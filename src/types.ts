export type Aspect = '9:16' | '4:5' | '1:1' | '16:9';

export const ASPECT_SIZES: Record<Aspect, { width: number; height: number }> = {
  '9:16': { width: 1080, height: 1920 },
  '4:5': { width: 1080, height: 1350 },
  '1:1': { width: 1080, height: 1080 },
  '16:9': { width: 1920, height: 1080 },
};

/** canvas size of a project: a custom size (e.g. the source recording's own ratio) or the aspect preset */
export const projectSize = (p: { aspect: Aspect; size?: { width: number; height: number } }) => p.size ?? ASPECT_SIZES[p.aspect];

/** one part of a speed ramp: from this second of the source file until the next part starts */
export interface SpeedSegment {
  from: number;
  speed: number;
  /** game sound 0..1; empty = automatic (full at ~1×, muted when faster) */
  volume?: number;
  note?: string;
}

export interface SpeedRamp {
  segments: SpeedSegment[];
  /** source second where the clip ends */
  end: number;
  /** length of the smooth speed transitions in output seconds (0 = hard switch) */
  smooth: number;
}

export type LayerType =
  | 'image'
  | 'video'
  | 'audio'
  | 'text'
  | 'multiplier'
  | 'button'
  | 'background'
  | 'particles'
  | 'placeholder'
  | 'camera'
  | 'frame'
  | 'subtitles';

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
  | 'shine'
  | 'dancePro'
  | 'bouncePro'
  | 'smoothRotate'
  | 'groupDance'
  | 'cameraZoom'
  | 'impactShake'
  | 'goldExplosion'
  | 'beatSync'
  | 'beatJump'
  | 'beatTurn'
  | 'coinFlip';

export type SfxKey = 'whoosh' | 'bounce' | 'coins' | 'sparkle' | 'riser' | 'button' | 'rewind';
export type ZoomMode = 'in' | 'out' | 'inout';

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
  /** sound effect played when this effect starts */
  sound?: SfxKey;
  soundVolume?: number;
  zoomMode?: ZoomMode;
  /** follow the music beats (Dance Pro, Group Dance, Golden Explosion, Beat Sync) */
  syncToMusic?: boolean;
  /** music-triggered effects: react to every Nth trigger beat, starting at offset */
  beatEvery?: number;
  beatOffset?: number;
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
  /** seconds skipped at the start of the media (trim) */
  trimStart?: number;
  fadeIn?: number;
  fadeOut?: number;
  channel?: 'music' | 'sfx' | 'voice';
  /** sound played when the layer appears */
  startSound?: SfxKey;
  startSoundVolume?: number;
  /** soft drop shadow that follows the object's scale */
  shadow?: boolean;
  /** blur proportional to movement speed */
  motionBlur?: boolean;
  /** how strongly the camera moves this layer (0 = fixed, 1 = full) */
  depth?: number;
  /** video speed (0.25 – 4) */
  playbackRate?: number;
  /** variable speed (speed ramp) for video layers; overrides trimStart / playbackRate */
  speedRamp?: SpeedRamp;
  /** the game video slot of a frame template: a new video is fitted into the frame automatically */
  gameSlot?: boolean;
  /** crop of the source picture (fractions 0–0.45 per side), e.g. to hide a phone's status / browser bars */
  mediaCrop?: { top: number; bottom: number; left: number; right: number };
  /** subtitles layer with its own lines (seconds from the layer start); *word* = highlighted */
  cues?: SubtitleCue[];
  /** volume automation of audio layers: multiplier points (seconds from the layer start), linear in between */
  volumeKeys?: { t: number; v: number }[];
  /** rewind effect for video layers: scrubs the source backwards from → to (seconds) over the layer */
  rewind?: { from: number; to: number; vhs?: boolean };
  /** Slot Reel Assemble effect (image layers; text layers with a premium glyph style) */
  reel?: ReelAssemble;
  /** Premium 3D gold glyph (Telegram Emoji Studio digits); the text stays editable */
  glyph?: GlyphStyle;
  /** zoom inside the layer box (cropped): scale and focus point 0..1 */
  mediaZoom?: { scale: number; x: number; y: number; animate?: boolean };
  colorFilter?: 'none' | 'sepia' | 'bw' | 'warm';
  /** text with {field} placeholders, filled from the story data fields */
  textTemplate?: string;
  /** layers created / owned by the story module */
  storyRole?: StoryRole;
  storySceneId?: string;
  /** stable slot of a story-generated layer (scene id + part); user edits are kept per slot */
  storySlot?: string;
  frame?: FrameSettings;
  subtitleStyle?: SubtitleStyle;
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
  /** result of the automatic rhythm analysis (seconds in the source file) */
  analysis?: AudioAnalysis;
  /** copied from the Varlık Kütüphanesi item with this id */
  libId?: string;
}

export interface AudioAnalysis {
  bpm: number;
  beats: number[];
  /** 0..1 strength of each beat */
  strengths: number[];
  duration: number;
  /** loudest sample of the file (0..1), used for normalising */
  peak?: number;
  /** true when the beat grid was set by hand (tempo, first beat) */
  manual?: boolean;
  firstBeat?: number;
  beatsPerBar?: number;
}

export interface MusicSection {
  id: string;
  label: string;
  /** composition seconds */
  start: number;
  end: number;
  /** multiplier for music-synced animations inside the section */
  boost: number;
}

export interface ProjectAudio {
  musicVolume: number;
  sfxVolume: number;
  musicMuted: boolean;
  sfxMuted: boolean;
  voiceVolume?: number;
  voiceMuted?: boolean;
  /** lower the music while the voice-over speaks (default on) */
  duckMusic?: boolean;
  /** lower the game sound of video layers while the voice-over speaks (default off) */
  duckGame?: boolean;
  /** music-synced animations on/off */
  syncEnabled: boolean;
  sections: MusicSection[];
}

export interface Project {
  id: string;
  name: string;
  aspect: Aspect;
  /** custom canvas size (keeps a recording's original ratio); empty = aspect preset */
  size?: { width: number; height: number };
  fps: number;
  durationInFrames: number;
  /** index 0 = bottom layer */
  layers: Layer[];
  assets: Asset[];
  updatedAt: number;
  audio?: ProjectAudio;
  story?: StoryData;
  /** Telegram Emoji Studio project (100×100 transparent WEBM/VP9 emoji, ≤3 s loop) */
  emoji?: EmojiMeta;
  /** set on a format copy made by the Toplu Reklam Formatı Oluşturucu: the source project and the format */
  variantOf?: { sourceId: string; aspect: Aspect };
}

export interface CompositionProps extends Record<string, unknown> {
  project: Project;
  assetUrls: Record<string, string>;
}

/* ---------------- Büyük Kazanç Hikâyesi ---------------- */

export type StoryRole = 'frame' | 'chrome' | 'scene' | 'subtitles' | 'label' | 'voice';

export interface FrameSettings {
  /** the video window inside the frame (composition px, centre + size) */
  window: { x: number; y: number; w: number; h: number };
  radius: number;
  thickness: number;
  colorA: string;
  colorB: string;
  lights: boolean;
  fruits: boolean;
  sevens: boolean;
  /** largest area the window may use; "fit to video" sizes the window inside it */
  area?: { x: number; y: number; w: number; h: number };
  /** strength of the frame's outer glow (0–2, default 1) */
  glow?: number;
}

export interface SubtitleStyle {
  fontSize: number;
  color: string;
  strokeColor: string;
  strokeWidth: number;
  highlight: string;
  box: boolean;
  /** soft drop shadow under the letters */
  shadow?: boolean;
}

export type StoryFieldKey =
  | 'gameName'
  | 'betAmount'
  | 'freeSpinValue'
  | 'totalWin'
  | 'bonusAmount'
  | 'freeSpinCount'
  | 'campaignText';

export type SceneKind = 'hook' | 'flashback' | 'start' | 'rising' | 'bigwin' | 'outro' | 'custom';
export type SceneTransition = 'cut' | 'fade' | 'zoom' | 'slide' | 'flash' | 'rewind';

export interface StoryClip {
  assetId?: string;
  /** seconds in the source recording */
  in: number;
  out: number;
  speed: number;
  zoom: number;
  zoomX: number;
  zoomY: number;
  zoomAnimate: boolean;
  muted: boolean;
  volume: number;
}

export interface StoryVoicePart {
  assetId?: string;
  /** seconds in the voice file */
  from: number;
  to: number;
  /** delay after the scene start */
  delay: number;
}

export interface StoryScene {
  id: string;
  kind: SceneKind;
  title: string;
  /** seconds */
  duration: number;
  clip: StoryClip;
  /** important moment this scene shows (marker on a recording) */
  markerId?: string;
  /** where inside the scene the marked moment should appear (seconds) */
  hitAt?: number;
  transition: SceneTransition;
  caption: string;
  voText: string;
  voice?: StoryVoicePart;
  colorFilter?: Layer['colorFilter'];
  /** index of the voice-over sentence that is linked to the marked game moment */
  anchorSentence?: number;
}

export interface StoryMarker {
  id: string;
  assetId: string;
  /** seconds in the recording */
  time: number;
  label: string;
  bigWin: boolean;
}

export interface SubtitleCue {
  id: string;
  text: string;
  start: number;
  end: number;
}

export interface StoryData {
  fields: Record<StoryFieldKey, string>;
  scenes: StoryScene[];
  markers: StoryMarker[];
  script: string;
  /** speaking rate used for duration estimates (words per second) */
  wordsPerSecond: number;
  subtitles: { enabled: boolean; mode: 'sentence' | 'word'; cues: SubtitleCue[] };
  frameEnabled: boolean;
  dramatization: { enabled: boolean; text: string };
  narrationStyle?: NarrationStyle;
  /** user edits of story-generated layers, kept across rebuilds (key = layer.storySlot) */
  layerOverrides?: Record<string, Partial<Layer>>;
}

export type NarrationStyle = 'excited' | 'story' | 'cinematic';

/** Telegram Emoji Studio */
export const EMOJI_CATEGORIES = ['Logo', 'Bonus', 'Çarpan', 'Premium Rakamlar V2', 'Premium Rakamlar', 'Slot sembolleri', 'Sağlayıcı logoları', 'Spor', 'Duyurular'] as const;
export interface EmojiMeta {
  category: string;
  /** design canvas is square (project.size, e.g. 512×512); exported at 100×100 */
  outSize?: number;
  /** strip emojis: "Slotolog Logo Assemble (şerit)" part 1 of 3 … */
  strip?: { group: string; index: number; count: number };
  note?: string;
  /** Premium Rakamlar set member: which character and which animation style */
  glyphSet?: { char: string; anim: GlyphAnim };
}

/** Slot Reel Assemble: the image is cut into vertical reels; symbols roll down each reel and it lands on its own slice. */
export interface ReelAssemble {
  /** cut positions inside the image, as fractions of its width (sorted, between 0 and 1) */
  cuts: number[];
  /** reel symbols: brand paths (decor/…, brand/…) or project asset ids */
  symbols: string[];
  /** frames at the start where the pieces stand apart */
  scatterFrames: number;
  /** frame (inside the layer) where the first reel lands */
  firstLand: number;
  /** frames between reels landing */
  stagger: number;
  /** frames at the end in which the pieces drift apart again (seamless loop) */
  releaseFrames: number;
  /** how far apart the pieces stand (0–1) */
  scatter: number;
  /** landing overshoot (0–1) */
  bounce: number;
  glowColor: string;
  /** symbols that pass on the first reel; later reels get one more each */
  spins: number;
  /** light sweep after assembling */
  shine: boolean;
  /** 'out' (default): fast start, overshoot; 'inout': speeds up, rolls, slows down and settles with a bounce (digits) */
  ease?: 'out' | 'inout';
}

/** Premium Rakamlar: 3D gold glyph drawn on canvas (Montserrat Black) */
/** set animation styles: reel = Slot Reel, pulse = Golden Pulse (V1), shine = Premium Shine (V2) */
export type GlyphAnim = 'reel' | 'pulse' | 'shine';

export interface GlyphStyle {
  /** brand accent used for the rim, the lower gold tones and the glow */
  accent: string;
  /** 0.6 – 1.4 */
  brightness: number;
  /** 3D depth in px (design canvas) */
  depth: number;
  /** 'reel' = Slot Reel (uses layer.reel), 'pulse' = Golden Pulse, 'shine' = Premium Shine (V2), 'static' = no motion */
  anim: GlyphAnim | 'static';
  /** 'orange' = Premium Rakamlar V2 görünümü (Inter Black, turuncu yüz); yoksa V1 altın görünüm */
  look?: 'gold' | 'orange';
  /** characters that roll past in the reel (default: digits) */
  spin?: string;
}
