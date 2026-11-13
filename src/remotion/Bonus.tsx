import { useLayoutEffect, useRef } from 'react';
import type { BonusStyle } from '../types';

/**
 * Bonus Seviyeleri — Telegram premium emojileri (Taç / Rozet / Casino Chip × Bronz…Elmas).
 * Tamamen prosedürel çizim (512×512 tasarım alanı). Animasyon yerinde: hafif nefes (ölçek), turuncu ışıma,
 * tek metalik ışık geçişi, parıltılar; chip ±22° sağa-sola eğilir. p = döngü konumu 0..1 → ilk kare = son kare.
 */

export const BONUS_LEVELS = ['Bronz', 'Gümüş', 'Altın', 'Platin', 'Elmas'] as const;
export const BONUS_SERIES = { crown: 'Premium Taçlar', badge: 'Premium Rozetler', chip: 'Premium Casino Chips' } as const;

type Mat = { metal: string[]; edge: string[]; gem: string[]; sym: string[] };
const CRYSTAL = ['#FFFFFF', '#EAF8FF', '#C4E9FB', '#93D0EE', '#62AED6'];
const ORANGE = ['#FFE0BC', '#FFB25C', '#FF8E16', '#D96E00', '#9E4E00'];
const MATS: Mat[] = [
  // Bronz
  { metal: ['#FFD9B8', '#E3A06A', '#B26B37', '#6F3E1C', '#D18E58'], edge: ['#C98552', '#8A4F24', '#4A2810'], gem: ORANGE, sym: ['#FFD9B8', '#D18E58', '#8A4F24'] },
  // Gümüş
  { metal: ['#FFFFFF', '#E4E8EC', '#B3BBC3', '#6F7983', '#D5DBE0'], edge: ['#D0D6DC', '#86909A', '#454D55'], gem: CRYSTAL, sym: ['#FFFFFF', '#C9D0D7', '#7C8691'] },
  // Altın
  { metal: ['#FFF4C4', '#F7D06A', '#D9A531', '#8A6212', '#F0C552'], edge: ['#E8BE52', '#9C7016', '#523A08'], gem: ORANGE, sym: ['#FFF4C4', '#F2C14A', '#A87A14'] },
  // Platin
  { metal: ['#FFFFFF', '#EEF1F5', '#C8CFD7', '#848F9B', '#E1E6EC'], edge: ['#DCE2E8', '#8E99A5', '#4C5560'], gem: CRYSTAL, sym: ['#FFFFFF', '#DCE3EA', '#8E99A5'] },
  // Elmas
  { metal: ['#FFFFFF', '#EEF3F7', '#C3CED8', '#8C99A6', '#E3EAF0'], edge: ['#D9E1E8', '#8E9AA6', '#4E5964'], gem: CRYSTAL, sym: CRYSTAL },
];
const TAU = Math.PI * 2;
type C2 = CanvasRenderingContext2D;

function lin(ctx: C2, x0: number, y0: number, x1: number, y1: number, stops: string[]) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
}
function mk(S: number): [HTMLCanvasElement, C2] {
  const c = document.createElement('canvas');
  c.width = Math.round(512 * S);
  c.height = Math.round(512 * S);
  const x = c.getContext('2d')!;
  x.scale(S, S);
  x.lineJoin = 'round';
  return [c, x];
}
function poly(ctx: C2, pts: number[][], fill: string | CanvasGradient) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}
function sparkle(ctx: C2, x: number, y: number, r: number, a: number) {
  if (a <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(x, y);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.1);
  g.addColorStop(0, 'rgba(255,255,255,.9)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.1, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const ang = (i * Math.PI) / 4 - Math.PI / 2;
    const rr = i % 2 ? r * 0.16 : r;
    ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
/** brilliant-cut gem, side view */
function gem(ctx: C2, cx: number, cy: number, w: number, h: number, cols: string[], outline = 6) {
  const t = h * 0.36,
    top = cy - h / 2,
    girdle = top + t,
    bot = cy + h / 2,
    tw = w * 0.56;
  ctx.save();
  const sil = () => {
    ctx.beginPath();
    ctx.moveTo(cx - tw / 2, top);
    ctx.lineTo(cx + tw / 2, top);
    ctx.lineTo(cx + w / 2, girdle);
    ctx.lineTo(cx, bot);
    ctx.lineTo(cx - w / 2, girdle);
    ctx.closePath();
  };
  sil();
  ctx.strokeStyle = '#1E1E1E';
  ctx.lineWidth = outline * 2;
  ctx.stroke();
  sil();
  ctx.fillStyle = lin(ctx, 0, top, 0, bot, [cols[1], cols[2], cols[4]]);
  ctx.fill();
  poly(ctx, [[cx - tw / 2, top], [cx + tw / 2, top], [cx + tw * 0.32, girdle], [cx - tw * 0.32, girdle]], cols[0]);
  poly(ctx, [[cx - tw / 2, top], [cx - tw * 0.32, girdle], [cx - w / 2, girdle]], cols[2]);
  poly(ctx, [[cx + tw / 2, top], [cx + w / 2, girdle], [cx + tw * 0.32, girdle]], cols[3]);
  poly(ctx, [[cx - w / 2, girdle], [cx - tw * 0.32, girdle], [cx, bot]], cols[1]);
  poly(ctx, [[cx - tw * 0.32, girdle], [cx + tw * 0.32, girdle], [cx, bot]], cols[2]);
  poly(ctx, [[cx + tw * 0.32, girdle], [cx + w / 2, girdle], [cx, bot]], cols[4]);
  ctx.strokeStyle = 'rgba(255,255,255,.55)';
  ctx.lineWidth = Math.max(1.5, w * 0.012);
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, girdle);
  ctx.lineTo(cx + w / 2, girdle);
  ctx.stroke();
  ctx.restore();
}
/** simple round stone / polished ball (few facets — readable at 100 px) */
function ball(ctx: C2, cx: number, cy: number, r: number, cols: string[], outline = 5, faceted = true) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.strokeStyle = '#1E1E1E';
  ctx.lineWidth = outline * 2;
  ctx.stroke();
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
  g.addColorStop(0, cols[0]);
  g.addColorStop(0.55, cols[2]);
  g.addColorStop(1, cols[4]);
  ctx.fillStyle = g;
  ctx.fill();
  if (faceted) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r, cy);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,.22)';
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(cx - r * 0.3, cy - r * 0.32, r * 0.22, 0, TAU);
  ctx.fillStyle = 'rgba(255,255,255,.9)';
  ctx.fill();
  ctx.restore();
}
function star(ctx: C2, cx: number, cy: number, R: number, cols: string[]) {
  const path = () => {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5 - Math.PI / 2;
      const r = i % 2 ? R * 0.46 : R;
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.closePath();
  };
  ctx.save();
  path();
  ctx.strokeStyle = '#1E1E1E';
  ctx.lineWidth = Math.max(6, R * 0.16);
  ctx.stroke();
  path();
  ctx.fillStyle = lin(ctx, 0, cy - R, 0, cy + R, [cols[0], cols[1], cols[2]]);
  ctx.fill();
  // facet: right half a little darker
  ctx.save();
  path();
  ctx.clip();
  ctx.fillStyle = 'rgba(30,30,30,.16)';
  ctx.fillRect(cx, cy - R, R, R * 2);
  ctx.restore();
  ctx.restore();
}
function miniCrown(ctx: C2, cx: number, cy: number, w: number, cols: string[], accent: string) {
  const h = w * 0.62,
    x0 = cx - w / 2,
    y1 = cy + h / 2,
    y0 = cy - h / 2;
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(x0, y1);
    ctx.lineTo(x0, y0 + h * 0.15);
    ctx.lineTo(cx - w * 0.25, cy + h * 0.02);
    ctx.lineTo(cx, y0);
    ctx.lineTo(cx + w * 0.25, cy + h * 0.02);
    ctx.lineTo(x0 + w, y0 + h * 0.15);
    ctx.lineTo(x0 + w, y1);
    ctx.closePath();
  };
  ctx.save();
  path();
  ctx.strokeStyle = '#1E1E1E';
  ctx.lineWidth = w * 0.09;
  ctx.stroke();
  path();
  ctx.fillStyle = lin(ctx, 0, y0, 0, y1, [cols[0], cols[1], cols[2]]);
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.fillRect(x0 + w * 0.08, y1 - h * 0.22, w * 0.84, h * 0.1);
  ctx.restore();
}
/** level symbol: 1–3 stars, crown + star, big diamond */
function levelSymbol(ctx: C2, lv: number, cx: number, cy: number, size: number, m: Mat, accent: string) {
  if (lv === 4) return gem(ctx, cx, cy + size * 0.03, size, size * 0.82, CRYSTAL, Math.max(4, size * 0.03));
  if (lv === 3) {
    miniCrown(ctx, cx, cy - size * 0.16, size * 0.66, m.sym, accent);
    star(ctx, cx, cy + size * 0.28, size * 0.22, m.sym);
    return;
  }
  const n = lv + 1;
  const R = [size * 0.42, size * 0.3, size * 0.26][lv];
  const pos = n === 1 ? [[0, 0]] : n === 2 ? [[-0.26, 0], [0.26, 0]] : [[-0.34, 0.1], [0, -0.14], [0.34, 0.1]];
  pos.forEach(([dx, dy]) => star(ctx, cx + dx * size, cy + dy * size, R, m.sym));
}

// ---------- SERİ A: TAÇ ----------
const crownPath = (ctx: C2) => {
  ctx.beginPath();
  ctx.moveTo(78, 318);
  ctx.lineTo(90, 150);
  ctx.lineTo(160, 236);
  ctx.lineTo(178, 122);
  ctx.lineTo(226, 222);
  ctx.lineTo(256, 90);
  ctx.lineTo(286, 222);
  ctx.lineTo(334, 122);
  ctx.lineTo(352, 236);
  ctx.lineTo(422, 150);
  ctx.lineTo(434, 318);
  ctx.closePath();
};
function drawCrown(ctx: C2, lv: number, accent: string) {
  const m = MATS[lv];
  ctx.save();
  ctx.save();
  ctx.translate(0, 12);
  crownPath(ctx);
  ctx.fillStyle = '#2b2f34';
  ctx.strokeStyle = '#1E1E1E';
  ctx.lineWidth = 16;
  ctx.stroke();
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(62, 300, 388, 82, 18);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  crownPath(ctx);
  ctx.strokeStyle = '#1E1E1E';
  ctx.lineWidth = 16;
  ctx.stroke();
  crownPath(ctx);
  ctx.fillStyle = lin(ctx, 0, 90, 0, 318, [m.metal[0], m.metal[1], m.metal[2], m.metal[3]]);
  ctx.fill();
  // spikes: light + dark facet (crystal from Platin up, metal below) — wide facets, no hairlines
  ctx.save();
  crownPath(ctx);
  ctx.clip();
  const spikes = [
    [90, 150, 78, 318, 160, 236],
    [178, 122, 160, 236, 226, 222],
    [256, 90, 226, 222, 286, 222],
    [334, 122, 286, 222, 352, 236],
    [422, 150, 352, 236, 434, 318],
  ];
  const fc = lv >= 4 ? CRYSTAL : m.metal;
  spikes.forEach(([tx, ty, lx, ly, rx, ry]) => {
    ctx.globalAlpha = lv >= 4 ? 0.75 : lv === 3 ? 0.62 : 0.5;
    poly(ctx, [[tx, ty], [lx, ly], [lx, 320], [tx, 320]], lin(ctx, 0, ty, 0, 320, ['rgba(255,255,255,.95)', fc[1], fc[2]]));
    ctx.globalAlpha = lv >= 4 ? 0.6 : lv === 3 ? 0.55 : 0.45;
    poly(ctx, [[tx, ty], [rx, ry], [rx, 320], [tx, 320]], lin(ctx, 0, ty, 0, 320, [fc[2], fc[3], fc[4]]));
  });
  ctx.globalAlpha = 1;
  ctx.restore();
  crownPath(ctx);
  ctx.strokeStyle = '#1E1E1E';
  ctx.lineWidth = 6;
  ctx.stroke();
  // band
  ctx.beginPath();
  ctx.roundRect(62, 296, 388, 84, 20);
  ctx.strokeStyle = '#1E1E1E';
  ctx.lineWidth = 14;
  ctx.stroke();
  ctx.fillStyle = lin(ctx, 0, 296, 0, 380, [m.metal[0], m.metal[2], m.metal[3], m.metal[4]]);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.6)';
  ctx.fillRect(76, 304, 360, 6);
  ctx.fillStyle = accent;
  ctx.fillRect(70, 366, 372, 6);
  // band stones: more with each level (big and few — readable at 100 px)
  gem(ctx, 256, 338, 74, 60, ORANGE, 4);
  if (lv >= 1) [[140, 338], [372, 338]].forEach(([x, y]) => (lv >= 3 ? gem(ctx, x, y, 52, 44, CRYSTAL, 4) : ball(ctx, x, y, 16, lv === 2 ? ORANGE : m.metal, 4, false)));
  // spike tips: metal balls → stones
  const tips = [
    [90, 146, 22],
    [178, 118, 22],
    [256, 82, 28],
    [334, 118, 22],
    [422, 146, 22],
  ];
  tips.forEach(([x, y, r], i) => {
    if (lv === 4 && i === 2) return gem(ctx, x, y - 2, 78, 64, CRYSTAL, 5); // Elmas: big diamond on the top spike
    const stone = lv >= 3 || (lv === 2 && i === 2) || (lv === 1 && i === 2);
    ball(ctx, x, y, r, stone ? (lv === 2 ? ORANGE : lv >= 3 ? CRYSTAL : m.gem) : m.metal, 5, stone);
  });
  ctx.restore();
}

// ---------- SERİ B: ROZET ----------
function hex(ctx: C2, cx: number, cy: number, R: number, begin = true) {
  if (begin) ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU - Math.PI / 2;
    const x = cx + Math.cos(a) * R,
      y = cy + Math.sin(a) * R;
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.closePath();
}
const BX = 256,
  BY = 250,
  BR = 214;
function drawBadge(ctx: C2, lv: number, accent: string) {
  const m = MATS[lv];
  const fr = lv === 4 ? CRYSTAL : m.metal;
  ctx.save();
  ctx.save();
  ctx.translate(0, 12);
  hex(ctx, BX, BY, BR);
  ctx.fillStyle = '#2b2f34';
  ctx.strokeStyle = '#1E1E1E';
  ctx.lineWidth = 16;
  ctx.stroke();
  ctx.fill();
  ctx.restore();
  hex(ctx, BX, BY, BR);
  ctx.strokeStyle = '#1E1E1E';
  ctx.lineWidth = 16;
  ctx.stroke();
  for (let i = 0; i < 6; i++) {
    const a0 = (i / 6) * TAU - Math.PI / 2,
      a1 = ((i + 1) / 6) * TAU - Math.PI / 2;
    const o0 = [BX + Math.cos(a0) * BR, BY + Math.sin(a0) * BR],
      o1 = [BX + Math.cos(a1) * BR, BY + Math.sin(a1) * BR];
    const r2 = BR * 0.78;
    const i0 = [BX + Math.cos(a0) * r2, BY + Math.sin(a0) * r2],
      i1 = [BX + Math.cos(a1) * r2, BY + Math.sin(a1) * r2];
    const mid = [(o0[0] + o1[0]) / 2, (o0[1] + o1[1]) / 2],
      midI = [(i0[0] + i1[0]) / 2, (i0[1] + i1[1]) / 2];
    const tone = [0, 1, 3, 4, 3, 1][i];
    if (lv >= 3) {
      poly(ctx, [o0, mid, midI, i0], fr[tone]);
      poly(ctx, [mid, o1, i1, midI], fr[Math.min(4, tone + 1)]);
    } else {
      poly(ctx, [o0, o1, i1, i0], fr[tone]);
    }
  }
  ctx.strokeStyle = 'rgba(255,255,255,.7)';
  ctx.lineWidth = 3;
  hex(ctx, BX, BY, BR - 6);
  ctx.stroke();
  hex(ctx, BX, BY, BR * 0.78);
  ctx.strokeStyle = '#1E1E1E';
  ctx.lineWidth = 10;
  ctx.stroke();
  const fg = ctx.createRadialGradient(BX, BY - 40, 10, BX, BY, BR * 0.8);
  fg.addColorStop(0, '#3A3A3A');
  fg.addColorStop(1, '#161616');
  ctx.fillStyle = fg;
  ctx.fill();
  hex(ctx, BX, BY, BR * 0.7);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 6;
  ctx.stroke();
  levelSymbol(ctx, lv, BX, BY, lv === 4 ? 196 : 200, m, accent);
  ball(ctx, BX, BY - BR + 6, 20, ORANGE, 4);
  ctx.restore();
}
function badgeEdgeLight(g: C2, p: number, lv: number) {
  g.save();
  g.beginPath();
  hex(g, BX, BY, BR, false);
  hex(g, BX, BY, BR * 0.78, false);
  g.clip('evenodd');
  const a = 0.35 + lv * 0.12;
  const cg = g.createConicGradient(p * TAU - Math.PI / 2, BX, BY);
  cg.addColorStop(0, `rgba(255,255,255,${a})`);
  cg.addColorStop(0.08, 'rgba(255,255,255,0)');
  cg.addColorStop(0.5, 'rgba(255,255,255,0)');
  cg.addColorStop(0.5, `rgba(255,190,120,${a * 0.7})`);
  cg.addColorStop(0.58, 'rgba(255,190,120,0)');
  cg.addColorStop(0.92, 'rgba(255,255,255,0)');
  cg.addColorStop(1, `rgba(255,255,255,${a})`);
  g.fillStyle = cg;
  g.fillRect(0, 0, 512, 512);
  g.restore();
}

// ---------- SERİ C: CHIP ----------
function chipFace(lv: number, accent: string, S: number) {
  const m = MATS[lv];
  const [c, x] = mk(S);
  const cx = 256,
    cy = 256,
    R = 200;
  x.beginPath();
  x.arc(cx, cy, R, 0, TAU);
  x.fillStyle = lin(x, 0, 56, 0, 456, [m.metal[0], m.metal[1], m.metal[2], m.metal[1]]);
  x.fill();
  for (let i = 0; i < 8; i++) {
    x.save();
    x.translate(cx, cy);
    x.rotate((i / 8) * TAU);
    x.beginPath();
    x.moveTo(-26, -R + 2);
    x.lineTo(26, -R + 2);
    x.lineTo(20, -R + 44);
    x.lineTo(-20, -R + 44);
    x.closePath();
    x.fillStyle = lin(x, 0, -R, 0, -R + 44, [ORANGE[1], accent, ORANGE[3]]);
    x.fill();
    x.restore();
  }
  x.beginPath();
  x.arc(cx, cy, 150, 0, TAU);
  x.strokeStyle = '#1E1E1E';
  x.lineWidth = 8;
  x.stroke();
  x.setLineDash([16, 12]);
  x.beginPath();
  x.arc(cx, cy, 136, 0, TAU);
  x.strokeStyle = accent;
  x.lineWidth = 6;
  x.stroke();
  x.setLineDash([]);
  const ig = x.createRadialGradient(cx - 40, cy - 60, 10, cx, cy, 150);
  ig.addColorStop(0, '#3A3A3A');
  ig.addColorStop(1, '#151515');
  x.beginPath();
  x.arc(cx, cy, 126, 0, TAU);
  x.fillStyle = ig;
  x.fill();
  levelSymbol(x, lv, cx, cy, lv === 4 ? 150 : 160, m, accent);
  x.save();
  x.beginPath();
  x.arc(cx, cy, R, 0, TAU);
  x.clip();
  x.fillStyle = lin(x, 0, 56, 0, 256, ['rgba(255,255,255,.35)', 'rgba(255,255,255,0)']);
  x.fillRect(0, 0, 512, 256);
  x.restore();
  x.beginPath();
  x.arc(cx, cy, R, 0, TAU);
  x.strokeStyle = '#1E1E1E';
  x.lineWidth = 10;
  x.stroke();
  return c;
}
function drawChip(ctx: C2, lv: number, accent: string, p: number, face: HTMLCanvasElement) {
  const m = MATS[lv];
  const th = 0.38 * Math.sin(p * TAU);
  const sx = Math.cos(th),
    side = Math.sin(th) * 34,
    cx = 256,
    cy = 256,
    R = 200;
  ctx.save();
  const steps = Math.ceil(Math.abs(side));
  for (let k = steps; k >= 0; k--) {
    const dx = (side * k) / Math.max(1, steps);
    ctx.beginPath();
    ctx.ellipse(cx - dx, cy, R * sx + 5, R + 5, 0, 0, TAU);
    ctx.fillStyle = '#1E1E1E';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx - dx, cy, R * sx, R, 0, 0, TAU);
    ctx.fillStyle = lin(ctx, 0, 56, 0, 456, m.edge);
    ctx.fill();
  }
  if (steps > 2) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx - side, cy, R * sx, R, 0, 0, TAU);
    ctx.clip();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + Math.PI / 8;
      const yy = cy + Math.sin(a) * R * 0.92;
      ctx.fillStyle = accent;
      ctx.fillRect(Math.min(cx - side, cx) - R, yy - 10, 2 * R + Math.abs(side), 20);
    }
    ctx.restore();
  }
  ctx.translate(cx, cy);
  ctx.scale(sx, 1);
  ctx.drawImage(face, -256, -256, 512, 512);
  ctx.restore();
}

/** sparkle positions per series; level n shows the first n+1 (Elmas: all five) */
const SPARKS: Record<BonusStyle['series'], number[][]> = {
  crown: [[256, 64, 34, 0.0], [420, 132, 24, 0.66], [92, 132, 24, 0.33], [440, 300, 20, 0.5], [70, 300, 18, 0.15]],
  badge: [[350, 196, 26, 0.1], [256, 40, 22, 0.7], [172, 290, 20, 0.45], [440, 360, 18, 0.25], [76, 150, 18, 0.85]],
  chip: [[392, 116, 26, 0.2], [118, 400, 20, 0.6], [256, 50, 18, 0.85], [440, 330, 18, 0.4], [80, 170, 18, 0.05]],
};

const objCache = new Map<string, HTMLCanvasElement>();
let scratch: HTMLCanvasElement | null = null;

/** draws one frame of a bonus emoji onto ctx (canvas size 512*S) */
export function drawBonusFrame(ctx: C2, st: BonusStyle, p: number, S: number) {
  const lv = Math.max(0, Math.min(4, st.level));
  const accent = st.accent || '#FF8E16';
  const key = `${st.series}|${lv}|${accent}|${S.toFixed(3)}`;
  let obj: HTMLCanvasElement;
  if (st.series === 'chip') {
    let face = objCache.get(key + '|face');
    if (!face) objCache.set(key + '|face', (face = chipFace(lv, accent, S)));
    const [o, x] = mk(S);
    drawChip(x, lv, accent, p, face);
    obj = o;
  } else {
    const hit = objCache.get(key);
    if (hit) obj = hit;
    else {
      const [o, x] = mk(S);
      if (st.series === 'crown') drawCrown(x, lv, accent);
      else drawBadge(x, lv, accent);
      objCache.set(key, (obj = o));
    }
  }
  const breath = Math.pow(Math.sin(p * Math.PI), 2);
  const sc = (st.scale ?? 1) * (1 + 0.03 * breath);
  const shine = st.shine ?? 1;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.scale(S, S);
  ctx.translate(256, 256);
  ctx.scale(sc, sc);
  ctx.translate(-256, -256);
  // orange glow: grows with the level
  const ga = Math.min(1, (0.22 + lv * 0.06 + 0.3 * breath) * shine);
  ctx.save();
  ctx.shadowColor = `rgba(255,142,22,${ga.toFixed(3)})`;
  ctx.shadowBlur = (14 + lv * 2 + 10 * breath) * S;
  ctx.drawImage(obj, 0, 0, 512, 512);
  ctx.restore();
  ctx.drawImage(obj, 0, 0, 512, 512);
  // one metallic light sweep over the object only
  const sp = (p - 0.3) / 0.42;
  if (sp >= 0 && sp <= 1 && shine > 0) {
    const t = (scratch ??= document.createElement('canvas'));
    t.width = obj.width;
    t.height = obj.height;
    const tx = t.getContext('2d')!;
    tx.drawImage(obj, 0, 0);
    tx.globalCompositeOperation = 'source-atop';
    tx.scale(S, S);
    const band = 150,
      bx = -band + sp * (512 + band * 2);
    tx.translate(bx, 256);
    tx.rotate(0.45);
    const gr = tx.createLinearGradient(-band / 2, 0, band / 2, 0);
    const a = Math.min(0.95, (0.5 + lv * 0.07) * shine);
    gr.addColorStop(0, 'rgba(255,255,255,0)');
    gr.addColorStop(0.5, `rgba(255,255,255,${a.toFixed(3)})`);
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    tx.fillStyle = gr;
    tx.fillRect(-band / 2, -800, band, 1600);
    ctx.drawImage(t, 0, 0, 512, 512);
  }
  if (st.series === 'badge') badgeEdgeLight(ctx, p, lv);
  ctx.restore();
  // sparkles (integer frequency → seamless loop); more with each level
  ctx.save();
  ctx.setTransform(S, 0, 0, S, 0, 0);
  ctx.translate(256, 256);
  ctx.scale(st.scale ?? 1, st.scale ?? 1);
  ctx.translate(-256, -256);
  SPARKS[st.series].slice(0, lv + 1).forEach(([x, y, r, ph]) => {
    const a = Math.pow(Math.max(0, Math.sin((p + ph) * TAU)), 6) * Math.min(1, shine);
    sparkle(ctx, x, y, r * (0.6 + 0.4 * a), a);
  });
  ctx.restore();
}

export const BonusView: React.FC<{ style: BonusStyle; width: number; height: number; frame: number; duration: number }> = ({ style, width, height, frame, duration }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const W = Math.max(1, Math.round(width));
  const H = Math.max(1, Math.round(height));
  const S = Math.min(W, H) / 512;
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    const L = Math.max(1, duration);
    const p = (((frame % L) + L) % L) / L;
    drawBonusFrame(ctx, style, p, S);
  }, [frame, duration, S, JSON.stringify(style)]);
  const side = Math.round(512 * S);
  return <canvas ref={ref} width={side} height={side} style={{ position: 'absolute', left: (W - side) / 2, top: (H - side) / 2, width: side, height: side, display: 'block' }} />;
};
