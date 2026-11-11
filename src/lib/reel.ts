import type { ReelAssemble } from '../types';

/**
 * Slot Reel Assemble — yeniden kullanılabilir efekt.
 * Görsel dikey "makaralara" bölünür. Başta parçalar birbirinden ayrı durur; sonra her makarada semboller
 * yukarıdan aşağı akar ve makara farklı hızlarda, soldan sağa sırayla, hafif yaylanarak kendi logo parçasında durur.
 * Birleşince turuncu ışıma, küçük bir zıplama ve ışık yansıması; sonda parçalar yeniden ayrılır → kesintisiz döngü.
 */

export const DEFAULT_REEL: ReelAssemble = {
  cuts: [0.25, 0.5, 0.75],
  symbols: ['decor/seven.svg', 'decor/cherry.svg', 'decor/bell.svg', 'decor/gem.svg', 'decor/coin.svg'],
  scatterFrames: 8,
  firstLand: 40,
  stagger: 6,
  releaseFrames: 12,
  scatter: 0.55,
  bounce: 0.7,
  glowColor: '#FF8E16',
  spins: 4,
  shine: true,
};

export interface ReelColumn {
  /** column bounds inside the image (fractions of width) */
  x0: number;
  x1: number;
  /** offset of the whole column (fractions of the image size) */
  dx: number;
  dy: number;
  /** tilt in degrees */
  rot: number;
  scale: number;
  /** true while the column is a rolling reel (clipped window) */
  rolling: boolean;
  /** strip position: 0 = start slice in the window, items = 1 + symbols + 1 (final slice) */
  offset: number;
  items: number;
  /** speed in windows per frame (for motion blur) */
  speed: number;
  /** landing glow 0..1 */
  glow: number;
}

export interface ReelState {
  columns: ReelColumn[];
  /** whole-logo glow / bounce / shine after assembling */
  glow: number;
  scale: number;
  shine: number | null;
  assembled: boolean;
}

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
/** slow start, fast middle, overshoot at the end (the reel "clicks" into place) */
export function reelEase(p: number, bounce: number) {
  const q = Math.pow(clamp(p), 1.45);
  const c1 = 1.70158 * bounce;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(q - 1, 3) + c1 * Math.pow(q - 1, 2);
}

export const reelColumns = (r: ReelAssemble) => {
  const cuts = [...r.cuts].filter((c) => c > 0.01 && c < 0.99).sort((a, b) => a - b);
  const edges = [0, ...cuts, 1];
  return edges.slice(0, -1).map((x0, i) => ({ x0, x1: edges[i + 1] }));
};

export const landFrame = (r: ReelAssemble, i: number) => r.firstLand + i * r.stagger;

/** frames the effect needs (last landing + glow/shine + release) */
export const reelMinFrames = (r: ReelAssemble) => landFrame(r, reelColumns(r).length - 1) + 18 + r.releaseFrames;

export function reelState(r: ReelAssemble, frame: number, duration: number): ReelState {
  const cols = reelColumns(r);
  const n = cols.length;
  const L = Math.max(1, duration);
  const f = ((frame % L) + L) % L;
  const relStart = L - r.releaseFrames;
  const lastLand = landFrame(r, n - 1);
  const columns: ReelColumn[] = cols.map(({ x0, x1 }, i) => {
    const c = (x0 + x1) / 2 - 0.5;
    // the pieces stand apart: spread sideways, alternately up / down, a little smaller
    // sideways spread stays small so wide logos do not leave the canvas; tilt + vertical offset do the separating
    const sdx = c * r.scatter * 0.14;
    const sdy = (i % 2 === 0 ? -1 : 1) * r.scatter * 0.36;
    const srot = (i % 2 === 0 ? -1 : 1) * r.scatter * 14;
    const items = 2 + r.spins + i;
    const start = r.scatterFrames + i * 2;
    const land = landFrame(r, i);
    let apart = 0;
    let rolling = false;
    let offset = 0;
    let speed = 0;
    if (f < start) apart = 1;
    else if (f < land) {
      rolling = true;
      const p = (f - start) / Math.max(1, land - start);
      apart = 1 - easeInOut(clamp(p / 0.45));
      offset = (items - 1) * reelEase(p, r.bounce);
      const p2 = (f + 1 - start) / Math.max(1, land - start);
      speed = Math.abs((items - 1) * reelEase(p2, r.bounce) - offset);
    } else if (f >= relStart) {
      apart = easeInOut(clamp((f - relStart) / Math.max(1, r.releaseFrames)));
    }
    const glow = Math.exp(-Math.pow((f - land) / 3.5, 2));
    return { x0, x1, dx: sdx * apart, dy: sdy * apart, rot: srot * apart, scale: 1 - 0.12 * apart, rolling, offset: rolling ? offset : 0, items, speed, glow };
  });
  const since = f - lastLand;
  const assembled = since >= 0 && f < relStart;
  const glow = since >= 0 ? Math.exp(-since / 10) * (f < relStart ? 1 : 0) : 0;
  const scale = since >= 0 && since < 18 ? 1 + 0.07 * r.bounce * Math.exp(-since / 5) * Math.sin(since * 0.9) : 1;
  const shinePos = (since - 3) / 14;
  const shine = r.shine && shinePos >= 0 && shinePos <= 1 ? shinePos : null;
  return { columns, glow, scale, shine, assembled };
}
