import { rand } from '../lib/anim';
import { hexToRgba } from '../lib/color';
import { FONT_FAMILY } from '../lib/fonts';
import type { BackgroundSettings, ParticleSettings } from '../types';

type Ctx = CanvasRenderingContext2D;

function bokeh(ctx: Ctx, w: number, h: number, t: number, color: string, count = 26) {
  for (let i = 0; i < count; i++) {
    const r = 12 + rand(i * 3.1) * 60;
    const x = rand(i * 7.7) * w + Math.sin(t * 0.4 + i) * 30;
    const travel = h + r * 2;
    const y = h + r - ((rand(i * 5.3) * travel + t * (20 + rand(i) * 50)) % travel);
    const a = 0.06 + rand(i * 9.1) * 0.2;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, hexToRgba(color, a));
    g.addColorStop(1, hexToRgba(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function rays(ctx: Ctx, cx: number, cy: number, len: number, count: number, angle: number, color: string, alpha: number) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  const step = (Math.PI * 2) / count;
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, len);
  g.addColorStop(0, hexToRgba(color, alpha));
  g.addColorStop(0.6, hexToRgba(color, alpha * 0.5));
  g.addColorStop(1, hexToRgba(color, 0));
  ctx.fillStyle = g;
  for (let i = 0; i < count; i++) {
    const a0 = i * step;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, len, a0, a0 + step * 0.5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

export function drawBackground(ctx: Ctx, s: BackgroundSettings, t: number, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2;
  const cy = h * 0.45;
  const big = Math.max(w, h);
  const sp = s.speed || 1;

  if (s.style === 'rays') {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, big * 0.75);
    g.addColorStop(0, s.colorA);
    g.addColorStop(1, s.colorB);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    rays(ctx, cx, cy, big, Math.max(4, s.rays), t * 0.3 * sp, s.rayColor, 0.32);
    rays(ctx, cx, cy, big * 0.8, Math.max(4, s.rays), -t * 0.18 * sp, s.rayColor, 0.12);
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, big * 0.32);
    const pulse = 0.45 + Math.sin(t * 2 * sp) * 0.1;
    core.addColorStop(0, `rgba(255,255,255,${pulse})`);
    core.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = core;
    ctx.fillRect(0, 0, w, h);
  } else if (s.style === 'gradient') {
    const a = t * 0.4 * sp;
    const dx = Math.cos(a) * w;
    const dy = Math.sin(a) * h;
    const g = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
    g.addColorStop(0, s.colorA);
    g.addColorStop(1, s.colorB);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) {
      const bx = cx + Math.sin(t * 0.5 * sp + i * 1.7) * w * 0.4;
      const by = cy + Math.cos(t * 0.4 * sp + i * 2.3) * h * 0.35;
      const r = big * (0.25 + 0.1 * i);
      const bg = ctx.createRadialGradient(bx, by, 0, bx, by, r);
      bg.addColorStop(0, hexToRgba(s.rayColor, 0.35));
      bg.addColorStop(1, hexToRgba(s.rayColor, 0));
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
    }
  } else if (s.style === 'party') {
    const py = h * 0.42;
    const g = ctx.createRadialGradient(cx, py, 0, cx, py, big * 0.78);
    g.addColorStop(0, '#FFF3B0');
    g.addColorStop(0.18, s.rayColor);
    g.addColorStop(0.5, s.colorA);
    g.addColorStop(1, s.colorB);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // drifting warm-pink washes in the corners
    for (let i = 0; i < 3; i++) {
      const bx = (i % 2 === 0 ? 0.1 : 0.9) * w + Math.sin(t * 0.5 * sp + i * 2) * w * 0.12;
      const by = (i === 2 ? 0.95 : 0.15) * h + Math.cos(t * 0.4 * sp + i) * h * 0.06;
      const bg = ctx.createRadialGradient(bx, by, 0, bx, by, big * 0.4);
      bg.addColorStop(0, hexToRgba(s.colorB, 0.55));
      bg.addColorStop(1, hexToRgba(s.colorB, 0));
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
    }
    rays(ctx, cx, py, big, Math.max(4, s.rays), t * 0.22 * sp, '#FFFFFF', 0.2);
    rays(ctx, cx, py, big * 0.75, Math.max(4, s.rays), -t * 0.12 * sp, s.rayColor, 0.14);
    // lens flares
    for (let i = 0; i < 4; i++) {
      const fx = w * (0.15 + 0.7 * rand(i * 3.3)) + Math.sin(t * 0.7 * sp + i * 1.9) * w * 0.15;
      const fy = h * (0.2 + 0.6 * rand(i * 5.1)) + Math.cos(t * 0.6 * sp + i * 2.7) * h * 0.08;
      const fr = big * (0.05 + 0.05 * rand(i * 8.8)) * (0.85 + 0.15 * Math.sin(t * 3 + i));
      const fg = ctx.createRadialGradient(fx, fy, 0, fx, fy, fr);
      fg.addColorStop(0, 'rgba(255,255,255,0.75)');
      fg.addColorStop(0.3, 'rgba(255,240,200,0.3)');
      fg.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.fillStyle = fg;
      ctx.fillRect(fx - fr, fy - fr, fr * 2, fr * 2);
    }
    const core = ctx.createRadialGradient(cx, py, 0, cx, py, big * 0.28);
    core.addColorStop(0, `rgba(255,255,255,${0.42 + Math.sin(t * 2 * sp) * 0.08})`);
    core.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = core;
    ctx.fillRect(0, 0, w, h);
  } else if (s.style === 'luxury') {
    const ly = h * 0.58;
    const g = ctx.createRadialGradient(cx, ly, 0, cx, ly, big * 0.85);
    g.addColorStop(0, s.colorB);
    g.addColorStop(0.55, '#120A02');
    g.addColorStop(1, '#040302');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const pulse = 0.85 + Math.sin(t * 1.6 * sp) * 0.15;
    const glow = ctx.createRadialGradient(cx, ly, 0, cx, ly, big * 0.42);
    glow.addColorStop(0, hexToRgba(s.colorA, 0.5 * pulse));
    glow.addColorStop(1, hexToRgba(s.colorA, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    rays(ctx, cx, ly, big, Math.max(4, s.rays), t * 0.15 * sp, s.rayColor, 0.15);
    rays(ctx, cx, ly, big * 0.7, Math.max(4, s.rays), -t * 0.1 * sp, s.colorA, 0.08);
    // top and bottom warm edge light
    const top = ctx.createLinearGradient(0, 0, 0, h * 0.25);
    top.addColorStop(0, hexToRgba(s.colorA, 0.28));
    top.addColorStop(1, hexToRgba(s.colorA, 0));
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, w, h * 0.25);
    const bot = ctx.createLinearGradient(0, h, 0, h * 0.75);
    bot.addColorStop(0, hexToRgba(s.colorA, 0.35));
    bot.addColorStop(1, hexToRgba(s.colorA, 0));
    ctx.fillStyle = bot;
    ctx.fillRect(0, h * 0.75, w, h * 0.25);
    // diagonal light sweep
    const period = 4.5 / Math.max(0.1, sp);
    const ph = (t % period) / period;
    ctx.save();
    ctx.translate(-w * 0.6 + ph * w * 2.2, h / 2);
    ctx.rotate(-0.4);
    const sw = ctx.createLinearGradient(-160, 0, 160, 0);
    sw.addColorStop(0, 'rgba(255,220,150,0)');
    sw.addColorStop(0.5, 'rgba(255,220,150,0.14)');
    sw.addColorStop(1, 'rgba(255,220,150,0)');
    ctx.fillStyle = sw;
    ctx.fillRect(-160, -h * 1.5, 320, h * 3);
    ctx.restore();
  } else {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, big * 0.8);
    g.addColorStop(0, hexToRgba(s.colorB, 1));
    g.addColorStop(1, '#0b0b0b');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    rays(ctx, cx, cy, big, Math.max(4, s.rays), t * 0.2 * sp, s.colorA, 0.08);
    for (let i = 0; i < 3; i++) {
      const bx = cx + Math.sin(t * 0.6 * sp + i * 2.1) * w * 0.35;
      const by = cy + Math.cos(t * 0.5 * sp + i * 1.3) * h * 0.3;
      const r = big * 0.3;
      const bg = ctx.createRadialGradient(bx, by, 0, bx, by, r);
      bg.addColorStop(0, hexToRgba(s.colorA, 0.32));
      bg.addColorStop(1, hexToRgba(s.colorA, 0));
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
    }
  }

  if (s.bokeh) bokeh(ctx, w, h, t * sp, s.style === 'dark' || s.style === 'luxury' ? s.colorA : '#FFFFFF');

  const v = ctx.createRadialGradient(cx, cy, big * 0.35, cx, cy, big * 0.85);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, s.style === 'party' ? 'rgba(90,0,40,0.28)' : 'rgba(0,0,0,0.35)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
}

export function drawCoin(ctx: Ctx, x: number, y: number, r: number, spin: number, tilt: number) {
  const sx = Math.max(0.08, Math.abs(Math.cos(spin)));
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.scale(sx, 1);
  // edge (thickness)
  ctx.fillStyle = '#9A5800';
  ctx.beginPath();
  ctx.arc(r * 0.08 * Math.sign(Math.cos(spin) || 1), 0, r, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
  g.addColorStop(0, '#FFF8C4');
  g.addColorStop(0.35, '#FFD84A');
  g.addColorStop(0.75, '#F2A007');
  g.addColorStop(1, '#B86A00');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = r * 0.1;
  ctx.strokeStyle = '#C47A00';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.78, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#B56A00';
  ctx.font = `900 ${Math.round(r * 1.05)}px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('₺', 0, r * 0.05);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.3, -r * 0.4, r * 0.35, r * 0.15, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function star(ctx: Ctx, x: number, y: number, r: number, alpha: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#FFFBE0';
  ctx.shadowColor = '#FFD54A';
  ctx.shadowBlur = r * 1.5;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const rr = i % 2 === 0 ? r : r * 0.22;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

const CONFETTI = ['#FF8E16', '#FFD23F', '#FFFFFF', '#FFB347', '#E85D04'];

export function drawParticles(ctx: Ctx, s: ParticleSettings, t: number, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  const sp = s.speed || 1;
  const seed = s.seed || 1;
  const n = Math.max(1, Math.min(300, Math.round(s.count)));
  for (let i = 0; i < n; i++) {
    const R = (k: number) => rand(i * 13.37 + k * 7.1 + seed * 31.7);
    if (s.kind === 'coins') {
      const r = s.size * (0.55 + R(1) * 0.8);
      const fall = (260 + R(2) * 520) * sp;
      const travel = h + r * 4;
      const y = ((R(3) * travel + t * fall) % travel) - r * 2;
      const x = R(4) * w + Math.sin(t * 1.4 + i) * 24;
      drawCoin(ctx, x, y, r, t * (2 + R(5) * 4) * sp + R(6) * 6, (R(7) - 0.5) * 0.8);
    } else if (s.kind === 'burst') {
      const period = 2.6 / sp;
      const lt = (t % period) * sp;
      const ang = R(1) * Math.PI * 2;
      const v = 700 + R(2) * 1100;
      const g = 1700;
      const x = w / 2 + Math.cos(ang) * v * lt;
      const y = h * 0.45 + Math.sin(ang) * v * lt + 0.5 * g * lt * lt;
      const r = s.size * (0.5 + R(3) * 0.8) * Math.min(1, 0.3 + lt * 3);
      drawCoin(ctx, x, y, r, lt * (5 + R(4) * 6), R(5) - 0.5);
    } else if (s.kind === 'sparkles') {
      const x = R(1) * w;
      const y = R(2) * h;
      const a = Math.max(0, Math.sin(t * (2 + R(3) * 3) * sp + R(4) * 20));
      star(ctx, x, y, s.size * (0.3 + R(5) * 0.7), a);
    } else if (s.kind === 'fruits') {
      const rise = (90 + R(2) * 140) * sp;
      const r = s.size * (0.55 + R(1) * 0.6);
      const travel = h + r * 4;
      const y = h + r * 2 - ((R(3) * travel + t * rise) % travel);
      const x = R(4) * w + Math.sin(t * 0.9 * sp + i * 1.7) * 40;
      ctx.globalAlpha = 0.95;
      drawFruit(ctx, FRUITS[Math.floor(R(5) * FRUITS.length)], x, y, r, Math.sin(t * 1.2 * sp + i) * 0.5);
      ctx.globalAlpha = 1;
    } else if (s.kind === 'fruitFrame') {
      // decorative rows along the top and bottom edges (count = fruits per row)
      const per = Math.max(3, Math.min(14, Math.round(s.count)));
      for (const row of [0, 1]) {
        for (let j = 0; j < per; j++) {
          const RR = (k: number) => rand(j * 7.3 + row * 91 + k * 3.7 + seed * 13.1);
          const r = s.size * (0.85 + RR(1) * 0.35);
          const x = ((j + 0.5) / per) * w + (RR(2) - 0.5) * (w / per) * 0.35;
          const base = row === 0 ? r * 0.35 : h - r * 0.35;
          const y = base + Math.sin(t * 1.6 * sp + j * 1.3 + row) * r * 0.08;
          drawFruit(ctx, FRUITS[(j * 3 + row * 2 + Math.floor(seed)) % FRUITS.length], x, y, r, Math.sin(t * 1.1 * sp + j) * 0.12 + (RR(3) - 0.5) * 0.5);
        }
      }
      break;
    } else {
      const fall = (200 + R(2) * 400) * sp;
      const travel = h + 80;
      const y = ((R(3) * travel + t * fall) % travel) - 40;
      const x = R(4) * w + Math.sin(t * 2 + i) * 40;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t * (2 + R(5) * 4) + i);
      ctx.scale(1, Math.abs(Math.cos(t * 4 * sp + i)));
      ctx.fillStyle = CONFETTI[i % CONFETTI.length];
      const sz = s.size * 0.4;
      ctx.fillRect(-sz / 2, -sz / 4, sz, sz / 2);
      ctx.restore();
    }
  }
}

export const FRUITS = ['cherry', 'lemon', 'watermelon', 'grapes', 'orange', 'plum', 'seven'] as const;
export type Fruit = (typeof FRUITS)[number];

function ball(ctx: Ctx, x: number, y: number, r: number, light: string, dark: string, outline: string) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, light);
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.1);
  ctx.strokeStyle = outline;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.35, y - r * 0.42, r * 0.28, r * 0.15, -0.6, 0, Math.PI * 2);
  ctx.fill();
}

function leaf(ctx: Ctx, x: number, y: number, r: number, rot: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = '#43A047';
  ctx.strokeStyle = '#1B5E20';
  ctx.lineWidth = Math.max(1, r * 0.06);
  ctx.beginPath();
  ctx.ellipse(r * 0.35, 0, r * 0.38, r * 0.17, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** Cartoon slot-machine fruit centred on (x,y), roughly r in radius. */
export function drawFruit(ctx: Ctx, kind: Fruit, x: number, y: number, r: number, rot: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.lineJoin = 'round';
  switch (kind) {
    case 'cherry': {
      ctx.strokeStyle = '#2E7D32';
      ctx.lineWidth = r * 0.09;
      ctx.beginPath();
      ctx.moveTo(-r * 0.45, r * 0.05);
      ctx.quadraticCurveTo(-r * 0.2, -r * 0.6, r * 0.15, -r * 0.85);
      ctx.moveTo(r * 0.4, r * 0.15);
      ctx.quadraticCurveTo(r * 0.3, -r * 0.4, r * 0.15, -r * 0.85);
      ctx.stroke();
      leaf(ctx, r * 0.15, -r * 0.85, r, -0.4);
      ball(ctx, -r * 0.42, r * 0.38, r * 0.45, '#FF8A80', '#B71C1C', '#5D0000');
      ball(ctx, r * 0.4, r * 0.48, r * 0.45, '#FF8A80', '#B71C1C', '#5D0000');
      break;
    }
    case 'lemon': {
      const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
      g.addColorStop(0, '#FFFDE7');
      g.addColorStop(0.5, '#FFEB3B');
      g.addColorStop(1, '#F9A825');
      ctx.fillStyle = g;
      ctx.strokeStyle = '#8D6E00';
      ctx.lineWidth = r * 0.08;
      ctx.beginPath();
      ctx.moveTo(-r, 0);
      ctx.bezierCurveTo(-r * 0.9, -r * 0.85, r * 0.9, -r * 0.85, r, 0);
      ctx.bezierCurveTo(r * 0.9, r * 0.85, -r * 0.9, r * 0.85, -r, 0);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.ellipse(-r * 0.3, -r * 0.3, r * 0.3, r * 0.12, -0.3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'watermelon': {
      ctx.beginPath();
      ctx.arc(0, -r * 0.3, r, 0, Math.PI);
      ctx.closePath();
      ctx.fillStyle = '#2E7D32';
      ctx.fill();
      ctx.lineWidth = r * 0.08;
      ctx.strokeStyle = '#1B5E20';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -r * 0.3, r * 0.86, 0, Math.PI);
      ctx.closePath();
      ctx.fillStyle = '#F1F8E9';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, -r * 0.3, r * 0.76, 0, Math.PI);
      ctx.closePath();
      const g = ctx.createRadialGradient(0, -r * 0.3, 0, 0, -r * 0.3, r * 0.76);
      g.addColorStop(0, '#FF8A80');
      g.addColorStop(1, '#E53935');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.fillStyle = '#212121';
      for (let i = 0; i < 5; i++) {
        const a = 0.35 + i * 0.6;
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * r * 0.45, -r * 0.3 + Math.sin(a) * r * 0.42, r * 0.05, r * 0.09, a, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'grapes': {
      const pts = [[-0.45, -0.35], [0, -0.42], [0.45, -0.35], [-0.25, 0.05], [0.25, 0.05], [0, 0.45], [-0.5, 0.15], [0.5, 0.15]];
      leaf(ctx, 0, -r * 0.8, r, -0.9);
      for (const [px, py] of pts) ball(ctx, px * r, py * r, r * 0.3, '#E1BEE7', '#6A1B9A', '#2A0640');
      break;
    }
    case 'orange': {
      ball(ctx, 0, r * 0.05, r * 0.9, '#FFE0B2', '#EF6C00', '#7A3300');
      ctx.fillStyle = 'rgba(122,51,0,0.25)';
      for (let i = 0; i < 9; i++) {
        ctx.beginPath();
        ctx.arc(Math.cos(i * 2.4) * r * 0.5, Math.sin(i * 2.4) * r * 0.45 + r * 0.1, r * 0.035, 0, Math.PI * 2);
        ctx.fill();
      }
      leaf(ctx, r * 0.05, -r * 0.8, r, -0.5);
      break;
    }
    case 'plum': {
      ball(ctx, 0, r * 0.05, r * 0.85, '#B39DDB', '#4527A0', '#1A0A4A');
      ctx.strokeStyle = '#5D4037';
      ctx.lineWidth = r * 0.08;
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.75);
      ctx.lineTo(r * 0.1, -r * 1.0);
      ctx.stroke();
      break;
    }
    case 'seven': {
      ctx.font = `900 italic ${Math.round(r * 2.1)}px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = r * 0.32;
      ctx.strokeStyle = '#5A1A00';
      ctx.strokeText('7', 0, r * 0.08);
      ctx.lineWidth = r * 0.16;
      ctx.strokeStyle = '#FFD54A';
      ctx.strokeText('7', 0, r * 0.08);
      const g = ctx.createLinearGradient(0, -r, 0, r);
      g.addColorStop(0, '#FF6E6E');
      g.addColorStop(1, '#C62828');
      ctx.fillStyle = g;
      ctx.fillText('7', 0, r * 0.08);
      break;
    }
  }
  ctx.restore();
}

/** Animated orange-gold frame around the video window, with optional bulbs, fruits and 777. */
export function drawStoryFrame(ctx: Ctx, f: import('../types').FrameSettings, t: number, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  const { x, y, w: ww, h: wh } = f.window;
  const L = x - ww / 2;
  const T = y - wh / 2;
  const th = f.thickness;
  const r = f.radius;
  const rr = (pad: number) => {
    ctx.beginPath();
    ctx.roundRect(L - pad, T - pad, ww + pad * 2, wh + pad * 2, r + pad);
  };
  // outer glow (breathing slightly) and soft shadow under the frame
  const glow = f.glow ?? 0;
  if (glow > 0) {
    ctx.save();
    ctx.shadowColor = `rgba(255,150,30,${Math.min(1, 0.55 * glow)})`;
    ctx.shadowBlur = 40 * glow * (0.85 + 0.15 * Math.sin(t * 2.2));
    ctx.lineWidth = th;
    ctx.strokeStyle = f.colorB;
    rr(th / 2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.save();
  ctx.shadowColor = 'rgba(60,10,0,0.55)';
  ctx.shadowBlur = 30;
  ctx.lineWidth = th;
  ctx.strokeStyle = f.colorB;
  rr(th / 2);
  ctx.stroke();
  ctx.restore();
  // moving gold gradient band
  const off = (t * 0.25) % 1;
  const g = ctx.createLinearGradient(L - th, T - th + off * wh * 2 - wh, L + ww + th, T + wh + th + off * wh * 2 - wh);
  g.addColorStop(0, f.colorB);
  g.addColorStop(0.25, '#FFF3B0');
  g.addColorStop(0.5, f.colorA);
  g.addColorStop(0.75, '#FFF3B0');
  g.addColorStop(1, f.colorB);
  ctx.lineWidth = th;
  ctx.strokeStyle = g;
  rr(th / 2);
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#5A1E00';
  rr(0);
  ctx.stroke();
  rr(th);
  ctx.stroke();
  if (f.lights) {
    // bulbs along the frame, chasing
    const per = 2 * (ww + wh + th * 2);
    const n = Math.round(per / 46);
    for (let i = 0; i < n; i++) {
      let d = (i / n) * per;
      const W2 = ww + th;
      const H2 = wh + th;
      let px: number;
      let py: number;
      if (d < W2) {
        px = L - th / 2 + d;
        py = T - th / 2;
      } else if ((d -= W2) < H2) {
        px = L + ww + th / 2;
        py = T - th / 2 + d;
      } else if ((d -= H2) < W2) {
        px = L + ww + th / 2 - d;
        py = T + wh + th / 2;
      } else {
        d -= W2;
        px = L - th / 2;
        py = T + wh + th / 2 - d;
      }
      const on = (Math.floor(t * 8) + i) % 3 === 0;
      const rb = th * 0.22;
      const bg = ctx.createRadialGradient(px, py, 0, px, py, rb * 2.4);
      bg.addColorStop(0, on ? 'rgba(255,255,240,1)' : 'rgba(255,220,140,0.75)');
      bg.addColorStop(0.45, on ? 'rgba(255,214,90,0.9)' : 'rgba(230,140,20,0.6)');
      bg.addColorStop(1, 'rgba(255,160,0,0)');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(px, py, rb * 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (f.fruits) {
    const s = th * 1.6;
    const corners: [number, number, Fruit][] = [
      [L - th * 0.2, T - th * 0.2, 'cherry'],
      [L + ww + th * 0.2, T - th * 0.2, 'lemon'],
      [L - th * 0.2, T + wh + th * 0.2, 'watermelon'],
      [L + ww + th * 0.2, T + wh + th * 0.2, 'grapes'],
    ];
    corners.forEach(([cx, cy, k], i) => drawFruit(ctx, k, cx, cy + Math.sin(t * 2 + i) * 5, s, Math.sin(t * 1.5 + i) * 0.15));
  }
  if (f.sevens) {
    const fs = th * 2.2;
    const draw7 = (cx: number, cy: number, i: number) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1 + Math.sin(t * 3 + i) * 0.05, 1 + Math.sin(t * 3 + i) * 0.05);
      ctx.font = `900 italic ${Math.round(fs)}px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = fs * 0.16;
      ctx.strokeStyle = '#5A1A00';
      ctx.strokeText('777', 0, 0);
      ctx.lineWidth = fs * 0.07;
      ctx.strokeStyle = '#FFD54A';
      ctx.strokeText('777', 0, 0);
      const gg = ctx.createLinearGradient(0, -fs / 2, 0, fs / 2);
      gg.addColorStop(0, '#FF6E6E');
      gg.addColorStop(1, '#C62828');
      ctx.fillStyle = gg;
      ctx.fillText('777', 0, 0);
      ctx.restore();
    };
    draw7(L + ww * 0.13, T - th * 2.1, 0);
    draw7(L + ww * 0.87, T - th * 2.1, 1);
  }
}
