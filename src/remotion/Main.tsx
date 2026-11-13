import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { AbsoluteFill, Img, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import { Audio, Video } from '@remotion/media';
import { computeEffects, propAt, type EffectOutput } from '../lib/anim';
import { buildMusicSync, projectAudio, type MusicSync } from '../lib/music';
import { SFX, sfxUrl } from '../lib/sfx';
import { rand } from '../lib/anim';
import type { CompositionProps, Layer, ProjectAudio, SfxKey } from '../types';
import { BackgroundCanvas, ButtonView, FrameCanvas, MultiplierSvg, ParticlesCanvas, Placeholder, ReelImage, ShineImage, SubtitleView, SvgText } from './Elements';
import { brandUrl } from '../lib/brand';
import { GlyphView } from './Glyph';
import { BonusView } from './Bonus';
import { fillTemplate, defaultSubtitleStyle } from '../lib/story';
import { expandRamp } from '../lib/speedramp';
import type { StoryData } from '../types';

const StoryContext = React.createContext<StoryData | undefined>(undefined);

const COLOR_FILTERS: Record<string, string | undefined> = {
  none: undefined,
  sepia: 'sepia(0.85) contrast(1.05)',
  bw: 'grayscale(1) contrast(1.1)',
  warm: 'sepia(0.3) saturate(1.35)',
};
import { drawCoin } from './draw';

type Mix = Pick<ProjectAudio, 'musicVolume' | 'sfxVolume' | 'musicMuted' | 'sfxMuted' | 'voiceVolume' | 'voiceMuted' | 'duckMusic' | 'duckGame'>;

const LayerContent: React.FC<{ layer: Layer; url?: string; shine?: EffectOutput['shine']; fps: number; duck?: (layerFrame: number) => number; reelSyms?: string[]; frame?: number }> = ({ layer, url, shine, fps, duck, reelSyms, frame }) => {
  if (layer.bonus) return <BonusView style={layer.bonus} width={layer.width} height={layer.height} frame={frame ?? 0} duration={layer.duration} />;
  switch (layer.type) {
    case 'image':
      if (url && layer.reel)
        return <ReelImage url={url} symbolUrls={reelSyms ?? []} width={layer.width} height={layer.height} reel={layer.reel} frame={frame ?? 0} duration={layer.duration} />;
      // layers with a light-reflection effect are drawn on a canvas
      if (url && layer.effects.some((e) => e.type === 'shine'))
        return <ShineImage url={url} width={layer.width} height={layer.height} fit={layer.objectFit ?? 'contain'} shine={shine ?? null} />;
      return url ? (
        <Img src={url} style={{ width: '100%', height: '100%', objectFit: layer.objectFit ?? 'contain', display: 'block' }} />
      ) : (
        <Placeholder label="Görsel bulunamadı" />
      );
    case 'video':
      if (url && layer.rewind) return <RewindVideo layer={layer} url={url} fps={fps} />;
      if (url && layer.speedRamp) return <RampVideo layer={layer} url={url} fps={fps} duck={duck} />;
      return url ? (
        <Video
          src={url}
          objectFit={layer.objectFit ?? 'cover'}
          muted={layer.muted}
          loop={!!layer.loop}
          volume={duck ? (f: number) => (layer.volume ?? 1) * duck(f) : (layer.volume ?? 1)}
          trimBefore={layer.trimStart ? Math.round(layer.trimStart * fps) : undefined}
          playbackRate={layer.playbackRate ?? 1}
          style={{ width: '100%', height: '100%' }}
        />
      ) : (
        <Placeholder label="Video bulunamadı" />
      );
    case 'text':
      if (layer.text && layer.glyph)
        return (
          <GlyphView text={layer.text.text} fontSize={layer.text.fontSize} width={layer.width} height={layer.height} style={layer.glyph} reel={layer.reel} frame={frame ?? 0} duration={layer.duration} />
        );
      return layer.text ? (
        <StoryText layer={layer} />
      ) : null;
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

/** variable speed: consecutive constant-speed pieces of the same file, nothing skipped */
const RampVideo: React.FC<{ layer: Layer; url: string; fps: number; duck?: (layerFrame: number) => number }> = ({ layer, url, fps, duck }) => {
  const pieces = useMemo(() => expandRamp(layer.speedRamp!, fps), [layer.speedRamp, fps]);
  const base = layer.muted ? 0 : (layer.volume ?? 1);
  const fade = Math.max(2, Math.round(0.12 * fps));
  return (
    <>
      {pieces.map((p, i) => {
        const prev = pieces[i - 1]?.volume ?? 0;
        const next = pieces[i + 1]?.volume ?? 0;
        const v = p.volume * base;
        return (
          <Sequence key={i} from={p.out0} durationInFrames={p.len} premountFor={Math.round(fps * 0.5)} name={`${p.speed.toFixed(2)}×`}>
            <Video
              src={url}
              objectFit={layer.objectFit ?? 'cover'}
              muted={v <= 0}
              trimBefore={Math.max(0, Math.round(p.src0 * fps))}
              playbackRate={p.speed}
              volume={(f: number) => {
                let k = v;
                if (prev < p.volume && f < fade) k *= f / fade;
                if (next < p.volume && f > p.len - fade) k *= Math.max(0, (p.len - f) / fade);
                return duck ? k * duck(p.out0 + f) : k;
              }}
              style={{ width: '100%', height: '100%' }}
            />
          </Sequence>
        );
      })}
    </>
  );
};

/** rewind: the footage runs backwards at high speed (eased), with an optional VHS look */
const RewindVideo: React.FC<{ layer: Layer; url: string; fps: number }> = ({ layer, url, fps }) => {
  const frame = useCurrentFrame();
  const { from, to, vhs = true } = layer.rewind!;
  const n = Math.max(1, layer.duration);
  const ease = (x: number) => x * x * (3 - 2 * x);
  const srcAt = (f: number) => from + (to - from) * ease(Math.min(1, f / Math.max(1, n - 1)));
  const band = ((frame * 37) % 100) / 100;
  return (
    <AbsoluteFill>
      {Array.from({ length: n }, (_, f) => (
        <Sequence key={f} from={f} durationInFrames={1} premountFor={Math.round(fps * 0.4)}>
          <Video src={url} muted objectFit={layer.objectFit ?? 'cover'} trimBefore={Math.max(0, Math.round(srcAt(f) * fps))} style={{ width: '100%', height: '100%' }} />
        </Sequence>
      ))}
      {vhs && (
        <AbsoluteFill style={{ pointerEvents: 'none' }}>
          <AbsoluteFill style={{ background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.22) 0px, rgba(0,0,0,0.22) 2px, transparent 2px, transparent 5px)' }} />
          <AbsoluteFill style={{ background: 'linear-gradient(90deg, rgba(255,0,80,0.10), transparent 30%, transparent 70%, rgba(0,200,255,0.10))', mixBlendMode: 'screen' }} />
          <div style={{ position: 'absolute', left: 0, right: 0, top: `${band * 100}%`, height: '7%', background: 'rgba(255,255,255,0.18)', filter: 'blur(3px)' }} />
          <div style={{ position: 'absolute', left: '6%', top: '4%', fontFamily: 'Arial Black, Arial, sans-serif', fontWeight: 900, fontSize: Math.round(layer.width * 0.11), color: '#fff', textShadow: '2px 2px 0 rgba(0,0,0,0.6)', opacity: Math.floor(frame / 6) % 2 ? 1 : 0.65 }}>
            ◀◀
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

const StoryText: React.FC<{ layer: Layer }> = ({ layer }) => {
  const story = React.useContext(StoryContext);
  const text = layer.textTemplate ? fillTemplate(layer.textTemplate, story?.fields) : layer.text!.text;
  return <SvgText id={layer.id} s={{ ...layer.text!, text }} width={layer.width} height={layer.height} />;
};

/** Zoom inside the layer box (cropped), optionally growing over the layer's life. */
/** shows only part of the source picture (the box keeps its size, the cut parts are hidden) */
const MediaCrop: React.FC<{ layer: Layer; children: React.ReactNode }> = ({ layer, children }) => {
  const c = layer.mediaCrop;
  if (!c || (!c.top && !c.bottom && !c.left && !c.right)) return <>{children}</>;
  const w = 1 / Math.max(0.1, 1 - c.left - c.right);
  const h = 1 / Math.max(0.1, 1 - c.top - c.bottom);
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: `${-c.left * w * 100}%`, top: `${-c.top * h * 100}%`, width: `${w * 100}%`, height: `${h * 100}%` }}>{children}</div>
    </div>
  );
};

const MediaZoom: React.FC<{ layer: Layer; children: React.ReactNode }> = ({ layer, children }) => {
  const frame = useCurrentFrame();
  const z = layer.mediaZoom;
  if (!z || (z.scale === 1 && !z.animate)) return <>{children}</>;
  const p = z.animate ? Math.min(1, frame / Math.max(1, layer.duration)) : 1;
  const s = 1 + (z.scale - 1) * p;
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${s})`, transformOrigin: `${z.x * 100}% ${z.y * 100}%` }}>{children}</div>
    </div>
  );
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

const SubtitleLayer: React.FC<{ layer: Layer }> = ({ layer }) => {
  const story = React.useContext(StoryContext);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const own = !!layer.cues;
  const cues = React.useMemo(
    () => (own ? layer.cues! : story ? story.subtitles.cues : []).map((c) => ({ ...c, text: fillTemplate(c.text, story?.fields) })),
    [own, layer.cues, story],
  );
  if (!own && !story?.subtitles.enabled) return null;
  return (
    <div style={{ position: 'absolute', left: layer.x - layer.width / 2, top: layer.y - layer.height / 2, width: layer.width, height: layer.height }}>
      <SubtitleView cues={cues} style={layer.subtitleStyle ?? defaultSubtitleStyle()} t={own ? frame / fps : (layer.start + frame) / fps} width={layer.width} height={layer.height} />
    </div>
  );
};

/** volume automation: linear between points, constant outside */
function volumeKeyAt(keys: { t: number; v: number }[], t: number) {
  const k = [...keys].sort((a, b) => a.t - b.t);
  if (t <= k[0].t) return k[0].v;
  for (let i = 1; i < k.length; i++) if (t <= k[i].t) return k[i - 1].v + ((k[i].v - k[i - 1].v) * (t - k[i - 1].t)) / Math.max(1e-6, k[i].t - k[i - 1].t);
  return k[k.length - 1].v;
}

/** music volume factor while a voice-over is speaking (0.25 s ramps) */
function duckAt(ranges: [number, number][], f: number, fps: number) {
  const ramp = 0.25 * fps;
  let k = 1;
  for (const [a, b] of ranges) {
    if (f < a - ramp || f > b + ramp) continue;
    const inside = f < a ? (f - (a - ramp)) / ramp : f > b ? 1 - (f - b) / ramp : 1;
    k = Math.min(k, 1 - 0.65 * Math.max(0, Math.min(1, inside)));
  }
  return k;
}

const LayerView: React.FC<{ layer: Layer; assetUrls: Record<string, string>; music: MusicSync | null; mix: Mix; voiceRanges?: [number, number][]; gameRanges?: [number, number][] }> = ({
  layer,
  assetUrls,
  music,
  mix,
  voiceRanges = [],
  gameRanges = [],
}) => {
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
    const channel = layer.channel ?? 'music';
    const ch =
      channel === 'music' ? (mix.musicMuted ? 0 : mix.musicVolume) : channel === 'voice' ? (mix.voiceMuted ? 0 : (mix.voiceVolume ?? 1)) : sfxVol;
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
          if (channel === 'music' && voiceRanges.length) v *= duckAt(voiceRanges, layer.start + f, fps);
          if (layer.volumeKeys?.length) v *= volumeKeyAt(layer.volumeKeys, f / fps);
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
  if (layer.type === 'frame' && layer.frame) {
    return (
      <AbsoluteFill style={{ opacity }}>
        <FrameCanvas settings={layer.frame} />
        {sounds}
      </AbsoluteFill>
    );
  }
  if (layer.type === 'subtitles') {
    return <SubtitleLayer layer={layer} />;
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
  const cf = layer.colorFilter ? COLOR_FILTERS[layer.colorFilter] : undefined;
  if (cf) filters.push(cf);
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
          <MediaZoom layer={layer}>
            <MediaCrop layer={layer}>
              <LayerContent layer={layer} url={url} shine={fx.shine} fps={fps} frame={frame} reelSyms={layer.reel ? layer.reel.symbols.map((x) => (x.includes('/') ? brandUrl(x) : assetUrls[x])).filter(Boolean) : undefined} duck={gameRanges.length && layer.type === 'video' ? (f: number) => duckAt(gameRanges, layer.start + f, fps) : undefined} />
            </MediaCrop>
          </MediaZoom>
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
  // where the voice-over speaks (global frames), used to lower the music
  const voiceRanges = useMemo<[number, number][]>(
    () =>
      mix.duckMusic === false || mix.voiceMuted
        ? []
        : project.layers.filter((l) => l.visible && l.type === 'audio' && l.channel === 'voice').map((l) => [l.start, l.start + l.duration]),
    [project.layers, mix.duckMusic, mix.voiceMuted],
  );
  // same, used to lower the game sound of videos (optional)
  const gameRanges = useMemo<[number, number][]>(
    () =>
      !mix.duckGame || mix.voiceMuted
        ? []
        : project.layers.filter((l) => l.visible && l.type === 'audio' && l.channel === 'voice').map((l) => [l.start, l.start + l.duration]),
    [project.layers, mix.duckGame, mix.voiceMuted],
  );
  const cam = cameraAt(project.layers, frame, fps, { width, height }, music);

  return (
    <StoryContext.Provider value={project.story}>
    <AbsoluteFill style={{ backgroundColor: project.emoji ? 'transparent' : '#000', overflow: 'hidden' }}>
      {project.layers.map((layer) => {
        if (!layer.visible || layer.type === 'camera') return null;
        const seq = (
          <Sequence from={layer.start} durationInFrames={Math.max(1, layer.duration)} name={layer.name}>
            <LayerView layer={layer} assetUrls={assetUrls} music={music} mix={mix} voiceRanges={voiceRanges} gameRanges={gameRanges} />
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
    </StoryContext.Provider>
  );
};
