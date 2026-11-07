export type Aspect = '9:16' | '1:1' | '16:9';

export const ASPECT_SIZES: Record<Aspect, { width: number; height: number }> = {
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
  '16:9': { width: 1920, height: 1080 },
};

export type LayerType =
  | 'image'
  | 'video'
  | 'audio'
  | 'text'
  | 'multiplier'
  | 'button'
  | 'background'
  | 'particles'
  | 'placeholder';

export type AnimProp = 'x' | 'y' | 'scale' | 'rotation' | 'opacity';
export const ANIM_PROPS: AnimProp[] = ['x', 'y', 'scale', 'rotation', 'opacity'];

export type EasingName = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'back';

export interface Keyframe {
  /** frame relative to the layer start */
  frame: number;
  value: number;
  easing: EasingName;
}

export type EffectType =
  | 'bounce'
  | 'dance'
  | 'sway'
  | 'spin'
  | 'pulse'
  | 'flyIn'
  | 'glow'
  | 'flash'
  | 'shake'
  | 'impact'
  | 'beat'
  | 'float'
  | 'shine';

export type Direction = 'left' | 'right' | 'top' | 'bottom';

export interface Effect {
  id: string;
  type: EffectType;
  /** frame relative to the layer start */
  start: number;
  /** length in frames */
  duration: number;
  /** 0.1 – 5, 1 = normal */
  speed: number;
  /** 0 – 3, 1 = normal */
  intensity: number;
  direction?: Direction;
  color?: string;
  /** beats per minute for the "beat" effect */
  bpm?: number;
  /** seconds added to the time of looping effects, so copies do not move in sync */
  phase?: number;
}

export type BackgroundStyle = 'rays' | 'gradient' | 'dark' | 'luxury' | 'party';

export interface BackgroundSettings {
  style: BackgroundStyle;
  colorA: string; // centre / main
  colorB: string; // edge / secondary
  rayColor: string;
  rays: number;
  speed: number;
  bokeh: boolean;
}

export type ParticleKind = 'coins' | 'burst' | 'sparkles' | 'confetti' | 'fruits' | 'fruitFrame';

export interface ParticleSettings {
  kind: ParticleKind;
  count: number;
  speed: number;
  size: number;
  seed: number;
}

export type TextStyle = 'gold' | 'white' | 'solid';

export interface TextSettings {
  text: string;
  fontSize: number;
  style: TextStyle;
  color: string;
  strokeColor: string;
  strokeWidth: number;
  extrude: boolean;
  italic: boolean;
}

export interface ButtonSettings {
  label: string;
  colorTop: string;
  colorBottom: string;
  textColor: string;
  radius: number;
  fontSize: number;
}

export interface Layer {
  id: string;
  name: string;
  type: LayerType;
  visible: boolean;
  locked: boolean;
  /** start frame in the composition */
  start: number;
  /** duration in frames */
  duration: number;
  /** centre position in composition pixels */
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scale: number;
  opacity: number;
  keyframes: Partial<Record<AnimProp, Keyframe[]>>;
  effects: Effect[];
  assetId?: string;
  objectFit?: 'contain' | 'cover';
  volume?: number;
  muted?: boolean;
  /** loop video when it is shorter than the layer */
  loop?: boolean;
  text?: TextSettings;
  button?: ButtonSettings;
  background?: BackgroundSettings;
  particles?: ParticleSettings;
}

export type AssetKind = 'image' | 'video' | 'audio';

export interface Asset {
  id: string;
  name: string;
  kind: AssetKind;
  mime: string;
  width?: number;
  height?: number;
  /** seconds, for video / audio */
  duration?: number;
  /** built-in asset shipped with the app (relative URL); no blob in IndexedDB */
  src?: string;
}

export interface Project {
  id: string;
  name: string;
  aspect: Aspect;
  fps: number;
  durationInFrames: number;
  /** index 0 = bottom layer */
  layers: Layer[];
  assets: Asset[];
  updatedAt: number;
}

export interface CompositionProps extends Record<string, unknown> {
  project: Project;
  assetUrls: Record<string, string>;
}
