import React from 'react';
import { AbsoluteFill, Img, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import { Audio, Video } from '@remotion/media';
import { computeEffects, propAt } from '../lib/anim';
import type { CompositionProps, Layer } from '../types';
import { BackgroundCanvas, ButtonView, MultiplierSvg, ParticlesCanvas, Placeholder, ShineImage, SvgText } from './Elements';
import type { EffectOutput } from '../lib/anim';

const LayerContent: React.FC<{ layer: Layer; url?: string; shine?: EffectOutput['shine'] }> = ({ layer, url, shine }) => {
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

const LayerView: React.FC<{ layer: Layer; assetUrls: Record<string, string> }> = ({ layer, assetUrls }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const url = layer.assetId ? assetUrls[layer.assetId] : undefined;
  const opacity = propAt(layer, 'opacity', frame);

  if (layer.type === 'audio') {
    return url ? <Audio src={url} volume={layer.volume ?? 1} muted={layer.muted} /> : null;
  }
  if (layer.type === 'background' && layer.background) {
    return (
      <AbsoluteFill style={{ opacity }}>
        <BackgroundCanvas settings={layer.background} />
      </AbsoluteFill>
    );
  }
  if (layer.type === 'particles' && layer.particles) {
    return (
      <AbsoluteFill style={{ opacity }}>
        <ParticlesCanvas settings={layer.particles} />
      </AbsoluteFill>
    );
  }

  const fx = computeEffects(layer.effects, frame, fps, { width, height });
  const x = propAt(layer, 'x', frame) + fx.dx;
  const y = propAt(layer, 'y', frame) + fx.dy;
  const rot = propAt(layer, 'rotation', frame) + fx.dRot;
  const sc = propAt(layer, 'scale', frame) * fx.scaleMul;
  const filters: string[] = [];
  if (fx.glow) {
    filters.push(`drop-shadow(0px 0px ${fx.glow.radius.toFixed(1)}px ${fx.glow.color})`);
    filters.push(`drop-shadow(0px 0px ${(fx.glow.radius / 2).toFixed(1)}px ${fx.glow.color})`);
  }
  if (fx.brightness !== 1) filters.push(`brightness(${fx.brightness.toFixed(3)})`);

  return (
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
        <LayerContent layer={layer} url={url} shine={fx.shine} />
      </div>
    </div>
  );
};

export const MainComposition: React.FC<CompositionProps> = ({ project, assetUrls }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#000', overflow: 'hidden' }}>
      {project.layers.map((layer) =>
        layer.visible ? (
          <Sequence key={layer.id} from={layer.start} durationInFrames={Math.max(1, layer.duration)} name={layer.name}>
            <LayerView layer={layer} assetUrls={assetUrls} />
          </Sequence>
        ) : null,
      )}
    </AbsoluteFill>
  );
};
