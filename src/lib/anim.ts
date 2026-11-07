import { Easing, interpolate, spring } from 'remotion';
import type { AnimProp, Effect, EffectType, EasingName, Keyframe, Layer } from '../types';

const EASINGS: Record<EasingName, (t: number) => number> = {
  linear: (t) => t,
  easeIn: Easing.in(Easing.cubic),
  easeOut: Easing.out(Easing.cubic),
  easeInOut: Easing.inOut(Easing.cubic),
  back: Easing.out(Easing.back(1.7)),
};

export const EASING_LABELS: Record<EasingName, string> = {
  linear: 'Doğrusal',
  easeIn: 'Yavaş başla',
  easeOut: 'Yavaş bitir',
  easeInOut: 'Yumuşak',
  back: 'Esnek (geri sekme)',
};

/** Value of a property at a layer-local frame, taking keyframes into account. */
export function propAt(layer: Layer, prop: AnimProp, frame: number): number {
  const kfs = layer.keyframes[prop];
  if (!kfs || kfs.length === 0) return layer[prop];
  return interpolateKeyframes(kfs, frame);
}

export function interpolateKeyframes(kfs: Keyframe[], frame: number): number {
  const sorted = [...kfs].sort((a, b) => a.frame - b.frame);
  if (frame <= sorted[0].frame) return sorted[0].value;
  const last = sorted[sorted.length - 1];
  if (frame >= last.frame) return last.value;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (frame >= a.frame && frame <= b.frame) {
      if (b.frame === a.frame) return b.value;
      return interpolate(frame, [a.frame, b.frame], [a.value, b.value], {
        easing: EASINGS[a.easing] ?? EASINGS.linear,
      });
    }
  }
  return last.value;
}

/** Deterministic pseudo random number in [0,1) */
export function rand(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Smooth 1D value noise in [-1,1] */
export function noise(t: number, seed = 0): number {
  const i = Math.floor(t);
  const f = t - i;
  const a = rand(i + seed * 101) * 2 - 1;
  const b = rand(i + 1 + seed * 101) * 2 - 1;
  const u = f * f * (3 - 2 * f);
  return a + (b - a) * u;
}

export interface EffectOutput {
  dx: number;
  dy: number;
  dRot: number;
  scaleMul: number;
  scaleX: number;
  scaleY: number;
  opacityMul: number;
  brightness: number;
  glow: { radius: number; color: string } | null;
  flash: { progress: number; color: string } | null;
}

export const neutralEffect = (): EffectOutput => ({
  dx: 0,
  dy: 0,
  dRot: 0,
  scaleMul: 1,
  scaleX: 1,
  scaleY: 1,
  opacityMul: 1,
  brightness: 1,
  glow: null,
  flash: null,
});

export const EFFECT_META: Record<
  EffectType,
  { label: string; icon: string; defaultDuration: number; description: string }
> = {
  bounce: { label: 'Zıplama', icon: '⤒', defaultDuration: 3, description: 'Yukarı aşağı zıplar' },
  dance: { label: 'Dans', icon: '♪', defaultDuration: 3, description: 'Sallanarak zıplar' },
  sway: { label: 'Sağa sola sallanma', icon: '↔', defaultDuration: 3, description: 'Sarkaç gibi sallanır' },
  spin: { label: '360° dönme', icon: '⟳', defaultDuration: 2, description: 'Kendi etrafında döner' },
  pulse: { label: 'Büyüme / küçülme', icon: '◉', defaultDuration: 3, description: 'Nefes alır gibi büyür' },
  flyIn: { label: 'Uçarak giriş', icon: '➶', defaultDuration: 1, description: 'Ekran dışından uçarak gelir' },
  glow: { label: 'Parlama', icon: '✦', defaultDuration: 3, description: 'Etrafında ışık yayar' },
  flash: { label: 'Işık patlaması', icon: '✸', defaultDuration: 1, description: 'Arkasında ışık patlar' },
  shake: { label: 'Titreme', icon: '≋', defaultDuration: 1, description: 'Hızlıca titrer' },
  impact: { label: 'Çarpma', icon: '✊', defaultDuration: 1, description: 'Büyükten küçülerek çarpar' },
  beat: { label: 'Ritim (BPM)', icon: '♫', defaultDuration: 5, description: 'Belirlenen BPM ile vurur' },
};

/**
 * Computes the combined animation offsets of all effects of a layer
 * at a layer-local frame.
 */
export function computeEffects(
  effects: Effect[],
  frame: number,
  fps: number,
  comp: { width: number; height: number },
): EffectOutput {
  const out = neutralEffect();
  effects.forEach((e, idx) => {
    if (frame < e.start || frame > e.start + e.duration) return;
    const t = (frame - e.start) / fps; // seconds since effect start
    const sp = e.speed || 1;
    const k = e.intensity ?? 1;
    switch (e.type) {
      case 'bounce': {
        const ph = Math.abs(Math.sin(Math.PI * t * sp * 2));
        out.dy -= ph * 70 * k;
        const squash = 1 - Math.max(0, 0.25 - ph) * 0.6 * k;
        out.scaleY *= squash;
        out.scaleX *= 2 - squash;
        break;
      }
      case 'dance': {
        const w = Math.PI * 2 * t * sp;
        out.dRot += Math.sin(w) * 14 * k;
        out.dy -= Math.abs(Math.sin(w)) * 40 * k;
        out.dx += Math.sin(w / 2) * 20 * k;
        out.scaleMul *= 1 + Math.sin(w * 2) * 0.04 * k;
        break;
      }
      case 'sway': {
        const w = Math.PI * 2 * t * sp * 0.8;
        out.dRot += Math.sin(w) * 16 * k;
        out.dx += Math.sin(w) * 25 * k;
        break;
      }
      case 'spin': {
        out.dRot += t * 360 * sp * 0.75 * Math.max(0.1, k);
        break;
      }
      case 'pulse': {
        out.scaleMul *= 1 + Math.sin(Math.PI * 2 * t * sp) * 0.12 * k;
        break;
      }
      case 'flyIn': {
        const p = spring({
          frame: frame - e.start,
          fps,
          config: { damping: 14, mass: 0.9 },
          durationInFrames: Math.max(4, Math.round(e.duration / sp)),
        });
        const dir = e.direction ?? 'bottom';
        const dist = (dir === 'left' || dir === 'right' ? comp.width : comp.height) * 0.9 * Math.max(0.3, k);
        const inv = 1 - p;
        if (dir === 'left') out.dx -= inv * dist;
        if (dir === 'right') out.dx += inv * dist;
        if (dir === 'top') out.dy -= inv * dist;
        if (dir === 'bottom') out.dy += inv * dist;
        out.dRot += inv * (dir === 'left' ? -25 : 25);
        out.scaleMul *= 0.6 + 0.4 * p;
        break;
      }
      case 'glow': {
        const pulse = 0.5 + 0.5 * Math.sin(Math.PI * 2 * t * sp);
        out.glow = { radius: (18 + pulse * 30) * k, color: e.color ?? '#FFD54A' };
        out.brightness *= 1 + pulse * 0.15 * k;
        break;
      }
      case 'flash': {
        const len = Math.max(1, e.duration / sp);
        const p = ((frame - e.start) % len) / len;
        out.flash = { progress: p, color: e.color ?? '#FFF3B0' };
        out.brightness *= 1 + Math.max(0, 0.6 - p) * 0.8 * k;
        break;
      }
      case 'shake': {
        const f = t * 30 * sp;
        out.dx += noise(f, idx + 1) * 14 * k;
        out.dy += noise(f, idx + 7) * 14 * k;
        out.dRot += noise(f, idx + 13) * 4 * k;
        break;
      }
      case 'impact': {
        const local = frame - e.start;
        const hitFrames = Math.max(3, Math.round((fps * 0.35) / sp));
        if (local < hitFrames) {
          const p = Easing.in(Easing.cubic)(local / hitFrames);
          out.scaleMul *= 1 + (1 - p) * 2.2 * k;
          out.opacityMul *= Math.min(1, 0.2 + p);
        } else {
          const after = (local - hitFrames) / fps;
          const decay = Math.exp(-after * 9);
          out.dx += noise(after * 40, idx + 3) * 22 * k * decay;
          out.dy += noise(after * 40, idx + 9) * 22 * k * decay;
          out.scaleMul *= 1 + Math.sin(after * 30) * 0.08 * k * decay;
        }
        break;
      }
      case 'beat': {
        const bpm = (e.bpm ?? 120) * sp;
        const beatLen = 60 / bpm;
        const phase = (t % beatLen) / beatLen;
        out.scaleMul *= 1 + Math.exp(-phase * 6) * 0.14 * k;
        out.brightness *= 1 + Math.exp(-phase * 8) * 0.12 * k;
        break;
      }
    }
  });
  return out;
}
