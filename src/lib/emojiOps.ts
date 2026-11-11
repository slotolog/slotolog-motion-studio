import { uid } from './factory';
import { DEFAULT_REEL, reelMinFrames } from './reel';
import type { Effect, EffectType, Layer, Project, ReelAssemble } from '../types';
import { TG } from './emoji';

/**
 * Seconds per cycle of each looping effect at speed 1 (from anim.ts). With these the loop fixer picks
 * speeds that finish a whole number of cycles in the emoji's duration, so the last frame flows into the first.
 */
const PERIOD: Partial<Record<EffectType, (e: Effect) => number>> = {
  pulse: () => 1,
  glow: () => 1,
  bounce: () => 0.5,
  dance: () => 2,
  sway: () => 1 / 0.8,
  float: () => 2 / 0.35,
  shine: () => 2.6,
  bouncePro: () => 0.75,
  smoothRotate: () => 3,
  coinFlip: () => 3,
  dancePro: () => 1 / 0.9,
  spin: (e) => 1 / (0.75 * Math.max(0.1, e.intensity)),
};

/** effects that can not loop seamlessly (random / one-shot); they are reported, never changed */
const NOT_LOOPING: EffectType[] = ['shake', 'flyIn', 'impact', 'impactShake', 'goldExplosion', 'cameraZoom'];

export interface LoopFix {
  project: Project;
  changed: string[];
  warnings: string[];
}

/** makes every periodic effect / keyframe track close the loop (last frame → first frame) */
export function fitToLoop(p: Project): LoopFix {
  const T = p.durationInFrames / p.fps;
  const changed: string[] = [];
  const warnings: string[] = [];
  const layers = p.layers.map((l) => {
    const effects = l.effects.map((e) => {
      const endsInside = e.start > 0 || e.start + e.duration < l.duration - 1;
      const per = PERIOD[e.type];
      if (NOT_LOOPING.includes(e.type) && !endsInside) warnings.push(`“${l.name}”: ${e.type} efekti döngü sınırında atlama yapabilir`);
      if (!per || endsInside) return e;
      const c = per(e);
      const n = Math.max(1, Math.round((T * e.speed) / c));
      const speed = Math.round(((n * c) / T) * 10000) / 10000;
      if (Math.abs(speed - e.speed) > 1e-4) changed.push(`“${l.name}” · ${e.type}: hız ${e.speed.toFixed(3)} → ${speed} (${n} tur)`);
      return { ...e, speed };
    });
    const keyframes = { ...l.keyframes };
    for (const [prop, list] of Object.entries(keyframes)) {
      if (!list || list.length < 2) continue;
      const first = list[0];
      const last = list[list.length - 1];
      const end = l.duration - 1;
      if (first.frame === 0 && (last.frame < end || Math.abs(last.value - first.value) > 1e-6)) {
        const rest = list.filter((k) => k.frame < end);
        keyframes[prop as keyof typeof keyframes] = [...rest, { frame: end, value: first.value, easing: last.easing }];
        changed.push(`“${l.name}” · ${prop} keyframe’i başa bağlandı`);
      }
    }
    return { ...l, effects, keyframes };
  });
  return { project: { ...p, layers }, changed, warnings };
}

/** changes the animation speed: the loop gets shorter / longer (max 3 s), everything is rescaled */
export function setEmojiSpeed(p: Project, factor: number): Project {
  const maxF = TG.maxSeconds * p.fps;
  const newDur = Math.max(15, Math.min(maxF, Math.round(p.durationInFrames / factor)));
  const k = newDur / p.durationInFrames;
  const f = (v: number) => Math.round(v * k);
  const layers = p.layers.map((l) => ({
    ...l,
    start: f(l.start),
    duration: Math.max(1, Math.min(newDur - f(l.start), f(l.duration))),
    effects: l.effects.map((e) => ({ ...e, start: f(e.start), duration: Math.max(1, f(e.duration)), speed: e.speed / k })),
    keyframes: Object.fromEntries(Object.entries(l.keyframes).map(([prop, list]) => [prop, list?.map((q) => ({ ...q, frame: f(q.frame) }))])),
    reel: l.reel ? scaleReel(l.reel, k) : l.reel,
  }));
  return fitToLoop({ ...p, durationInFrames: newDur, layers }).project;
}

function scaleReel(r: ReelAssemble, k: number): ReelAssemble {
  const f = (v: number) => Math.max(1, Math.round(v * k));
  return { ...r, scatterFrames: f(r.scatterFrames), firstLand: f(r.firstLand), stagger: Math.max(1, Math.round(r.stagger * k)), releaseFrames: f(r.releaseFrames) };
}

/** cuts an image layer into vertical pieces (each its own layer, cropped from the same PNG) */
export function splitLayer(p: Project, id: string, cuts: number[]): Project {
  const l = p.layers.find((x) => x.id === id);
  if (!l) return p;
  const edges = [0, ...[...cuts].filter((c) => c > 0.01 && c < 0.99).sort((a, b) => a - b), 1];
  const left = l.x - l.width / 2;
  const pieces: Layer[] = edges.slice(0, -1).map((x0, i) => {
    const x1 = edges[i + 1];
    const w = l.width * (x1 - x0);
    const cx = left + l.width * x0 + w / 2;
    const dx = cx - l.x;
    return {
      ...l,
      id: uid(),
      name: `${l.name} · parça ${i + 1}/${edges.length - 1}`,
      x: Math.round(cx),
      width: Math.round(w),
      reel: undefined,
      mediaCrop: { top: 0, bottom: 0, left: x0, right: 1 - x1 },
      keyframes: { ...l.keyframes, x: l.keyframes.x?.map((q) => ({ ...q, value: q.value + dx })) },
      effects: l.effects.map((e) => ({ ...e, id: uid() })),
    };
  });
  const idx = p.layers.indexOf(l);
  return { ...p, layers: [...p.layers.slice(0, idx), ...pieces, ...p.layers.slice(idx + 1)] };
}

/** Slot Reel Assemble on an image layer, timed to fit the loop */
export function reelFor(p: Project, columns: number, base: Partial<ReelAssemble> = {}): ReelAssemble {
  const cuts = Array.from({ length: Math.max(1, columns) - 1 }, (_, i) => (i + 1) / columns);
  const r: ReelAssemble = { ...DEFAULT_REEL, cuts, ...base };
  return fitReel(r, p.durationInFrames);
}

/** squeezes the reel timing so it fits in the loop */
export function fitReel(r: ReelAssemble, frames: number): ReelAssemble {
  const out = { ...r };
  let guard = 0;
  while (reelMinFrames(out) > frames && guard++ < 60) {
    if (out.stagger > 2) out.stagger--;
    else if (out.firstLand > out.scatterFrames + 14) out.firstLand--;
    else if (out.releaseFrames > 6) out.releaseFrames--;
    else break;
  }
  return out;
}

export const emojiProblems = (p: Project): string[] => {
  const out: string[] = [];
  if (p.durationInFrames > TG.maxSeconds * p.fps) out.push(`Süre ${(p.durationInFrames / p.fps).toFixed(2)} sn — Telegram en fazla 3 sn kabul eder`);
  if (p.fps > TG.maxFps) out.push(`${p.fps} FPS — Telegram en fazla 30 FPS kabul eder`);
  if (p.layers.some((l) => l.type === 'background' && l.visible)) out.push('Görünür bir arka plan katmanı var — emoji şeffaf olmaz');
  if (p.layers.some((l) => (l.type === 'audio' || l.startSound || l.effects.some((e) => e.sound)) && l.visible)) out.push('Ses içeren katman/efekt var — dışa aktarmada ses alınmaz');
  for (const l of p.layers) if (l.reel && reelMinFrames(l.reel) > l.duration) out.push(`“${l.name}”: makara zamanlaması ${reelMinFrames(l.reel)} kare istiyor, katman ${l.duration} kare`);
  return out;
};
