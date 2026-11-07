import React from 'react';
import { useSelectedLayer, useStore } from '../store';
import { EASING_LABELS, EFFECT_META, propAt } from '../lib/anim';
import { seek } from '../lib/player';
import { BG_PRESETS } from '../lib/factory';
import type { AnimProp, BackgroundStyle, Direction, EasingName, EffectType, Layer, ParticleKind, TextStyle } from '../types';
import { ASPECT_SIZES } from '../types';
import { TYPE_META } from './Timeline';
import { Btn, ColorInput, NumInput, Row, Section, Select, Slider, TextInput, Toggle } from './ui';

const PROP_LABELS: Record<AnimProp, string> = { x: 'X konumu', y: 'Y konumu', scale: 'Ölçek', rotation: 'Açı (°)', opacity: 'Opaklık' };

const KeyBtn: React.FC<{ layer: Layer; prop: AnimProp }> = ({ layer, prop }) => {
  const frame = useStore((s) => s.frame);
  const local = Math.round(frame - layer.start);
  const kfs = layer.keyframes[prop] ?? [];
  const here = kfs.some((k) => k.frame === local);
  const animated = kfs.length > 0;
  return (
    <button
      title={here ? 'Bu karedeki keyframe’i sil' : 'Bu kareye keyframe ekle'}
      onClick={() => useStore.getState().toggleKeyframe(layer.id, prop)}
      className={`flex h-5 w-5 shrink-0 items-center justify-center text-xs ${here ? 'text-yellow-300' : animated ? 'text-yellow-700' : 'text-neutral-600'} hover:text-yellow-200`}
    >
      {here ? '◆' : '◇'}
    </button>
  );
};

const PropField: React.FC<{ layer: Layer; prop: AnimProp; step?: number; digits?: number; min?: number; max?: number }> = ({
  layer,
  prop,
  step = 1,
  digits = 0,
  min,
  max,
}) => {
  const frame = useStore((s) => s.frame);
  const value = propAt(layer, prop, frame - layer.start);
  return (
    <Row label={PROP_LABELS[prop]}>
      <NumInput value={value} step={step} digits={digits} min={min} max={max} onChange={(v) => useStore.getState().setLayerProp(layer.id, prop, v)} />
      <KeyBtn layer={layer} prop={prop} />
    </Row>
  );
};

const KeyframeList: React.FC<{ layer: Layer }> = ({ layer }) => {
  const fps = useStore((s) => s.project.fps);
  const entries = (Object.keys(layer.keyframes) as AnimProp[]).flatMap((p) => (layer.keyframes[p] ?? []).map((k) => ({ p, k })));
  if (!entries.length)
    return <p className="text-[11px] leading-relaxed text-neutral-500">Bir özelliğin yanındaki ◇ ile o kareye keyframe ekle. Oynatma çizgisini başka kareye taşıyıp değeri değiştirince animasyon oluşur.</p>;
  return (
    <div className="space-y-1">
      {entries
        .sort((a, b) => a.k.frame - b.k.frame)
        .map(({ p, k }) => (
          <div key={`${p}-${k.frame}`} className="flex items-center gap-1 text-[11px] text-neutral-300">
            <button className="w-12 text-left font-mono text-yellow-300 hover:underline" onClick={() => seek(layer.start + k.frame)}>
              {((layer.start + k.frame) / fps).toFixed(2)}s
            </button>
            <span className="w-16 truncate">{PROP_LABELS[p]}</span>
            <span className="w-12 font-mono text-neutral-400">{k.value.toFixed(p === 'scale' || p === 'opacity' ? 2 : 0)}</span>
            <select
              value={k.easing}
              onChange={(e) =>
                useStore.getState().updateLayer(layer.id, {
                  keyframes: { ...layer.keyframes, [p]: layer.keyframes[p]!.map((x) => (x.frame === k.frame ? { ...x, easing: e.target.value as EasingName } : x)) },
                })
              }
              className="min-w-0 flex-1 rounded bg-[#121212] px-1 py-0.5 text-[10px]"
            >
              {Object.entries(EASING_LABELS).map(([v, lbl]) => (
                <option key={v} value={v}>
                  {lbl}
                </option>
              ))}
            </select>
          </div>
        ))}
    </div>
  );
};

const EffectsEditor: React.FC<{ layer: Layer }> = ({ layer }) => {
  const fps = useStore((s) => s.project.fps);
  const st = useStore.getState();
  return (
    <div className="space-y-2">
      {layer.effects.map((e) => (
        <div key={e.id} className="rounded-md border border-white/10 bg-[#141414] p-2">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-semibold text-white">
              {EFFECT_META[e.type].icon} {EFFECT_META[e.type].label}
            </span>
            <button className="text-[11px] text-neutral-500 hover:text-red-400" onClick={() => st.removeEffect(layer.id, e.id)}>
              Sil
            </button>
          </div>
          <div className="space-y-1.5">
            <Row label="Başlangıç (sn)">
              <NumInput value={e.start / fps} step={0.1} min={0} digits={2} onChange={(v) => st.updateEffect(layer.id, e.id, { start: Math.round(v * fps) })} />
            </Row>
            <Row label="Süre (sn)">
              <NumInput value={e.duration / fps} step={0.1} min={0.1} digits={2} onChange={(v) => st.updateEffect(layer.id, e.id, { duration: Math.max(1, Math.round(v * fps)) })} />
            </Row>
            <Row label="Hız">
              <Slider value={e.speed} min={0.1} max={4} onChange={(v) => st.updateEffect(layer.id, e.id, { speed: v })} />
            </Row>
            <Row label="Şiddet">
              <Slider value={e.intensity} min={0} max={3} onChange={(v) => st.updateEffect(layer.id, e.id, { intensity: v })} />
            </Row>
            {e.type === 'flyIn' && (
              <Row label="Yön">
                <Select<Direction>
                  value={e.direction ?? 'bottom'}
                  onChange={(v) => st.updateEffect(layer.id, e.id, { direction: v })}
                  options={[
                    { value: 'left', label: 'Soldan' },
                    { value: 'right', label: 'Sağdan' },
                    { value: 'top', label: 'Yukarıdan' },
                    { value: 'bottom', label: 'Aşağıdan' },
                  ]}
                />
              </Row>
            )}
            {(e.type === 'glow' || e.type === 'flash') && (
              <Row label="Renk">
                <ColorInput value={e.color ?? '#FFD54A'} onChange={(v) => st.updateEffect(layer.id, e.id, { color: v })} />
              </Row>
            )}
            {e.type === 'beat' && (
              <Row label="BPM">
                <NumInput value={e.bpm ?? 120} min={30} max={240} onChange={(v) => st.updateEffect(layer.id, e.id, { bpm: v })} />
              </Row>
            )}
          </div>
        </div>
      ))}
      <select
        value=""
        onChange={(ev) => ev.target.value && st.addEffect(layer.id, ev.target.value as EffectType)}
        className="w-full rounded border border-dashed border-[#FF8E16]/60 bg-transparent px-2 py-1.5 text-xs text-[#FF8E16]"
      >
        <option value="">+ Efekt ekle (oynatma çizgisinden başlar)</option>
        {(Object.keys(EFFECT_META) as EffectType[]).map((t) => (
          <option key={t} value={t}>
            {EFFECT_META[t].icon} {EFFECT_META[t].label}
          </option>
        ))}
      </select>
    </div>
  );
};

const ProjectSettings: React.FC = () => {
  const p = useStore((s) => s.project);
  const st = useStore.getState();
  const { width, height } = ASPECT_SIZES[p.aspect];
  return (
    <>
      <Section title="Proje">
        <Row label="Ad">
          <TextInput value={p.name} onChange={st.rename} />
        </Row>
        <Row label="Boyut">
          <span className="text-neutral-200">
            {p.aspect} · {width}×{height}
          </span>
        </Row>
        <Row label="Süre (sn)">
          <NumInput value={p.durationInFrames / p.fps} step={0.5} min={0.5} digits={1} onChange={(v) => st.setDuration(v * p.fps)} />
        </Row>
        <Row label="FPS">
          <span className="text-neutral-200">{p.fps}</span>
        </Row>
      </Section>
      <div className="px-3 py-4 text-xs leading-relaxed text-neutral-500">
        Ayarlarını görmek için önizlemede veya zaman çizelgesinde bir katmana tıkla.
        <br />
        <br />
        Kısayollar: <b className="text-neutral-300">Boşluk</b> oynat · <b className="text-neutral-300">Delete</b> sil · <b className="text-neutral-300">⌘/Ctrl+Z</b> geri al ·{' '}
        <b className="text-neutral-300">⌘/Ctrl+Shift+Z</b> yinele · <b className="text-neutral-300">⌘/Ctrl+D</b> çoğalt · <b className="text-neutral-300">Oklar</b> 1px taşı (Shift: 10px)
      </div>
    </>
  );
};

export const Inspector: React.FC = () => {
  const layer = useSelectedLayer();
  const fps = useStore((s) => s.project.fps);
  const assets = useStore((s) => s.project.assets);
  if (!layer) return <ProjectSettings />;
  const st = useStore.getState();
  const up = (patch: Partial<Layer>) => st.updateLayer(layer.id, patch);
  const positional = !['background', 'particles', 'audio'].includes(layer.type);
  const visualAssets = assets.filter((a) => a.kind !== 'audio');

  return (
    <div data-testid="inspector">
      <Section
        title={TYPE_META[layer.type].label}
        right={
          <div className="flex gap-1">
            <Btn small variant="ghost" title="Öne getir" onClick={() => st.reorderLayer(layer.id, 1)}>
              ↑
            </Btn>
            <Btn small variant="ghost" title="Arkaya gönder" onClick={() => st.reorderLayer(layer.id, -1)}>
              ↓
            </Btn>
            <Btn small variant="ghost" title="Çoğalt" onClick={() => st.duplicateLayer(layer.id)}>
              ⧉
            </Btn>
            <Btn small variant="ghost" title="Sil" onClick={() => st.removeLayer(layer.id)}>
              🗑
            </Btn>
          </div>
        }
      >
        <Row label="Ad">
          <TextInput value={layer.name} onChange={(v) => up({ name: v })} />
        </Row>
        <div className="flex gap-4">
          <Toggle value={layer.visible} onChange={(v) => up({ visible: v })} label="Görünür" />
          <Toggle value={layer.locked} onChange={(v) => up({ locked: v })} label="Kilitli" />
        </div>
      </Section>

      <Section title="Zamanlama">
        <Row label="Başlangıç (sn)">
          <NumInput value={layer.start / fps} step={0.1} min={0} digits={2} onChange={(v) => up({ start: Math.round(v * fps) })} />
        </Row>
        <Row label="Süre (sn)">
          <NumInput value={layer.duration / fps} step={0.1} min={0.05} digits={2} onChange={(v) => up({ duration: Math.max(1, Math.round(v * fps)) })} />
        </Row>
      </Section>

      {positional && (
        <Section title="Dönüşüm">
          <PropField layer={layer} prop="x" />
          <PropField layer={layer} prop="y" />
          <Row label="Genişlik">
            <NumInput value={layer.width} min={1} onChange={(v) => up({ width: Math.round(v) })} />
            <span className="w-5" />
          </Row>
          <Row label="Yükseklik">
            <NumInput value={layer.height} min={1} onChange={(v) => up({ height: Math.round(v) })} />
            <span className="w-5" />
          </Row>
          <PropField layer={layer} prop="scale" step={0.05} digits={2} min={0} />
          <PropField layer={layer} prop="rotation" />
          <PropField layer={layer} prop="opacity" step={0.05} digits={2} min={0} max={1} />
        </Section>
      )}
      {!positional && layer.type !== 'audio' && (
        <Section title="Görünüm">
          <PropField layer={layer} prop="opacity" step={0.05} digits={2} min={0} max={1} />
        </Section>
      )}

      {(layer.type === 'text' || layer.type === 'multiplier' || layer.type === 'placeholder') && layer.text && (
        <Section title={layer.type === 'multiplier' ? 'Çarpan' : 'Metin'}>
          <TextInput value={layer.text.text} multiline={layer.type !== 'multiplier'} onChange={(v) => up({ text: { ...layer.text!, text: v } })} />
          {layer.type !== 'placeholder' && (
            <Row label="Stil">
              <Select<TextStyle>
                value={layer.text.style}
                onChange={(v) => up({ text: { ...layer.text!, style: v } })}
                options={[
                  { value: 'gold', label: 'Altın gradyan' },
                  { value: 'white', label: 'Beyaz' },
                  { value: 'solid', label: 'Tek renk' },
                ]}
              />
            </Row>
          )}
          {layer.text.style === 'solid' && (
            <Row label="Renk">
              <ColorInput value={layer.text.color} onChange={(v) => up({ text: { ...layer.text!, color: v } })} />
            </Row>
          )}
          {layer.type === 'text' && (
            <>
              <Row label="Yazı boyutu">
                <NumInput value={layer.text.fontSize} min={8} onChange={(v) => up({ text: { ...layer.text!, fontSize: v } })} />
              </Row>
              <Row label="Kontur rengi">
                <ColorInput value={layer.text.strokeColor} onChange={(v) => up({ text: { ...layer.text!, strokeColor: v } })} />
              </Row>
              <Row label="Kontur kalınlığı">
                <NumInput value={layer.text.strokeWidth} min={0} onChange={(v) => up({ text: { ...layer.text!, strokeWidth: v } })} />
              </Row>
              <div className="flex gap-4">
                <Toggle value={layer.text.extrude} onChange={(v) => up({ text: { ...layer.text!, extrude: v } })} label="3D gölge" />
                <Toggle value={layer.text.italic} onChange={(v) => up({ text: { ...layer.text!, italic: v } })} label="İtalik" />
              </div>
            </>
          )}
        </Section>
      )}

      {layer.type === 'button' && layer.button && (
        <Section title="Buton">
          <TextInput value={layer.button.label} onChange={(v) => up({ button: { ...layer.button!, label: v } })} />
          <Row label="Üst renk">
            <ColorInput value={layer.button.colorTop} onChange={(v) => up({ button: { ...layer.button!, colorTop: v } })} />
          </Row>
          <Row label="Alt renk">
            <ColorInput value={layer.button.colorBottom} onChange={(v) => up({ button: { ...layer.button!, colorBottom: v } })} />
          </Row>
          <Row label="Yazı rengi">
            <ColorInput value={layer.button.textColor} onChange={(v) => up({ button: { ...layer.button!, textColor: v } })} />
          </Row>
          <Row label="Yazı boyutu">
            <NumInput value={layer.button.fontSize} min={8} onChange={(v) => up({ button: { ...layer.button!, fontSize: v } })} />
          </Row>
          <Row label="Köşe yarıçapı">
            <NumInput value={Math.min(layer.button.radius, 400)} min={0} onChange={(v) => up({ button: { ...layer.button!, radius: v } })} />
          </Row>
        </Section>
      )}

      {layer.type === 'background' && layer.background && (
        <Section title="Hareketli arka plan">
          <Row label="Stil">
            <Select<BackgroundStyle>
              value={layer.background.style}
              onChange={(v) => up({ background: { ...layer.background!, style: v } })}
              options={[
                { value: 'rays', label: 'Dönen ışık huzmeleri' },
                { value: 'gradient', label: 'Akan gradyan' },
                { value: 'dark', label: 'Koyu casino' },
              ]}
            />
          </Row>
          <Row label="Ana renk">
            <ColorInput value={layer.background.colorA} onChange={(v) => up({ background: { ...layer.background!, colorA: v } })} />
          </Row>
          <Row label="İkinci renk">
            <ColorInput value={layer.background.colorB} onChange={(v) => up({ background: { ...layer.background!, colorB: v } })} />
          </Row>
          <Row label="Işık rengi">
            <ColorInput value={layer.background.rayColor} onChange={(v) => up({ background: { ...layer.background!, rayColor: v } })} />
          </Row>
          <Row label="Huzme sayısı">
            <NumInput value={layer.background.rays} min={4} max={60} onChange={(v) => up({ background: { ...layer.background!, rays: Math.round(v) } })} />
          </Row>
          <Row label="Hız">
            <Slider value={layer.background.speed} min={0} max={4} onChange={(v) => up({ background: { ...layer.background!, speed: v } })} />
          </Row>
          <Toggle value={layer.background.bokeh} onChange={(v) => up({ background: { ...layer.background!, bokeh: v } })} label="Uçuşan ışık noktaları" />
          <div className="flex flex-wrap gap-1 pt-1">
            {BG_PRESETS.map((pr) => (
              <Btn key={pr.name} small onClick={() => up({ background: { ...pr.settings } })}>
                {pr.name}
              </Btn>
            ))}
          </div>
        </Section>
      )}

      {layer.type === 'particles' && layer.particles && (
        <Section title="Parçacıklar">
          <Row label="Tür">
            <Select<ParticleKind>
              value={layer.particles.kind}
              onChange={(v) => up({ particles: { ...layer.particles!, kind: v } })}
              options={[
                { value: 'coins', label: 'Altın yağmuru' },
                { value: 'burst', label: 'Altın patlaması' },
                { value: 'sparkles', label: 'Parıltılar' },
                { value: 'confetti', label: 'Konfeti' },
              ]}
            />
          </Row>
          <Row label="Adet">
            <NumInput value={layer.particles.count} min={1} max={300} onChange={(v) => up({ particles: { ...layer.particles!, count: Math.round(v) } })} />
          </Row>
          <Row label="Boyut">
            <NumInput value={layer.particles.size} min={4} max={300} onChange={(v) => up({ particles: { ...layer.particles!, size: v } })} />
          </Row>
          <Row label="Hız">
            <Slider value={layer.particles.speed} min={0.1} max={4} onChange={(v) => up({ particles: { ...layer.particles!, speed: v } })} />
          </Row>
          <Btn small onClick={() => up({ particles: { ...layer.particles!, seed: Math.round(Math.random() * 1000) } })}>
            🎲 Dağılımı değiştir
          </Btn>
        </Section>
      )}

      {(layer.type === 'image' || layer.type === 'video') && (
        <Section title="Medya">
          <Row label="Sığdırma">
            <Select<'contain' | 'cover'>
              value={layer.objectFit ?? 'contain'}
              onChange={(v) => up({ objectFit: v })}
              options={[
                { value: 'contain', label: 'Tamamı görünsün' },
                { value: 'cover', label: 'Kutuyu doldur' },
              ]}
            />
          </Row>
        </Section>
      )}
      {(layer.type === 'video' || layer.type === 'audio') && (
        <Section title="Ses">
          {layer.type === 'video' && <Toggle value={!!layer.loop} onChange={(v) => up({ loop: v })} label="Döngü (video bitince başa sar)" />}
          <Toggle value={!!layer.muted} onChange={(v) => up({ muted: v })} label="Sessiz" />
          <Row label="Ses düzeyi">
            <Slider value={layer.volume ?? 1} min={0} max={1} onChange={(v) => up({ volume: v })} />
          </Row>
        </Section>
      )}

      {positional && visualAssets.length > 0 && (
        <Section title="Görselle / videoyla değiştir">
          <p className="text-[11px] text-neutral-500">Konum, zamanlama, keyframe ve efektler korunur.</p>
          <select
            value=""
            onChange={(e) => e.target.value && st.applyAssetToLayer(layer.id, e.target.value)}
            className="w-full rounded border border-white/10 bg-[#121212] px-2 py-1 text-xs"
          >
            <option value="">Medya seç…</option>
            {visualAssets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.kind === 'video' ? '🎬' : '🖼'} {a.name}
              </option>
            ))}
          </select>
        </Section>
      )}

      {positional && (
        <Section title="Efektler">
          <EffectsEditor layer={layer} />
        </Section>
      )}
      {positional && (
        <Section title="Keyframe’ler">
          <KeyframeList layer={layer} />
        </Section>
      )}
    </div>
  );
};
