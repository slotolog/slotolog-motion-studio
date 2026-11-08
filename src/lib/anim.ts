import { Easing, interpolate, spring } from 'remotion';
import type { AnimProp, Effect, EffectType, EasingName, Keyframe, Layer } from '../types';
import { beatPosition, boostAt, sinceBeat, type MusicSync } from './music';

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
  /** moving light reflection over an image: band position 0..1, strength */
  shine: { pos: number; alpha: number; color: string } | null;
  /** golden explosions emitted from the layer: age in seconds */
  explosions: { age: number; seed: number; power: number }[];
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
  shine: null,
  explosions: [],
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
  float: { label: 'Floating Motion (süzülme)', icon: '〰', defaultDuration: 5, description: 'Yavaşça yukarı aşağı süzülür' },
  shine: { label: 'Light Sweep (ışık yansıması)', icon: '⟋', defaultDuration: 5, description: 'PNG’nin üstünden ışık geçer' },
  dancePro: { label: 'Dance Pro', icon: '💃', defaultDuration: 6, description: 'Zıplayarak sağa sola dans; müzikte vuruşa uyar' },
  bouncePro: { label: 'Bounce Pro', icon: '⤒', defaultDuration: 4, description: 'Yerçekimli zıplama, ezilme-esneme' },
  smoothRotate: { label: 'Smooth Rotation', icon: '↻', defaultDuration: 6, description: 'Yumuşak hızlanıp yavaşlayan açılı dönüş' },
  groupDance: { label: 'Group Dance', icon: '⇄', defaultDuration: 8, description: 'Ekran merkezine yaklaşıp uzaklaşır, çapraz akar' },
  cameraZoom: { label: 'Camera Zoom', icon: '🎥', defaultDuration: 6, description: 'Yakınlaş / uzaklaş (Kamera katmanında tüm sahne)' },
  impactShake: { label: 'Impact Shake', icon: '💥', defaultDuration: 1, description: 'Sönümlenen sarsıntı (Kamera’da ekran sarsıntısı)' },
  goldExplosion: { label: 'Golden Explosion', icon: '🪙', defaultDuration: 2, description: 'Nesneden altın patlaması fışkırır' },
  beatSync: { label: 'Music Beat Sync', icon: '🎵', defaultDuration: 10, description: 'Müzikteki her vuruşta büyür ve parlar' },
};

/**
 * Computes the combined animation offsets of all effects of a layer
 * at a layer-local frame.
 */
export interface EffectContext {
  /** the layer's own (keyframed) centre, used by Group Dance */
  base?: { x: number; y: number };
  /** composition second at which the layer starts */
  layerStartSec?: number;
  music?: MusicSync | null;
}

export const LOOPING_EFFECTS: EffectType[] = [
  'bounce', 'dance', 'sway', 'spin', 'pulse', 'glow', 'beat', 'float', 'shine', 'shake',
  'dancePro', 'bouncePro', 'smoothRotate', 'groupDance', 'beatSync',
];
export const MUSIC_EFFECTS: EffectType[] = ['dancePro', 'groupDance', 'goldExplosion', 'beatSync', 'impactShake'];

const smooth = (x: number) => x * x * (3 - 2 * x);

export function computeEffects(
  effects: Effect[],
  frame: number,
  fps: number,
  comp: { width: number; height: number },
  ctx: EffectContext = {},
): EffectOutput {
  const out = neutralEffect();
  const music = ctx.music ?? null;
  effects.forEach((e, idx) => {
    if (frame < e.start || frame > e.start + e.duration) return;
    const LOOPING = LOOPING_EFFECTS as string[];
    const nowComp = (ctx.layerStartSec ?? 0) + frame / fps;
    const startComp = (ctx.layerStartSec ?? 0) + e.start / fps;
    const synced = !!music && e.syncToMusic !== false && MUSIC_EFFECTS.includes(e.type);
    const boost = synced ? boostAt(music, nowComp) : 1;
    // "music only" effects stay silent until a song with analysed beats is added
    if (e.syncToMusic === true && !music && (e.type === 'goldExplosion' || e.type === 'impactShake' || e.type === 'beatSync')) return;
    const t = (frame - e.start) / fps + (LOOPING.includes(e.type) ? (e.phase ?? 0) : 0); // seconds since effect start
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
      case 'float': {
        const w = Math.PI * 2 * t * sp * 0.35;
        out.dy += Math.sin(w) * 26 * k;
        out.dx += Math.sin(w * 0.5 + 1.3) * 6 * k;
        out.dRot += Math.sin(w + 0.8) * 2 * k;
        break;
      }
      case 'shine': {
        const period = 2.6 / sp;
        const p = (((t % period) + period) % period) / period;
        // the band crosses during the first half of the period, then rests
        if (p < 0.5) out.shine = { pos: p / 0.5, alpha: Math.min(1, 0.55 * k), color: e.color ?? '#FFFFFF' };
        break;
      }
      case 'dancePro': {
        const kk = k * boost;
        const cycle = synced ? Math.PI * (beatPosition(music!, nowComp) * sp + (e.phase ?? 0)) : Math.PI * 2 * t * sp * 0.9;
        const hop = Math.pow(Math.abs(Math.sin(cycle)), 0.8);
        out.dy -= hop * 48 * kk;
        out.dRot += Math.sin(cycle) * 10 * kk;
        out.dx += Math.sin(cycle) * 22 * kk;
        const land = 1 - hop;
        if (land > 0.8) {
          const q = (land - 0.8) / 0.2;
          out.scaleY *= 1 - 0.08 * kk * q;
          out.scaleX *= 1 + 0.06 * kk * q;
        }
        break;
      }
      case 'bouncePro': {
        const period = 0.75 / sp;
        const ph = (((t / period) % 1) + 1) % 1;
        out.dy -= 4 * ph * (1 - ph) * 80 * k;
        const near = Math.min(ph, 1 - ph);
        if (near < 0.08) {
          const q = 1 - near / 0.08;
          out.scaleY *= 1 - 0.13 * k * q;
          out.scaleX *= 1 + 0.1 * k * q;
        } else out.scaleY *= 1 + 0.04 * k * Math.sin(Math.PI * ph);
        break;
      }
      case 'smoothRotate': {
        const period = 3 / sp;
        const ph = (((t / period) % 1) + 1) % 1;
        const tri = ph < 0.5 ? ph * 2 : 2 - ph * 2;
        out.dRot += (smooth(tri) * 2 - 1) * 14 * k;
        break;
      }
      case 'groupDance': {
        const b = ctx.base ?? { x: comp.width / 2, y: comp.height / 2 };
        const vx = comp.width / 2 - b.x;
        const vy = comp.height * 0.45 - b.y;
        const dist = Math.hypot(vx, vy) || 1;
        const nx = vx / dist;
        const ny = vy / dist;
        const amp = Math.min(dist * 0.14, 90) * k * boost;
        const w = synced ? (Math.PI * (beatPosition(music!, nowComp) + (e.phase ?? 0)) * sp) / 4 : Math.PI * 2 * t * sp * 0.3;
        const approach = 0.5 - 0.5 * Math.cos(w);
        out.dx += nx * amp * approach - ny * amp * 0.35 * Math.sin(w * 0.5);
        out.dy += ny * amp * approach + nx * amp * 0.35 * Math.sin(w * 0.5);
        out.scaleMul *= 1 + 0.06 * k * approach;
        break;
      }
      case 'cameraZoom': {
        const durS = Math.max(0.1, e.duration / fps);
        const lin = Math.min(1, ((frame - e.start) / fps) * sp / durS);
        const p = Easing.inOut(Easing.cubic)(lin);
        const mode = e.zoomMode ?? 'inout';
        const z = 0.1 * k;
        out.scaleMul *= mode === 'in' ? 1 + z * p : mode === 'out' ? 1 + z * (1 - p) : 1 + z * (0.5 - 0.5 * Math.cos(2 * Math.PI * ((frame - e.start) / fps) * sp / durS));
        break;
      }
      case 'impactShake': {
        let age = (frame - e.start) / fps;
        if (synced) {
          const strong = music!.strong.filter((x) => x >= startComp && x <= nowComp);
          if (!strong.length) break;
          age = nowComp - strong[strong.length - 1];
        }
        const decay = Math.exp(-age * 5 * sp);
        if (decay < 0.01) break;
        out.dx += noise(age * 35, idx + 5) * 28 * k * decay;
        out.dy += noise(age * 35, idx + 11) * 28 * k * decay;
        out.dRot += noise(age * 30, idx + 17) * 2.5 * k * decay;
        out.scaleMul *= 1 + 0.05 * k * Math.exp(-age * 12);
        break;
      }
      case 'goldExplosion': {
        const life = 1.8 / Math.max(0.3, sp);
        const age = (frame - e.start) / fps;
        if (age < life && e.syncToMusic !== true) out.explosions.push({ age: age * sp, seed: idx * 13 + 1, power: k });
        if (synced) {
          for (const b of music!.strong) {
            if (b > startComp && b <= nowComp && nowComp - b < life) out.explosions.push({ age: (nowComp - b) * sp, seed: Math.round(b * 100), power: k * boost });
          }
        }
        break;
      }
      case 'beatSync': {
        let pulse = 0;
        if (music && e.syncToMusic !== false) {
          const sb = sinceBeat(music, nowComp);
          if (sb) pulse = Math.exp(-sb.dt * 7) * (0.6 + 0.6 * sb.strength) * boost;
        } else if (e.bpm) {
          // optional fallback tempo when there is no analysed music
          const beatLen = 60 / (e.bpm * sp);
          pulse = Math.exp(-((t % beatLen) / beatLen) * 6);
        }
        out.scaleMul *= 1 + 0.12 * k * pulse;
        out.brightness *= 1 + 0.15 * k * pulse;
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
