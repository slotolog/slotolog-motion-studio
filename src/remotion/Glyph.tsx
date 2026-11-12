import React, { useLayoutEffect, useRef, useState, useEffect } from 'react';
import { useDelayRender } from 'remotion';
import { reelState } from '../lib/reel';
import { FONT_FAMILY, FONT_INTER } from '../lib/fonts';
import type { GlyphStyle, ReelAssemble } from '../types';

/**
 * Premium Rakamlar — 3D altın rakam çizici (canvas).
 * Katmanlar: yumuşak gölge → koyu gri 3D derinlik → antrasit dış hat → turuncu kenar (bevel) → metalik altın yüz
 * (koyu yansıma bandıyla) → üst parlama. Bütün karakterler aynı yazı boyutu ve taban çizgisiyle çizilir:
 * yan yana yazıldığında yükseklik, kalınlık, gölge ve hiza tutarlıdır. Çok geniş karakterler (FS, %) yalnızca yatayda daraltılır.
 */

const CAP = 0.7; // Montserrat cap height / em
export const glyphFont = (size: number, look?: GlyphStyle['look']) => (look === 'orange' ? `900 ${size}px ${FONT_INTER}, sans-serif` : `900 ${size}px ${FONT_FAMILY}, sans-serif`);
const INTER_CAP = 0.727; // Inter cap height / em

function shade(hex: string, k: number) {
  const n = parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

const cache = new Map<string, HTMLCanvasElement>();
/** V2: the glyph face alone (the light sweep only crosses the orange face, not the dark edges) */
const faceCache = new Map<string, HTMLCanvasElement>();
const keyOf = (text: string, fontSize: number, w: number, h: number, st: GlyphStyle) => [text, fontSize, w, h, st.accent, st.depth, st.look ?? 'gold'].join('|');

/** one glyph on its own canvas (w × h of the layer box), baseline and cap height fixed by fontSize */
export function glyphCanvas(text: string, fontSize: number, w: number, h: number, st: GlyphStyle): HTMLCanvasElement {
  const key = keyOf(text, fontSize, w, h, st);
  const hit = cache.get(key);
  if (hit) return hit;
  if (st.look === 'orange') {
    const [v2, face] = glyphCanvasV2(text, fontSize, w, h, st);
    cache.set(key, v2);
    faceCache.set(key, face);
    return v2;
  }
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


/**
 * Premium Rakamlar V2 — turuncu, temiz, parlak 3D (Inter Black).
 * Katmanlar: yumuşak #1E1E1E gölge → koyu gri derinlik → #1E1E1E dış hat → turuncu kenar → turuncu yüz
 * (üstte beyaz parlaklık, üst kenarlarda ince beyaz kabartma ışığı). Altın yalnız çok hafif açık tonlarda.
 */
function glyphCanvasV2(text: string, fontSize: number, w: number, h: number, st: GlyphStyle): [HTMLCanvasElement, HTMLCanvasElement] {
  const W = Math.max(1, Math.round(w));
  const H = Math.max(1, Math.round(h));
  const font = glyphFont(fontSize, 'orange');
  const cap = fontSize * INTER_CAP;
  const outline = fontSize * 0.05;
  const rim = fontSize * 0.02;
  const depth = st.depth;
  const make = () => {
    const k = document.createElement('canvas');
    k.width = W;
    k.height = H;
    const x = k.getContext('2d')!;
    x.font = font;
    x.textAlign = 'center';
    x.textBaseline = 'alphabetic';
    x.lineJoin = 'round';
    return [k, x] as const;
  };
  const [c, g] = make();
  const maxW = W - outline * 2 - depth * 0.4 - 8;
  const tw = g.measureText(text).width;
  const sx = tw > maxW ? maxW / tw : 1;
  const base = H / 2 + cap / 2 - depth * 0.45;
  const place = (x: CanvasRenderingContext2D) => {
    x.translate(W / 2, 0);
    x.scale(sx, 1);
  };
  place(g);
  g.save();
  g.shadowColor = 'rgba(30,30,30,.55)';
  g.shadowBlur = fontSize * 0.045;
  g.shadowOffsetY = fontSize * 0.025;
  g.strokeStyle = '#1E1E1E';
  g.lineWidth = outline * 2;
  g.strokeText(text, 0, base + depth);
  g.restore();
  for (let i = depth; i >= 1; i--) {
    const k = i / depth;
    g.strokeStyle = `rgb(${Math.round(30 + 26 * (1 - k))},${Math.round(30 + 20 * (1 - k))},${Math.round(30 + 14 * (1 - k))})`;
    g.lineWidth = outline * 2;
    g.strokeText(text, 0, base + i);
  }
  g.strokeStyle = '#1E1E1E';
  g.lineWidth = outline * 2;
  g.strokeText(text, 0, base);
  const rg = g.createLinearGradient(0, base - cap, 0, base);
  rg.addColorStop(0, shade(st.accent, 0.6));
  rg.addColorStop(0.45, st.accent);
  rg.addColorStop(1, shade(st.accent, -0.34));
  g.strokeStyle = rg;
  g.lineWidth = rim * 2;
  g.strokeText(text, 0, base);
  // face on its own canvas, so the gloss and the edge light stay inside the glyph
  const [fc, f] = make();
  place(f);
  const fg = f.createLinearGradient(0, base - cap, 0, base);
  fg.addColorStop(0, shade(st.accent, 0.5));
  fg.addColorStop(0.3, shade(st.accent, 0.18));
  fg.addColorStop(0.52, st.accent);
  fg.addColorStop(0.6, shade(st.accent, -0.09));
  fg.addColorStop(0.82, shade(st.accent, 0.08));
  fg.addColorStop(1, shade(st.accent, -0.18));
  f.fillStyle = fg;
  f.fillText(text, 0, base);
  f.globalCompositeOperation = 'source-atop';
  const gl = f.createLinearGradient(0, base - cap, 0, base - cap * 0.45);
  gl.addColorStop(0, 'rgba(255,255,255,.55)');
  gl.addColorStop(1, 'rgba(255,255,255,0)');
  f.fillStyle = gl;
  f.fillRect(-W, base - cap - fontSize * 0.05, W * 2, cap * 0.6);
  // embossed top edges: glyph mask minus the same mask moved down a little
  const [hc, hx] = make();
  place(hx);
  hx.fillStyle = '#FFFFFF';
  hx.fillText(text, 0, base);
  hx.globalCompositeOperation = 'destination-out';
  hx.fillText(text, 0, base + fontSize * 0.012);
  f.setTransform(1, 0, 0, 1, 0, 0);
  f.globalAlpha = 0.75;
  f.drawImage(hc, 0, 0);
  f.globalAlpha = 1;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(fc, 0, 0);
  return [c, fc];
}

/** Slot Reel / Golden Pulse / Premium Shine (V2) / static premium glyph, drawn per frame */
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
      .load(glyphFont(Math.round(fontSize), style.look), text + '0123456789')
      .then(() => alive && setReady(true))
      .catch(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, [fontSize, text, style.look]);
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
    } else if (style.anim === 'shine') {
      // Premium Shine (V2): stays in place — tiny breath in scale, soft orange glow pulse, one light sweep; first = last frame
      const p = f / L;
      const breath = Math.pow(Math.sin(p * Math.PI), 2);
      scale = 1 + 0.03 * breath;
      glow = 0.18 + 0.5 * breath;
      const sp = (p - 0.32) / 0.4;
      shine = sp >= 0 && sp <= 1 ? sp : null;
      ctx.translate(W / 2, H / 2);
      ctx.scale(scale, scale);
      ctx.translate(-W / 2, -H / 2);
      // cached glow sprite (blurred once), faded per frame: cheap enough for many Players at once
      const sprite = glowSprite(main, keyOf(text, fontSize, W, H, style), style.accent, H * 0.06 * 0.68, pad);
      ctx.globalAlpha = Math.min(1, glow / 0.68);
      ctx.drawImage(sprite, -pad, -pad);
      ctx.globalAlpha = 1;
      ctx.drawImage(main, 0, 0);
    } else drawGlow(ctx, main, 0, style.accent, H);
    ctx.restore();
    if (shine !== null) {
      const face = style.look === 'orange' ? faceCache.get(keyOf(text, fontSize, W, H, style)) : undefined;
      const band = W * 0.38;
      const paint = (x: CanvasRenderingContext2D) => {
        const bx = pad - band + shine! * (W + band * 2);
        x.translate(bx, pad + H / 2);
        x.rotate(0.42);
        const gr = x.createLinearGradient(-band / 2, 0, band / 2, 0);
        gr.addColorStop(0, 'rgba(255,255,255,0)');
        gr.addColorStop(0.5, face ? 'rgba(255,255,255,.8)' : 'rgba(255,250,228,.85)');
        gr.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = gr;
        x.fillRect(-band / 2, -H * 2, band, H * 4);
      };
      if (face) {
        // V2: light sweep only over the orange face (same placement and scale as the glyph)
        const t = (scratch ??= document.createElement('canvas'));
        t.width = c.width;
        t.height = c.height;
        const tx = t.getContext('2d')!;
        tx.translate(pad + W / 2, pad + H / 2);
        tx.scale(scale, scale);
        tx.translate(-W / 2, -H / 2);
        tx.drawImage(face, 0, 0);
        tx.setTransform(1, 0, 0, 1, 0, 0);
        tx.globalCompositeOperation = 'source-atop';
        paint(tx);
        ctx.drawImage(t, 0, 0);
      } else {
        // light sweep only over the glyph's own pixels
        ctx.save();
        ctx.globalCompositeOperation = 'source-atop';
        paint(ctx);
        ctx.restore();
      }
    }
    release();
  }, [ready, text, fontSize, W, H, frame, duration, JSON.stringify(style), JSON.stringify(reel)]);
  return <canvas ref={ref} width={W + pad * 2} height={H + pad * 2} style={{ position: 'absolute', left: -pad, top: -pad, width: W + pad * 2, height: H + pad * 2, display: 'block' }} />;
};

let scratch: HTMLCanvasElement | null = null;
const glowCache = new Map<string, HTMLCanvasElement>();
/** the glyph drawn once with its orange glow (shadowBlur is expensive per frame) */
function glowSprite(im: HTMLCanvasElement, key: string, accent: string, blur: number, pad: number) {
  const k = `${key}|${accent}|${Math.round(blur)}|${pad}`;
  const hit = glowCache.get(k);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = im.width + pad * 2;
  c.height = im.height + pad * 2;
  const x = c.getContext('2d')!;
  x.shadowColor = accent;
  x.shadowBlur = blur;
  x.drawImage(im, pad, pad);
  glowCache.set(k, c);
  return c;
}

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
