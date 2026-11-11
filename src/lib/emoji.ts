import { renderMediaOnWeb } from '@remotion/web-renderer';
import { ALL_FORMATS, BlobSource, CanvasSink, EncodedPacketSink, Input } from 'mediabunny';
import { GIFEncoder, applyPalette, quantize } from 'gifenc';
import { zipSync } from 'fflate';
import { MainComposition } from '../remotion/Main';
import { getLicenseKey } from './export';
import { ensureFonts } from './fonts';
import { projectSize, type Project } from '../types';

/** Telegram özel video emoji kuralları */
export const TG = { size: 100, maxSeconds: 3, maxFps: 30, maxBytes: 256 * 1024 } as const;

/** bitrates tried in order until the file fits in 256 KB (bits per second) */
const BITRATES = [600_000, 420_000, 300_000, 210_000, 150_000, 100_000];

export interface TgCheck {
  key: string;
  label: string;
  ok: boolean;
  value: string;
}
export interface TgReport {
  ok: boolean;
  bytes: number;
  checks: TgCheck[];
  /** mean colour / alpha difference between the last and the first frame vs. an average frame step */
  loopSeam?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** renders a project as a transparent 100×100 VP9 WEBM (no audio). Lowers the bitrate step by step if it is over 256 KB. */
export async function exportEmojiWebm(
  project: Project,
  assetUrls: Record<string, string>,
  opts: { signal?: AbortSignal; onProgress?: (p: number, note: string) => void } = {},
): Promise<{ blob: Blob; report: TgReport; bitrate: number; attempts: number }> {
  await ensureFonts();
  const { width, height } = projectSize(project);
  const out = project.emoji?.outSize ?? TG.size;
  let last: { blob: Blob; report: TgReport; bitrate: number; attempts: number } | null = null;
  for (let i = 0; i < BITRATES.length; i++) {
    const bitrate = BITRATES[i];
    opts.onProgress?.(0, i ? `${Math.round(bitrate / 1000)} kbps ile yeniden kodlanıyor (256 KB sınırı)` : 'VP9 kodlanıyor');
    const result = await renderMediaOnWeb({
      composition: {
        id: 'slotolog-emoji',
        component: MainComposition,
        width,
        height,
        fps: project.fps,
        durationInFrames: project.durationInFrames,
        defaultProps: { project, assetUrls },
      },
      inputProps: { project, assetUrls },
      container: 'webm',
      videoCodec: 'vp9',
      transparent: true,
      muted: true,
      scale: out / width,
      videoBitrate: bitrate,
      keyframeIntervalInSeconds: 3,
      signal: opts.signal ?? null,
      licenseKey: getLicenseKey(),
      onProgress: (p) => opts.onProgress?.(p.progress, i ? `${Math.round(bitrate / 1000)} kbps` : 'VP9'),
    });
    const blob = await result.getBlob();
    const report = await checkTelegramWebm(blob, project);
    last = { blob, report, bitrate, attempts: i + 1 };
    if (blob.size <= TG.maxBytes) return last;
    await sleep(10);
  }
  return last!;
}

async function readHead(blob: Blob, n: number) {
  return new Uint8Array(await blob.slice(0, n).arrayBuffer());
}

/** decodes the WEBM with its alpha channel (RGBA canvases, 100×100) */
export async function decodeFrames(blob: Blob, limit = 200): Promise<{ canvases: HTMLCanvasElement[]; times: number[] }> {
  const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
  const track = await input.getPrimaryVideoTrack();
  if (!track) return { canvases: [], times: [] };
  const sink = new CanvasSink(track, { alpha: true, poolSize: 0 });
  const canvases: HTMLCanvasElement[] = [];
  const times: number[] = [];
  for await (const w of sink.canvases()) {
    const c = document.createElement('canvas');
    c.width = w.canvas.width;
    c.height = w.canvas.height;
    c.getContext('2d')!.drawImage(w.canvas as CanvasImageSource, 0, 0);
    canvases.push(c);
    times.push(w.timestamp);
    if (canvases.length >= limit) break;
  }
  return { canvases, times };
}

const pixels = (c: HTMLCanvasElement) => c.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, c.width, c.height).data;

function frameDiff(a: Uint8ClampedArray, b: Uint8ClampedArray) {
  let d = 0;
  for (let i = 0; i < a.length; i++) d += Math.abs(a[i] - b[i]);
  return d / a.length;
}

/** Telegram uyumluluk kontrolü — hepsi dosyanın kendisinden okunur */
export async function checkTelegramWebm(blob: Blob, project?: Project): Promise<TgReport> {
  const checks: TgCheck[] = [];
  const add = (key: string, label: string, ok: boolean, value: string) => checks.push({ key, label, ok, value });
  const head = await readHead(blob, 64);
  const ebml = head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3;
  const docWebm = new TextDecoder('latin1').decode(head).includes('webm');
  add('container', 'Kapsayıcı WEBM (EBML başlığı)', ebml && docWebm, ebml ? (docWebm ? 'webm' : 'matroska') : 'WEBM değil');
  const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
  const video = await input.getPrimaryVideoTrack();
  const audio = await input.getPrimaryAudioTrack();
  if (!video) {
    add('video', 'Görüntü izi', false, 'yok');
    return { ok: false, bytes: blob.size, checks };
  }
  add('codec', 'Codec VP9', video.codec === 'vp9', String(video.codec));
  add('size', 'Boyut 100×100', video.displayWidth === TG.size && video.displayHeight === TG.size, `${video.displayWidth}×${video.displayHeight}`);
  const duration = await input.computeDuration();
  add('duration', 'Süre ≤ 3 sn', duration <= TG.maxSeconds + 0.001, `${duration.toFixed(2)} sn`);
  const stats = await video.computePacketStats();
  const fps = stats.packetCount / Math.max(0.001, duration);
  add('fps', 'Kare hızı ≤ 30 FPS', fps <= TG.maxFps + 0.5, `${fps.toFixed(1)} FPS · ${stats.packetCount} kare`);
  add('bytes', 'Dosya ≤ 256 KB', blob.size <= TG.maxBytes, `${(blob.size / 1024).toFixed(1)} KB`);
  add('audio', 'Ses izi yok', !audio, audio ? 'ses izi var' : 'yok');
  // alpha: side data in packets + decoded pixels really transparent
  let alphaPackets = 0;
  const ps = new EncodedPacketSink(video);
  for await (const pk of ps.packets()) if ((pk.sideData.alphaByteLength ?? pk.sideData.alpha?.byteLength ?? 0) > 0) alphaPackets++;
  const { canvases } = await decodeFrames(blob);
  let transparentShare = 0;
  let opaqueShare = 0;
  let loopSeam: number | undefined;
  let edge = 0;
  if (canvases.length) {
    const px = canvases.map(pixels);
    // outer 2-px ring: should be fully transparent, otherwise the emoji shows as a box in the chat
    const w = canvases[0].width;
    const h = canvases[0].height;
    let ring = 0;
    let hit = 0;
    for (const d of px)
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          if (x > 1 && y > 1 && x < w - 2 && y < h - 2) continue;
          ring++;
          if (d[(y * w + x) * 4 + 3] > 24) hit++;
        }
    edge = hit / Math.max(1, ring);
    let t = 0;
    let o = 0;
    let n = 0;
    for (const d of px)
      for (let i = 3; i < d.length; i += 4) {
        n++;
        if (d[i] < 8) t++;
        else if (d[i] > 247) o++;
      }
    transparentShare = t / n;
    opaqueShare = o / n;
    if (px.length > 2) {
      const steps: number[] = [];
      for (let i = 1; i < px.length; i++) steps.push(frameDiff(px[i - 1], px[i]));
      const avg = steps.reduce((a, b) => a + b, 0) / steps.length;
      loopSeam = frameDiff(px[px.length - 1], px[0]) / Math.max(0.01, avg);
    }
  }
  add(
    'alpha',
    'Şeffaf arka plan (alfa kanalı)',
    alphaPackets > 0 && transparentShare > 0.05 && opaqueShare > 0.01,
    `${alphaPackets}/${stats.packetCount} karede alfa verisi · piksellerin %${Math.round(transparentShare * 100)}’i tam şeffaf`,
  );
  const strip = !!project?.emoji?.strip;
  add(
    'edges',
    'Kenarlar şeffaf (sohbette kutu görünmez)',
    strip || edge <= 0.01,
    strip ? `şerit parçası: logo komşu emojiye bilerek uzanıyor (kenarın %${Math.round(edge * 100)}’i dolu)` : `kenar piksellerinin %${(edge * 100).toFixed(1)}’i dolu`,
  );
  if (loopSeam !== undefined)
    add('loop', 'Kesintisiz döngü (son kare → ilk kare)', loopSeam <= 2.5, `geçiş farkı ortalama kare adımının ${loopSeam.toFixed(2)} katı`);
  if (project) add('frames', 'Proje süresi ≤ 90 kare', project.durationInFrames <= TG.maxSeconds * project.fps && project.fps <= TG.maxFps, `${project.durationInFrames} kare @ ${project.fps} FPS`);
  return { ok: checks.every((c) => c.ok), bytes: blob.size, checks, loopSeam };
}

/** first frame as a transparent PNG */
export async function pngPreview(blob: Blob, at = 0.5): Promise<Blob> {
  const { canvases } = await decodeFrames(blob);
  const c = canvases[Math.min(canvases.length - 1, Math.floor(canvases.length * at))];
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('PNG oluşturulamadı'))), 'image/png'));
}

/** animated GIF preview from the decoded WEBM (1-bit transparency, as GIF allows) */
export async function gifPreview(blob: Blob, fps = 30, size = 100): Promise<Blob> {
  const { canvases } = await decodeFrames(blob);
  const gif = GIFEncoder();
  const delay = Math.round(1000 / fps);
  for (const src of canvases) {
    let c = src;
    if (size !== src.width) {
      c = document.createElement('canvas');
      c.width = size;
      c.height = size;
      const g = c.getContext('2d')!;
      g.imageSmoothingQuality = 'high';
      g.drawImage(src, 0, 0, size, size);
    }
    const data = pixels(c);
    const palette = quantize(data, 255, { format: 'rgba4444', oneBitAlpha: true, clearAlpha: true, clearAlphaThreshold: 100 });
    const index = applyPalette(data, palette, 'rgba4444');
    const tIndex = palette.findIndex((p) => p[3] === 0);
    gif.writeFrame(index, c.width, c.height, { palette, delay, transparent: tIndex >= 0, transparentIndex: Math.max(0, tIndex), dispose: 2, repeat: 0 });
  }
  gif.finish();
  return new Blob([gif.bytes() as BlobPart], { type: 'image/gif' });
}

export async function zipFiles(files: { name: string; blob: Blob }[]): Promise<Blob> {
  const entries: Record<string, Uint8Array> = {};
  for (const f of files) entries[f.name] = new Uint8Array(await f.blob.arrayBuffer());
  return new Blob([zipSync(entries, { level: 0 }) as BlobPart], { type: 'application/zip' });
}

export const emojiFileName = (p: Project, ext = 'webm') =>
  `${(p.name.replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '') || 'slotolog-emoji').slice(0, 60)}_100x100.${ext}`;
