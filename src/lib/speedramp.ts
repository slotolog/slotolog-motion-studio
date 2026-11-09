import type { Layer, SpeedRamp, SpeedSegment } from '../types';

/**
 * Variable speed (speed ramp) for a video layer.
 *
 * The source file is split into consecutive parts (segments), each with its own speed. Nothing is
 * cut: every part plays in its original order, one after the other. At each speed change a short
 * transition steps the speed gradually; it always uses footage of the FASTER side, so the slow
 * (important) part keeps its full length at its own speed.
 */

export interface RampPiece {
  /** first output frame (relative to the layer start) */
  out0: number;
  /** length in output frames */
  len: number;
  /** source second shown at out0 */
  src0: number;
  speed: number;
  /** game sound 0..1 */
  volume: number;
  /** index of the segment this piece belongs to */
  seg: number;
  transition: boolean;
}

const STEPS = 5;

/** default game sound: full at normal speed, muted when sped up or slowed down (pitch would be distorted) */
export const autoVolume = (speed: number) => (speed >= 0.95 && speed <= 1.05 ? 1 : 0);

export function normalizeRamp(r: SpeedRamp): SpeedRamp {
  const segs = [...r.segments]
    .map((s) => ({ ...s, speed: Math.max(0.1, Math.min(32, s.speed || 1)), from: Math.max(0, s.from) }))
    .sort((a, b) => a.from - b.from)
    .filter((s, i, a) => s.from < r.end - 0.02 && (i === 0 || s.from - a[i - 1].from > 0.02));
  return { ...r, segments: segs.length ? segs : [{ from: 0, speed: 1 }] };
}

interface Step {
  srcLen: number;
  speed: number;
  volume: number;
  seg: number;
  transition: boolean;
}

/** builds the exact (unrounded) list of constant-speed steps */
function steps(r: SpeedRamp): Step[] {
  const segs = r.segments;
  const n = segs.length;
  const segEnd = (i: number) => (i + 1 < n ? segs[i + 1].from : r.end);
  const len = segs.map((s, i) => Math.max(0, segEnd(i) - s.from));
  const vol = (s: SpeedSegment) => (s.volume ?? autoVolume(s.speed));
  // transitions per boundary j (between segment j and j+1)
  type T = { speeds: number[]; dt: number; side: number; atStart: boolean };
  const trans: (T | null)[] = [];
  for (let j = 0; j + 1 < n; j++) {
    const a = segs[j].speed;
    const b = segs[j + 1].speed;
    if (!(r.smooth > 0) || Math.abs(Math.log(b / a)) < 0.05) {
      trans.push(null);
      continue;
    }
    const speeds = Array.from({ length: STEPS }, (_, k) => a * Math.pow(b / a, (k + 1) / (STEPS + 1)));
    const faster = b > a ? j + 1 : j;
    trans.push({ speeds, dt: r.smooth / STEPS, side: faster, atStart: b > a });
  }
  // a transition may use at most 70 % of the faster segment
  for (let i = 0; i < n; i++) {
    const mine = trans.filter((t): t is T => !!t && t.side === i);
    const need = mine.reduce((acc, t) => acc + t.speeds.reduce((x, y) => x + y, 0) * t.dt, 0);
    const cap = len[i] * 0.7;
    if (need > cap && need > 0) mine.forEach((t) => (t.dt *= cap / need));
  }
  const tLen = (t: T) => t.speeds.reduce((x, y) => x + y, 0) * t.dt;
  const out: Step[] = [];
  for (let i = 0; i < n; i++) {
    const tin = i > 0 ? trans[i - 1] : null;
    const tout = i + 1 < n ? trans[i] : null;
    let plain = len[i];
    if (tin && tin.side === i) plain -= tLen(tin);
    if (tout && tout.side === i) plain -= tLen(tout);
    const push = (t: T) => t.speeds.forEach((sp) => out.push({ srcLen: sp * t.dt, speed: sp, volume: autoVolume(sp) * Math.min(vol(segs[i]), 1), seg: i, transition: true }));
    if (tin && tin.side === i) push(tin);
    if (plain > 1e-6) out.push({ srcLen: plain, speed: segs[i].speed, volume: vol(segs[i]), seg: i, transition: false });
    if (tout && tout.side === i) push(tout);
  }
  return out;
}

/** constant-speed pieces on whole output frames, ready for rendering */
export function expandRamp(ramp: SpeedRamp, fps: number): RampPiece[] {
  const r = normalizeRamp(ramp);
  const st = steps(r);
  const pieces: RampPiece[] = [];
  let T = 0; // exact output seconds
  let S = r.segments[0].from; // exact source seconds
  for (const s of st) {
    const F = Math.round(T * fps);
    const dur = s.srcLen / s.speed;
    const F2 = Math.round((T + dur) * fps);
    if (F2 > F) pieces.push({ out0: F, len: F2 - F, src0: S + (F / fps - T) * s.speed, speed: s.speed, volume: s.volume, seg: s.seg, transition: s.transition });
    T += dur;
    S += s.srcLen;
  }
  return pieces;
}

export const rampFrames = (ramp: SpeedRamp, fps: number) => {
  const p = expandRamp(ramp, fps);
  const last = p[p.length - 1];
  return last ? last.out0 + last.len : 1;
};

/** output second (from the layer start) at which a given source second is shown */
export function srcToOut(ramp: SpeedRamp, fps: number, src: number): number {
  const p = expandRamp(ramp, fps);
  for (const x of p) {
    const end = x.src0 + (x.len / fps) * x.speed;
    if (src < end) return (x.out0 + Math.max(0, (src - x.src0) / x.speed) * fps) / fps;
  }
  const last = p[p.length - 1];
  return last ? (last.out0 + last.len) / fps : 0;
}

/** source second shown at an output frame (relative to the layer start) */
export function outToSrc(ramp: SpeedRamp, fps: number, outFrame: number): number {
  const p = expandRamp(ramp, fps);
  for (const x of p) if (outFrame < x.out0 + x.len) return x.src0 + ((Math.max(x.out0, outFrame) - x.out0) / fps) * x.speed;
  const last = p[p.length - 1];
  return last ? last.src0 + (last.len / fps) * last.speed : 0;
}

/** output second where each segment starts (for the timeline / inspector) */
export function segmentStarts(ramp: SpeedRamp, fps: number): number[] {
  const r = normalizeRamp(ramp);
  return r.segments.map((s) => srcToOut(r, fps, s.from));
}

/** layer patch for a new ramp: duration follows the ramp */
export function rampPatch(l: Layer, ramp: SpeedRamp | undefined, fps: number): Partial<Layer> {
  if (!ramp) return { speedRamp: undefined };
  const r = normalizeRamp(ramp);
  return { speedRamp: r, trimStart: r.segments[0].from, playbackRate: 1, duration: rampFrames(r, fps), loop: l.loop ? false : l.loop };
}

/** splits the segment that contains a source second */
export function splitAt(ramp: SpeedRamp, src: number): SpeedRamp {
  const r = normalizeRamp(ramp);
  const i = r.segments.findIndex((s, k) => src > s.from && src < (r.segments[k + 1]?.from ?? r.end));
  if (i < 0) return r;
  const segs = [...r.segments];
  segs.splice(i + 1, 0, { ...segs[i], from: src, note: undefined });
  return { ...r, segments: segs };
}
