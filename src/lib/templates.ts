import type { Keyframe, Project } from '../types';
import { brandLayer } from './brand';
import {
  BG_PRESETS,
  PARTICLE_PRESETS,
  backgroundLayer,
  baseLayer,
  buttonLayer,
  emptyProject,
  makeEffect,
  multiplierLayer,
  particlesLayer,
  textLayer,
} from './factory';

const s = (sec: number, fps = 30) => Math.round(sec * fps);

/** Slotolog logo (brand asset) at the top of the frame with a short entrance. */
function logo(p: Project, y: number, width = 620, entrance = true) {
  const l = brandLayer(p, 'logoWhite', width, { name: 'Slotolog logo', y });
  if (entrance) l.effects = [makeEffect('flyIn', 30, { direction: 'top', duration: s(0.9), intensity: 0.5 })];
  return l;
}

const bgPreset = (name: string) => (BG_PRESETS.find((b) => b.name === name) ?? BG_PRESETS[0]).settings;

/** Keyframes helper: [second (absolute), value][] relative to the layer start. */
function kf(layerStartSec: number, pts: [number, number][], easing: Keyframe['easing'] = 'easeInOut'): Keyframe[] {
  return pts.map(([sec, value]) => ({ frame: s(sec - layerStartSec), value, easing }));
}

/** A. Çarpan animasyonu — 15 sn */
export function multiplierTemplate(): Project {
  const p = emptyProject('9:16', 'Çarpan Animasyonu');
  p.durationInFrames = s(15);
  const end = p.durationInFrames;
  const bg = backgroundLayer(p, BG_PRESETS[0].settings);
  const sparkles = particlesLayer(p, PARTICLE_PRESETS[2].settings, 'Parıltılar');
  const rain = particlesLayer(p, { ...PARTICLE_PRESETS[0].settings, count: 14 }, 'Altın yağmuru');
  const lg = logo(p, 165, 600);
  lg.effects.push(makeEffect('glow', 30, { start: s(0.9), duration: end, color: '#5A2000', speed: 0.5, intensity: 0.5 }));
  const title = textLayer(p, { text: 'DEV ÇARPANLAR\nSENİ BEKLİYOR', fontSize: 92, style: 'white', strokeColor: '#7A2E00', strokeWidth: 10 }, { y: 380, start: s(0.4) });
  title.effects = [makeEffect('impact', 30, { duration: s(1) })];

  const spots: [string, number, number, number, number][] = [
    // value, x, y, width, entry second
    ['100X', 290, 640, 470, 1],
    ['250X', 790, 640, 470, 2],
    ['500X', 290, 960, 470, 3],
    ['750X', 790, 960, 470, 4],
    ['1000X', 540, 1360, 500, 5],
  ];
  const mults = spots.map(([v, x, y, w, sec], i) => {
    const l =
      v === '1000X'
        ? brandLayer(p, 'mult1000', w, { name: '1000X çarpan (görsel)', x, y, start: s(sec), duration: end - s(sec) })
        : multiplierLayer(p, v, { x, y, width: w, height: w / 2, start: s(sec), duration: end - s(sec) });
    l.effects = [
      makeEffect('impact', 30, { duration: s(0.9) }),
      makeEffect('flash', 30, { duration: s(0.8) }),
      makeEffect(i % 2 === 0 ? 'dance' : 'sway', 30, { start: s(0.9), duration: end, speed: 0.8 + i * 0.1, intensity: v === '1000X' ? 0.6 : 0.8 }),
      makeEffect('glow', 30, { start: s(0.9), duration: end, speed: 0.7 }),
    ];
    return l;
  });
  const burst = particlesLayer(p, PARTICLE_PRESETS[1].settings, 'Altın patlaması', { start: s(5), duration: s(2.6) });
  const btn = buttonLayer(p, 'HEMEN OYNA', { y: 1700, start: s(6.5), duration: end - s(6.5) });
  btn.effects = [makeEffect('flyIn', 30, { duration: s(0.8) }), makeEffect('pulse', 30, { start: s(0.8), duration: end, speed: 1.4, intensity: 0.7 })];

  p.layers = [bg, sparkles, rain, lg, title, ...mults, burst, btn];
  return p;
}

/** B. Bonus tanıtımı — 10 sn */
export function bonusTemplate(): Project {
  const p = emptyProject('9:16', 'Bonus Tanıtımı');
  p.durationInFrames = s(10);
  const end = p.durationInFrames;
  const bg = backgroundLayer(p, BG_PRESETS[1].settings);
  const rain = particlesLayer(p, PARTICLE_PRESETS[0].settings, 'Altın yağmuru');
  const sparkles = particlesLayer(p, PARTICLE_PRESETS[2].settings, 'Parıltılar');
  const lg = logo(p, 270, 680);
  lg.effects.push(makeEffect('glow', 30, { start: s(0.9), duration: end, color: '#5A2000', speed: 0.5, intensity: 0.5 }));
  const welcome = textLayer(p, { text: 'HOŞ GELDİN BONUSU', fontSize: 84, style: 'white', strokeColor: '#7A2E00', strokeWidth: 10 }, { y: 600, start: s(0.6) });
  welcome.effects = [makeEffect('flyIn', 30, { direction: 'left', duration: s(0.8) })];
  const amount = textLayer(p, { text: '100.000TL', fontSize: 190, style: 'gold', strokeColor: '#7A2E00', strokeWidth: 14, italic: true }, { y: 860, start: s(1.2) });
  amount.effects = [
    makeEffect('impact', 30, { duration: s(1) }),
    makeEffect('flash', 30, { duration: s(0.8) }),
    makeEffect('pulse', 30, { start: s(1), duration: end, speed: 0.8, intensity: 0.5 }),
    makeEffect('glow', 30, { start: s(1), duration: end }),
  ];
  const fs = textLayer(p, { text: '+ 450FS', fontSize: 150, style: 'gold', strokeColor: '#7A2E00', strokeWidth: 12, italic: true }, { y: 1090, start: s(1.9) });
  fs.effects = [makeEffect('impact', 30, { duration: s(0.9) }), makeEffect('sway', 30, { start: s(0.9), duration: end, speed: 0.7, intensity: 0.4 })];
  const burst = particlesLayer(p, PARTICLE_PRESETS[1].settings, 'Altın patlaması', { start: s(1.2), duration: s(2.6) });
  const btn = buttonLayer(p, 'BONUSU AL', { y: 1500, width: 700, height: 180, start: s(2.6), duration: end - s(2.6) });
  btn.button!.fontSize = 84;
  btn.effects = [makeEffect('flyIn', 30, { duration: s(0.8) }), makeEffect('pulse', 30, { start: s(0.8), duration: end, speed: 1.4, intensity: 0.8 })];
  p.layers = [bg, sparkles, rain, lg, welcome, burst, amount, fs, btn];
  return p;
}

/** C. Oyun videosu — 15 sn */
export function gameVideoTemplate(): Project {
  const p = emptyProject('9:16', 'Oyun Videosu');
  p.durationInFrames = s(15);
  const end = p.durationInFrames;
  const bg = backgroundLayer(p, bgPreset('Koyu Casino'));
  const lg = logo(p, 155, 560, false);
  lg.effects = [makeEffect('glow', 30, { duration: end, color: '#000000', speed: 0.3, intensity: 0.45 })];
  const video = baseLayer(
    {
      type: 'placeholder',
      name: 'Oyun videosu (değiştir)',
      y: 900,
      width: 1000,
      height: 1200,
      text: { text: "OYUN VİDEOSU\nMedya'dan video seçip\n'Seçili katmana uygula'", fontSize: 48, style: 'white', color: '#fff', strokeColor: '#000', strokeWidth: 0, extrude: false, italic: false },
      objectFit: 'cover',
    },
    p,
  );
  const bonus = textLayer(p, { text: '100.000TL + 450FS', fontSize: 92, style: 'gold', strokeColor: '#7A2E00', strokeWidth: 10, italic: true }, { y: 1612, name: 'Bonus metni' });
  bonus.effects = [makeEffect('pulse', 30, { duration: end, speed: 0.8, intensity: 0.4 })];
  const btn = buttonLayer(p, 'BONUSU AL', { y: 1790, width: 560, height: 130 });
  btn.button!.fontSize = 62;
  btn.effects = [makeEffect('pulse', 30, { duration: end, speed: 1.4, intensity: 0.8 })];
  p.layers = [bg, video, lg, bonus, btn];
  return p;
}

/** D. Slotolog Premium Bonus — 15 sn, lüks altın-siyah */
export function premiumTemplate(): Project {
  const p = emptyProject('9:16', 'Slotolog Premium Bonus');
  p.durationInFrames = s(15);
  const end = p.durationInFrames;
  const at = (sec: number, partial: Record<string, unknown> = {}) => ({ start: s(sec), duration: end - s(sec), ...partial });

  const bg = backgroundLayer(p, bgPreset('Lüks Altın-Siyah'), 'Lüks casino arka planı');
  const sparkles = particlesLayer(p, { kind: 'sparkles', count: 55, speed: 0.8, size: 34, seed: 7 }, 'Altın parıltılar');
  const rain = particlesLayer(p, { kind: 'coins', count: 9, speed: 0.55, size: 38, seed: 11 }, 'Hafif altın yağmuru', { opacity: 0.85 });

  // Logo
  const lg = logo(p, 175, 640);
  lg.effects.push(makeEffect('flash', 30, { start: s(0.5), duration: s(0.9), color: '#FFE2A8', intensity: 0.6 }));
  lg.effects.push(makeEffect('glow', 30, { start: s(1), duration: end, color: '#000000', speed: 0.3, intensity: 0.45 }));

  // Act 1 (0.6 – 5.4 s): four multipliers in a 2×2 grid, then they leave
  const grid: [string, number, number, number][] = [
    ['100X', 290, 500, 0.6],
    ['250X', 790, 500, 1.0],
    ['500X', 290, 745, 1.4],
    ['750X', 790, 745, 1.8],
  ];
  const exitAt = 5.0;
  const small = grid.map(([v, x, y, sec], i) => {
    const l = multiplierLayer(p, v, { x, y, width: 430, height: 215, start: s(sec), duration: s(exitAt + 0.6 - sec) });
    l.effects = [
      makeEffect('impact', 30, { duration: s(0.7), intensity: 0.28 }),
      makeEffect('flash', 30, { duration: s(0.7), intensity: 0.5 }),
      makeEffect(i % 2 === 0 ? 'dance' : 'sway', 30, { start: s(0.7), duration: end, speed: 0.9, intensity: 0.45 }),
      makeEffect('glow', 30, { start: s(0.7), duration: end, speed: 0.8, intensity: 0.6 }),
    ];
    l.keyframes = {
      opacity: kf(sec, [[exitAt + i * 0.06, 1], [exitAt + 0.45 + i * 0.06, 0]]),
      scale: kf(sec, [[exitAt + i * 0.06, 1], [exitAt + 0.45 + i * 0.06, 0.55]], 'easeIn'),
    };
    return l;
  });

  // Hero: uploaded 1000X image, stays until the end
  const hero = brandLayer(p, 'mult1000', 580, { name: '1000X çarpan (görsel)', y: 1180, ...at(2.4) });
  hero.effects = [
    makeEffect('impact', 30, { duration: s(0.9), intensity: 0.3 }),
    makeEffect('flash', 30, { duration: s(1), color: '#FFF1C2', intensity: 0.7 }),
    makeEffect('spin', 30, { start: s(0.9), duration: s(1.33), speed: 1, intensity: 1 }),
    makeEffect('dance', 30, { start: s(2.25), duration: end, speed: 0.7, intensity: 0.4 }),
    makeEffect('glow', 30, { start: s(0.9), duration: end, color: '#FFB300', speed: 0.6, intensity: 0.9 }),
  ];
  const heroBurst = particlesLayer(p, { kind: 'burst', count: 34, speed: 1, size: 44, seed: 5 }, 'Altın patlaması (1000X)', { start: s(2.4), duration: s(2.5) });

  // Act 2 (5.6 s →): bonus texts, top-to-bottom, no overlap with the 1000X
  const welcome = textLayer(
    p,
    { text: 'HOŞ GELDİN BONUSU', fontSize: 76, style: 'white', strokeColor: '#3D1500', strokeWidth: 9, extrude: true },
    { y: 430, ...at(5.6) },
  );
  welcome.effects = [makeEffect('flyIn', 30, { direction: 'left', duration: s(0.8), intensity: 0.6 })];

  const amount = textLayer(
    p,
    { text: '100.000TL', fontSize: 175, style: 'gold', strokeColor: '#3D1500', strokeWidth: 13, extrude: true, italic: true },
    { y: 600, ...at(6.1) },
  );
  amount.effects = [
    makeEffect('impact', 30, { duration: s(0.8), intensity: 0.35 }),
    makeEffect('flash', 30, { duration: s(0.9), color: '#FFF1C2', intensity: 0.6 }),
    makeEffect('glow', 30, { start: s(0.8), duration: end, color: '#FFB300', speed: 0.6, intensity: 0.7 }),
    makeEffect('pulse', 30, { start: s(0.8), duration: end, speed: 0.6, intensity: 0.3 }),
  ];
  const amountBurst = particlesLayer(p, { kind: 'burst', count: 26, speed: 1.1, size: 36, seed: 9 }, 'Altın patlaması (bonus)', { start: s(6.1), duration: s(2.3) });

  const fs = textLayer(
    p,
    { text: '+ 450FS', fontSize: 128, style: 'gold', strokeColor: '#3D1500', strokeWidth: 11, extrude: true, italic: true },
    { y: 790, ...at(6.8) },
  );
  fs.effects = [makeEffect('impact', 30, { duration: s(0.7), intensity: 0.3 }), makeEffect('sway', 30, { start: s(0.7), duration: end, speed: 0.6, intensity: 0.3 })];

  const btn = buttonLayer(p, 'BONUSU AL', { y: 1600, width: 700, height: 170, ...at(7.6) });
  btn.button = { ...btn.button!, fontSize: 82, colorTop: '#FFC15A', colorBottom: '#FF7A00' };
  btn.effects = [
    makeEffect('flyIn', 30, { duration: s(0.8), intensity: 0.5 }),
    makeEffect('pulse', 30, { start: s(0.8), duration: end, speed: 1.3, intensity: 0.6 }),
    makeEffect('glow', 30, { start: s(0.8), duration: end, color: '#FF8E16', speed: 1.3, intensity: 0.6 }),
  ];

  const legal = textLayer(
    p,
    { text: '18+ · Kampanya koşulları geçerlidir · Sorumlu oyna', fontSize: 34, style: 'solid', color: '#D9C7A8', strokeWidth: 0, extrude: false },
    { y: 1830, width: 1000, height: 60, name: 'Yasal not', ...at(8) },
  );
  legal.keyframes = { opacity: kf(8, [[8, 0], [8.6, 1]]) };

  p.layers = [bg, sparkles, rain, lg, ...small, heroBurst, hero, welcome, amountBurst, amount, fs, btn, legal];
  return p;
}

export const TEMPLATES = [
  { id: 'premium', name: '★ Slotolog Premium Bonus', desc: 'Lüks altın-siyah, logo, 100X–1000X, bonus, 15 sn', make: premiumTemplate },
  { id: 'multiplier', name: 'A · Çarpan animasyonu', desc: '100X–1000X çarpanlar, 15 sn', make: multiplierTemplate },
  { id: 'bonus', name: 'B · Bonus tanıtımı', desc: 'Logo, 100.000TL + 450FS, buton', make: bonusTemplate },
  { id: 'game', name: 'C · Oyun videosu', desc: 'Logo, oyun videosu, bonus alanı', make: gameVideoTemplate },
];
