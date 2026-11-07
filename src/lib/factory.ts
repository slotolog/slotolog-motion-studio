import { nanoid } from 'nanoid';
import { EFFECT_META } from './anim';
import type {
  BackgroundSettings,
  ButtonSettings,
  Effect,
  EffectType,
  Layer,
  ParticleSettings,
  Project,
  TextSettings,
} from '../types';
import { ASPECT_SIZES, type Aspect } from '../types';

export const BRAND = { orange: '#FF8E16', dark: '#1E1E1E' };

export const uid = () => nanoid(10);

export function baseLayer(partial: Partial<Layer> & Pick<Layer, 'type' | 'name'>, project: Project): Layer {
  const { width, height } = ASPECT_SIZES[project.aspect];
  return {
    id: uid(),
    visible: true,
    locked: false,
    start: 0,
    duration: Math.max(1, project.durationInFrames - (partial.start ?? 0)),
    x: width / 2,
    y: height / 2,
    width: 500,
    height: 500,
    rotation: 0,
    scale: 1,
    opacity: 1,
    keyframes: {},
    effects: [],
    ...partial,
  };
}

export function makeEffect(type: EffectType, fps: number, partial: Partial<Effect> = {}): Effect {
  return {
    id: uid(),
    type,
    start: 0,
    duration: Math.round(EFFECT_META[type].defaultDuration * fps),
    speed: 1,
    intensity: 1,
    ...(type === 'flyIn' ? { direction: 'bottom' as const } : {}),
    ...(type === 'glow' ? { color: '#FFD54A' } : {}),
    ...(type === 'shine' ? { color: '#FFFFFF' } : {}),
    ...(type === 'flash' ? { color: '#FFF3B0' } : {}),
    ...(type === 'beat' ? { bpm: 120 } : {}),
    ...partial,
  };
}

export const BG_PRESETS: { name: string; settings: BackgroundSettings }[] = [
  {
    name: 'Sarı-Turuncu Işınlar',
    settings: { style: 'rays', colorA: '#FFE066', colorB: '#FF8E16', rayColor: '#FFF7C2', rays: 18, speed: 1, bokeh: true },
  },
  {
    name: 'Ateş Turuncusu',
    settings: { style: 'rays', colorA: '#FFC233', colorB: '#D45500', rayColor: '#FFE7A0', rays: 14, speed: 1.2, bokeh: true },
  },
  {
    name: 'Akan Gradyan',
    settings: { style: 'gradient', colorA: '#FFB300', colorB: '#FF6A00', rayColor: '#FFF0A0', rays: 12, speed: 1, bokeh: true },
  },
  {
    name: 'Slotolog Parti',
    settings: { style: 'party', colorA: '#FF8E16', colorB: '#FF4F9A', rayColor: '#FFD23F', rays: 18, speed: 1, bokeh: true },
  },
  {
    name: 'Lüks Altın-Siyah',
    settings: { style: 'luxury', colorA: '#FF8E16', colorB: '#3A2000', rayColor: '#FFD27A', rays: 22, speed: 1, bokeh: true },
  },
  {
    name: 'Koyu Casino',
    settings: { style: 'dark', colorA: '#FF8E16', colorB: '#2A2A2A', rayColor: '#FF8E16', rays: 16, speed: 1, bokeh: true },
  },
];

export const PARTICLE_PRESETS: { name: string; settings: ParticleSettings }[] = [
  { name: 'Altın yağmuru', settings: { kind: 'coins', count: 22, speed: 1, size: 55, seed: 1 } },
  { name: 'Altın patlaması', settings: { kind: 'burst', count: 40, speed: 1, size: 50, seed: 2 } },
  { name: 'Parıltılar', settings: { kind: 'sparkles', count: 45, speed: 1, size: 40, seed: 3 } },
  { name: 'Konfeti', settings: { kind: 'confetti', count: 90, speed: 1, size: 50, seed: 4 } },
  { name: 'Uçuşan meyveler', settings: { kind: 'fruits', count: 10, speed: 1, size: 60, seed: 5 } },
  { name: 'Meyve çerçevesi', settings: { kind: 'fruitFrame', count: 7, speed: 1, size: 85, seed: 6 } },
];

export const defaultText = (p: Partial<TextSettings> = {}): TextSettings => ({
  text: 'YENİ METİN',
  fontSize: 110,
  style: 'white',
  color: '#FFFFFF',
  strokeColor: '#7A2E00',
  strokeWidth: 10,
  extrude: true,
  italic: false,
  ...p,
});

export const defaultButton = (p: Partial<ButtonSettings> = {}): ButtonSettings => ({
  label: 'BONUSU AL',
  colorTop: '#FFB547',
  colorBottom: '#FF7A00',
  textColor: '#FFFFFF',
  radius: 999,
  fontSize: 72,
  ...p,
});

export function backgroundLayer(project: Project, settings: BackgroundSettings, name = 'Hareketli arka plan'): Layer {
  const { width, height } = ASPECT_SIZES[project.aspect];
  return baseLayer({ type: 'background', name, width, height, background: { ...settings } }, project);
}

export function particlesLayer(project: Project, settings: ParticleSettings, name = 'Parçacıklar', partial: Partial<Layer> = {}): Layer {
  const { width, height } = ASPECT_SIZES[project.aspect];
  return baseLayer({ type: 'particles', name, width, height, particles: { ...settings, seed: Math.round(Math.random() * 1000) }, ...partial }, project);
}

export function textLayer(project: Project, text: Partial<TextSettings>, partial: Partial<Layer> = {}): Layer {
  const t = defaultText(text);
  const lines = t.text.split('\n');
  const longest = Math.max(...lines.map((l) => l.length));
  return baseLayer(
    {
      type: 'text',
      name: t.text.replace(/\n/g, ' ').slice(0, 24),
      width: Math.min(1040, Math.max(200, longest * t.fontSize * 0.72 + 60)),
      height: lines.length * t.fontSize * 1.1 + 40,
      text: t,
      ...partial,
    },
    project,
  );
}

export function multiplierLayer(project: Project, value: string, partial: Partial<Layer> = {}): Layer {
  return baseLayer(
    {
      type: 'multiplier',
      name: `Çarpan ${value}`,
      width: 460,
      height: 230,
      text: defaultText({ text: value, style: 'gold' }),
      ...partial,
    },
    project,
  );
}

export function buttonLayer(project: Project, label = 'BONUSU AL', partial: Partial<Layer> = {}): Layer {
  return baseLayer({ type: 'button', name: `Buton: ${label}`, width: 640, height: 160, button: defaultButton({ label }), ...partial }, project);
}

export function emptyProject(aspect: Aspect = '9:16', name = 'Yeni proje'): Project {
  return { id: uid(), name, aspect, fps: 30, durationInFrames: 30 * 10, layers: [], assets: [], updatedAt: Date.now() };
}
