import { canRenderMediaOnWeb, renderMediaOnWeb, type WebRendererQuality } from '@remotion/web-renderer';
import { ALL_FORMATS, BlobSource, Input } from 'mediabunny';
import { MainComposition } from '../remotion/Main';
import { ensureFonts } from './fonts';
import type { Project } from '../types';
import { projectSize } from '../types';

export const LICENSE_KEY_STORAGE = 'slotolog:remotionLicense';
export const getLicenseKey = () => localStorage.getItem(LICENSE_KEY_STORAGE) || 'free-license';

export function projectHasAudio(p: Project) {
  return p.layers.some(
    (l) =>
      l.visible &&
      ((!l.muted && (l.type === 'audio' || l.type === 'video') && !!l.assetId) || !!l.startSound || l.effects.some((e) => !!e.sound)),
  );
}

export async function checkExportSupport(p: Project) {
  const { width, height } = projectSize(p);
  return canRenderMediaOnWeb({ width, height, container: 'mp4', videoCodec: 'h264', muted: !projectHasAudio(p) });
}

export async function exportMp4(
  project: Project,
  assetUrls: Record<string, string>,
  opts: { quality: WebRendererQuality; signal: AbortSignal; onProgress: (p: number, etaMs: number) => void },
): Promise<Blob> {
  await ensureFonts();
  const { width, height } = projectSize(project);
  const muted = !projectHasAudio(project);
  const result = await renderMediaOnWeb({
    composition: {
      id: 'slotolog',
      component: MainComposition,
      width,
      height,
      fps: project.fps,
      durationInFrames: project.durationInFrames,
      defaultProps: { project, assetUrls },
    },
    inputProps: { project, assetUrls },
    container: 'mp4',
    videoCodec: 'h264',
    muted,
    // always render at the composition's full size (1080×1920 etc.), never a preview scale
    scale: 1,
    videoBitrate: opts.quality,
    signal: opts.signal,
    licenseKey: getLicenseKey(),
    onProgress: (p) => opts.onProgress(p.progress, p.renderEstimatedTime),
  });
  return result.getBlob();
}

export interface ExportCheck {
  width: number;
  height: number;
  frames: number;
  duration: number;
  hasAudio: boolean;
  expected: { width: number; height: number; frames: number; duration: number };
  ok: boolean;
  problems: string[];
}

/** Reads the finished MP4 back and checks resolution, frame count and duration. */
export async function verifyMp4(blob: Blob, project: Project): Promise<ExportCheck> {
  const { width, height } = projectSize(project);
  const expected = { width, height, frames: project.durationInFrames, duration: project.durationInFrames / project.fps };
  const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
  const video = await input.getPrimaryVideoTrack();
  const audio = await input.getPrimaryAudioTrack();
  const problems: string[] = [];
  if (!video) return { width: 0, height: 0, frames: 0, duration: 0, hasAudio: !!audio, expected, ok: false, problems: ['Videoda görüntü izi yok'] };
  const stats = await video.computePacketStats();
  const duration = await input.computeDuration();
  const res = { width: video.displayWidth, height: video.displayHeight, frames: stats.packetCount, duration, hasAudio: !!audio };
  if (res.width !== width || res.height !== height) problems.push(`Çözünürlük ${res.width}×${res.height} (beklenen ${width}×${height})`);
  if (Math.abs(res.frames - expected.frames) > 1) problems.push(`${res.frames} kare (beklenen ${expected.frames})`);
  if (Math.abs(duration - expected.duration) > 0.15) problems.push(`Süre ${duration.toFixed(2)} sn (beklenen ${expected.duration.toFixed(2)})`);
  if (projectHasAudio(project) && !audio) problems.push('Ses izi eksik');
  return { ...res, expected, ok: problems.length === 0, problems };
}
