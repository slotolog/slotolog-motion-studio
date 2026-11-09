import type { Keyframe, Layer, Project } from '../types';
import { brandLayer } from './brand';
import { cameraLayer, frameLayer } from './factory';
import { defaultStory, defaultSubtitleStyle, rebuildStory } from './story';
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
      makeEffect('impact', 30, { duration: s(0.6), intensity: 0.14 }),
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
    makeEffect('impact', 30, { duration: s(0.8), intensity: 0.15 }),
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
    makeEffect('impact', 30, { duration: s(0.7), intensity: 0.15 }),
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
  fs.effects = [makeEffect('impact', 30, { duration: s(0.6), intensity: 0.15 }), makeEffect('sway', 30, { start: s(0.7), duration: end, speed: 0.6, intensity: 0.3 })];

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

/** E. Slotolog 1000X Bomb Party — 18 sn, 2 + 3 bomba, parti arka planı, meyveler */
export function bombPartyTemplate(): Project {
  const p = emptyProject('9:16', 'Slotolog 1000X Bomb Party');
  p.durationInFrames = s(18);
  const end = p.durationInFrames;
  const from = (sec: number) => ({ start: s(sec), duration: end - s(sec) });

  const bg = backgroundLayer(p, bgPreset('Slotolog Parti'), 'Parti arka planı');
  const frame = particlesLayer(p, { kind: 'fruitFrame', count: 7, speed: 1, size: 82, seed: 3 }, 'Meyve çerçevesi (üst/alt)');
  frame.particles!.seed = 3;
  const fruits = particlesLayer(p, { kind: 'fruits', count: 9, speed: 0.75, size: 44, seed: 8 }, 'Uçuşan meyveler', { opacity: 0.9 });
  fruits.particles!.seed = 8;
  const coins = particlesLayer(p, { kind: 'coins', count: 16, speed: 0.7, size: 24, seed: 12 }, 'Küçük altınlar');
  coins.particles!.seed = 12;

  const lg = brandLayer(p, 'logoBadge', 560, { name: 'Slotolog logo', y: 178 });
  lg.effects = [
    makeEffect('flyIn', 30, { direction: 'top', duration: s(0.9), intensity: 0.5 }),
    makeEffect('float', 30, { start: s(0.9), duration: end, speed: 0.6, intensity: 0.35 }),
    makeEffect('shine', 30, { start: s(0.9), duration: end, speed: 0.35, intensity: 0.7, phase: 1.5 }),
  ];

  // 2 bombs on top, 3 below — each one an independent, editable image layer
  const bombs: [number, number, number, number][] = [
    // x, y, width, entry second
    [315, 505, 390, 0.3],
    [765, 505, 390, 0.5],
    [185, 895, 330, 0.75],
    [540, 895, 330, 0.95],
    [895, 895, 330, 1.15],
  ];
  const bombLayers = bombs.map(([x, y, w, sec], i) => {
    const l = brandLayer(p, 'mult1000', w, { name: `1000X bomba ${i + 1}`, x, y, ...from(sec) });
    const ph = [0, 1.7, 0.9, 2.6, 0.4][i];
    l.effects = [
      makeEffect('impact', 30, { duration: s(0.6), intensity: 0.15 }),
      makeEffect('flash', 30, { duration: s(0.7), intensity: 0.6, color: '#FFF6D0' }),
      makeEffect('sway', 30, { start: s(0.6), duration: end, speed: [0.55, 0.65, 0.6, 0.7, 0.5][i], intensity: 0.32, phase: ph }),
      makeEffect('float', 30, { start: s(0.6), duration: end, speed: [0.9, 1.05, 0.95, 0.85, 1.1][i], intensity: 0.9, phase: ph * 1.3 }),
      makeEffect('pulse', 30, { start: s(0.6), duration: end, speed: [0.42, 0.36, 0.48, 0.4, 0.45][i], intensity: 0.35, phase: ph * 0.7 }),
      makeEffect('shine', 30, { start: s(0.6), duration: end, speed: [0.45, 0.42, 0.5, 0.47, 0.4][i], intensity: 1, phase: i * 0.55 }),
      makeEffect('glow', 30, { start: s(0.6), duration: end, color: '#FFD23F', speed: 0.5, intensity: 0.45, phase: ph }),
      // flash waves keep the scene alive
      makeEffect('flash', 30, { start: s(7 - sec + i * 0.15), duration: s(0.7), intensity: 0.55, color: '#FFFFFF' }),
      makeEffect('flash', 30, { start: s(12.5 - sec + i * 0.15), duration: s(0.7), intensity: 0.55, color: '#FFFFFF' }),
    ];
    return l;
  });

  const burst1 = particlesLayer(p, { kind: 'burst', count: 30, speed: 1, size: 34, seed: 21 }, 'Altın patlaması 1', { start: s(1.2), duration: s(2.6) });
  const burst2 = particlesLayer(p, { kind: 'burst', count: 24, speed: 1, size: 30, seed: 22 }, 'Altın patlaması 2', { start: s(9.5), duration: s(2.6) });
  const burst3 = particlesLayer(p, { kind: 'burst', count: 24, speed: 1, size: 30, seed: 23 }, 'Altın patlaması 3', { start: s(15), duration: s(2.6) });
  [burst1, burst2, burst3].forEach((b, i) => (b.particles!.seed = 21 + i));
  const sparkles = particlesLayer(p, { kind: 'sparkles', count: 45, speed: 0.9, size: 32, seed: 31 }, 'Parıltılar');
  sparkles.particles!.seed = 31;

  const amount = textLayer(
    p,
    { text: '100.000TL', fontSize: 150, style: 'gold', strokeColor: '#5A1500', strokeWidth: 13, extrude: true, italic: true },
    { name: 'Bonus miktarı', y: 1172, ...from(1.6) },
  );
  amount.effects = [
    makeEffect('impact', 30, { duration: s(0.6), intensity: 0.15 }),
    makeEffect('flash', 30, { duration: s(0.8), color: '#FFF6D0', intensity: 0.7 }),
    makeEffect('pulse', 30, { start: s(0.6), duration: end, speed: 0.55, intensity: 0.25 }),
    makeEffect('glow', 30, { start: s(0.6), duration: end, color: '#FFE27A', speed: 0.55, intensity: 0.45 }),
    makeEffect('flash', 30, { start: s(9.5 - 1.6), duration: s(0.8), color: '#FFFFFF', intensity: 0.6 }),
    makeEffect('flash', 30, { start: s(15 - 1.6), duration: s(0.8), color: '#FFFFFF', intensity: 0.6 }),
  ];
  const fs = textLayer(
    p,
    { text: '+ 450FS', fontSize: 112, style: 'gold', strokeColor: '#5A1500', strokeWidth: 11, extrude: true, italic: true },
    { name: 'Free spin', y: 1322, ...from(2.1) },
  );
  fs.effects = [makeEffect('impact', 30, { duration: s(0.6), intensity: 0.15 }), makeEffect('sway', 30, { start: s(0.6), duration: end, speed: 0.5, intensity: 0.2 })];
  const players = textLayer(
    p,
    { text: 'TÜM YENİ OYUNCULARA', fontSize: 72, style: 'white', strokeColor: '#7A1E00', strokeWidth: 9, extrude: true },
    { name: 'Hedef kitle', y: 1450, ...from(2.6) },
  );
  players.effects = [makeEffect('flyIn', 30, { direction: 'left', duration: s(0.8), intensity: 0.5 })];

  const btn = buttonLayer(p, 'BONUSU AL', { y: 1645, width: 760, height: 180, ...from(3.0) });
  btn.button = { ...btn.button!, fontSize: 88, colorTop: '#FFD45A', colorBottom: '#FF7A00' };
  btn.effects = [
    makeEffect('flyIn', 30, { duration: s(0.8), intensity: 0.45 }),
    makeEffect('pulse', 30, { start: s(0.8), duration: end, speed: 1.2, intensity: 0.55 }),
    makeEffect('glow', 30, { start: s(0.8), duration: end, color: '#FFE27A', speed: 1.2, intensity: 0.6 }),
  ];

  p.layers = [bg, frame, fruits, coins, lg, ...bombLayers, burst1, burst2, burst3, sparkles, amount, fs, players, btn];
  return p;
}

/** F. Slotolog 1000X Bomb Party 2.0 — 18 sn, kamera, Dance Pro, özgün ses efektleri, müziğe hazır */
export function bombParty2Template(): Project {
  const p = emptyProject('9:16', 'Slotolog 1000X Bomb Party 2.0');
  p.durationInFrames = s(18);
  const end = p.durationInFrames;
  const from = (sec: number) => ({ start: s(sec), duration: end - s(sec) });
  const fx = makeEffect;
  /** effect at an absolute second for a layer that starts at layerSec */
  const at = (layerSec: number, sec: number) => s(sec - layerSec);

  const bg = backgroundLayer(p, bgPreset('Slotolog Parti'), 'Parti arka planı');
  bg.depth = 0.45;
  const frame = particlesLayer(p, { kind: 'fruitFrame', count: 7, speed: 1, size: 82, seed: 3 }, 'Meyve çerçevesi (üst/alt)', { depth: 0.7 });
  frame.particles!.seed = 3;
  const fruits = particlesLayer(p, { kind: 'fruits', count: 9, speed: 0.75, size: 44, seed: 8 }, 'Uçuşan meyveler', { opacity: 0.9, depth: 0.8 });
  fruits.particles!.seed = 8;
  const coins = particlesLayer(p, { kind: 'coins', count: 16, speed: 0.7, size: 24, seed: 12 }, 'Küçük altınlar', { depth: 0.9 });
  coins.particles!.seed = 12;

  const lg = brandLayer(p, 'logoBadge', 560, { name: 'Slotolog logo', y: 178 });
  lg.shadow = true;
  lg.depth = 0.6;
  lg.effects = [
    fx('flyIn', 30, { direction: 'top', duration: s(0.7), intensity: 0.45 }),
    fx('float', 30, { start: s(0.7), duration: end, speed: 0.6, intensity: 0.3 }),
    ...[3.0, 9.0, 16.4].map((sec) => fx('shine', 30, { start: s(sec), duration: s(1.3), speed: 1, intensity: 0.8, sound: 'sparkle', soundVolume: 0.3 })),
  ];

  // 2 on top, 3 below — independent layers with their own rhythm
  const bombs: [number, number, number, number, 'left' | 'right' | 'bottom'][] = [
    [315, 495, 390, 0.15, 'left'],
    [765, 495, 390, 0.3, 'right'],
    [185, 895, 330, 0.5, 'left'],
    [540, 895, 330, 0.65, 'bottom'],
    [895, 895, 330, 0.8, 'right'],
  ];
  const bombLayers = bombs.map(([x, y, w, sec, dir], i) => {
    const l = brandLayer(p, 'mult1000', w, { name: `1000X bomba ${i + 1}`, x, y, ...from(sec) });
    l.shadow = true;
    l.motionBlur = true;
    const ph = [0, 0.55, 0.25, 0.8, 0.4][i];
    const live = s(0.7);
    l.effects = [
      // one whoosh per row (bomb 1 leads the top row, bomb 4 the bottom row) so the sounds do not mask each other
      fx('flyIn', 30, { direction: dir, duration: s(0.7), intensity: 0.5, ...(i === 0 || i === 3 ? { sound: 'whoosh' as const, soundVolume: i === 0 ? 0.35 : 0.32 } : {}) }),
      fx('flash', 30, { start: s(0.45), duration: s(0.6), intensity: 0.6, color: '#FFF6D0' }),
      fx('dancePro', 30, { start: live, duration: end, speed: [0.85, 0.95, 0.9, 1.0, 0.8][i], intensity: 0.5, phase: ph }),
      fx('groupDance', 30, { start: live, duration: end, speed: [0.8, 0.75, 0.85, 0.7, 0.9][i], intensity: 0.45, phase: ph * 3 }),
      fx('smoothRotate', 30, { start: live, duration: end, speed: [0.9, 1.1, 1.0, 0.85, 1.05][i], intensity: 0.55, phase: ph * 4 }),
      fx('float', 30, { start: live, duration: end, speed: [0.9, 1.05, 0.95, 0.85, 1.1][i], intensity: 0.6, phase: ph * 5 }),
      fx('pulse', 30, { start: live, duration: end, speed: [0.42, 0.36, 0.48, 0.4, 0.45][i], intensity: 0.25, phase: ph * 2 }),
      fx('shine', 30, { start: live, duration: end, speed: [0.45, 0.42, 0.5, 0.47, 0.4][i], intensity: 1, phase: i * 0.55 }),
      fx('glow', 30, { start: live, duration: end, color: '#FFD23F', speed: 0.5, intensity: 0.4, phase: ph }),
      fx('beatSync', 30, { start: live, duration: end, intensity: 0.5 }),
      // accents: a real bounce together, flash waves
      ...[5.0, 10.5].map((acc) =>
        fx('bouncePro', 30, { start: at(sec, acc + i * 0.08), duration: s(0.75), intensity: 0.8, ...(i === 3 ? { sound: 'bounce' as const, soundVolume: 0.55 } : {}) }),
      ),
      ...[7.0, 12.5].map((acc) => fx('flash', 30, { start: at(sec, acc + i * 0.12), duration: s(0.7), intensity: 0.55, color: '#FFFFFF' })),
    ];
    return l;
  });
  // golden explosions from bombs
  bombLayers[3].effects.push(fx('goldExplosion', 30, { start: at(0.65, 7.0), duration: s(2), intensity: 1, sound: 'coins', soundVolume: 0.5 }));
  bombLayers[0].effects.push(fx('goldExplosion', 30, { start: at(0.15, 12.5), duration: s(2), intensity: 0.8, sound: 'coins', soundVolume: 0.45 }));
  bombLayers[1].effects.push(fx('goldExplosion', 30, { start: at(0.3, 12.7), duration: s(2), intensity: 0.8 }));
  bombLayers[4].effects.push(fx('goldExplosion', 30, { start: at(0.8, 15.6), duration: s(2), intensity: 0.9, sound: 'coins', soundVolume: 0.45 }));
  bombLayers.forEach((b) => b.effects.forEach((e) => e.type === 'goldExplosion' && (e.syncToMusic = false)));
  // only when music is added: explosions on the strong beats from the middle bomb
  bombLayers[3].effects.push(fx('goldExplosion', 30, { start: s(1), duration: end, intensity: 0.6, syncToMusic: true }));

  const sparkles = particlesLayer(p, { kind: 'sparkles', count: 45, speed: 0.9, size: 32, seed: 31 }, 'Parıltılar');
  sparkles.particles!.seed = 31;

  const amount = textLayer(
    p,
    { text: '100.000TL', fontSize: 150, style: 'gold', strokeColor: '#5A1500', strokeWidth: 13, extrude: true, italic: true },
    { name: 'Bonus miktarı', y: 1190, ...from(1.1), startSound: 'riser', startSoundVolume: 0.5, shadow: true },
  );
  amount.effects = [
    fx('impact', 30, { duration: s(0.6), intensity: 0.16 }),
    fx('flash', 30, { duration: s(0.8), color: '#FFF6D0', intensity: 0.8 }),
    fx('pulse', 30, { start: s(0.7), duration: end, speed: 0.55, intensity: 0.22 }),
    fx('glow', 30, { start: s(0.7), duration: end, color: '#FFE27A', speed: 0.55, intensity: 0.45 }),
    fx('beatSync', 30, { start: s(0.7), duration: end, intensity: 0.35 }),
    ...[7.0, 12.5].map((sec) => fx('flash', 30, { start: at(1.1, sec + 0.3), duration: s(0.8), color: '#FFFFFF', intensity: 0.6 })),
  ];
  const fsT = textLayer(
    p,
    { text: '+ 450FS', fontSize: 112, style: 'gold', strokeColor: '#5A1500', strokeWidth: 11, extrude: true, italic: true },
    { name: 'Free spin', y: 1338, ...from(1.5), shadow: true },
  );
  fsT.effects = [
    fx('flyIn', 30, { direction: 'right', duration: s(0.6), intensity: 0.45 }),
    fx('impact', 30, { start: s(0.45), duration: s(0.5), intensity: 0.2 }),
    fx('sway', 30, { start: s(0.9), duration: end, speed: 0.5, intensity: 0.2 }),
  ];
  const players = textLayer(
    p,
    { text: 'TÜM YENİ OYUNCULARA', fontSize: 72, style: 'white', strokeColor: '#7A1E00', strokeWidth: 9, extrude: true },
    { name: 'Hedef kitle', y: 1462, ...from(1.9), startSound: 'whoosh', startSoundVolume: 0.22, shadow: true },
  );
  players.effects = [fx('flyIn', 30, { direction: 'left', duration: s(0.7), intensity: 0.5 }), fx('pulse', 30, { start: s(0.7), duration: end, speed: 0.4, intensity: 0.12 })];

  const btn = buttonLayer(p, 'BONUSU AL', { y: 1650, width: 760, height: 180, ...from(2.4), startSound: 'button', startSoundVolume: 0.55 });
  btn.button = { ...btn.button!, fontSize: 88, colorTop: '#FFD45A', colorBottom: '#FF7A00' };
  btn.effects = [
    fx('flyIn', 30, { duration: s(0.75), intensity: 0.45 }),
    fx('pulse', 30, { start: s(0.75), duration: at(2.4, 13.5) - s(0.75), speed: 1.1, intensity: 0.45 }),
    fx('glow', 30, { start: s(0.75), duration: at(2.4, 13.5) - s(0.75), color: '#FFE27A', speed: 1.1, intensity: 0.5 }),
    // final section: the button takes the stage
    fx('flash', 30, { start: at(2.4, 13.5), duration: s(0.9), color: '#FFFFFF', intensity: 0.9, sound: 'sparkle', soundVolume: 0.4 }),
    fx('pulse', 30, { start: at(2.4, 13.5), duration: end, speed: 1.4, intensity: 0.9 }),
    fx('glow', 30, { start: at(2.4, 13.5), duration: end, color: '#FFFFFF', speed: 1.4, intensity: 0.9 }),
    fx('flash', 30, { start: at(2.4, 16.0), duration: s(0.9), color: '#FFF6D0', intensity: 0.8 }),
  ];

  // camera: slow push in / pull back, small shakes on the big moments
  const cam = cameraLayer(p);
  cam.effects = [
    fx('cameraZoom', 30, { start: 0, duration: s(6), zoomMode: 'in', intensity: 0.5 }),
    fx('cameraZoom', 30, { start: s(6), duration: s(6), zoomMode: 'out', intensity: 0.5 }),
    fx('cameraZoom', 30, { start: s(12), duration: s(6), zoomMode: 'in', intensity: 0.6 }),
    fx('impactShake', 30, { start: s(1.15), duration: s(0.8), intensity: 0.3, syncToMusic: false }),
    fx('impactShake', 30, { start: s(7.0), duration: s(0.9), intensity: 0.45, syncToMusic: false }),
    fx('impactShake', 30, { start: s(12.5), duration: s(0.9), intensity: 0.45, syncToMusic: false }),
    fx('impactShake', 30, { start: s(1), duration: end, intensity: 0.25, syncToMusic: true }),
  ];

  p.layers = [bg, frame, fruits, coins, lg, ...bombLayers, sparkles, amount, fsT, players, btn, cam];
  return p;
}

/**
 * G. Bomb Party 2.0 — Music Edition: identical design; the bombs, camera and texts react to
 * the analysed music (bass pulse, jumps on strong beats, turns, explosions). Without music it
 * still plays like Bomb Party 2.0 (time-based motion only).
 */
export function bombParty2MusicTemplate(): Project {
  const p = bombParty2Template();
  p.name = 'Slotolog Bomb Party 2.0 — Music Edition';
  const end = p.durationInFrames;
  const fx = makeEffect;
  const bombs = p.layers.filter((l) => /^1000X bomba \d$/.test(l.name));
  bombs.forEach((l, i) => {
    const live = s(0.7);
    // keep entrances, light and the slow group motion; replace fixed-time accents with beat-driven ones
    l.effects = l.effects.filter(
      (e) => !(e.type === 'bouncePro' || e.type === 'goldExplosion' || (e.type === 'flash' && e.start > s(1))),
    );
    l.effects = l.effects.map((e) => {
      if (e.type === 'dancePro') return { ...e, speed: 0.5, intensity: 0.32, phase: i % 2 ? 1 : 0 };
      if (e.type === 'smoothRotate') return { ...e, intensity: 0.3 };
      if (e.type === 'float') return { ...e, intensity: 0.4 };
      if (e.type === 'beatSync') return { ...e, intensity: 0.6 };
      return e;
    });
    l.effects.push(
      fx('beatJump', 30, { start: live, duration: end, intensity: 0.85 }),
      fx('beatTurn', 30, { start: live, duration: end, intensity: 0.9, beatEvery: 2, beatOffset: 1, direction: i % 2 ? 'left' : 'right' }),
      // explosions travel around the bombs on the strong beats (every 4th strong beat per bomb)
      fx('goldExplosion', 30, { start: live, duration: end, intensity: 0.75, syncToMusic: true, beatEvery: 4, beatOffset: [1, 3, 2, 0, 2][i] }),
    );
  });
  const cam = p.layers.find((l) => l.type === 'camera');
  if (cam) {
    cam.effects = cam.effects.filter((e) => e.type === 'cameraZoom');
    cam.effects.push(
      fx('beatSync', 30, { start: 0, duration: end, intensity: 0.12 }),
      fx('impactShake', 30, { start: s(1), duration: end, intensity: 0.28, syncToMusic: true, beatEvery: 2 }),
    );
  }
  p.audio = { musicVolume: 0.85, sfxVolume: 0.45, musicMuted: false, sfxMuted: false, syncEnabled: true, sections: [] };
  return p;
}

/** H. Büyük Kazanç Hikâyesi — oyun kaydı + seslendirme + altyazı için düzenlenebilir çerçeve */
export function bigWinStoryTemplate(): Project {
  const p = emptyProject('9:16', 'Büyük Kazanç Hikâyesi');
  p.story = defaultStory();
  const bg = backgroundLayer(p, bgPreset('Slotolog Parti'), 'Arka plan');
  const sparkles = particlesLayer(p, { kind: 'sparkles', count: 30, speed: 0.8, size: 26, seed: 41 }, 'Parıltılar');
  sparkles.particles!.seed = 41;
  const fr = frameLayer(p);
  const win = fr.frame!.window;
  const chrome = (l: Layer) => ({ ...l, storyRole: 'chrome' as const });
  const lg = chrome(brandLayer(p, 'logoBadge', 470, { name: 'Slotolog logo', y: 160 }));
  lg.effects = [makeEffect('float', 30, { duration: s(600), speed: 0.5, intensity: 0.3 }), makeEffect('shine', 30, { duration: s(600), speed: 0.35, intensity: 0.6 })];
  const camp = chrome(
    textLayer(p, { text: '{bonusAmount} + {freeSpinCount} FS', fontSize: 80, style: 'gold', strokeColor: '#5A1500', strokeWidth: 9, extrude: true, italic: true }, {
      name: 'Kampanya: bonus', y: 1592, width: 1040, height: 112, textTemplate: '{bonusAmount} + {freeSpinCount} FS',
    }),
  );
  camp.effects = [makeEffect('pulse', 30, { duration: s(600), speed: 0.6, intensity: 0.15 })];
  const desc = chrome(
    textLayer(p, { text: '{campaignText}', fontSize: 44, style: 'white', strokeColor: '#7A1E00', strokeWidth: 7, extrude: false }, {
      name: 'Kampanya: açıklama', y: 1668, width: 1040, height: 66, textTemplate: '{campaignText}',
    }),
  );
  const btn = chrome(buttonLayer(p, 'BONUSU AL', { y: 1772, width: 600, height: 120 }));
  btn.button = { ...btn.button!, fontSize: 62, colorTop: '#FFD45A', colorBottom: '#FF7A00' };
  btn.effects = [makeEffect('pulse', 30, { duration: s(600), speed: 1.2, intensity: 0.5 }), makeEffect('glow', 30, { duration: s(600), color: '#FFE27A', speed: 1.2, intensity: 0.45 })];
  const legal = chrome(
    textLayer(p, { text: '18+ · Kampanya koşulları geçerlidir · Sorumlu oyna', fontSize: 28, style: 'solid', color: '#FFF4E0', strokeColor: '#5A1500', strokeWidth: 4, extrude: false }, {
      name: 'Yasal not (18+ / sorumlu oyun)', y: 1878, width: 1040, height: 44,
    }),
  );
  const subs = baseLayer(
    { type: 'subtitles', name: 'Altyazılar', x: win.x, y: win.y + win.h / 2 - 150, width: 960, height: 240, storyRole: 'subtitles', subtitleStyle: defaultSubtitleStyle() },
    p,
  );
  const label = textLayer(p, { text: 'CANLANDIRMADIR', fontSize: 30, style: 'solid', color: '#FFFFFF', strokeColor: '#000000', strokeWidth: 5, extrude: false }, {
    name: 'Canlandırma etiketi', x: win.x + win.w / 2 - 170, y: win.y - win.h / 2 + 46, width: 300, height: 48, storyRole: 'label', visible: true,
  });
  p.layers = [bg, sparkles, fr, lg, camp, desc, btn, legal, subs, label];
  return rebuildStory(p);
}

/**
 * Slotolog Big Win Frame — reusable frame for big win videos:
 * logo on top, the game recording in a gold-orange frame, bonus banner + 18+ note at the bottom,
 * subtitles above the bonus area. Every part is an ordinary, editable layer.
 */
export const BIG_WIN_WINDOW = { x: 540, y: 855, w: 662, h: 1200 };
export function bigWinFrameTemplate(): Project {
  const p = emptyProject('9:16', 'Slotolog Big Win Frame');
  p.durationInFrames = s(30);
  const D = p.durationInFrames;
  const win = { ...BIG_WIN_WINDOW };
  const bg = backgroundLayer(p, { style: 'dark', colorA: '#FF8E16', colorB: '#1E1E1E', rayColor: '#FF8E16', rays: 14, speed: 0.5, bokeh: true }, 'Arka plan (koyu gri)');
  const glow = particlesLayer(p, { kind: 'sparkles', count: 26, speed: 0.6, size: 30, seed: 77 }, 'Kenar ışıltıları (altın)');
  glow.opacity = 0.85;
  const symbols = particlesLayer(p, { kind: 'fruitFrame', count: 6, speed: 0.5, size: 80, seed: 12 }, 'Kenar slot sembolleri');
  symbols.opacity = 0.45;
  symbols.visible = false; // optional: turn on for slot symbols around the edges
  const game = baseLayer(
    {
      type: 'placeholder',
      name: 'Oyun videosu (değiştir)',
      x: win.x,
      y: win.y,
      width: win.w,
      height: win.h,
      objectFit: 'cover',
      text: { text: 'OYUN VİDEOSU\nMedya › videon › ⇄ ile uygula', fontSize: 40, style: 'white', color: '#fff', strokeColor: '#000', strokeWidth: 0, extrude: false, italic: false },
    },
    p,
  );
  const fr = frameLayer(p, { name: 'Slotolog çerçevesi' });
  fr.frame = { ...fr.frame!, window: win, radius: 28, thickness: 24, colorA: '#FFD45A', colorB: '#FF8E16', lights: true, fruits: false, sevens: false };
  const logo = brandLayer(p, 'logoWhite', 560, { name: 'Slotolog logo', y: 128 });
  logo.effects = [makeEffect('shine', 30, { duration: D, speed: 0.3, intensity: 0.55 })];
  const bonus = textLayer(p, { text: '100.000 TL + 450 FS', fontSize: 94, style: 'gold', strokeColor: '#5A1500', strokeWidth: 10, extrude: true, italic: true }, {
    name: 'Bonus tutarı', y: 1548, width: 1040, height: 124,
  });
  bonus.effects = [makeEffect('pulse', 30, { duration: D, speed: 0.5, intensity: 0.08 }), makeEffect('shine', 30, { duration: D, speed: 0.25, intensity: 0.5 })];
  const welcome = textLayer(p, { text: 'HOŞ GELDİN BONUSU', fontSize: 50, style: 'white', color: '#FFFFFF', strokeColor: '#1E1E1E', strokeWidth: 8, extrude: false }, {
    name: 'Bonus açıklaması', y: 1638, width: 1000, height: 70,
  });
  const btn = buttonLayer(p, 'BONUSU AL', { name: 'Buton: BONUSU AL', y: 1748, width: 540, height: 116 });
  btn.button = { ...btn.button!, fontSize: 60, colorTop: '#FFD45A', colorBottom: '#FF7A00', textColor: '#FFFFFF' };
  btn.effects = [makeEffect('pulse', 30, { duration: D, speed: 1.1, intensity: 0.45 }), makeEffect('glow', 30, { duration: D, color: '#FFD45A', speed: 1.1, intensity: 0.4 })];
  const legal = textLayer(p, { text: '18+ · Sorumlu oyna · Kampanya koşulları geçerlidir', fontSize: 27, style: 'solid', color: '#E8E8E8', strokeColor: '#000000', strokeWidth: 3, extrude: false }, {
    name: 'Yasal not (18+ / sorumlu oyun)', y: 1872, width: 1040, height: 40,
  });
  const subs = baseLayer(
    {
      type: 'subtitles',
      name: 'Altyazı (örnek)',
      x: win.x,
      y: 1240,
      width: 900,
      height: 190,
      subtitleStyle: { fontSize: 64, color: '#FFFFFF', strokeColor: '#000000', strokeWidth: 10, highlight: '#FF8E16', box: false, shadow: true },
      cues: [{ id: 'c1', text: 'İşte *büyük kazanç* anı!', start: 0.5, end: 3 }],
    },
    p,
  );
  p.layers = [bg, symbols, glow, game, fr, logo, bonus, welcome, btn, legal, subs];
  return p;
}

export const TEMPLATES = [
  { id: 'bigwinframe', name: '★ Slotolog Big Win Frame', desc: 'Logo, altın çerçeve, oyun videosu, bonus alanı, altyazı · yeniden kullanılabilir', make: bigWinFrameTemplate },
  { id: 'bigwinstory', name: '🎬 Büyük Kazanç Hikâyesi', desc: 'Oyun kaydı + seslendirme + altyazı, 6 sahne, çerçeve', make: bigWinStoryTemplate },
  { id: 'bombparty2music', name: '★ Bomb Party 2.0 — Music Edition', desc: 'Müzik ekle: bombalar vuruşlara göre dans eder · 18 sn', make: bombParty2MusicTemplate },
  { id: 'bombparty2', name: '★ Slotolog 1000X Bomb Party 2.0', desc: 'Kamera, Dance Pro, özgün sesler, müziğe hazır · 18 sn', make: bombParty2Template },
  { id: 'bombparty', name: '★ Slotolog 1000X Bomb Party', desc: '5 adet 1000X bomba, parti arka planı, meyveler, 18 sn', make: bombPartyTemplate },
  { id: 'premium', name: '★ Slotolog Premium Bonus', desc: 'Lüks altın-siyah, logo, 100X–1000X, bonus, 15 sn', make: premiumTemplate },
  { id: 'multiplier', name: 'A · Çarpan animasyonu', desc: '100X–1000X çarpanlar, 15 sn', make: multiplierTemplate },
  { id: 'bonus', name: 'B · Bonus tanıtımı', desc: 'Logo, 100.000TL + 450FS, buton', make: bonusTemplate },
  { id: 'game', name: 'C · Oyun videosu', desc: 'Logo, oyun videosu, bonus alanı', make: gameVideoTemplate },
];
