import React, { useRef, useState } from 'react';
import { useSelectedLayer, useStore } from '../store';
import { EFFECT_META } from '../lib/anim';
import {
  BG_PRESETS,
  PARTICLE_PRESETS,
  backgroundLayer,
  baseLayer,
  cameraLayer,
  buttonLayer,
  multiplierLayer,
  particlesLayer,
  textLayer,
} from '../lib/factory';
import { TEMPLATES } from '../lib/templates';
import { BRAND_ASSETS, brandUrl, type BrandKey } from '../lib/brand';
import { SFX, SFX_KEYS, sfxUrl } from '../lib/sfx';
import type { BackgroundSettings, EffectType } from '../types';
import { Btn } from './ui';

type Tab = 'media' | 'elements' | 'bg' | 'effects' | 'templates';
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'media', label: 'Medya', icon: '📁' },
  { id: 'elements', label: 'Öğeler', icon: '✚' },
  { id: 'bg', label: 'Arka plan', icon: '▦' },
  { id: 'effects', label: 'Efektler', icon: '✦' },
  { id: 'templates', label: 'Şablonlar', icon: '★' },
];

const bgSwatch = (s: BackgroundSettings) =>
  s.style === 'luxury'
    ? `repeating-conic-gradient(from 0deg at 50% 60%, ${s.rayColor}33 0deg 6deg, transparent 6deg 16deg), radial-gradient(circle at 50% 60%, ${s.colorA}aa, ${s.colorB} 45%, #050403)`
    : s.style === 'dark'
    ? `radial-gradient(circle, ${s.colorB}, #0b0b0b), #111`
    : s.style === 'gradient'
      ? `linear-gradient(135deg, ${s.colorA}, ${s.colorB})`
      : `repeating-conic-gradient(from 0deg, ${s.rayColor}55 0deg 8deg, transparent 8deg 20deg), radial-gradient(circle, ${s.colorA}, ${s.colorB})`;

const MediaTab: React.FC = () => {
  const assets = useStore((s) => s.project.assets);
  const urls = useStore((s) => s.assetUrls);
  const selected = useSelectedLayer();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const st = useStore.getState();
  const canApply = selected && !['background', 'particles', 'audio'].includes(selected.type);

  const upload = async (files: FileList | File[]) => {
    setBusy(true);
    for (const f of Array.from(files)) {
      try {
        await st.addAssetFromFile(f);
      } catch (e) {
        alert((e as Error).message);
      }
    }
    setBusy(false);
  };

  return (
    <div className="space-y-3 p-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          upload(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-lg border-2 border-dashed p-4 text-center text-xs transition ${over ? 'border-[#FF8E16] bg-[#FF8E16]/10' : 'border-white/15 hover:border-[#FF8E16]/60'}`}
      >
        <div className="text-2xl">⬆</div>
        <div className="mt-1 font-semibold text-neutral-200">{busy ? 'Yükleniyor…' : 'Dosya yükle veya buraya bırak'}</div>
        <div className="mt-0.5 text-neutral-500">PNG, SVG, JPG, MP4, MP3, WAV</div>
        <input
          ref={inputRef}
          data-testid="upload"
          type="file"
          multiple
          accept="image/png,image/jpeg,image/svg+xml,image/webp,video/mp4,video/quicktime,video/webm,audio/*"
          className="hidden"
          onChange={(e) => e.target.files && upload(e.target.files)}
        />
      </div>
      <div data-testid="brand-assets">
        <h4 className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-[#FF8E16]">Slotolog marka varlıkları</h4>
        <div className="space-y-1.5">
          {(Object.keys(BRAND_ASSETS) as BrandKey[]).map((k) => {
            const a = BRAND_ASSETS[k];
            return (
              <div
                key={k}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('application/x-slotolog-asset', st.addBrandAsset(k))}
                className="flex items-center gap-2 rounded-md border border-white/10 bg-[#141414] p-1.5"
              >
                <div className={`flex h-10 w-16 shrink-0 items-center justify-center rounded ${k === 'logo' ? 'bg-white' : 'bg-[#2a1a08]'}`}>
                  <img src={brandUrl(a.src)} alt="" className="max-h-9 max-w-14 object-contain" />
                </div>
                <span className="min-w-0 flex-1 truncate text-[11px] text-neutral-300" title={a.name}>
                  {a.name}
                </span>
                <Btn small variant="primary" onClick={() => st.addAssetLayer(st.addBrandAsset(k))}>
                  Ekle
                </Btn>
                {canApply && (
                  <Btn small title="Seçili katmana uygula" onClick={() => st.applyAssetToLayer(selected!.id, st.addBrandAsset(k))}>
                    ⇄
                  </Btn>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div data-testid="sfx-library">
        <h4 className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-[#FF8E16]">Slotolog ses efektleri (özgün)</h4>
        <div className="space-y-1">
          {SFX_KEYS.map((k) => (
            <div key={k} className="flex items-center gap-1.5 rounded-md border border-white/10 bg-[#141414] px-1.5 py-1">
              <button
                title="Dinle"
                className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2b2b2b] text-[10px] hover:bg-[#FF8E16] hover:text-black"
                onClick={() => new Audio(sfxUrl(k)).play().catch(() => undefined)}
              >
                ▶
              </button>
              <span className="min-w-0 flex-1 truncate text-[11px] text-neutral-300">{SFX[k].name}</span>
              <Btn small onClick={() => st.addSfxLayer(k)}>
                Ekle
              </Btn>
            </div>
          ))}
        </div>
        <p className="mt-1 text-[10px] text-neutral-500">Ses, efektlere ve katman girişlerine sağ panelden de bağlanabilir.</p>
      </div>
      <h4 className="pt-1 text-[11px] font-bold uppercase tracking-wider text-neutral-400">Yüklediklerim</h4>
      {assets.filter((a) => !a.src).length === 0 && <p className="text-center text-[11px] text-neutral-500">Henüz medya yok. Logo, oyun ikonu, video veya müzik yükle.</p>}
      <div className="grid grid-cols-2 gap-2">
        {assets.filter((a) => !a.src).map((a) => (
          <div
            key={a.id}
            draggable
            data-testid="user-asset"
            onDragStart={(e) => e.dataTransfer.setData('application/x-slotolog-asset', a.id)}
            className="group overflow-hidden rounded-md border border-white/10 bg-[#141414]"
          >
            <div className="flex aspect-video items-center justify-center bg-[repeating-conic-gradient(#222_0_25%,#1a1a1a_0_50%)] bg-[length:16px_16px]">
              {a.kind === 'image' && urls[a.id] && <img src={urls[a.id]} className="max-h-full max-w-full object-contain" alt="" />}
              {a.kind === 'video' && urls[a.id] && <video src={urls[a.id]} className="max-h-full max-w-full" muted />}
              {a.kind === 'audio' && <span className="text-2xl">♪</span>}
            </div>
            <div className="truncate px-1.5 pt-1 text-[10px] text-neutral-300" title={a.name}>
              {a.name}
            </div>
            <div className="flex gap-1 p-1.5">
              <Btn small variant="primary" className="flex-1" onClick={() => st.addAssetLayer(a.id)}>
                Ekle
              </Btn>
              {canApply && a.kind !== 'audio' && (
                <Btn small title="Seçili katmana uygula" onClick={() => st.applyAssetToLayer(selected!.id, a.id)}>
                  ⇄
                </Btn>
              )}
              <Btn
                small
                variant="ghost"
                title="Sil"
                onClick={() => confirm(`"${a.name}" ve onu kullanan katmanlar silinsin mi?`) && st.removeAsset(a.id)}
              >
                ✕
              </Btn>
            </div>
          </div>
        ))}
      </div>
      {canApply && assets.some((a) => a.kind !== 'audio') && (
        <p className="text-[11px] text-neutral-500">⇄ = seçili katmanı (“{selected!.name}”) bu medya ile değiştir.</p>
      )}
    </div>
  );
};

const ElementsTab: React.FC = () => {
  const project = useStore((s) => s.project);
  const add = useStore((s) => s.addLayer);
  const [custom, setCustom] = useState('2000X');
  return (
    <div className="space-y-4 p-3">
      <div>
        <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-neutral-400">Çarpan ikonları</h4>
        <div className="grid grid-cols-3 gap-1.5">
          {['100X', '250X', '500X', '750X', '1000X'].map((v) => (
            <button
              key={v}
              onClick={() => add(multiplierLayer(project, v))}
              className="rounded-md border border-white/10 bg-gradient-to-b from-[#ffe04d] to-[#ff8e16] py-2 text-sm font-black text-[#5a2400] italic hover:brightness-110"
            >
              {v}
            </button>
          ))}
          <div className="col-span-3 flex gap-1">
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value.toUpperCase())}
              className="min-w-0 flex-1 rounded border border-white/10 bg-[#121212] px-2 text-xs"
            />
            <Btn small onClick={() => add(multiplierLayer(project, custom || '100X'))}>
              Ekle
            </Btn>
          </div>
        </div>
      </div>
      <div>
        <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-neutral-400">Metin ve buton</h4>
        <div className="grid grid-cols-2 gap-1.5">
          <Btn onClick={() => add(textLayer(project, { text: 'YENİ METİN', style: 'white' }))}>T Beyaz metin</Btn>
          <Btn onClick={() => add(textLayer(project, { text: '100.000TL', style: 'gold', italic: true, fontSize: 150 }))}>T Altın metin</Btn>
          <Btn onClick={() => add(buttonLayer(project, 'BONUSU AL'))}>▭ Buton</Btn>
          <Btn onClick={() => add(cameraLayer(project))} title="Tüm sahneyi yakınlaştırma/sarsma">
            🎥 Kamera
          </Btn>
          <Btn
            onClick={() =>
              add(
                baseLayer(
                  {
                    type: 'placeholder',
                    name: 'Medya yeri',
                    width: 800,
                    height: 800,
                    text: { text: 'MEDYA YERİ', fontSize: 48, style: 'white', color: '#fff', strokeColor: '#000', strokeWidth: 0, extrude: false, italic: false },
                  },
                  project,
                ),
              )
            }
          >
            ▢ Medya yeri
          </Btn>
        </div>
      </div>
      <div>
        <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-neutral-400">Parçacıklar</h4>
        <div className="grid grid-cols-2 gap-1.5">
          {PARTICLE_PRESETS.map((pp) => (
            <Btn key={pp.name} onClick={() => add(particlesLayer(project, pp.settings, pp.name, { start: Math.min(useStore.getState().frame, project.durationInFrames - 1) }))}>
              {{ sparkles: '✦', confetti: '🎉', fruits: '🍒', fruitFrame: '🍋', coins: '🪙', burst: '🪙' }[pp.settings.kind]} {pp.name}
            </Btn>
          ))}
        </div>
        <p className="mt-1 text-[10px] text-neutral-500">Parçacıklar oynatma çizgisinin olduğu yerden başlar.</p>
      </div>
    </div>
  );
};

const BgTab: React.FC = () => {
  const project = useStore((s) => s.project);
  const st = useStore.getState();
  const apply = (s: BackgroundSettings, name: string) => {
    const existing = project.layers.find((l) => l.type === 'background');
    if (existing) {
      st.updateLayer(existing.id, { background: { ...s } });
      st.select(existing.id);
    } else {
      const l = backgroundLayer(project, s, name);
      st.update((p) => ({ ...p, layers: [l, ...p.layers] }));
      st.select(l.id);
    }
  };
  return (
    <div className="space-y-2 p-3">
      <p className="text-[11px] text-neutral-500">Sistemin kendi ürettiği hareketli arka planlar. Renk, hız ve huzme sayısı sağ panelden değişir.</p>
      {BG_PRESETS.map((pr) => (
        <button key={pr.name} onClick={() => apply(pr.settings, pr.name)} className="group block w-full overflow-hidden rounded-lg border border-white/10 text-left hover:border-[#FF8E16]">
          <div className="h-16" style={{ background: bgSwatch(pr.settings) }} />
          <div className="bg-[#141414] px-2 py-1.5 text-xs font-semibold text-neutral-200 group-hover:text-[#FF8E16]">{pr.name}</div>
        </button>
      ))}
      <Btn
        className="w-full"
        onClick={() => {
          const l = backgroundLayer(project, BG_PRESETS[0].settings, 'Ek arka plan');
          st.update((p) => ({ ...p, layers: [l, ...p.layers] }));
          st.select(l.id);
        }}
      >
        + Yeni arka plan katmanı
      </Btn>
      <p className="text-[11px] text-neutral-500">Kendi arka plan görselini/videosunu “Medya” sekmesinden yükleyip en alta taşıyabilirsin.</p>
    </div>
  );
};

const EffectsTab: React.FC = () => {
  const selected = useSelectedLayer();
  const project = useStore((s) => s.project);
  const st = useStore.getState();
  const ok = selected && !['background', 'particles', 'audio'].includes(selected.type);
  return (
    <div className="space-y-2 p-3">
      <p className={`text-[11px] ${ok ? 'text-neutral-400' : 'text-yellow-500'}`}>
        {ok ? `“${selected!.name}” katmanına uygulanır, oynatma çizgisinden başlar.` : 'Önce önizlemede bir görsel, metin veya çarpan seç.'}
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {(Object.keys(EFFECT_META) as EffectType[]).map((t) => (
          <button
            key={t}
            disabled={!ok}
            onClick={() => ok && st.addEffect(selected!.id, t)}
            className="rounded-md border border-white/10 bg-[#141414] p-2 text-left transition hover:border-[#FF8E16] disabled:opacity-40"
          >
            <div className="text-lg text-[#FF8E16]">{EFFECT_META[t].icon}</div>
            <div className="text-xs font-semibold text-neutral-100">{EFFECT_META[t].label}</div>
            <div className="text-[10px] text-neutral-500">{EFFECT_META[t].description}</div>
          </button>
        ))}
        <button
          onClick={() => st.addLayer(particlesLayer(project, PARTICLE_PRESETS[0].settings, 'Altın yağmuru', { start: st.frame }))}
          className="rounded-md border border-white/10 bg-[#141414] p-2 text-left transition hover:border-[#FF8E16]"
        >
          <div className="text-lg">🪙</div>
          <div className="text-xs font-semibold text-neutral-100">Altın yağmuru</div>
          <div className="text-[10px] text-neutral-500">Yeni parçacık katmanı ekler</div>
        </button>
      </div>
    </div>
  );
};

const TemplatesTab: React.FC = () => {
  const load = useStore((s) => s.loadIntoEditor);
  return (
    <div className="space-y-2 p-3">
      <p className="text-[11px] text-neutral-500">Şablon yeni bir proje olarak açılır; mevcut projen otomatik kaydedilmiştir.</p>
      {TEMPLATES.map((t) => (
        <button
          key={t.id}
          data-testid={`template-${t.id}`}
          onClick={() => load(t.make())}
          className="block w-full rounded-lg border border-white/10 bg-gradient-to-br from-[#2a1a08] to-[#141414] p-3 text-left hover:border-[#FF8E16]"
        >
          <div className="text-sm font-bold text-white">{t.name}</div>
          <div className="text-[11px] text-neutral-400">{t.desc}</div>
        </button>
      ))}
    </div>
  );
};

export const Library: React.FC = () => {
  const [tab, setTab] = useState<Tab>('templates');
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="grid grid-cols-5 border-b border-white/10">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex flex-col items-center gap-0.5 py-2 text-[10px] ${tab === t.id ? 'border-b-2 border-[#FF8E16] text-[#FF8E16]' : 'text-neutral-400 hover:text-neutral-200'}`}
          >
            <span className="text-sm">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'media' && <MediaTab />}
        {tab === 'elements' && <ElementsTab />}
        {tab === 'bg' && <BgTab />}
        {tab === 'effects' && <EffectsTab />}
        {tab === 'templates' && <TemplatesTab />}
      </div>
    </div>
  );
};
