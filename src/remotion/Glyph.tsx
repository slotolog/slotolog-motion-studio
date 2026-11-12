import React, { useLayoutEffect, useRef, useState, useEffect } from 'react';
import { useDelayRender } from 'remotion';
import { reelState } from '../lib/reel';
import { FONT_FAMILY } from '../lib/fonts';
import type { GlyphStyle, ReelAssemble } from '../types';

/**
 * Premium Rakamlar — 3D altın rakam çizici (canvas).
 * Katmanlar: yumuşak gölge → koyu gri 3D derinlik → antrasit dış hat → turuncu kenar (bevel) → metalik altın yüz
 * (koyu yansıma bandıyla) → üst parlama. Bütün karakterler aynı yazı boyutu ve taban çizgisiyle çizilir:
 * yan yana yazıldığında yükseklik, kalınlık, gölge ve hiza tutarlıdır. Çok geniş karakterler (FS, %) yalnızca yatayda daraltılır.
 */

const CAP = 0.7; // Montserrat cap height / em
export const glyphFont = (size: number) => `900 ${size}px ${FONT_FAMILY}, sans-serif`;

function shade(hex: string, k: number) {
  const n = parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

const cache = new Map<string, HTMLCanvasElement>();

/** one glyph on its own canvas (w × h of the layer box), baseline and cap height fixed by fontSize */
export function glyphCanvas(text: string, fontSize: number, w: number, h: number, st: GlyphStyle): HTMLCanvasElement {
  const key = [text, fontSize, w, h, st.accent, st.depth].join('|');
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const g = c.getContext('2d')!;
  g.font = glyphFont(fontSize);
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.lineJoin = 'round';
  const cap = fontSize * CAP;
  const outline = fontSize * 0.055;
  const rim = fontSize * 0.024;
  const depth = st.depth;
  const maxW = w - outline * 2 - depth - 8;
  const tw = g.measureText(text).width;
  const sx = tw > maxW ? maxW / tw : 1;
  const cx = w / 2 - depth * 0.15;
  const base = h / 2 + cap / 2 - depth * 0.5;
  g.translate(cx, 0);
  g.scale(sx, 1);
  const T = (fn: (x: number, y: number) => void, dx = 0, dy = 0) => fn(dx / sx, base + dy);
  // soft drop shadow (dark grey depth below)
  g.save();
  g.shadowColor = 'rgba(0,0,0,.55)';
  g.shadowBlur = fontSize * 0.05;
  g.shadowOffsetY = fontSize * 0.03;
  g.fillStyle = '#121110';
  g.strokeStyle = '#121110';
  g.lineWidth = outline * 2;
  T((x, y) => g.strokeText(text, x, y), depth * 0.35, depth);
  g.restore();
  // 3D extrusion: dark grey going warmer towards the face
  for (let i = depth; i >= 1; i--) {
    const k = i / depth;
    g.strokeStyle = `rgb(${Math.round(24 + 30 * (1 - k))},${Math.round(22 + 22 * (1 - k))},${Math.round(20 + 14 * (1 - k))})`;
    g.lineWidth = outline * 2;
    T((x, y) => g.strokeText(text, x, y), i * 0.35, i);
  }
  // anthracite outline
  g.strokeStyle = '#1E1E1E';
  g.lineWidth = outline * 2;
  T((x, y) => g.strokeText(text, x, y));
  // orange bevel rim
  const rg = g.createLinearGradient(0, base - cap, 0, base);
  rg.addColorStop(0, shade(st.accent, 0.45));
  rg.addColorStop(0.5, st.accent);
  rg.addColorStop(1, shade(st.accent, -0.35));
  g.strokeStyle = rg;
  g.lineWidth = rim * 2;
  T((x, y) => g.strokeText(text, x, y));
  // metallic gold face (dark reflection band in the middle like polished metal)
  const fg = g.createLinearGradient(0, base - cap * 1.02, 0, base + fontSize * 0.02);
  fg.addColorStop(0, '#FFFBEA');
  fg.addColorStop(0.16, '#FFE7A2');
  fg.addColorStop(0.38, '#F7C24C');
  fg.addColorStop(0.5, '#B8701A');
  fg.addColorStop(0.58, '#F2B640');
  fg.addColorStop(0.74, '#FFE08A');
  fg.addColorStop(0.9, shade(st.accent, 0.15));
  fg.addColorStop(1, shade(st.accent, -0.2));
  g.fillStyle = fg;
  T((x, y) => g.fillText(text, x, y));
  cache.set(key, c);
  return c;
}

/** Slot Reel / Golden Pulse / static premium glyph, drawn per frame */
export const GlyphView: React.FC<{
  text: string;
  fontSize: number;
  width: number;
  height: number;
  style: GlyphStyle;
  reel?: ReelAssemble;
  frame: number;
  duration: number;
}> = ({ text, fontSize, width, height, style, reel, frame, duration }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const { delayRender, continueRender } = useDelayRender();
  const handle = useRef<number | null>(null);
  if (handle.current === null) handle.current = delayRender('Rakam yazı tipi yükleniyor');
  const [ready, setReady] = useState(false);
  const release = () => {
    if (handle.current !== null && handle.current !== -1) {
      continueRender(handle.current);
      handle.current = -1;
    }
  };
  useEffect(() => {
    let alive = true;
    document.fonts
      .load(glyphFont(Math.round(fontSize)), text + '0123456789')
      .then(() => alive && setReady(true))
      .catch(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, [fontSize, text]);
  useEffect(() => release, []);
  const W = Math.max(1, Math.round(width));
  const H = Math.max(1, Math.round(height));
  const pad = Math.round(H * 0.15);
  useLayoutEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx || !ready) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    const main = glyphCanvas(text, fontSize, W, H, style);
    const bright = style.brightness ?? 1;
    const L = Math.max(1, duration);
    const f = ((frame % L) + L) % L;
    let scale = 1;
    let glow = 0;
    let shine: number | null = null;
    ctx.save();
    ctx.translate(pad, pad);
    if (bright !== 1) ctx.filter = `brightness(${bright})`;
    if (style.anim === 'reel' && reel) {
      const st = reelState(reel, f, L);
      const col = st.columns[0];
      scale = st.scale;
      glow = Math.max(st.glow * 0.8, col.glow * 0.9);
      shine = st.shine;
      ctx.translate(W / 2, H / 2);
      ctx.scale(scale, scale);
      ctx.translate(-W / 2, -H / 2);
      if (!col.rolling) drawGlow(ctx, main, glow, style.accent, H);
      else {
        // the reel window is the glyph's own box: the digit slides down and away, other digits roll past, it lands again
        ctx.save();
        ctx.beginPath();
        ctx.rect(-pad, H * 0.06, W + pad * 2, H * 0.88);
        ctx.clip();
        const chars = (style.spin ?? '0123456789').split('').filter((ch) => ch !== text);
        const start = Math.max(0, (style.spin ?? '0123456789').indexOf(text));
        for (let k = 0; k < col.items; k++) {
          const y = (col.offset - k) * H;
          if (y > H || y < -H) continue;
          const im = k === 0 || k === col.items - 1 ? main : glyphCanvas(chars[(start + k) % chars.length], fontSize, W, H, style);
          const blur = Math.min(3, Math.round(col.speed * 2.2));
          for (let b = blur; b >= 0; b--) {
            ctx.globalAlpha = b === 0 ? 1 : 0.22 / b;
            ctx.drawImage(im, 0, y - b * col.speed * H * 0.16);
          }
          ctx.globalAlpha = 1;
        }
        ctx.restore();
      }
    } else if (style.anim === 'pulse') {
      // Golden Pulse: two soft breaths per loop, one light sweep, always readable
      const p = f / L;
      const breath = Math.pow(Math.sin(p * Math.PI * 2), 2);
      scale = 1 + 0.04 * breath;
      glow = 0.2 + 0.5 * breath;
      const sp = (p - 0.3) / 0.35;
      shine = sp >= 0 && sp <= 1 ? sp : null;
      ctx.translate(W / 2, H / 2);
      ctx.scale(scale, scale);
      ctx.translate(-W / 2, -H / 2);
      drawGlow(ctx, main, glow, style.accent, H, 0.065);
    } else drawGlow(ctx, main, 0, style.accent, H);
    ctx.restore();
    if (shine !== null) {
      // light sweep only over the glyph's own pixels
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      const band = W * 0.38;
      const bx = pad - band + shine * (W + band * 2);
      ctx.translate(bx, pad + H / 2);
      ctx.rotate(0.42);
      const gr = ctx.createLinearGradient(-band / 2, 0, band / 2, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0)');
      gr.addColorStop(0.5, 'rgba(255,250,228,.85)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(-band / 2, -H * 2, band, H * 4);
      ctx.restore();
    }
    release();
  }, [ready, text, fontSize, W, H, frame, duration, JSON.stringify(style), JSON.stringify(reel)]);
  return <canvas ref={ref} width={W + pad * 2} height={H + pad * 2} style={{ position: 'absolute', left: -pad, top: -pad, width: W + pad * 2, height: H + pad * 2, display: 'block' }} />;
};

function drawGlow(ctx: CanvasRenderingContext2D, im: HTMLCanvasElement, glow: number, accent: string, H: number, radius = 0.12) {
  if (glow > 0.02) {
    ctx.save();
    ctx.shadowColor = accent;
    ctx.shadowBlur = H * radius * glow;
    ctx.globalAlpha = Math.min(1, glow);
    ctx.drawImage(im, 0, 0);
    ctx.restore();
  }
  ctx.drawImage(im, 0, 0);
}
