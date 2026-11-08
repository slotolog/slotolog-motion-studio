import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { AbsoluteFill, Img, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import { Audio, Video } from '@remotion/media';
import { computeEffects, propAt, type EffectOutput } from '../lib/anim';
import { buildMusicSync, projectAudio, type MusicSync } from '../lib/music';
import { SFX, sfxUrl } from '../lib/sfx';
import { rand } from '../lib/anim';
import type { CompositionProps, Layer, ProjectAudio, SfxKey } from '../types';
import { BackgroundCanvas, ButtonView, MultiplierSvg, ParticlesCanvas, Placeholder, ShineImage, SvgText } from './Elements';
import { drawCoin } from './draw';

type Mix = Pick<ProjectAudio, 'musicVolume' | 'sfxVolume' | 'musicMuted' | 'sfxMuted'>;

const LayerContent: React.FC<{ layer: Layer; url?: string; shine?: EffectOutput['shine']; fps: number }> = ({ layer, url, shine, fps }) => {
  switch (layer.type) {
    case 'image':
      // layers with a light-reflection effect are drawn on a canvas
      if (url && layer.effects.some((e) => e.type === 'shine'))
        return <ShineImage url={url} width={layer.width} height={layer.height} fit={layer.objectFit ?? 'contain'} shine={shine ?? null} />;
      return url ? (
        <Img src={url} style={{ width: '100%', height: '100%', objectFit: layer.objectFit ?? 'contain', display: 'block' }} />
      ) : (
        <Placeholder label="Görsel bulunamadı" />
      );
    case 'video':
      return url ? (
        <Video
          src={url}
          objectFit={layer.objectFit ?? 'cover'}
          muted={layer.muted}
          loop={!!layer.loop}
          volume={layer.volume ?? 1}
          trimBefore={layer.trimStart ? Math.round(layer.trimStart * fps) : undefined}
          style={{ width: '100%', height: '100%' }}
        />
      ) : (
        <Placeholder label="Video bulunamadı" />
      );
    case 'text':
      return layer.text ? <SvgText id={layer.id} s={layer.text} width={layer.width} height={layer.height} /> : null;
    case 'multiplier':
      return <MultiplierSvg id={layer.id} value={layer.text?.text ?? '100X'} style={layer.text?.style} color={layer.text?.color} />;
    case 'button':
      return layer.button ? <ButtonView s={layer.button} /> : null;
    case 'placeholder':
      return <Placeholder label={layer.text?.text ?? layer.name} />;
    default:
      return null;
  }
};

/** Coins bursting out of a point, drawn in composition space. */
const ExplosionCanvas: React.FC<{ x: number; y: number; size: number; explosions: EffectOutput['explosions'] }> = ({ x, y, size, explosions }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const { width, height } = useVideoConfig();
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    for (const ex of explosions) {
      const a = ex.age;
      if (a < 0.3) {
        const r = size * (0.6 + a * 4);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(255,250,220,${0.85 * (1 - a / 0.3)})`);
        g.addColorStop(0.4, `rgba(255,200,60,${0.5 * (1 - a / 0.3)})`);
        g.addColorStop(1, 'rgba(255,142,22,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      const n = Math.round(22 * Math.max(0.3, ex.power));
      for (let i = 0; i < n; i++) {
        const R = (k: number) => rand(ex.seed * 7.7 + i * 3.1 + k * 11.3);
        const ang = R(1) * Math.PI * 2;
        const v = (450 + R(2) * 900) * (0.7 + ex.power * 0.3);
        const px = x + Math.cos(ang) * v * a;
        const py = y + Math.sin(ang) * v * a - 250 * a + 0.5 * 1500 * a * a;
        const fade = Math.max(0, 1 - Math.max(0, a - 1.1) / 0.7);
        if (fade <= 0) continue;
        ctx.globalAlpha = fade;
        drawCoin(ctx, px, py, (14 + R(3) * 18) * Math.min(1, 0.4 + a * 4), a * (6 + R(4) * 8), R(5) - 0.5);
      }
      ctx.globalAlpha = 1;
    }
  }, [x, y, size, explosions, width, height]);
  return <canvas ref={ref} width={width} height={height} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />;
};

const SoundAt: React.FC<{ from: number; sound: SfxKey; volume: number }> = ({ from, sound, volume }) => {
  const { fps } = useVideoConfig();
  if (volume <= 0) return null;
  return (
    <Sequence from={from} durationInFrames={Math.ceil(SFX[sound].duration * fps) + 2} layout="none">
      <Audio src={sfxUrl(sound)} volume={volume} />
    </Sequence>
  );
};

function transformOf(layer: Layer, frame: number, fps: number, comp: { width: number; height: number }, music: MusicSync | null) {
  const base = { x: propAt(layer, 'x', frame), y: propAt(layer, 'y', frame) };
  const fx = computeEffects(layer.effects, frame, fps, comp, { base, layerStartSec: layer.start / fps, music });
  return {
    fx,
    x: base.x + fx.dx,
    y: base.y + fx.dy,
    rot: propAt(layer, 'rotation', frame) + fx.dRot,
    sc: propAt(layer, 'scale', frame) * fx.scaleMul,
  };
}

const LayerView: React.FC<{ layer: Layer; assetUrls: Record<string, string>; music: MusicSync | null; mix: Mix }> = ({ layer, assetUrls, music, mix }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const url = layer.assetId ? assetUrls[layer.assetId] : undefined;
  const opacity = propAt(layer, 'opacity', frame);
  const sfxVol = mix.sfxMuted ? 0 : mix.sfxVolume;

  const sounds = (
    <>
      {layer.startSound && <SoundAt from={0} sound={layer.startSound} volume={(layer.startSoundVolume ?? 0.7) * sfxVol} />}
      {layer.effects.map((e) =>
        e.sound ? <SoundAt key={e.id} from={Math.max(0, e.start)} sound={e.sound} volume={(e.soundVolume ?? 0.7) * sfxVol} /> : null,
      )}
    </>
  );

  if (layer.type === 'camera') return null;
  if (layer.type === 'audio') {
    if (!url) return null;
    const isMusic = (layer.channel ?? 'music') === 'music';
    const ch = isMusic ? (mix.musicMuted ? 0 : mix.musicVolume) : sfxVol;
    const fi = (layer.fadeIn ?? 0) * fps;
    const fo = (layer.fadeOut ?? 0) * fps;
    const base = (layer.volume ?? 1) * ch;
    return (
      <Audio
        src={url}
        muted={layer.muted || ch === 0}
        trimBefore={layer.trimStart ? Math.round(layer.trimStart * fps) : undefined}
        volume={(f: number) => {
          let v = base;
          if (fi > 0 && f < fi) v *= f / fi;
          if (fo > 0 && f > layer.duration - fo) v *= Math.max(0, (layer.duration - f) / fo);
          return v;
        }}
      />
    );
  }
  if (layer.type === 'background' && layer.background) {
    return (
      <AbsoluteFill style={{ opacity }}>
        <BackgroundCanvas settings={layer.background} />
        {sounds}
      </AbsoluteFill>
    );
  }
  if (layer.type === 'particles' && layer.particles) {
    return (
      <AbsoluteFill style={{ opacity }}>
        <ParticlesCanvas settings={layer.particles} />
        {sounds}
      </AbsoluteFill>
    );
  }

  const comp = { width, height };
  const cur = transformOf(layer, frame, fps, comp, music);
  const { fx, x, y, rot, sc } = cur;
  const filters: string[] = [];
  if (layer.shadow) {
    const d = Math.max(0.3, sc);
    filters.push(`drop-shadow(0px ${(16 * d).toFixed(1)}px ${(14 * d).toFixed(1)}px rgba(60,10,0,0.45))`);
  }
  if (fx.glow) {
    filters.push(`drop-shadow(0px 0px ${fx.glow.radius.toFixed(1)}px ${fx.glow.color})`);
    filters.push(`drop-shadow(0px 0px ${(fx.glow.radius / 2).toFixed(1)}px ${fx.glow.color})`);
  }
  if (fx.brightness !== 1) filters.push(`brightness(${fx.brightness.toFixed(3)})`);
  if (layer.motionBlur && frame > 0) {
    const prev = transformOf(layer, frame - 1, fps, comp, music);
    const speed = Math.hypot(x - prev.x, y - prev.y) + Math.abs(sc - prev.sc) * Math.max(layer.width, layer.height) * 0.5;
    // only fast moves (entrances, jumps) get blurred: slow dancing stays sharp and cheap to render
    const blur = Math.min(5, Math.max(0, speed - 14) * 0.15);
    if (blur > 0.4) filters.push(`blur(${blur.toFixed(2)}px)`);
  }

  return (
    <>
      {fx.explosions.length > 0 && (
        <ExplosionCanvas x={x} y={y} size={Math.max(layer.width, layer.height) * 0.5} explosions={fx.explosions} />
      )}
      <div
        style={{
          position: 'absolute',
          left: x - layer.width / 2,
          top: y - layer.height / 2,
          width: layer.width,
          height: layer.height,
          opacity: Math.max(0, Math.min(1, opacity * fx.opacityMul)),
          transform: `rotate(${rot}deg) scale(${sc * fx.scaleX}, ${sc * fx.scaleY})`,
          transformOrigin: 'center center',
        }}
      >
        {fx.flash && (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: Math.max(layer.width, layer.height) * 1.6,
              height: Math.max(layer.width, layer.height) * 1.6,
              marginLeft: -Math.max(layer.width, layer.height) * 0.8,
              marginTop: -Math.max(layer.width, layer.height) * 0.8,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${fx.flash.color} 0%, rgba(255,200,60,0.55) 35%, rgba(255,142,22,0) 70%)`,
              transform: `scale(${0.2 + fx.flash.progress * 1.8})`,
              opacity: 1 - fx.flash.progress,
            }}
          />
        )}
        <div style={{ position: 'absolute', inset: 0, filter: filters.length ? filters.join(' ') : undefined }}>
          <LayerContent layer={layer} url={url} shine={fx.shine} fps={fps} />
        </div>
      </div>
      {sounds}
    </>
  );
};

/** Combined transform of all active camera layers at a global frame. */
function cameraAt(layers: Layer[], frame: number, fps: number, comp: { width: number; height: number }, music: MusicSync | null) {
  let tx = 0;
  let ty = 0;
  let s = 1;
  let r = 0;
  let active = false;
  for (const c of layers) {
    if (c.type !== 'camera' || !c.visible || frame < c.start || frame >= c.start + c.duration) continue;
    active = true;
    const lf = frame - c.start;
    const fx = computeEffects(c.effects, lf, fps, comp, { layerStartSec: c.start / fps, music });
    tx += propAt(c, 'x', lf) - comp.width / 2 + fx.dx;
    ty += propAt(c, 'y', lf) - comp.height / 2 + fx.dy;
    s *= propAt(c, 'scale', lf) * fx.scaleMul;
    r += propAt(c, 'rotation', lf) + fx.dRot;
  }
  return active ? { tx, ty, s, r } : null;
}

const defaultDepth = (l: Layer) => l.depth ?? (l.type === 'background' ? 0.5 : l.type === 'particles' ? 0.85 : 1);

export const MainComposition: React.FC<CompositionProps> = ({ project, assetUrls }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const music = useMemo(() => buildMusicSync(project), [project]);
  const mix = projectAudio(project);
  const cam = cameraAt(project.layers, frame, fps, { width, height }, music);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', overflow: 'hidden' }}>
      {project.layers.map((layer) => {
        if (!layer.visible || layer.type === 'camera') return null;
        const seq = (
          <Sequence from={layer.start} durationInFrames={Math.max(1, layer.duration)} name={layer.name}>
            <LayerView layer={layer} assetUrls={assetUrls} music={music} mix={mix} />
          </Sequence>
        );
        if (!cam) {
          // same element structure with or without a camera, so nothing re-mounts
          return (
            <AbsoluteFill key={layer.id} style={{ pointerEvents: 'none' }}>
              {seq}
            </AbsoluteFill>
          );
        }
        const d = defaultDepth(layer);
        // full-frame layers are slightly over-scanned so camera moves never show the edges
        const overscan = layer.type === 'background' ? 1.06 : 1;
        const sc = Math.max(layer.type === 'background' ? 1 : 0, 1 + (cam.s - 1) * d) * overscan;
        return (
          <AbsoluteFill
            key={layer.id}
            style={{ pointerEvents: 'none', transform: `translate(${cam.tx * d}px, ${cam.ty * d}px) scale(${sc}) rotate(${cam.r * d}deg)`, transformOrigin: 'center center' }}
          >
            {seq}
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
};
