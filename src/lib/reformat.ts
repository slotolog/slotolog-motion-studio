import { computeEffects, propAt } from './anim';
import { buildMusicSync } from './music';
import { ASPECT_SIZES, projectSize, type Aspect, type Layer, type Project } from '../types';

/**
 * Reklam formatı dönüştürme (ör. 9:16 → 4:5 Meta akışı).
 *
 * Videoyu üstten/alttan kırpmak yerine katmanları yeniden yerleştirir:
 *  - arka plan, parçacık ve kamera katmanları yeni tuvali boşluksuz doldurur;
 *  - içerik katmanları dikeyde üst üste binen "satırlara" ayrılır (logo, çarpanlar, oyun penceresi + altyazı, bonus, buton, yasal not…);
 *  - her satır kendi merkezinde orantılı küçültülür (oran ve satır içi düzen korunur), satır aralıkları sıkıştırılır;
 *  - yatayda boşalan alan kullanılır: satırdaki öğeler arası mesafe korunur (taşmadıkça), böylece birbirine binmezler;
 *  - küçük yazılar (18+ / yasal) okunur boyutun altına inmez.
 * Süre, efektler, zamanlama, ses katmanları ve ses ayarları değişmez.
 */

export const AD_FORMATS: { aspect: Aspect; label: string; tag: string }[] = [
  { aspect: '9:16', label: '9:16 · 1080×1920 (Reels, Hikâye, TikTok)', tag: '9x16' },
  { aspect: '4:5', label: '4:5 · 1080×1350 (Facebook / Instagram akışı)', tag: '4x5' },
];

const FULL = new Set(['background', 'particles', 'camera', 'audio']);
const MIN_FONT = 30; // px on a 1080-wide canvas: 18+ / legal lines stay readable
const EDGE = 16; // safe margin at the left / right edges

interface Item {
  layer: Layer;
  top: number;
  bottom: number;
  /** the frame layer contributes its video window */
  frameWindow?: boolean;
}

interface Row {
  top: number;
  bottom: number;
  items: Item[];
  scale: number;
  sx: number;
  newTop: number;
}

const fontOf = (l: Layer): number | null =>
  l.type === 'text' || l.type === 'multiplier' ? (l.text?.fontSize ?? null) : l.type === 'button' ? (l.button?.fontSize ?? null) : l.type === 'subtitles' ? (l.subtitleStyle?.fontSize ?? null) : null;

/** returns a copy of the project laid out for another format (same width family, e.g. 9:16 → 4:5) */
export function reformatProject(src: Project, aspect: Aspect): Project {
  const from = projectSize(src);
  const to = ASPECT_SIZES[aspect];
  const p: Project = structuredClone(src);
  p.aspect = aspect;
  p.size = undefined;
  if (from.width === to.width && from.height === to.height) return p;
  const hs = to.width / from.width;

  // 1) content boxes
  const items: Item[] = [];
  for (const l of p.layers) {
    if (FULL.has(l.type)) continue;
    if (l.type === 'frame') {
      if (l.frame) items.push({ layer: l, top: l.frame.window.y - l.frame.window.h / 2, bottom: l.frame.window.y + l.frame.window.h / 2, frameWindow: true });
      continue;
    }
    const h = l.height * (l.scale || 1);
    items.push({ layer: l, top: l.y - h / 2, bottom: l.y + h / 2 });
  }
  items.sort((a, b) => a.top - b.top);

  // 2) rows of vertically overlapping boxes
  const rows: Row[] = [];
  for (const it of items) {
    const r = rows[rows.length - 1];
    if (r && it.top < r.bottom - 2) {
      r.items.push(it);
      r.bottom = Math.max(r.bottom, it.bottom);
    } else rows.push({ top: it.top, bottom: it.bottom, items: [it], scale: 1, sx: 1, newTop: 0 });
  }

  // 3) how far each row moves in the source (dance, float, pulse…): that room is kept free, unscaled
  const motion = motionExtents(src);
  const U: number[] = [];
  const D: number[] = [];
  rows.forEach((r) => {
    let up = 0;
    let down = 0;
    for (const it of r.items) {
      const m = it.frameWindow ? undefined : motion.get(it.layer.id);
      if (!m) continue;
      up = Math.max(up, r.top - (it.top - m.up));
      down = Math.max(down, it.bottom + m.down - r.bottom);
    }
    U.push(up);
    D.push(down);
  });
  // 4) scales: one common scale, a readable floor for small-text rows, then the free gaps share what is left
  const H = rows.map((r) => r.bottom - r.top);
  const gaps: number[] = [];
  let prev = 0;
  rows.forEach((r, i) => {
    gaps.push(Math.max(0, r.top - U[i] - prev));
    prev = r.bottom + D[i];
  });
  gaps.push(Math.max(0, from.height - prev));
  const G = gaps.reduce((a, b) => a + b, 0);
  const M = U.reduce((a, b) => a + b, 0) + D.reduce((a, b) => a + b, 0);
  const minGap = G * 0.35;
  const fixed = new Map<number, number>();
  for (let pass = 0; pass < 3; pass++) {
    const fixedH = [...fixed].reduce((a, [i, s]) => a + H[i] * s, 0);
    const freeH = H.reduce((a, h, i) => (fixed.has(i) ? a : a + h), 0);
    const e = freeH > 0 ? Math.max(0.3, Math.min(hs, (to.height - minGap - M - fixedH) / freeH)) : hs;
    rows.forEach((r, i) => {
      if (fixed.has(i)) return;
      r.scale = e;
      const fonts = r.items.map((it) => (it.layer.type === 'text' || it.layer.type === 'button' ? fontOf(it.layer) : null));
      if (fonts.every((f) => f != null)) {
        const smallest = Math.min(...(fonts as number[]));
        if (smallest * e < MIN_FONT) fixed.set(i, Math.min(hs, MIN_FONT / smallest));
      }
    });
    fixed.forEach((s, i) => (rows[i].scale = s));
  }
  const used = rows.reduce((a, r, i) => a + H[i] * r.scale, 0) + M;
  // the top and bottom margins (where frame decorations / fruit borders live) shrink least
  const last = gaps.length - 1;
  const edge = (gaps[0] + gaps[last]) * 0.6;
  const inner = G - gaps[0] - gaps[last];
  const room = Math.max(0, to.height - used);
  const ge = G > 0 ? Math.min(edge, room) / Math.max(1, gaps[0] + gaps[last]) : 0;
  const gi = inner > 0 ? (room - ge * (gaps[0] + gaps[last])) / inner : 0;
  const gsOf = (i: number) => (i === 0 || i === last ? (inner > 0 ? ge : room / Math.max(1, G)) : gi);
  let y = 0;
  rows.forEach((r, i) => {
    y += gaps[i] * gsOf(i) + U[i];
    r.newTop = y;
    y += H[i] * r.scale + D[i];
    // horizontal: keep the spacing between side-by-side items when they still fit
    let sx = hs;
    for (const it of r.items) {
      const l = it.layer;
      const cx = it.frameWindow ? l.frame!.window.x : l.x;
      const w = (it.frameWindow ? l.frame!.window.w : l.width * (l.scale || 1)) * r.scale;
      const off = Math.abs(cx - from.width / 2);
      if (off > 1) sx = Math.min(sx, (to.width / 2 - EDGE - w / 2) / off);
    }
    r.sx = Math.max(r.scale, sx);
  });
  if (rows.length === 0 && G === 0) return p;

  const rowOf = new Map<string, Row>();
  rows.forEach((r) => r.items.forEach((it) => rowOf.set(it.layer.id + (it.frameWindow ? ':w' : ''), r)));
  const mapY = (r: Row, v: number) => r.newTop + (v - r.top) * r.scale;
  const mapX = (r: Row, v: number) => to.width / 2 + (v - from.width / 2) * r.sx;
  const fallback = (v: number) => (v * to.height) / from.height;

  p.layers = p.layers.map((l) => {
    if (FULL.has(l.type)) {
      if (l.type === 'audio') return l;
      return { ...l, x: to.width / 2, y: to.height / 2, width: to.width, height: to.height };
    }
    if (l.type === 'frame') {
      const f = l.frame!;
      const r = rowOf.get(l.id + ':w')!;
      const box = (b: { x: number; y: number; w: number; h: number }) => ({ x: Math.round(mapX(r, b.x)), y: Math.round(mapY(r, b.y)), w: Math.round(b.w * r.scale), h: Math.round(b.h * r.scale) });
      return {
        ...l,
        x: to.width / 2,
        y: to.height / 2,
        width: to.width,
        height: to.height,
        frame: { ...f, window: box(f.window), area: f.area ? box(f.area) : undefined, thickness: Math.max(6, Math.round(f.thickness * r.scale)), radius: Math.round(f.radius * r.scale) },
      };
    }
    const r = rowOf.get(l.id);
    if (!r) return { ...l, y: fallback(l.y) };
    // small text (18+ / legal) never goes below the readable size, even when its row shrinks more
    const f0 = l.type === 'text' || l.type === 'button' ? fontOf(l) : null;
    const k = f0 && f0 * r.scale < MIN_FONT ? Math.min(hs, Math.max(r.scale, MIN_FONT / f0)) : r.scale;
    const kf = { ...l.keyframes };
    if (kf.x) kf.x = kf.x.map((q) => ({ ...q, value: mapX(r, q.value) }));
    if (kf.y) kf.y = kf.y.map((q) => ({ ...q, value: mapY(r, q.value) }));
    return {
      ...l,
      x: Math.round(mapX(r, l.x)),
      y: Math.round(mapY(r, l.y)),
      width: Math.round(l.width * k),
      height: Math.round(l.height * k),
      keyframes: kf,
      text: l.text ? { ...l.text, fontSize: Math.round(l.text.fontSize * k), strokeWidth: Math.round(l.text.strokeWidth * k * 10) / 10 } : l.text,
      button: l.button ? { ...l.button, fontSize: Math.round(l.button.fontSize * k) } : l.button,
      subtitleStyle: l.subtitleStyle ? { ...l.subtitleStyle, fontSize: Math.round(l.subtitleStyle.fontSize * k), strokeWidth: Math.round(l.subtitleStyle.strokeWidth * k * 10) / 10 } : l.subtitleStyle,
    };
  });
  return p;
}

export const formatTag = (aspect: Aspect) => AD_FORMATS.find((f) => f.aspect === aspect)?.tag ?? aspect.replace(':', 'x');

/** "Ad · 4:5 (1080×1350)" — the name of a format copy */
export function variantName(baseName: string, aspect: Aspect) {
  const { width, height } = ASPECT_SIZES[aspect];
  const clean = baseName.replace(/\s·\s(9:16|4:5|1:1|16:9)\s\(\d+×\d+\)$/, '');
  return `${clean} · ${aspect} (${width}×${height})`;
}

/** MP4 file name with the format in it: Ad_4x5_1080x1350.mp4 */
export function variantFileName(p: Project) {
  const { width, height } = projectSize(p);
  const base = p.name.replace(/\s·\s(9:16|4:5|1:1|16:9)\s\(\d+×\d+\)$/, '').replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/-+$/, '') || 'slotolog';
  return `${base}_${formatTag(p.aspect)}_${width}x${height}.mp4`;
}

/** how far (px, up / down) each content layer moves away from its own box in the source, entry fly-ins / impacts excluded */
function motionExtents(p: Project) {
  const comp = projectSize(p);
  const music = buildMusicSync(p);
  const out = new Map<string, { up: number; down: number }>();
  const ENTRY = new Set(['flyIn', 'impact']);
  for (const l of p.layers) {
    if (!KEY.has(l.type) || l.type === 'video' || l.type === 'subtitles') continue;
    let up = 0;
    let down = 0;
    const step = Math.max(1, Math.round(l.duration / 400));
    for (let f = 0; f < l.duration; f += step) {
      if (l.effects.some((e) => ENTRY.has(e.type) && f >= e.start && f <= e.start + e.duration)) continue;
      const base = { x: propAt(l, 'x', f), y: propAt(l, 'y', f) };
      const fx = computeEffects(l.effects, f, p.fps, comp, { base, layerStartSec: l.start / p.fps, music });
      if (propAt(l, 'opacity', f) * fx.opacityMul < 0.35) continue;
      const s = propAt(l, 'scale', f) * fx.scaleMul * Math.abs(fx.scaleY);
      const h = (l.height * s) / 2;
      const y = base.y + fx.dy;
      const h0 = (l.height * (l.scale || 1)) / 2;
      up = Math.max(up, l.y - h0 - (y - h));
      down = Math.max(down, y + h - (l.y + h0));
    }
    const cap = Math.min(140, l.height * 0.22);
    out.set(l.id, { up: Math.min(cap, up), down: Math.min(cap, down) });
  }
  return out;
}

/* ---------------- yerleşim kontrolü ---------------- */

export interface LayoutIssue {
  t: number;
  kind: 'overlap' | 'outside';
  a: string;
  b?: string;
}

const KEY = new Set(['image', 'text', 'multiplier', 'button', 'video', 'subtitles', 'placeholder']);

function boxesAt(p: Project, frame: number, music: ReturnType<typeof buildMusicSync>) {
  const comp = projectSize(p);
  const out: { name: string; id: string; x0: number; y0: number; x1: number; y1: number; entry: boolean }[] = [];
  for (const l of p.layers) {
    if (!l.visible || !KEY.has(l.type) || frame < l.start || frame >= l.start + l.duration) continue;
    const local = frame - l.start;
    const base = { x: propAt(l, 'x', local), y: propAt(l, 'y', local) };
    const fx = computeEffects(l.effects, local, p.fps, comp, { base, layerStartSec: l.start / p.fps, music });
    const op = propAt(l, 'opacity', local) * fx.opacityMul;
    if (op < 0.35) continue;
    const s = propAt(l, 'scale', local) * fx.scaleMul;
    const w = (l.width * Math.abs(s * fx.scaleX)) / 2;
    const h = (l.height * Math.abs(s * fx.scaleY)) / 2;
    const x = base.x + fx.dx;
    const y = base.y + fx.dy;
    const entry = l.effects.some((e) => (e.type === 'flyIn' || e.type === 'impact') && local >= e.start && local <= e.start + e.duration);
    out.push({ name: l.name, id: l.id, x0: x - w, y0: y - h, x1: x + w, y1: y + h, entry });
  }
  return { comp, out };
}

function pairs(p: Project, frame: number, music: ReturnType<typeof buildMusicSync>) {
  const { comp, out } = boxesAt(p, frame, music);
  const ov = new Set<string>();
  const outside = new Set<string>();
  for (const b of out) {
    const area = (b.x1 - b.x0) * (b.y1 - b.y0);
    const ix = Math.max(0, Math.min(b.x1, comp.width) - Math.max(b.x0, 0));
    const iy = Math.max(0, Math.min(b.y1, comp.height) - Math.max(b.y0, 0));
    if (!b.entry && area > 0 && (ix * iy) / area < 0.97) outside.add(b.id);
  }
  for (let i = 0; i < out.length; i++)
    for (let j = i + 1; j < out.length; j++) {
      const a = out[i];
      const b = out[j];
      const ix = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0));
      const iy = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
      const m = Math.min((a.x1 - a.x0) * (a.y1 - a.y0), (b.x1 - b.x0) * (b.y1 - b.y0));
      if (m > 0 && (ix * iy) / m > 0.15) ov.add([a.id, b.id].sort().join('|'));
    }
  return { ov, outside, names: Object.fromEntries(out.map((b) => [b.id, b.name])) };
}

/**
 * Compares a format copy with its source frame by frame (every ~¼ s): reports item pairs that overlap only in the copy
 * and items that are cut by the canvas edge only in the copy. Overlaps that the original design already has are fine.
 */
export function layoutIssues(source: Project, variant: Project, stepFrames = Math.max(1, Math.round(variant.fps / 4))): LayoutIssue[] {
  const ms = buildMusicSync(source);
  const mv = buildMusicSync(variant);
  const issues: LayoutIssue[] = [];
  const seen = new Set<string>();
  for (let f = 0; f < variant.durationInFrames; f += stepFrames) {
    const a = pairs(source, f, ms);
    const b = pairs(variant, f, mv);
    for (const k of b.ov) {
      if (a.ov.has(k) || seen.has('o' + k)) continue;
      seen.add('o' + k);
      const [x, y] = k.split('|');
      issues.push({ t: f / variant.fps, kind: 'overlap', a: b.names[x], b: b.names[y] });
    }
    for (const id of b.outside) {
      if (a.outside.has(id) || seen.has('x' + id)) continue;
      seen.add('x' + id);
      issues.push({ t: f / variant.fps, kind: 'outside', a: b.names[id] });
    }
  }
  return issues;
}
