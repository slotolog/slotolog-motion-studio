/**
 * "Büyük Kazanç Hikâyesi" module.
 *
 * The story (data fields, scenes, markers, script, subtitles) lives in project.story.
 * Scenes are turned into ordinary editor layers (video / placeholder / caption / voice)
 * by rebuildStory(), so preview, timeline, effects, audio mix and MP4 export are the
 * same systems as everywhere else in Motion Studio.
 */
import { uid, baseLayer, makeEffect, textLayer, particlesLayer } from './factory';
import type {
  Layer,
  Project,
  SceneKind,
  StoryData,
  StoryFieldKey,
  StoryScene,
  SubtitleCue,
  SubtitleStyle,
} from '../types';
import { projectSize } from '../types';

export const STORY_FIELDS: { key: StoryFieldKey; label: string; hint: string }[] = [
  { key: 'gameName', label: 'Oyun adı', hint: 'ör. Sweet Bonanza' },
  { key: 'betAmount', label: 'Başlangıç bahis tutarı', hint: 'ör. 20TL' },
  { key: 'freeSpinValue', label: 'Free Spin değeri', hint: 'ör. 2TL' },
  { key: 'totalWin', label: 'Toplam kazanç', hint: 'ör. 125.400TL' },
  { key: 'bonusAmount', label: 'Bonus miktarı', hint: 'ör. 100.000TL' },
  { key: 'freeSpinCount', label: 'Free Spin adedi', hint: 'ör. 450' },
  { key: 'campaignText', label: 'Kampanya açıklaması', hint: 'ör. Tüm yeni oyunculara' },
];
const FIELD_LABEL = Object.fromEntries(STORY_FIELDS.map((f) => [f.key, f.label])) as Record<StoryFieldKey, string>;

export const SCENE_KINDS: { kind: SceneKind; label: string }[] = [
  { kind: 'hook', label: '1 · Açılış (büyük kazanç anı)' },
  { kind: 'flashback', label: '2 · Geçmişe dönüş' },
  { kind: 'start', label: '3 · Oyunun başlangıcı / bonus' },
  { kind: 'rising', label: '4 · Kazancın yükseldiği anlar' },
  { kind: 'bigwin', label: '5 · Büyük kazanç' },
  { kind: 'outro', label: '6 · Kampanya ve kapanış' },
  { kind: 'custom', label: 'Serbest sahne' },
];

export const TRANSITIONS = [
  { value: 'cut', label: 'Kesme' },
  { value: 'fade', label: 'Yumuşak geçiş' },
  { value: 'zoom', label: 'Yakınlaşarak' },
  { value: 'slide', label: 'Kayarak' },
  { value: 'flash', label: 'Işık patlaması' },
  { value: 'rewind', label: 'Geri sarma (geçmişe dönüş)' },
] as const;

/** Fills {field} placeholders. Empty fields show a visible reminder, never an invented number. */
export function fillTemplate(text: string, fields?: Partial<Record<StoryFieldKey, string>>): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => {
    if (!fields || !(k in FIELD_LABEL)) return m;
    const v = fields[k as StoryFieldKey];
    return v && v.trim() ? v : `[${FIELD_LABEL[k as StoryFieldKey]}]`;
  });
}

export const usedFields = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).filter((k) => k in FIELD_LABEL) as StoryFieldKey[];

const clip0 = () => ({ in: 0, out: 0, speed: 1, zoom: 1, zoomX: 0.5, zoomY: 0.5, zoomAnimate: false, muted: true, volume: 1 });

export function makeScene(kind: SceneKind, partial: Partial<StoryScene> = {}): StoryScene {
  const d: Record<SceneKind, Partial<StoryScene>> = {
    hook: { title: 'Açılış', duration: 3, transition: 'flash', caption: '{totalWin}!' },
    flashback: { title: 'Peki nasıl başladı?', duration: 2.5, transition: 'rewind', caption: 'PEKİ NASIL BAŞLADI?', colorFilter: 'sepia' },
    start: { title: 'Başlangıç ve bonus', duration: 6, transition: 'fade', caption: '{gameName} · {betAmount} BAHİS' },
    rising: { title: 'Kazanç yükseliyor', duration: 7, transition: 'zoom', caption: 'KAZANÇ YÜKSELİYOR' },
    bigwin: { title: 'Büyük kazanç', duration: 6, transition: 'flash', caption: '{totalWin}' },
    outro: { title: 'Kampanya ve kapanış', duration: 5.5, transition: 'fade', caption: '' },
    custom: { title: 'Yeni sahne', duration: 3, transition: 'fade', caption: '' },
  };
  return {
    id: uid(),
    kind,
    title: 'Sahne',
    duration: 3,
    clip: clip0(),
    transition: 'fade',
    caption: '',
    voText: '',
    ...d[kind],
    ...partial,
  };
}

export const defaultSubtitleStyle = (): SubtitleStyle => ({
  fontSize: 58,
  color: '#FFFFFF',
  strokeColor: '#FF8E16',
  strokeWidth: 10,
  highlight: '#FFD23F',
  box: false,
});

export function defaultStory(): StoryData {
  return {
    fields: { gameName: '', betAmount: '', freeSpinValue: '', totalWin: '', bonusAmount: '100.000TL', freeSpinCount: '450', campaignText: 'TÜM YENİ OYUNCULARA' },
    scenes: (['hook', 'flashback', 'start', 'rising', 'bigwin', 'outro'] as SceneKind[]).map((k) => makeScene(k)),
    markers: [],
    script: '',
    wordsPerSecond: 2.6,
    subtitles: { enabled: true, mode: 'sentence', cues: [] },
    frameEnabled: true,
    // on by default: a written voice-over is not a real player's testimonial unless the user says so
    dramatization: { enabled: true, text: 'CANLANDIRMADIR' },
    narrationStyle: 'excited',
  };
}

export const sceneStarts = (story: StoryData) => {
  let t = 0;
  return story.scenes.map((s) => {
    const st = t;
    t += s.duration;
    return st;
  });
};
export const storyDuration = (story: StoryData) => story.scenes.reduce((a, s) => a + s.duration, 0);

export const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
export const estimateSpeech = (text: string, wps: number) => wordCount(text) / Math.max(0.5, wps);

export function splitSentences(text: string): string[] {
  return text
    .replace(/\n+/g, ' ')
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Speaking time of a text after its {field} placeholders are filled in. */
export const speechTime = (story: StoryData, text: string) => estimateSpeech(fillTemplate(text, story.fields), story.wordsPerSecond);

export interface SentenceTime {
  index: number;
  text: string;
  /** seconds from the scene start */
  start: number;
  end: number;
}

/**
 * Where each sentence of a scene's voice-over falls, relative to the scene start.
 * With a voice recording the sentences share its length; otherwise the estimated speaking time.
 * Timing is calculated, not recognised from the audio.
 */
export function sentenceTimes(story: StoryData, s: StoryScene): SentenceTime[] {
  const sentences = splitSentences(s.voText);
  if (!sentences.length) return [];
  const t0 = s.voice?.assetId ? s.voice.delay : 0.15;
  const total = s.voice?.assetId ? Math.max(0.1, s.voice.to - s.voice.from) : speechTime(story, s.voText);
  const weights = sentences.map((x) => fillTemplate(x, story.fields).length + 4);
  const sum = weights.reduce((a, b) => a + b, 0);
  let t = t0;
  return sentences.map((text, index) => {
    const d = (total * weights[index]) / sum;
    const r = { index, text, start: round2(t), end: round2(t + d) };
    t += d;
    return r;
  });
}

/** second inside the scene where the linked game moment appears */
export function hitTime(story: StoryData, s: StoryScene): number {
  if (s.anchorSentence !== undefined) {
    const st = sentenceTimes(story, s)[s.anchorSentence];
    if (st) return Math.min(s.duration, st.start + 0.15);
  }
  return s.hitAt ?? (s.voice?.assetId ? s.voice.delay + 0.2 : s.duration * 0.6);
}

/** Paragraphs (blank line or ---) go to the scenes in order. */
export function splitScriptToScenes(story: StoryData): StoryData {
  const parts = story.script
    .split(/\n\s*\n|^-{3,}$/m)
    .map((p) => p.trim())
    .filter(Boolean);
  const last = story.scenes.length - 1;
  const scenes = story.scenes.map((s, i) => ({ ...s, voText: i < last ? (parts[i] ?? '') : parts.slice(i).join(' ') }));
  return { ...story, scenes };
}

/** Scene durations follow the voice recording (or the estimated speaking time). */
export function fitScenesToVoice(story: StoryData, voiceDur: (assetId: string) => number | undefined): StoryData {
  return {
    ...story,
    scenes: story.scenes.map((s) => {
      if (s.voice?.assetId) {
        const len = Math.max(0.1, s.voice.to - s.voice.from);
        return { ...s, duration: round1(Math.max(1, s.voice.delay + len + 0.4)) };
      }
      if (s.voText.trim()) return { ...s, duration: round1(Math.max(1.5, speechTime(story, s.voText) + 0.6)) };
      void voiceDur;
      return s;
    }),
  };
}
const round1 = (x: number) => Math.round(x * 10) / 10;

/** Subtitles from the scene texts. Timing is calculated, not recognised from audio. */
export function generateSubtitles(story: StoryData, mode: 'sentence' | 'word'): SubtitleCue[] {
  const starts = sceneStarts(story);
  const cues: SubtitleCue[] = [];
  story.scenes.forEach((s, i) => {
    for (const st of sentenceTimes(story, s)) {
      const a = starts[i] + st.start;
      const b = Math.min(starts[i] + s.duration - 0.05, starts[i] + st.end);
      if (b <= a) continue;
      if (mode === 'sentence') {
        cues.push({ id: uid(), text: st.text, start: round2(a), end: round2(b) });
        continue;
      }
      const w = st.text.split(/\s+/).filter(Boolean);
      const chunks: string[] = [];
      for (let k = 0; k < w.length; k += 3) chunks.push(w.slice(k, k + 3).join(' '));
      const weights = chunks.map((c) => c.length + 2);
      const sum = weights.reduce((x, y) => x + y, 0);
      let t = a;
      chunks.forEach((c, k) => {
        const d = ((b - a) * weights[k]) / sum;
        cues.push({ id: uid(), text: c, start: round2(t), end: round2(t + d) });
        t += d;
      });
    }
  });
  return cues;
}
const round2 = (x: number) => Math.round(x * 100) / 100;

export interface StoryWarning {
  level: 'error' | 'warn';
  text: string;
  sceneId?: string;
}

/** Problems the user should know about before exporting. */
export function storyWarnings(p: Project): StoryWarning[] {
  const st = p.story;
  if (!st) return [];
  const out: StoryWarning[] = [];
  const starts = sceneStarts(st);
  const total = storyDuration(st);
  st.scenes.forEach((s, i) => {
    const name = `Sahne ${i + 1} (${s.title})`;
    const a = s.clip.assetId ? p.assets.find((x) => x.id === s.clip.assetId) : undefined;
    if (!s.clip.assetId && s.kind !== 'outro') out.push({ level: 'warn', text: `${name}: oyun kaydı seçilmedi (yer tutucu görünecek).`, sceneId: s.id });
    if (s.clip.assetId && !a) out.push({ level: 'error', text: `${name}: seçilen kayıt projede yok.`, sceneId: s.id });
    if (a) {
      const r = clipRange(p, s);
      if (a.duration !== undefined && r.in >= a.duration) out.push({ level: 'error', text: `${name}: başlangıç (${r.in.toFixed(1)} sn) kaydın sonundan sonra.`, sceneId: s.id });
      else if (a.duration !== undefined && r.in + s.duration * s.clip.speed > a.duration + 0.05)
        out.push({ level: 'warn', text: `${name}: kayıt sahne bitmeden bitiyor (${(a.duration - r.in) / s.clip.speed < 0 ? 0 : ((a.duration - r.in) / s.clip.speed).toFixed(1)} sn görüntü, sahne ${s.duration} sn).`, sceneId: s.id });
      if (!s.markerId && s.clip.out > 0 && (s.clip.out - s.clip.in) / s.clip.speed + 0.05 < s.duration)
        out.push({ level: 'warn', text: `${name}: seçilen aralık (${((s.clip.out - s.clip.in) / s.clip.speed).toFixed(1)} sn) sahneden kısa (${s.duration} sn); kalan kısımda kayıt devam eder.`, sceneId: s.id });
    }
    if (s.markerId && !st.markers.some((m) => m.id === s.markerId)) out.push({ level: 'error', text: `${name}: bağlı işaret silinmiş.`, sceneId: s.id });
    if (s.voice?.assetId) {
      const len = s.voice.to - s.voice.from;
      if (len <= 0) out.push({ level: 'error', text: `${name}: seslendirme parçasının bitişi başlangıçtan önce.`, sceneId: s.id });
      else if (s.voice.delay + len > s.duration + 0.05)
        out.push({ level: 'warn', text: `${name}: seslendirme (${(s.voice.delay + len).toFixed(1)} sn) sahneden uzun (${s.duration} sn) — sonraki sahneye taşar.`, sceneId: s.id });
    } else if (s.voText.trim()) {
      const est = speechTime(st, s.voText);
      if (est > s.duration) out.push({ level: 'warn', text: `${name}: metnin tahmini okunma süresi ${est.toFixed(1)} sn, sahne ${s.duration} sn.`, sceneId: s.id });
    }
    const cap = s.caption + ' ' + (s.kind === 'outro' ? '{bonusAmount} {freeSpinCount}' : '');
    usedFields(cap).forEach((k) => {
      if (!st.fields[k]?.trim()) out.push({ level: 'warn', text: `${name}: “${FIELD_LABEL[k]}” alanı boş.`, sceneId: s.id });
    });
    void starts;
  });
  // voice layers placed by hand
  p.layers
    .filter((l) => l.type === 'audio' && l.channel === 'voice' && !l.storyRole)
    .forEach((l) => {
      if ((l.start + l.duration) / p.fps > total + 0.05) out.push({ level: 'warn', text: `Seslendirme “${l.name}” videonun sonundan sonra bitiyor.` });
    });
  st.scenes.forEach((s, i) => {
    if (/\[[^\]]+\]/.test(s.voText)) out.push({ level: 'warn', text: `Sahne ${i + 1} (${s.title}): metinde doldurulmamış [ ] alanı var — ekranda gerçekten olanı yaz.`, sceneId: s.id });
    if (s.anchorSentence !== undefined && !sentenceTimes(st, s)[s.anchorSentence])
      out.push({ level: 'warn', text: `Sahne ${i + 1} (${s.title}): oyun anına bağlı cümle artık yok (metin değişti).`, sceneId: s.id });
  });
  const lastCue = st.subtitles.cues.reduce((a, c) => Math.max(a, c.end), 0);
  if (st.subtitles.enabled && lastCue > total + 0.05) out.push({ level: 'warn', text: 'Bazı altyazılar videonun sonundan sonra.' });
  if (st.dramatization.enabled === false && st.script.trim() && /\b(ben|kazandım|oynadım)\b/i.test(st.script))
    out.push({ level: 'warn', text: 'Metin birinci ağızdan; gerçek oyuncu sözü değilse “Canlandırma” etiketini aç.' });
  return out;
}

/** Source range of a scene's clip (marker-linked scenes are placed around the marker). */
export function clipRange(p: Project, s: StoryScene): { in: number; out: number } {
  const m = s.markerId ? p.story?.markers.find((x) => x.id === s.markerId) : undefined;
  if (m) {
    const hit = p.story ? hitTime(p.story, s) : (s.hitAt ?? s.duration * 0.6);
    const inn = Math.max(0, m.time - hit * s.clip.speed);
    return { in: inn, out: inn + s.duration * s.clip.speed };
  }
  return { in: s.clip.in, out: s.clip.out > s.clip.in ? s.clip.out : s.clip.in + s.duration * s.clip.speed };
}

const TRANSITION_IN = 0.45;

function transitionFor(l: Layer, s: StoryScene, fps: number) {
  const f = Math.round(TRANSITION_IN * fps);
  switch (s.transition) {
    case 'fade':
      l.keyframes = { ...l.keyframes, opacity: [{ frame: 0, value: 0, easing: 'easeOut' }, { frame: f, value: 1, easing: 'linear' }] };
      break;
    case 'zoom':
      l.keyframes = {
        ...l.keyframes,
        scale: [{ frame: 0, value: 1.25, easing: 'easeOut' }, { frame: f, value: 1, easing: 'linear' }],
        opacity: [{ frame: 0, value: 0, easing: 'easeOut' }, { frame: Math.round(f / 2), value: 1, easing: 'linear' }],
      };
      break;
    case 'slide':
      l.effects.push(makeEffect('flyIn', fps, { direction: 'right', duration: f, intensity: 0.5 }));
      break;
    case 'flash':
      l.effects.push(makeEffect('flash', fps, { duration: Math.round(0.6 * fps), color: '#FFFFFF', intensity: 1 }));
      break;
    case 'rewind':
      l.effects.push(
        makeEffect('impactShake', fps, { duration: Math.round(0.5 * fps), intensity: 0.5, syncToMusic: false }),
        makeEffect('flash', fps, { duration: Math.round(0.5 * fps), color: '#FFFFFF', intensity: 0.8 }),
      );
      break;
  }
}

/** Video window of the frame (or the full screen when the frame is off). */
export function videoWindow(p: Project) {
  const { width, height } = projectSize(p);
  const fr = p.layers.find((l) => l.type === 'frame' && l.frame);
  if (p.story?.frameEnabled !== false && fr?.frame) return fr.frame.window;
  return { x: width / 2, y: height / 2, w: width, h: height };
}

/** Rebuilds the scene layers from project.story; everything else stays untouched. */
export function rebuildStory(p: Project): Project {
  const st = p.story;
  if (!st) return p;
  const fps = p.fps;
  const total = Math.max(1, Math.round(storyDuration(st) * fps));
  const win = videoWindow(p);
  const starts = sceneStarts(st);
  const proj: Project = { ...p, durationInFrames: total };
  const gen: Layer[] = [];
  const voice: Layer[] = [];
  const captions: Layer[] = [];
  const ov = st.layerOverrides ?? {};
  /** stable id + slot so the selection and the user's edits survive rebuilds */
  const fin = (l: Layer, sceneId: string, part: string): Layer => {
    const slot = `${sceneId}:${part}`;
    return applyOverride({ ...l, id: `st-${slot}`, storySlot: slot, storySceneId: sceneId, storyRole: 'scene' }, ov[slot]);
  };
  st.scenes.forEach((s, i) => {
    const start = Math.round(starts[i] * fps);
    const dur = Math.max(1, Math.round(starts[i] * fps + s.duration * fps) - start);
    const common = { start, duration: dur, x: win.x, y: win.y, width: win.w, height: win.h, storyRole: 'scene' as const, storySceneId: s.id };
    const a = s.clip.assetId ? p.assets.find((x) => x.id === s.clip.assetId) : undefined;
    let main: Layer | null = null;
    if (a && a.kind === 'video') {
      const r = clipRange(p, s);
      main = baseLayer(
        {
          ...common,
          type: 'video',
          name: `${i + 1}. ${s.title} (kayıt)`,
          assetId: a.id,
          objectFit: 'cover',
          trimStart: r.in,
          playbackRate: s.clip.speed,
          muted: s.clip.muted,
          volume: s.clip.volume,
          mediaZoom: { scale: s.clip.zoom, x: s.clip.zoomX, y: s.clip.zoomY, animate: s.clip.zoomAnimate },
          colorFilter: s.colorFilter,
        },
        proj,
      );
    } else if (s.kind !== 'outro') {
      main = baseLayer(
        {
          ...common,
          type: 'placeholder',
          name: `${i + 1}. ${s.title} (kayıt yeri)`,
          text: { text: `OYUN KAYDI\n${i + 1}. ${s.title}\nHikâye Stüdyosu › Sahneler`, fontSize: 44, style: 'white', color: '#fff', strokeColor: '#000', strokeWidth: 0, extrude: false, italic: false },
        },
        proj,
      );
    }
    if (main) {
      transitionFor(main, s, fps);
      gen.push(fin(main, s.id, 'clip'));
    }
    if (s.kind === 'outro' && !a) {
      // campaign card inside the video window
      const mk = (tpl: string, y: number, fs: number, style: 'gold' | 'white', delay: number) => {
        const l = textLayer(proj, { text: tpl, fontSize: fs, style, strokeColor: '#5A1500', strokeWidth: Math.round(fs / 11), extrude: true, italic: style === 'gold' }, {
          ...common,
          start: start + Math.round(delay * fps),
          duration: Math.max(1, dur - Math.round(delay * fps)),
          y,
          width: win.w * 0.96,
          height: fs * 1.4,
          name: `${i + 1}. Kapanış: ${tpl}`,
          textTemplate: tpl,
        });
        l.effects = [makeEffect('impact', fps, { duration: Math.round(0.5 * fps), intensity: 0.15 }), makeEffect('pulse', fps, { start: Math.round(0.5 * fps), duration: dur, speed: 0.6, intensity: 0.2 })];
        return l;
      };
      gen.push(
        fin(mk('HOŞ GELDİN BONUSU', win.y - win.h * 0.22, 70, 'white', 0), s.id, 'outro0'),
        fin(mk('{bonusAmount}', win.y - win.h * 0.05, 150, 'gold', 0.2), s.id, 'outro1'),
        fin(mk('+ {freeSpinCount} FREE SPIN', win.y + win.h * 0.11, 92, 'gold', 0.4), s.id, 'outro2'),
      );
    }
    if (s.caption.trim()) {
      const big = s.kind === 'bigwin' || s.kind === 'hook';
      const fs = big ? 128 : 66;
      const cap = textLayer(
        proj,
        { text: s.caption, fontSize: fs, style: big ? 'gold' : 'white', strokeColor: big ? '#5A1500' : '#B34700', strokeWidth: big ? 12 : 9, extrude: true, italic: big },
        {
          ...common,
          y: big ? win.y - win.h * 0.08 : win.y - win.h / 2 + 110,
          width: win.w * 0.96,
          height: fs * 1.5,
          name: `${i + 1}. Başlık: ${s.caption}`,
          textTemplate: s.caption,
        },
      );
      cap.effects = big
        ? [makeEffect('impact', fps, { duration: Math.round(0.6 * fps), intensity: 0.2 }), makeEffect('pulse', fps, { start: Math.round(0.6 * fps), duration: dur, speed: 0.7, intensity: 0.25 }), makeEffect('glow', fps, { start: Math.round(0.6 * fps), duration: dur, color: '#FFE27A', intensity: 0.5 })]
        : [makeEffect('flyIn', fps, { direction: 'left', duration: Math.round(0.5 * fps), intensity: 0.4 })];
      captions.push(fin(cap, s.id, 'caption'));
    }
    if (s.kind === 'bigwin' || s.kind === 'hook') {
      const hitSec = s.markerId ? hitTime(st, s) : 0;
      const b = particlesLayer(proj, { kind: 'burst', count: 34, speed: 1, size: 40, seed: 5 + i }, `${i + 1}. Altın patlaması`, {
        ...common,
        start: start + Math.round(hitSec * fps),
        duration: Math.max(1, Math.min(dur - Math.round(hitSec * fps), Math.round(2.6 * fps))),
      });
      b.particles!.seed = 5 + i;
      captions.push(fin(b, s.id, 'burst'));
    }
    if (s.voice?.assetId) {
      const len = Math.max(0.1, s.voice.to - s.voice.from);
      voice.push(
        fin(baseLayer(
          {
            type: 'audio',
            name: `${i + 1}. Seslendirme`,
            assetId: s.voice.assetId,
            start: start + Math.round(s.voice.delay * fps),
            duration: Math.max(1, Math.round(len * fps)),
            trimStart: s.voice.from,
            channel: 'voice',
            volume: 1,
            storyRole: 'scene',
            storySceneId: s.id,
          },
          proj,
        ), s.id, 'voice'),
      );
    }
  });

  const keep = p.layers.filter((l) => l.storyRole !== 'scene');
  // scene video goes right under the frame canvas, captions right under the subtitles
  const frameIdx = keep.findIndex((l) => l.type === 'frame');
  const out = [...keep];
  out.splice(frameIdx >= 0 ? frameIdx : Math.min(1, out.length), 0, ...gen);
  const subIdx = out.findIndex((l) => l.storyRole === 'subtitles');
  out.splice(subIdx >= 0 ? subIdx : out.length, 0, ...captions);
  out.push(...voice);
  return {
    ...proj,
    layers: out.map((l) => {
      if (l.storyRole === 'frame') return { ...l, visible: st.frameEnabled, duration: total };
      if (l.storyRole === 'subtitles') return { ...l, visible: st.subtitles.enabled, duration: total, y: win.y + win.h / 2 - 150 };
      if (l.storyRole === 'label') return { ...l, visible: st.dramatization.enabled, textTemplate: undefined, text: l.text ? { ...l.text, text: st.dramatization.text } : l.text, duration: total };
      if (l.storyRole === 'chrome' || (!l.storyRole && (l.type === 'background' || l.type === 'particles') && l.start === 0)) return { ...l, duration: Math.max(1, total - l.start) };
      return l;
    }),
  };
}

/* ---------------- persistent edits of story layers ---------------- */

/** Properties of a story layer that the user may change and that survive rebuilds. */
export const OVERRIDE_KEYS = [
  'x', 'y', 'width', 'height', 'rotation', 'scale', 'opacity', 'visible', 'locked', 'keyframes', 'effects',
  'shadow', 'motionBlur', 'depth', 'startSound', 'startSoundVolume', 'objectFit', 'button', 'particles', 'name', 'background', 'fadeIn', 'fadeOut',
] as const;
/** text appearance (the words themselves come from the scene) */
const TEXT_STYLE_KEYS = ['fontSize', 'style', 'color', 'strokeColor', 'strokeWidth', 'extrude', 'italic'] as const;

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function applyOverride(l: Layer, o?: Partial<Layer>): Layer {
  if (!o) return l;
  const { text, ...rest } = o;
  const out: Layer = { ...l, ...rest };
  if (text && l.text) out.text = { ...l.text, ...Object.fromEntries(TEXT_STYLE_KEYS.filter((k) => k in text).map((k) => [k, text[k]])) };
  return out;
}

/**
 * Compares story layers before / after an edit and records what the user changed,
 * so the next rebuild (script, timing, data changes) keeps it.
 * A changed caption text goes back into the scene.
 */
export function captureOverrides(prev: Project, next: Project): Project {
  const st = next.story;
  if (!st) return next;
  const before = new Map(prev.layers.filter((l) => l.storySlot).map((l) => [l.id, l]));
  let overrides = st.layerOverrides ?? {};
  let scenes = st.scenes;
  let changed = false;
  for (const l of next.layers) {
    if (!l.storySlot) continue;
    const p = before.get(l.id);
    if (!p || p === l) continue;
    const o: Partial<Layer> = { ...(overrides[l.storySlot] ?? {}) };
    let touched = false;
    for (const k of OVERRIDE_KEYS) {
      if (!same(p[k], l[k])) {
        (o as Record<string, unknown>)[k] = structuredClone(l[k]);
        touched = true;
      }
    }
    if (p.text && l.text) {
      const ts: Record<string, unknown> = { ...((o.text as unknown as Record<string, unknown>) ?? {}) };
      for (const k of TEXT_STYLE_KEYS) if (p.text[k] !== l.text[k]) ((ts[k] = l.text[k]), (touched = true));
      if (Object.keys(ts).length) o.text = ts as unknown as Layer['text'];
      const newText = l.textTemplate ?? l.text.text;
      const oldText = p.textTemplate ?? p.text.text;
      if (newText !== oldText && l.storySlot.endsWith(':caption')) {
        scenes = scenes.map((s) => (s.id === l.storySceneId ? { ...s, caption: newText } : s));
        changed = true;
      }
    }
    if (touched) {
      overrides = { ...overrides, [l.storySlot]: o };
      changed = true;
    }
  }
  return changed ? { ...next, story: { ...st, layerOverrides: overrides, scenes } } : next;
}

export const SLOT_LABELS: Record<string, string> = {
  clip: 'Oyun kaydı',
  caption: 'Ekran yazısı',
  burst: 'Altın patlaması',
  outro0: 'Kapanış yazısı 1',
  outro1: 'Kapanış yazısı 2',
  outro2: 'Kapanış yazısı 3',
  voice: 'Seslendirme',
};
