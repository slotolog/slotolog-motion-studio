import type { SfxKey } from '../types';
import { brandUrl } from './brand';

/** Original sound effects synthesised by tools/make_sfx.py (no third-party samples). */
export const SFX: Record<SfxKey, { name: string; src: string; duration: number }> = {
  whoosh: { name: 'Whoosh (giriş)', src: 'sfx/whoosh.wav', duration: 0.6 },
  bounce: { name: 'Bounce (zıplama)', src: 'sfx/bounce.wav', duration: 0.32 },
  coins: { name: 'Altın parıltısı (patlama)', src: 'sfx/coins.wav', duration: 1.5 },
  sparkle: { name: 'Sparkle (ışık geçişi)', src: 'sfx/sparkle.wav', duration: 1.4 },
  riser: { name: 'Yükseliş (yazı girişi)', src: 'sfx/riser.wav', duration: 1.05 },
  button: { name: 'Buton (ta-da)', src: 'sfx/button.wav', duration: 1.9 },
};

export const SFX_KEYS = Object.keys(SFX) as SfxKey[];
export const sfxUrl = (k: SfxKey) => brandUrl(SFX[k].src);
