import type { Project, ProjectAudio } from '../types';

export const defaultAudio = (): ProjectAudio => ({
  musicVolume: 1,
  sfxVolume: 0.8,
  musicMuted: false,
  sfxMuted: false,
  syncEnabled: true,
  sections: [],
});

export const projectAudio = (p: Project): ProjectAudio => ({ ...defaultAudio(), ...(p.audio ?? {}) });

/** Beat timeline of the project's music, in composition seconds. */
export interface MusicSync {
  beats: number[];
  strengths: number[];
  /** beats whose strength is in the top part of the song */
  strong: number[];
  sections: ProjectAudio['sections'];
}

/** Collects the analysed beats of all visible music layers, mapped to composition time. */
export function buildMusicSync(p: Project): MusicSync | null {
  const audio = projectAudio(p);
  if (!audio.syncEnabled || audio.musicMuted) return null;
  const beats: { t: number; s: number }[] = [];
  for (const l of p.layers) {
    if (!l.visible || l.type !== 'audio' || (l.channel ?? 'music') !== 'music' || !l.assetId) continue;
    const a = p.assets.find((x) => x.id === l.assetId);
    if (!a?.analysis) continue;
    const start = l.start / p.fps;
    const end = (l.start + l.duration) / p.fps;
    const trim = l.trimStart ?? 0;
    a.analysis.beats.forEach((b, i) => {
      const t = start + b - trim;
      if (t >= start && t <= end) beats.push({ t, s: a.analysis!.strengths[i] ?? 0.5 });
    });
  }
  if (beats.length < 2) return null;
  beats.sort((x, y) => x.t - y.t);
  const sorted = beats.map((b) => b.s).sort((x, y) => x - y);
  const thr = sorted[Math.floor(sorted.length * 0.8)] ?? 1;
  return {
    beats: beats.map((b) => b.t),
    strengths: beats.map((b) => b.s),
    strong: beats.filter((b) => b.s >= thr).map((b) => b.t),
    sections: audio.sections,
  };
}

/** index of the last beat at or before t (-1 if none) */
function lastIndex(arr: number[], t: number) {
  let lo = 0;
  let hi = arr.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

/** continuous beat counter: 3.5 = halfway between the 4th and 5th beat */
export function beatPosition(m: MusicSync, t: number): number {
  const i = lastIndex(m.beats, t);
  if (i < 0) return (t - m.beats[0]) / Math.max(0.2, m.beats[1] - m.beats[0]);
  if (i >= m.beats.length - 1) {
    const p = m.beats[i] - m.beats[i - 1];
    return i + (t - m.beats[i]) / Math.max(0.2, p);
  }
  return i + (t - m.beats[i]) / Math.max(0.05, m.beats[i + 1] - m.beats[i]);
}

/** seconds since the last beat and that beat's strength */
export function sinceBeat(m: MusicSync, t: number): { dt: number; strength: number } | null {
  const i = lastIndex(m.beats, t);
  if (i < 0) return null;
  return { dt: t - m.beats[i], strength: m.strengths[i] };
}

export function strongBeatsBetween(m: MusicSync, from: number, to: number): number[] {
  return m.strong.filter((b) => b >= from && b <= to);
}

export function boostAt(m: MusicSync | null, t: number): number {
  if (!m) return 1;
  const s = m.sections.find((x) => t >= x.start && t <= x.end);
  return s ? s.boost : 1;
}
