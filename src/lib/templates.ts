import type { Project } from '../types';
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

function logo(p: Project, y: number, fontSize = 130) {
  return textLayer(
    p,
    { text: 'SLOTOLOG', fontSize, style: 'white', strokeColor: '#1E1E1E', strokeWidth: 12, extrude: true, italic: true },
    { name: 'Logo (görselle değiştirilebilir)', y },
  );
}

/** A. Çarpan animasyonu — 15 sn */
export function multiplierTemplate(): Project {
  const p = emptyProject('9:16', 'Çarpan Animasyonu');
  p.durationInFrames = s(15);
  const end = p.durationInFrames;
  const bg = backgroundLayer(p, BG_PRESETS[0].settings);
  const sparkles = particlesLayer(p, PARTICLE_PRESETS[2].settings, 'Parıltılar');
  const rain = particlesLayer(p, { ...PARTICLE_PRESETS[0].settings, count: 14 }, 'Altın yağmuru');
  const lg = logo(p, 170);
  lg.effects = [makeEffect('flyIn', 30, { direction: 'top', duration: s(1) }), makeEffect('pulse', 30, { start: s(1), duration: end, speed: 0.6, intensity: 0.4 })];
  const title = textLayer(p, { text: 'DEV ÇARPANLAR\nSENİ BEKLİYOR', fontSize: 92, style: 'white', strokeColor: '#7A2E00', strokeWidth: 10 }, { y: 380, start: s(0.4) });
  title.effects = [makeEffect('impact', 30, { duration: s(1) })];

  const spots: [string, number, number, number, number][] = [
    // value, x, y, width, entry second
    ['100X', 290, 640, 470, 1],
    ['250X', 790, 640, 470, 2],
    ['500X', 290, 960, 470, 3],
    ['750X', 790, 960, 470, 4],
    ['1000X', 540, 1330, 860, 5],
  ];
  const mults = spots.map(([v, x, y, w, sec], i) => {
    const l = multiplierLayer(p, v, { x, y, width: w, height: w / 2, start: s(sec), duration: end - s(sec) });
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
  const lg = logo(p, 280, 150);
  lg.effects = [makeEffect('flyIn', 30, { direction: 'top', duration: s(1) }), makeEffect('glow', 30, { start: s(1), duration: end, color: '#FFFFFF', intensity: 0.6 })];
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
  const bg = backgroundLayer(p, BG_PRESETS[3].settings);
  const lg = logo(p, 160, 120);
  lg.effects = [makeEffect('glow', 30, { duration: end, color: '#FF8E16' })];
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

export const TEMPLATES = [
  { id: 'multiplier', name: 'A · Çarpan animasyonu', desc: '100X–1000X çarpanlar, 15 sn', make: multiplierTemplate },
  { id: 'bonus', name: 'B · Bonus tanıtımı', desc: 'Logo, 100.000TL + 450FS, buton', make: bonusTemplate },
  { id: 'game', name: 'C · Oyun videosu', desc: 'Logo, oyun videosu, bonus alanı', make: gameVideoTemplate },
];
