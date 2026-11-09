import type { Asset, Layer, Project } from '../types';
import { baseLayer } from './factory';

/** Built-in Slotolog brand assets, shipped with the app in public/brand. */
export const BRAND_ASSETS = {
  logoWhite: {
    id: 'brand-logo-white',
    name: 'Slotolog logo (beyaz – koyu zemin)',
    kind: 'image',
    mime: 'image/png',
    width: 1050,
    height: 308,
    src: 'brand/slotolog-logo-white.png',
  },
  logoBadge: {
    id: 'brand-logo-badge',
    name: 'Slotolog logo rozeti (her zeminde okunur)',
    kind: 'image',
    mime: 'image/png',
    width: 1260,
    height: 440,
    src: 'brand/slotolog-logo-badge.png',
  },
  logo: {
    id: 'brand-logo',
    name: 'Slotolog logo (orijinal – açık zemin)',
    kind: 'image',
    mime: 'image/png',
    width: 1050,
    height: 308,
    src: 'brand/slotolog-logo.png',
  },
  mult1000: {
    id: 'brand-1000x',
    name: '1000X çarpan (bomba)',
    kind: 'image',
    mime: 'image/png',
    width: 408,
    height: 381,
    src: 'brand/multiplier-1000x.png',
  },
  decorCoin: {
    id: 'decor-coin',
    name: 'Dekor: altın coin',
    kind: 'image',
    mime: 'image/svg+xml',
    width: 256,
    height: 256,
    src: 'decor/coin.svg',
  },
  decorSeven: {
    id: 'decor-seven',
    name: 'Dekor: 7 sembolü',
    kind: 'image',
    mime: 'image/svg+xml',
    width: 220,
    height: 300,
    src: 'decor/seven.svg',
  },
  decorBell: {
    id: 'decor-bell',
    name: 'Dekor: jackpot çanı',
    kind: 'image',
    mime: 'image/svg+xml',
    width: 260,
    height: 280,
    src: 'decor/bell.svg',
  },
  decorCherry: {
    id: 'decor-cherry',
    name: 'Dekor: kiraz',
    kind: 'image',
    mime: 'image/svg+xml',
    width: 260,
    height: 260,
    src: 'decor/cherry.svg',
  },
  decorGem: {
    id: 'decor-gem',
    name: 'Dekor: mor mücevher',
    kind: 'image',
    mime: 'image/svg+xml',
    width: 240,
    height: 220,
    src: 'decor/gem.svg',
  },
  decorGlowOrange: {
    id: 'decor-glow-orange',
    name: 'Dekor: turuncu ışık',
    kind: 'image',
    mime: 'image/svg+xml',
    width: 400,
    height: 400,
    src: 'decor/glow-orange.svg',
  },
  decorGlowViolet: {
    id: 'decor-glow-violet',
    name: 'Dekor: mor ışık',
    kind: 'image',
    mime: 'image/svg+xml',
    width: 400,
    height: 400,
    src: 'decor/glow-violet.svg',
  },
  decorRibbon: {
    id: 'decor-ribbon',
    name: 'Slogan kurdelesi',
    kind: 'image',
    mime: 'image/svg+xml',
    width: 720,
    height: 100,
    src: 'decor/ribbon.svg',
  },
  decorBonusCard: {
    id: 'decor-bonus-card',
    name: 'Bonus kartı',
    kind: 'image',
    mime: 'image/svg+xml',
    width: 800,
    height: 270,
    src: 'decor/bonus-card.svg',
  },
} satisfies Record<string, Asset>;

export type BrandKey = keyof typeof BRAND_ASSETS;

export const brandUrl = (src: string) => new URL(src, document.baseURI).href;

/** Makes sure the brand asset is part of the project and returns its id. */
export function ensureBrandAsset(p: Project, key: BrandKey): string {
  const a = BRAND_ASSETS[key];
  if (!p.assets.some((x) => x.id === a.id)) p.assets = [...p.assets, { ...a }];
  return a.id;
}

/** Image layer showing a brand asset, sized to `width` with the original aspect ratio. */
export function brandLayer(p: Project, key: BrandKey, width: number, partial: Partial<Layer> = {}): Layer {
  const a = BRAND_ASSETS[key];
  const id = ensureBrandAsset(p, key);
  return baseLayer(
    { type: 'image', name: a.name, assetId: id, width, height: Math.round((width * a.height) / a.width), objectFit: 'contain', ...partial },
    p,
  );
}
