import { baseLayer, makeEffect, textLayer, uid } from './factory';
import { brandLayer } from './brand';
import { DEFAULT_REEL, reelMinFrames } from './reel';
import { fitToLoop } from './emojiOps';
import type { BonusStyle, EmojiMeta, GlyphAnim, GlyphStyle, Keyframe, Layer, Project, ReelAssemble } from '../types';

/** Telegram Emoji Studio — design canvas 512×512 (exported 100×100), 30 FPS, 3 s loop */
export const EMOJI_CANVAS = 512;
export const EMOJI_FRAMES = 90;

/** harf aralıkları gerçek logo PNG'sinin (slotolog-logo-white.png, 1050 px) şeffaflık profilinden ölçüldü */
export const LOGO_LETTER_CUTS = [0.156, 0.204, 0.366, 0.471, 0.633, 0.68, 0.844];
const LOGO_PAIR_CUTS = [0.204, 0.471, 0.68]; // sl | ot | ol | og
const MARK_CUTS = [0.38, 0.623]; // o | t | o

export function emojiProject(name: string, emoji: EmojiMeta, frames = EMOJI_FRAMES): Project {
  return { id: uid(), name, aspect: '1:1', size: { width: EMOJI_CANVAS, height: EMOJI_CANVAS }, fps: 30, durationInFrames: frames, layers: [], assets: [], updatedAt: Date.now(), emoji };
}

const kf = (pairs: [number, number][], easing: Keyframe['easing'] = 'easeInOut'): Keyframe[] => pairs.map(([frame, value]) => ({ frame, value, easing }));

/** whole-loop effect helper: speed chosen so the effect completes whole cycles in the loop */
const loopFx = (type: Parameters<typeof makeEffect>[0], frames: number, partial: Parameters<typeof makeEffect>[2] = {}) =>
  makeEffect(type, 30, { start: 0, duration: frames, ...partial });

/** soft orange glow behind the logo that blooms when the reels lock */
function assembleGlow(p: Project, reel: ReelAssemble, cols: number, size: number, y = EMOJI_CANVAS / 2): Layer {
  const last = reel.firstLand + (cols - 1) * reel.stagger;
  const rel = p.durationInFrames - reel.releaseFrames;
  return brandLayer(p, 'decorGlowOrange', size, {
    name: 'Turuncu ışıma (birleşince)',
    y,
    opacity: 0,
    keyframes: { opacity: kf([[0, 0], [last - 2, 0], [last + 3, 0.95], [rel - 2, 0.35], [p.durationInFrames - 1, 0]]) },
  });
}

/** 1 · Logo Assemble — tam logo tek emoji */
export function emojiLogoAssemble(): Project {
  const p = emojiProject('Slotolog Logo Assemble', { category: 'Logo', note: 'Tam logo tek emojide (100 px’te küçük kalır; okunaklı sürümler: şerit ve işaret)' });
  const reel: ReelAssemble = { ...DEFAULT_REEL, cuts: LOGO_PAIR_CUTS, firstLand: 38, stagger: 7, scatterFrames: 8, releaseFrames: 12, spins: 4, scatter: 0.5 };
  p.layers.push(assembleGlow(p, reel, 4, 470));
  p.layers.push(brandLayer(p, 'logoWhite', 430, { name: 'Slotolog logo (Slot Reel Assemble)', reel }));
  return p;
}

/** 1b · Logo Assemble — sadeleştirilmiş işaret (gerçek logodaki "oto" + gülümseme), 100 px’te okunaklı */
export function emojiLogoMarkAssemble(): Project {
  const p = emojiProject('Slotolog Logo Assemble · İşaret', { category: 'Logo', note: 'Okunaklı sadeleştirilmiş sürüm: gerçek logodan kırpılmış "oto" + gülümseme' });
  const reel: ReelAssemble = { ...DEFAULT_REEL, cuts: MARK_CUTS, firstLand: 40, stagger: 8, scatterFrames: 8, releaseFrames: 12, spins: 3, scatter: 0.5 };
  p.layers.push(assembleGlow(p, reel, 3, 480));
  p.layers.push(brandLayer(p, 'logoMark', 420, { name: 'Slotolog işareti (Slot Reel Assemble)', reel }));
  return p;
}

/** 1c · Logo Assemble — 3 emojilik yatay şerit: yan yana yazılınca tam logo okunur (her harf ayrı makara) */
export function emojiLogoAssembleStrip(): Project[] {
  const group = uid();
  const reel: ReelAssemble = { ...DEFAULT_REEL, cuts: LOGO_LETTER_CUTS, firstLand: 34, stagger: 3, scatterFrames: 6, releaseFrames: 12, spins: 3, scatter: 0.35 };
  const W = EMOJI_CANVAS * 3;
  return [0, 1, 2].map((i) => {
    const p = emojiProject(`Slotolog Logo Assemble · Şerit ${i + 1}/3`, {
      category: 'Logo',
      strip: { group, index: i, count: 3 },
      note: 'Telegram’da üç emojiyi yan yana yaz: tam logo büyük ve okunaklı görünür',
    });
    const x = W / 2 - i * EMOJI_CANVAS;
    p.layers.push(brandLayer(p, 'logoWhite', W - 40, { name: `Slotolog logo · parça ${i + 1}/3 (Slot Reel Assemble)`, x, reel }));
    return p;
  });
}

/** 2 · Logo Spin — işaret para gibi döner, parlar, dinlenir */
export function emojiLogoSpin(): Project {
  const p = emojiProject('Slotolog Logo Spin', { category: 'Logo' });
  const F = p.durationInFrames;
  p.layers.push(brandLayer(p, 'decorGlowOrange', 440, { name: 'Turuncu ışıma', effects: [loopFx('pulse', F, { speed: 2 / 3, intensity: 0.6 })] }));
  p.layers.push(
    brandLayer(p, 'logoMark', 470, {
      name: 'Slotolog işareti',
      effects: [loopFx('coinFlip', F, { speed: 1 }), loopFx('shine', F, { speed: 2.6 / 3, color: '#FFF3D6' })],
    }),
  );
  return p;
}

const goldWord = (p: Project, text: string, fontSize: number, partial: Partial<Layer> = {}) =>
  textLayer(p, { text, fontSize, style: 'gold', strokeColor: '#5A1E00', strokeWidth: Math.round(fontSize * 0.08), extrude: true, italic: false }, { width: 470, height: fontSize * 1.25, ...partial });

/** 3 · BONUS — altın-turuncu parlayan yazı */
export function emojiBonus(): Project {
  const p = emojiProject('BONUS', { category: 'Bonus' });
  const F = p.durationInFrames;
  p.layers.push(brandLayer(p, 'decorGlowOrange', 430, { name: 'Turuncu ışıma', effects: [loopFx('pulse', F, { speed: 2 / 3, intensity: 0.8 })] }));
  p.layers.push(brandLayer(p, 'decorCoin', 120, { name: 'Coin (sol)', x: 92, y: 120, effects: [loopFx('float', F, { speed: 2 / (3 * 0.35), intensity: 0.7 })] }));
  p.layers.push(brandLayer(p, 'decorCoin', 96, { name: 'Coin (sağ)', x: 430, y: 400, effects: [loopFx('float', F, { speed: 1 / (3 * 0.35), intensity: 0.8 })] }));
  p.layers.push(
    goldWord(p, 'BONUS', 112, {
      name: 'BONUS yazısı',
      effects: [loopFx('pulse', F, { speed: 2 / 3, intensity: 0.5 }), loopFx('shine', F, { speed: 2.6 / 1.5, color: '#FFFFFF' })],
    }),
  );
  return p;
}

/** 4 · 1000X Bomb — mevcut gerçek 1000X PNG */
export function emojiBomb(): Project {
  const p = emojiProject('1000X Bomb', { category: 'Çarpan' });
  const F = p.durationInFrames;
  p.layers.push(brandLayer(p, 'decorGlowOrange', 440, { name: 'Turuncu ışıma', effects: [loopFx('pulse', F, { speed: 4 / 3, intensity: 0.7 })] }));
  p.layers.push(
    brandLayer(p, 'mult1000', 380, {
      name: '1000X bomba (gerçek PNG)',
      y: 276,
      effects: [loopFx('bouncePro', F, { speed: 1, intensity: 0.45 }), loopFx('shine', F, { speed: 2.6 / 1.5, color: '#FFFFFF' })],
    }),
  );
  return p;
}

/** 5 · JACKPOT — ışık patlamalı */
export function emojiJackpot(): Project {
  const p = emojiProject('JACKPOT', { category: 'Duyurular' });
  const F = p.durationInFrames;
  // light burst in the middle of the loop: starts and ends invisible → seamless
  p.layers.push(
    brandLayer(p, 'decorGlowOrange', 420, {
      name: 'Işık patlaması',
      y: 230,
      opacity: 0,
      // burst: flares up fast, fades out slowly (stays inside the 100×100 square)
      keyframes: { opacity: kf([[0, 0], [22, 0], [27, 1], [60, 0.5], [89, 0]]), scale: kf([[0, 0.45], [22, 0.45], [29, 1.12], [89, 0.6]]) },
    }),
  );
  p.layers.push(brandLayer(p, 'decorSeven', 104, { name: '7 (sol)', x: 128, y: 372, rotation: -12, effects: [loopFx('sway', F, { speed: 1 / (3 * 0.8), intensity: 0.5 })] }));
  p.layers.push(brandLayer(p, 'decorSeven', 104, { name: '7 (sağ)', x: 384, y: 372, rotation: 12, effects: [loopFx('sway', F, { speed: 1 / (3 * 0.8), intensity: 0.5 })] }));
  p.layers.push(
    goldWord(p, 'JACKPOT', 86, {
      name: 'JACKPOT yazısı',
      y: 236,
      effects: [loopFx('pulse', F, { speed: 4 / 3, intensity: 0.45 }), loopFx('shine', F, { speed: 2.6 / 1.5, color: '#FFFFFF' })],
    }),
  );
  return p;
}

/** 6 · FREE SPIN — dönme ve parlama */
export function emojiFreeSpin(): Project {
  const p = emojiProject('FREE SPIN', { category: 'Bonus' });
  const F = p.durationInFrames;
  p.layers.push(brandLayer(p, 'decorCoin', 420, { name: 'Dönen coin', opacity: 0.9, effects: [loopFx('spin', F, { speed: 1 / (3 * 0.75), intensity: 1 })] }));
  p.layers.push(brandLayer(p, 'decorGlowOrange', 430, { name: 'Turuncu ışıma', effects: [loopFx('pulse', F, { speed: 2 / 3, intensity: 0.6 })] }));
  p.layers.push(goldWord(p, 'FREE', 116, { name: 'FREE', y: 186, effects: [loopFx('coinFlip', F, { speed: 1 }), loopFx('shine', F, { speed: 2.6 / 1.5, color: '#FFFFFF' })] }));
  p.layers.push(
    goldWord(p, 'SPIN', 116, { name: 'SPIN', y: 330, effects: [loopFx('coinFlip', F, { speed: 1, phase: 0 }), loopFx('shine', F, { speed: 2.6 / 1.5, color: '#FFFFFF' })] }),
  );
  return p;
}

/* ---------------- Premium Rakamlar ---------------- */

export const GLYPH_CHARS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '%', '+', '×', '₺', '.', 'FS'];
/** ascii file / project names for the symbols */
export const GLYPH_NAMES: Record<string, string> = { '%': 'yuzde', '+': 'arti', '×': 'carpi', '₺': 'TL', '.': 'nokta', FS: 'FS' };
export const GLYPH_FONT = 486; // cap height ≈ 340 px on the 512 canvas → same height for every character
export const GLYPH_BOX = 470;
export const DEFAULT_GLYPH: GlyphStyle = { accent: '#FF8E16', brightness: 1, depth: 18, anim: 'reel' };
/** Slot Reel timing shared by every digit: hold (sharp) → roll in from the top → land with a bounce → gold sweep → long sharp hold */
export const GLYPH_REEL: ReelAssemble = { cuts: [], symbols: [], scatterFrames: 16, firstLand: 40, stagger: 0, releaseFrames: 0, scatter: 0, bounce: 0.9, glowColor: '#FF8E16', spins: 4, shine: true, ease: 'inout' };

export const glyphLabel = (ch: string) => GLYPH_NAMES[ch] ?? ch;

/** Premium Rakamlar V2: Inter Black, turuncu parlak 3D yüz, yerinde duran Premium Shine animasyonu */
export const GLYPH_V2_FONT = 452; // Inter cap ≈ 329 px on the 512 canvas — same height as V1
export const DEFAULT_GLYPH_V2: GlyphStyle = { accent: '#FF8E16', brightness: 1, depth: 14, anim: 'shine', look: 'orange' };
export const GLYPH_ANIM_LABEL: Record<GlyphAnim, string> = { reel: 'Slot Reel', pulse: 'Golden Pulse', shine: 'Premium V2' };

export function premiumGlyph(ch: string, anim: GlyphAnim = 'reel', style: Partial<GlyphStyle> = {}): Project {
  const v2 = anim === 'shine';
  const p = emojiProject(`Rakam ${ch} · ${GLYPH_ANIM_LABEL[anim]}`, { category: v2 ? 'Premium Rakamlar V2' : 'Premium Rakamlar', glyphSet: { char: ch, anim } });
  const glyph: GlyphStyle = { ...(v2 ? DEFAULT_GLYPH_V2 : DEFAULT_GLYPH), ...style, anim };
  p.layers.push(
    textLayer(
      p,
      { text: ch, fontSize: v2 ? GLYPH_V2_FONT : GLYPH_FONT, style: 'gold', strokeColor: '#1E1E1E', strokeWidth: 0, extrude: true, italic: false },
      { name: `Premium rakam “${ch}”`, x: EMOJI_CANVAS / 2, y: EMOJI_CANVAS / 2, width: GLYPH_BOX, height: GLYPH_BOX, glyph, reel: anim === 'reel' ? { ...GLYPH_REEL, glowColor: glyph.accent } : undefined },
    ),
  );
  return p;
}

export const premiumGlyphSet = (anim: GlyphAnim = 'reel', style: Partial<GlyphStyle> = {}) => GLYPH_CHARS.map((ch) => premiumGlyph(ch, anim, style));

/** splits "100.000₺", "+450 FS", "%150", "1000×" into set characters (FS is one emoji; x/X → ×; TL → ₺) */
export function glyphTokens(s: string): string[] {
  const out: string[] = [];
  const t = s.replace(/TL/gi, '₺').replace(/[xX*]/g, '×');
  for (let i = 0; i < t.length; i++) {
    if (t.slice(i, i + 2).toUpperCase() === 'FS') {
      out.push('FS');
      i++;
    } else if (t[i] !== ' ') out.push(t[i]);
    else out.push(' ');
  }
  return out;
}

export interface EmojiPreset {
  id: string;
  name: string;
  category: string;
  make: () => Project | Project[];
}

/** every preset is passed through the loop fixer: periodic effects end exactly where they started */
const looped = (make: () => Project | Project[]) => () => {
  const m = make();
  return Array.isArray(m) ? m.map((p) => fitToLoop(p).project) : fitToLoop(m).project;
};

export const EMOJI_PRESETS: EmojiPreset[] = [
  { id: 'logo-assemble', name: 'Slotolog Logo Assemble', category: 'Logo', make: looped(emojiLogoAssemble) },
  { id: 'logo-mark', name: 'Logo Assemble · İşaret (okunaklı)', category: 'Logo', make: looped(emojiLogoMarkAssemble) },
  { id: 'logo-strip', name: 'Logo Assemble · 3’lü şerit', category: 'Logo', make: looped(emojiLogoAssembleStrip) },
  { id: 'logo-spin', name: 'Slotolog Logo Spin', category: 'Logo', make: looped(emojiLogoSpin) },
  { id: 'bonus', name: 'BONUS', category: 'Bonus', make: looped(emojiBonus) },
  { id: 'bomb', name: '1000X Bomb', category: 'Çarpan', make: looped(emojiBomb) },
  { id: 'jackpot', name: 'JACKPOT', category: 'Duyurular', make: looped(emojiJackpot) },
  { id: 'freespin', name: 'FREE SPIN', category: 'Bonus', make: looped(emojiFreeSpin) },
];

/** Slot Reel Assemble’ı herhangi bir görsel katmana uygular (ileride sağlayıcı logoları için) */
export function applyReel(layer: Layer, frames: number, columns = 4): ReelAssemble {
  const cuts = Array.from({ length: columns - 1 }, (_, i) => (i + 1) / columns);
  const reel: ReelAssemble = { ...DEFAULT_REEL, cuts };
  // fit timing into the loop
  const spare = frames - reelMinFrames(reel);
  if (spare < 0) reel.stagger = Math.max(2, Math.floor((frames - 18 - reel.releaseFrames - reel.firstLand) / Math.max(1, columns - 1)));
  void layer;
  return reel;
}


/** Bonus Seviyeleri: 3 seri × 5 seviye (Bronz → Elmas). Prosedürel çizim, yerinde parlama/pulse animasyonu. */
export const BONUS_SERIES_ORDER: BonusStyle['series'][] = ['crown', 'badge', 'chip'];
export const BONUS_SERIES_NAME: Record<BonusStyle['series'], string> = { crown: 'Premium Taçlar', badge: 'Premium Rozetler', chip: 'Premium Casino Chips' };
export const BONUS_SERIES_SHORT: Record<BonusStyle['series'], string> = { crown: 'Taç', badge: 'Rozet', chip: 'Chip' };
export const BONUS_LEVEL_NAME = ['Bronz', 'Gümüş', 'Altın', 'Platin', 'Elmas'];
const SERIES_LETTER: Record<BonusStyle['series'], string> = { crown: 'A', badge: 'B', chip: 'C' };

export function bonusEmoji(series: BonusStyle['series'], level: number, style: Partial<BonusStyle> = {}): Project {
  const p = emojiProject(`${SERIES_LETTER[series]} · ${BONUS_SERIES_SHORT[series]} · ${level + 1} ${BONUS_LEVEL_NAME[level]}`, { category: 'Bonus Seviyeleri', bonus: { series, level } });
  p.layers.push(
    baseLayer(
      {
        type: 'placeholder',
        name: `${BONUS_SERIES_SHORT[series]} — ${BONUS_LEVEL_NAME[level]}`,
        x: EMOJI_CANVAS / 2,
        y: EMOJI_CANVAS / 2,
        width: EMOJI_CANVAS,
        height: EMOJI_CANVAS,
        duration: EMOJI_FRAMES,
        bonus: { series, level, accent: '#FF8E16', shine: 1, scale: 1, ...style },
      },
      p,
    ),
  );
  return p;
}
export const bonusSet = () => BONUS_SERIES_ORDER.flatMap((s) => BONUS_LEVEL_NAME.map((_, lv) => bonusEmoji(s, lv)));
