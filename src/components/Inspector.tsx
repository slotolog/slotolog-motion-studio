import React from 'react';
import { useSelectedLayer, useStore } from '../store';
import { BEAT_TRIGGER_EFFECTS, EASING_LABELS, EFFECT_META, LOOPING_EFFECTS, MUSIC_EFFECTS, propAt } from '../lib/anim';
import { SFX, SFX_KEYS } from '../lib/sfx';
import { projectAudio } from '../lib/music';
import { uid } from '../lib/factory';
import { LAYOUTS } from '../store';
import { seek } from '../lib/player';
import { BG_PRESETS } from '../lib/factory';
import type { AnimProp, BackgroundStyle, Direction, EasingName, EffectType, Layer, ParticleKind, SfxKey, TextStyle, ZoomMode } from '../types';
import { ASPECT_SIZES } from '../types';
import { TYPE_META } from './Timeline';
import { Btn, ColorInput, NumInput, Row, Section, Select, Slider, TextInput, Toggle } from './ui';

const PROP_LABELS: Record<AnimProp, string> = { x: 'X konumu', y: 'Y konumu', scale: 'Ölçek', rotation: 'Açı (°)', opacity: 'Opaklık' };

const SoundSelect: React.FC<{ value?: SfxKey; volume?: number; onChange: (v: SfxKey | undefined, vol: number) => void }> = ({ value, volume = 0.7, onChange }) => (
  <div className="flex w-full items-center gap-1">
    <select
      value={value ?? ''}
      onChange={(e) => onChange((e.target.value || undefined) as SfxKey | undefined, volume)}
      className="min-w-0 flex-1 rounded border border-white/10 bg-[#121212] px-1 py-1 text-[11px]"
    >
      <option value="">Ses yok</option>
      {SFX_KEYS.map((k) => (
        <option key={k} value={k}>
          🔊 {SFX[k].name}
        </option>
      ))}
    </select>
    {value && (
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={volume}
        title={`Ses düzeyi ${Math.round(volume * 100)}%`}
        onChange={(e) => onChange(value, parseFloat(e.target.value))}
        className="w-14 accent-[#FF8E16]"
      />
    )}
  </div>
);

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
            {e.type === 'cameraZoom' && (
              <Row label="Yön">
                <Select<ZoomMode>
                  value={e.zoomMode ?? 'inout'}
                  onChange={(v) => st.updateEffect(layer.id, e.id, { zoomMode: v })}
                  options={[
                    { value: 'in', label: 'Yakınlaş' },
                    { value: 'out', label: 'Uzaklaş' },
                    { value: 'inout', label: 'Yakınlaş ↔ uzaklaş' },
                  ]}
                />
              </Row>
            )}
            {MUSIC_EFFECTS.includes(e.type) && (
              <Toggle value={e.syncToMusic !== false} onChange={(v) => st.updateEffect(layer.id, e.id, { syncToMusic: v })} label="Müzikle senkron (müzik varsa)" />
            )}
            {BEAT_TRIGGER_EFFECTS.includes(e.type) && e.syncToMusic !== false && (
              <Row label="Her N vuruşta">
                <NumInput value={e.beatEvery ?? (e.type === 'beatTurn' ? 2 : 1)} min={1} max={32} onChange={(v) => st.updateEffect(layer.id, e.id, { beatEvery: Math.round(v) })} />
                <span className="text-[10px] text-neutral-500">kaydır</span>
                <NumInput value={e.beatOffset ?? (e.type === 'beatTurn' ? 1 : 0)} min={0} max={31} onChange={(v) => st.updateEffect(layer.id, e.id, { beatOffset: Math.round(v) })} />
              </Row>
            )}
            <Row label="Ses efekti">
              <SoundSelect value={e.sound} volume={e.soundVolume} onChange={(v, vol) => st.updateEffect(layer.id, e.id, { sound: v, soundVolume: vol })} />
            </Row>
            {LOOPING_EFFECTS.includes(e.type) && (
              <Row label="Faz (sn)">
                <NumInput value={e.phase ?? 0} step={0.1} digits={2} onChange={(v) => st.updateEffect(layer.id, e.id, { phase: v })} />
              </Row>
            )}
            {(e.type === 'glow' || e.type === 'flash' || e.type === 'shine') && (
              <Row label="Renk">
                <ColorInput value={e.color ?? '#FFD54A'} onChange={(v) => st.updateEffect(layer.id, e.id, { color: v })} />
              </Row>
            )}
            {e.type === 'beat' && (
              <Row label="BPM">
                <NumInput value={e.bpm ?? 120} min={30} max={240} onChange={(v) => st.updateEffect(layer.id, e.id, { bpm: v })} />
              </Row>
            )}
            {e.type === 'beatSync' && (
              <Row label="Müzik yoksa BPM">
                <NumInput value={e.bpm ?? 0} min={0} max={240} onChange={(v) => st.updateEffect(layer.id, e.id, { bpm: v > 0 ? v : undefined })} />
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

const AudioSettings: React.FC = () => {
  const p = useStore((s) => s.project);
  const frame = useStore((s) => s.frame);
  const st = useStore.getState();
  const a = projectAudio(p);
  const musicLayers = p.layers.filter((l) => l.type === 'audio' && (l.channel ?? 'music') === 'music');
  const analysed = musicLayers.map((l) => p.assets.find((x) => x.id === l.assetId)).filter((x) => x?.analysis);
  const sec = frame / p.fps;
  return (
    <Section title="Ses ve müzik">
      <Row label="Müzik kanalı">
        <Slider value={a.musicVolume} min={0} max={1} onChange={(v) => st.setAudio({ musicVolume: v })} />
      </Row>
      <Row label="Efekt kanalı">
        <Slider value={a.sfxVolume} min={0} max={1} onChange={(v) => st.setAudio({ sfxVolume: v })} />
      </Row>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Toggle value={a.musicMuted} onChange={(v) => st.setAudio({ musicMuted: v })} label="Müziği kapat" />
        <Toggle value={a.sfxMuted} onChange={(v) => st.setAudio({ sfxMuted: v })} label="Efektleri kapat" />
      </div>
      <div className="mt-2 border-t border-white/5 pt-2">
        <Toggle value={a.syncEnabled} onChange={(v) => st.setAudio({ syncEnabled: v })} label="Animasyonları müzikle senkronla" />
        <p className="mt-1 text-[11px] text-neutral-500" data-testid="music-status">
          {musicLayers.length === 0
            ? 'Müzik yok. Medya’dan MP3/WAV yükleyip “Ekle” ile ekle; ritim otomatik analiz edilir.'
            : analysed.length
              ? `Algılanan tempo: ${analysed.map((x) => `${x!.analysis!.bpm} BPM (${x!.analysis!.beats.length} vuruş)`).join(', ')}`
              : 'Ritim analiz ediliyor veya henüz analiz edilmedi (ses katmanını seçip “Ritmi analiz et”).'}
        </p>
      </div>
      <div className="mt-2 border-t border-white/5 pt-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-neutral-300">Nakarat / güçlü bölümler (elle)</span>
          <Btn
            small
            onClick={() =>
              st.setAudio({
                sections: [...a.sections, { id: uid(), label: 'Nakarat', start: Math.round(sec * 10) / 10, end: Math.round(Math.min(p.durationInFrames / p.fps, sec + 4) * 10) / 10, boost: 1.6 }],
              })
            }
          >
            + Oynatma çizgisinden
          </Btn>
        </div>
        <p className="mb-1 text-[10px] text-neutral-500">Bu aralıklarda müzikle senkron efektler “Güç” katı kadar güçlenir. Nakarat otomatik algılanmaz.</p>
        {a.sections.map((s) => {
          const upd = (patch: Partial<typeof s>) => st.setAudio({ sections: a.sections.map((x) => (x.id === s.id ? { ...x, ...patch } : x)) });
          return (
            <div key={s.id} className="mb-1 grid grid-cols-[1fr_52px_52px_44px_16px] items-center gap-1">
              <input value={s.label} onChange={(e) => upd({ label: e.target.value })} className="min-w-0 rounded bg-[#121212] px-1 py-0.5 text-[11px]" />
              <NumInput value={s.start} step={0.1} digits={1} min={0} onChange={(v) => upd({ start: v })} />
              <NumInput value={s.end} step={0.1} digits={1} min={0} onChange={(v) => upd({ end: v })} />
              <NumInput value={s.boost} step={0.1} digits={1} min={1} max={3} onChange={(v) => upd({ boost: v })} />
              <button className="text-[11px] text-neutral-500 hover:text-red-400" onClick={() => st.setAudio({ sections: a.sections.filter((x) => x.id !== s.id) })}>
                ✕
              </button>
            </div>
          );
        })}
        {a.sections.length > 0 && <p className="text-[10px] text-neutral-500">ad · başlangıç sn · bitiş sn · güç</p>}
      </div>
    </Section>
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
      <AudioSettings />
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

/** Manual correction of the detected tempo / beat grid. */
const BeatGridEditor: React.FC<{ assetId: string }> = ({ assetId }) => {
  const asset = useStore((s) => s.project.assets.find((a) => a.id === assetId));
  const frame = useStore((s) => s.frame);
  const layer = useSelectedLayer();
  const fps = useStore((s) => s.project.fps);
  const [bpm, setBpm] = React.useState(asset?.analysis?.bpm ?? 120);
  const [first, setFirst] = React.useState(asset?.analysis?.firstBeat ?? asset?.analysis?.beats[0] ?? 0);
  const [bar, setBar] = React.useState(asset?.analysis?.beatsPerBar ?? 4);
  React.useEffect(() => {
    if (asset?.analysis) {
      setBpm(asset.analysis.bpm);
      setFirst(asset.analysis.firstBeat ?? asset.analysis.beats[0] ?? 0);
    }
  }, [asset?.analysis]);
  const st = useStore.getState();
  const apply = (b = bpm, f = first) => st.setBeatGrid(assetId, { bpm: b, firstBeat: f, beatsPerBar: bar });
  // the playhead position expressed in the song's own time
  const songTime = layer ? (frame - layer.start) / fps + (layer.trimStart ?? 0) : 0;
  return (
    <details className="rounded bg-[#141414] p-2 text-[11px] text-neutral-300" data-testid="beat-grid">
      <summary className="cursor-pointer text-neutral-200">Ritmi elle düzelt (algılama hatalıysa)</summary>
      <div className="mt-2 space-y-1.5">
        <Row label="Tempo (BPM)">
          <NumInput value={bpm} step={0.01} digits={2} min={20} max={300} onChange={setBpm} />
        </Row>
        <Row label="İlk ölçü başı (sn)">
          <NumInput value={first} step={0.005} digits={3} min={0} onChange={setFirst} />
          <Btn small title="Oynatma çizgisindeki an ölçü başı olsun" onClick={() => setFirst(Math.round(songTime * 1000) / 1000)}>
            ▼ çizgi
          </Btn>
        </Row>
        <Row label="Ölçü (vuruş)">
          <NumInput value={bar} min={2} max={12} onChange={(v) => setBar(Math.round(v))} />
        </Row>
        <div className="flex flex-wrap gap-1">
          <Btn small variant="primary" onClick={() => apply()}>
            Izgarayı uygula
          </Btn>
          {[
            ['×2', 2],
            ['÷2', 0.5],
            ['×3/4', 0.75],
            ['×4/3', 4 / 3],
          ].map(([l, f]) => (
            <Btn
              key={l as string}
              small
              title="Tempoyu bu oranla değiştirip uygula"
              onClick={() => {
                const nb = Math.round(bpm * (f as number) * 100) / 100;
                setBpm(nb);
                apply(nb, first);
              }}
            >
              {l}
            </Btn>
          ))}
        </div>
        <p className="text-[10px] text-neutral-500">Aksak ritimlerde (3+3+2) tempo 4/3 kat hızlı algılanabilir; ×3/4 ile düzelt. Ölçü başları güçlü vuruş sayılır.</p>
      </div>
    </details>
  );
};

const MusicLayerSettings: React.FC<{ layer: Layer }> = ({ layer }) => {
  const asset = useStore((s) => s.project.assets.find((a) => a.id === layer.assetId));
  const analyzing = useStore((s) => s.analyzing.includes(layer.assetId ?? ''));
  const st = useStore.getState();
  const up = (patch: Partial<Layer>) => st.updateLayer(layer.id, patch);
  return (
    <Section title="Müzik düzenleme">
      <Row label="Kanal">
        <Select<'music' | 'sfx'>
          value={layer.channel ?? 'music'}
          onChange={(v) => up({ channel: v })}
          options={[
            { value: 'music', label: 'Müzik' },
            { value: 'sfx', label: 'Ses efekti' },
          ]}
        />
      </Row>
      <Row label="Dosyadan atla (sn)">
        <NumInput value={layer.trimStart ?? 0} step={0.1} digits={2} min={0} onChange={(v) => up({ trimStart: v })} />
      </Row>
      <Row label="Kazanç">
        <NumInput value={layer.volume ?? 1} step={0.05} digits={2} min={0} max={8} onChange={(v) => up({ volume: v })} />
        <Btn small title="Şarkının en yüksek noktası −1,5 dBFS olacak şekilde ayarla" onClick={() => st.normalizeLayer(layer.id)}>
          Normalleştir
        </Btn>
      </Row>
      <Row label="Fade-in (sn)">
        <NumInput value={layer.fadeIn ?? 0} step={0.1} digits={1} min={0} onChange={(v) => up({ fadeIn: v })} />
      </Row>
      <Row label="Fade-out (sn)">
        <NumInput value={layer.fadeOut ?? 0} step={0.1} digits={1} min={0} onChange={(v) => up({ fadeOut: v })} />
      </Row>
      <p className="text-[10px] text-neutral-500">Başlangıç/süre = “Zamanlama”. Zaman çizelgesinde sol kenarı sürüklemek şarkının başını keser.</p>
      {(layer.channel ?? 'music') === 'music' && (
        <div className="rounded bg-[#141414] p-2 text-[11px] text-neutral-300">
          {analyzing ? (
            'Ritim analiz ediliyor…'
          ) : asset?.analysis ? (
            <>
              <b className="text-[#FF8E16]">{asset.analysis.bpm} BPM</b> · {asset.analysis.beats.length} vuruş algılandı
            </>
          ) : (
            'Henüz analiz edilmedi.'
          )}
          {asset?.analysis?.manual && <span className="ml-1 text-[10px] text-neutral-400">(elle ayarlandı)</span>}
          {asset && !asset.src && (
            <Btn small className="ml-2" onClick={() => st.analyzeAsset(asset.id)} disabled={analyzing}>
              {asset.analysis ? 'Otomatik yeniden algıla' : 'Ritmi analiz et'}
            </Btn>
          )}
        </div>
      )}
      {(layer.channel ?? 'music') === 'music' && asset && <BeatGridEditor assetId={asset.id} />}
    </Section>
  );
};

export const Inspector: React.FC = () => {
  const layer = useSelectedLayer();
  const fps = useStore((s) => s.project.fps);
  const assets = useStore((s) => s.project.assets);
  if (!layer) return <ProjectSettings />;
  const st = useStore.getState();
  const up = (patch: Partial<Layer>) => st.updateLayer(layer.id, patch);
  const positional = !['background', 'particles', 'audio', 'camera'].includes(layer.type);
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
      {positional && (
        <Section title="Derinlik ve ses">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <Toggle value={!!layer.shadow} onChange={(v) => up({ shadow: v })} label="Yumuşak gölge" />
            <Toggle value={!!layer.motionBlur} onChange={(v) => up({ motionBlur: v })} label="Hareket bulanıklığı" />
          </div>
          <Row label="Kamera derinliği">
            <Slider value={layer.depth ?? 1} min={0} max={1.5} onChange={(v) => up({ depth: v })} />
          </Row>
          <Row label="Giriş sesi">
            <SoundSelect value={layer.startSound} volume={layer.startSoundVolume} onChange={(v, vol) => up({ startSound: v, startSoundVolume: vol })} />
          </Row>
        </Section>
      )}
      {positional && (
        <Section title="Çoklu nesne düzeni">
          <p className="text-[11px] text-neutral-500">Bu katmanı çoğaltıp düzenler. Her kopya ayrı katmandır; efektler farklı zamanlamayla kopyalanır.</p>
          <div className="grid grid-cols-2 gap-1">
            {LAYOUTS.map((lo) => (
              <Btn key={lo.id} small onClick={() => st.arrangeLayout(layer.id, lo.id)} data-testid={`layout-${lo.id}`}>
                {lo.label}
              </Btn>
            ))}
          </div>
        </Section>
      )}
      {layer.type === 'camera' && (
        <Section title="Kamera">
          <p className="text-[11px] text-neutral-500">Kamera görünmez; efektleri ve keyframe’leri tüm sahneyi hareket ettirir. Katmanların “Kamera derinliği” paralaks oluşturur.</p>
          <PropField layer={layer} prop="scale" step={0.01} digits={2} min={0.5} />
          <PropField layer={layer} prop="x" />
          <PropField layer={layer} prop="y" />
          <PropField layer={layer} prop="rotation" step={0.5} digits={1} />
          <EffectsEditor layer={layer} />
        </Section>
      )}
      {(layer.type === 'background' || layer.type === 'particles') && (
        <Section title="Derinlik">
          <Row label="Kamera derinliği">
            <Slider value={layer.depth ?? (layer.type === 'background' ? 0.5 : 0.85)} min={0} max={1.5} onChange={(v) => up({ depth: v })} />
          </Row>
          <Row label="Giriş sesi">
            <SoundSelect value={layer.startSound} volume={layer.startSoundVolume} onChange={(v, vol) => up({ startSound: v, startSoundVolume: vol })} />
          </Row>
        </Section>
      )}
      {!positional && layer.type !== 'audio' && layer.type !== 'camera' && (
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
                { value: 'luxury', label: 'Lüks altın-siyah' },
                { value: 'party', label: 'Parti (turuncu-altın-pembe)' },
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
                { value: 'fruits', label: 'Uçuşan meyveler' },
                { value: 'fruitFrame', label: 'Meyve çerçevesi (üst/alt)' },
              ]}
            />
          </Row>
          <Row label={layer.particles.kind === 'fruitFrame' ? 'Sıra başına' : 'Adet'}>
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
      {layer.type === 'audio' && <MusicLayerSettings layer={layer} />}
      {(layer.type === 'video' || layer.type === 'audio') && (
        <Section title="Ses">
          {layer.type === 'video' && <Toggle value={!!layer.loop} onChange={(v) => up({ loop: v })} label="Döngü (video bitince başa sar)" />}
          <Toggle value={!!layer.muted} onChange={(v) => up({ muted: v })} label="Sessiz" />
          <Row label="Ses düzeyi">
            <Slider value={layer.volume ?? 1} min={0} max={layer.type === 'audio' ? 4 : 1} onChange={(v) => up({ volume: v })} />
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
