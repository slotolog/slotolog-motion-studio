import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { continueRender, delayRender, useCurrentFrame, useVideoConfig } from 'remotion';
import { FONT_FAMILY } from '../lib/fonts';
import type { BackgroundSettings, ButtonSettings, ParticleSettings, TextSettings } from '../types';
import { drawBackground, drawParticles } from './draw';

const safeId = (id: string) => id.replace(/[^a-zA-Z0-9_-]/g, '');

export const BackgroundCanvas: React.FC<{ settings: BackgroundSettings }> = ({ settings }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (ctx) drawBackground(ctx, settings, frame / fps, width, height);
  }, [frame, fps, width, height, settings]);
  return <canvas ref={ref} width={width} height={height} style={{ width: '100%', height: '100%', display: 'block' }} />;
};

export const ParticlesCanvas: React.FC<{ settings: ParticleSettings }> = ({ settings }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (ctx) drawParticles(ctx, settings, frame / fps, width, height);
  }, [frame, fps, width, height, settings]);
  return <canvas ref={ref} width={width} height={height} style={{ width: '100%', height: '100%', display: 'block' }} />;
};

const GoldDefs: React.FC<{ id: string; color: string; style: TextSettings['style'] }> = ({ id, color, style }) => (
  <defs>
    <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
      {style === 'gold' ? (
        <>
          <stop offset="0" stopColor="#FFFCD6" />
          <stop offset="0.35" stopColor="#FFE04D" />
          <stop offset="0.62" stopColor="#FFB300" />
          <stop offset="1" stopColor="#FF8E16" />
        </>
      ) : style === 'white' ? (
        <>
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#FFE9CC" />
        </>
      ) : (
        <>
          <stop offset="0" stopColor={color} />
          <stop offset="1" stopColor={color} />
        </>
      )}
    </linearGradient>
  </defs>
);

/** Text rendered as SVG so gradient, outline and 3D extrude survive MP4 export. */
export const SvgText: React.FC<{ id: string; s: TextSettings; width: number; height: number }> = ({ id, s, width, height }) => {
  const sid = safeId(id);
  const lines = s.text.split('\n');
  const lh = s.fontSize * 1.08;
  const top = height / 2 - ((lines.length - 1) * lh) / 2;
  const common = {
    fontFamily: FONT_FAMILY,
    fontWeight: 900,
    fontStyle: s.italic ? 'italic' : 'normal',
    fontSize: s.fontSize,
    textAnchor: 'middle' as const,
    dominantBaseline: 'central' as const,
  };
  const renderLines = (props: React.SVGProps<SVGTextElement>, dy = 0) =>
    lines.map((line, i) => (
      <text key={i} x={width / 2} y={top + i * lh + dy} {...common} {...props}>
        {line}
      </text>
    ));
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible', display: 'block' }}>
      <GoldDefs id={sid} color={s.color} style={s.style} />
      {s.extrude &&
        renderLines(
          { fill: '#4A1D00', stroke: '#4A1D00', strokeWidth: s.strokeWidth * 2, strokeLinejoin: 'round' },
          s.fontSize * 0.07,
        )}
      {s.strokeWidth > 0 &&
        renderLines({ fill: s.strokeColor, stroke: s.strokeColor, strokeWidth: s.strokeWidth * 2, strokeLinejoin: 'round' })}
      {renderLines({ fill: `url(#g${sid})` })}
    </svg>
  );
};

/** Multiplier badge such as "100X" — scales to its layer box. */
export const MultiplierSvg: React.FC<{ id: string; value: string; style?: TextSettings['style']; color?: string }> = ({
  id,
  value,
  style = 'gold',
  color = '#FF8E16',
}) => {
  const sid = safeId(id);
  const W = 520;
  const H = 260;
  const clean = value.replace(/x$/i, '');
  const chars = clean.length + 0.75;
  const fs = Math.min(200, (W * 0.92) / (chars * 0.72));
  const common = {
    x: W / 2,
    y: H / 2,
    fontFamily: FONT_FAMILY,
    fontWeight: 900,
    fontStyle: 'italic',
    fontSize: fs,
    textAnchor: 'middle' as const,
    dominantBaseline: 'central' as const,
  };
  const content = (
    <>
      {clean}
      <tspan fontSize={fs * 0.72}>X</tspan>
    </>
  );
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ overflow: 'visible', display: 'block' }}>
      <GoldDefs id={sid} color={color} style={style} />
      <text {...common} y={H / 2 + fs * 0.08} fill="#3D1500" stroke="#3D1500" strokeWidth={30} strokeLinejoin="round">
        {content}
      </text>
      <text {...common} fill="#7A2E00" stroke="#7A2E00" strokeWidth={24} strokeLinejoin="round">
        {content}
      </text>
      <text {...common} fill="#FFF3C4" stroke="#FFF3C4" strokeWidth={6} strokeLinejoin="round">
        {content}
      </text>
      <text {...common} fill={`url(#g${sid})`}>
        {content}
      </text>
    </svg>
  );
};

export const ButtonView: React.FC<{ s: ButtonSettings }> = ({ s }) => (
  <div
    style={{
      width: '100%',
      height: '100%',
      borderRadius: s.radius,
      background: `linear-gradient(180deg, ${s.colorTop} 0%, ${s.colorBottom} 100%)`,
      boxShadow: `0 10px 0 rgba(90,35,0,0.9), 0 0 50px ${s.colorBottom}`,
      border: '4px solid rgba(255,255,255,0.65)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
    }}
  >
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        height: '48%',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.05) 100%)',
        borderRadius: `${s.radius}px ${s.radius}px 40% 40%`,
      }}
    />
    <span
      style={{
        position: 'relative',
        fontFamily: FONT_FAMILY,
        fontWeight: 900,
        fontSize: s.fontSize,
        color: s.textColor,
        letterSpacing: 1,
        textShadow: '0 4px 0 rgba(90,35,0,0.85)',
        whiteSpace: 'nowrap',
      }}
    >
      {s.label}
    </span>
  </div>
);

export const Placeholder: React.FC<{ label: string }> = ({ label }) => (
  <div
    style={{
      width: '100%',
      height: '100%',
      border: '6px dashed rgba(255,255,255,0.7)',
      borderRadius: 24,
      background: 'rgba(30,30,30,0.55)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      color: '#fff',
      fontFamily: FONT_FAMILY,
      fontWeight: 900,
      fontSize: 48,
      padding: 40,
      boxSizing: 'border-box',
    }}
  >
    {label}
  </div>
);

const imageCache = new Map<string, Promise<HTMLImageElement>>();
function loadImage(url: string) {
  let p = imageCache.get(url);
  if (!p) {
    p = new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    imageCache.set(url, p);
  }
  return p;
}

/**
 * Image drawn on a canvas so that a light band can sweep across it,
 * clipped to the image's own transparency (works for any PNG).
 */
export const ShineImage: React.FC<{
  url: string;
  width: number;
  height: number;
  fit: 'contain' | 'cover';
  shine: { pos: number; alpha: number; color: string } | null;
}> = ({ url, width, height, fit, shine }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const handle = useRef<number | null>(null);
  if (handle.current === null) handle.current = delayRender(`Görsel yükleniyor: ${url}`);
  const release = () => {
    if (handle.current !== null && handle.current !== -1) {
      continueRender(handle.current);
      handle.current = -1;
    }
  };
  useEffect(() => {
    let alive = true;
    loadImage(url)
      .then((i) => alive && setImg(i))
      .catch(release);
    return () => {
      alive = false;
    };
  }, [url]);
  useEffect(() => release, []);
  useLayoutEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx || !img) return;
    const W = Math.max(1, Math.round(width));
    const H = Math.max(1, Math.round(height));
    ctx.clearRect(0, 0, W, H);
    const s = fit === 'cover' ? Math.max(W / img.naturalWidth, H / img.naturalHeight) : Math.min(W / img.naturalWidth, H / img.naturalHeight);
    const dw = img.naturalWidth * s;
    const dh = img.naturalHeight * s;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
    if (shine && shine.alpha > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      const band = Math.max(W, H) * 0.28;
      const cx = -band + shine.pos * (W + band * 2);
      ctx.translate(cx, H / 2);
      ctx.rotate(0.45);
      const g = ctx.createLinearGradient(-band / 2, 0, band / 2, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, shine.color);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.globalAlpha = shine.alpha;
      ctx.fillStyle = g;
      ctx.fillRect(-band / 2, -H * 2, band, H * 4);
      ctx.restore();
    }
    release();
  }, [img, width, height, fit, shine?.pos, shine?.alpha, shine?.color]);
  return (
    <canvas
      ref={ref}
      width={Math.max(1, Math.round(width))}
      height={Math.max(1, Math.round(height))}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
};
