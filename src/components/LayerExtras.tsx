import React from 'react';
import { useStore } from '../store';
import { defaultSubtitleStyle } from '../lib/story';
import { uid } from '../lib/factory';
import type { Layer, SubtitleCue, SubtitleStyle } from '../types';
import { Btn, ColorInput, NumInput, Section, Toggle } from './ui';

const up = (id: string, patch: Partial<Layer>) => useStore.getState().updateLayer(id, patch);

/** Crop of a video / image source (e.g. a phone's status and browser bars). */
export const CropEditor: React.FC<{ layer: Layer }> = ({ layer }) => {
  const c = layer.mediaCrop ?? { top: 0, bottom: 0, left: 0, right: 0 };
  const set = (k: keyof typeof c, v: number) => up(layer.id, { mediaCrop: { ...c, [k]: Math.max(0, Math.min(45, v)) / 100 } });
  return (
    <div className="mt-2" data-testid="crop-editor">
      <div className="mb-1 text-[11px] text-neutral-400">Kaynaktan kırp (%) — telefon durum / tarayıcı çubuklarını gizlemek için</div>
      <div className="grid grid-cols-4 gap-1 text-[10px] text-neutral-500">
        {(['top', 'bottom', 'left', 'right'] as const).map((k) => (
          <label key={k}>
            {{ top: 'Üst', bottom: 'Alt', left: 'Sol', right: 'Sağ' }[k]}
            <NumInput value={Math.round(c[k] * 1000) / 10} step={0.5} digits={1} min={0} max={45} onChange={(v) => set(k, v)} />
          </label>
        ))}
      </div>
    </div>
  );
};

/** Subtitles layer with its own lines (times from the layer start). */
export const SubtitleLayerEditor: React.FC<{ layer: Layer }> = ({ layer }) => {
  const fps = useStore((s) => s.project.fps);
  const frame = useStore((s) => s.frame);
  const st: SubtitleStyle = layer.subtitleStyle ?? defaultSubtitleStyle();
  const setStyle = (patch: Partial<SubtitleStyle>) => up(layer.id, { subtitleStyle: { ...st, ...patch } });
  const cues = layer.cues;
  const setCues = (c: SubtitleCue[]) => up(layer.id, { cues: c });
  const local = (frame - layer.start) / fps;
  return (
    <Section title="Altyazı">
      <div className="grid grid-cols-2 gap-2 text-[11px] text-neutral-400">
        <label>
          Yazı boyu
          <NumInput value={st.fontSize} step={2} min={20} max={140} onChange={(v) => setStyle({ fontSize: v })} />
        </label>
        <label>
          Kontur
          <NumInput value={st.strokeWidth} step={1} min={0} max={20} onChange={(v) => setStyle({ strokeWidth: v })} />
        </label>
        <label>
          Yazı rengi
          <ColorInput value={st.color} onChange={(v) => setStyle({ color: v })} />
        </label>
        <label>
          Vurgu rengi (*kelime*)
          <ColorInput value={st.highlight} onChange={(v) => setStyle({ highlight: v })} />
        </label>
      </div>
      <div className="mt-1 flex gap-3">
        <Toggle value={!!st.shadow} onChange={(v) => setStyle({ shadow: v })} label="Gölge" />
        <Toggle value={st.box} onChange={(v) => setStyle({ box: v })} label="Koyu kutu" />
      </div>
      {!cues ? (
        <p className="mt-2 text-[10px] text-neutral-500">Bu katman Hikâye Stüdyosu’ndaki altyazıları gösterir.</p>
      ) : (
        <div className="mt-2 space-y-1" data-testid="cue-editor">
          <div className="text-[10px] text-neutral-500">Satırlar (katman başından saniye). Turuncu yapmak için kelimeyi *yıldız* içine al.</div>
          {cues.map((c, i) => (
            <div key={c.id} className={`grid grid-cols-[48px_48px_1fr_14px] items-center gap-1 ${local >= c.start && local < c.end ? 'rounded bg-[#FF8E16]/15' : ''}`}>
              <NumInput value={c.start} step={0.05} digits={2} min={0} onChange={(v) => setCues(cues.map((x, k) => (k === i ? { ...x, start: v } : x)))} />
              <NumInput value={c.end} step={0.05} digits={2} min={0} onChange={(v) => setCues(cues.map((x, k) => (k === i ? { ...x, end: v } : x)))} />
              <input
                className="min-w-0 rounded border border-white/10 bg-[#121212] px-1 py-0.5 text-[11px]"
                value={c.text}
                data-testid={`cue-text-${i}`}
                onChange={(e) => setCues(cues.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)))}
              />
              <button className="text-[10px] text-neutral-500 hover:text-red-400" onClick={() => setCues(cues.filter((_, k) => k !== i))}>
                ✕
              </button>
            </div>
          ))}
          <Btn
            small
            onClick={() => {
              const t = Math.max(0, Math.round(local * 100) / 100);
              setCues([...cues, { id: uid(), text: 'Yeni satır', start: t, end: t + 1.5 }].sort((a, b) => a.start - b.start));
            }}
          >
            + Oynatıcı konumuna satır ekle
          </Btn>
        </div>
      )}
    </Section>
  );
};

/** Volume automation points of an audio layer. */
export const VolumeKeysEditor: React.FC<{ layer: Layer }> = ({ layer }) => {
  const fps = useStore((s) => s.project.fps);
  const frame = useStore((s) => s.frame);
  const keys = layer.volumeKeys ?? [];
  const set = (k: { t: number; v: number }[]) => up(layer.id, { volumeKeys: k.length ? [...k].sort((a, b) => a.t - b.t) : undefined });
  const local = Math.max(0, (frame - layer.start) / fps);
  return (
    <div className="mt-2" data-testid="volume-keys">
      <div className="mb-1 text-[11px] text-neutral-400">Ses seviyesi eğrisi (noktalar arası yumuşak geçiş)</div>
      {keys.map((k, i) => (
        <div key={i} className="mb-0.5 grid grid-cols-[1fr_1fr_14px] items-center gap-1 text-[10px] text-neutral-500">
          <NumInput value={k.t} step={0.1} digits={2} min={0} onChange={(v) => set(keys.map((x, j) => (j === i ? { ...x, t: v } : x)))} />
          <NumInput value={Math.round(k.v * 100)} step={5} min={0} max={200} onChange={(v) => set(keys.map((x, j) => (j === i ? { ...x, v: v / 100 } : x)))} />
          <button className="hover:text-red-400" onClick={() => set(keys.filter((_, j) => j !== i))}>
            ✕
          </button>
        </div>
      ))}
      <Btn small onClick={() => set([...keys, { t: Math.round(local * 100) / 100, v: 1 }])}>
        + Oynatıcı konumuna nokta (sn, %)
      </Btn>
    </div>
  );
};

/** Frame layer: video window and look (reusable Big Win Frame). */
export const FrameEditor: React.FC<{ layer: Layer }> = ({ layer }) => {
  const f = layer.frame!;
  const set = (patch: Partial<NonNullable<Layer['frame']>>) => up(layer.id, { frame: { ...f, ...patch } });
  const win = f.window;
  const setWin = (patch: Partial<typeof win>) => set({ window: { ...win, ...patch } });
  return (
    <Section title="Çerçeve">
      <div className="mb-1 text-[11px] text-neutral-400">Oyun penceresi (merkez ve boyut, px)</div>
      <div className="grid grid-cols-4 gap-1 text-[10px] text-neutral-500">
        {(['x', 'y', 'w', 'h'] as const).map((k) => (
          <label key={k}>
            {{ x: 'X', y: 'Y', w: 'Genişlik', h: 'Yükseklik' }[k]}
            <NumInput value={win[k]} step={2} min={10} onChange={(v) => setWin({ [k]: v })} />
          </label>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-neutral-400">
        <label>
          Kalınlık
          <NumInput value={f.thickness} step={1} min={4} max={80} onChange={(v) => set({ thickness: v })} />
        </label>
        <label>
          Köşe yuvarlaklığı
          <NumInput value={f.radius} step={2} min={0} max={120} onChange={(v) => set({ radius: v })} />
        </label>
        <label>
          Renk 1
          <ColorInput value={f.colorA} onChange={(v) => set({ colorA: v })} />
        </label>
        <label>
          Renk 2
          <ColorInput value={f.colorB} onChange={(v) => set({ colorB: v })} />
        </label>
      </div>
      <div className="mt-1 flex flex-wrap gap-3">
        <Toggle value={f.lights} onChange={(v) => set({ lights: v })} label="Işıklar" />
        <Toggle value={f.fruits} onChange={(v) => set({ fruits: v })} label="Köşe meyveleri" />
        <Toggle value={f.sevens} onChange={(v) => set({ sevens: v })} label="777" />
      </div>
      <Btn
        small
        className="mt-2"
        data-testid="fit-videos-to-window"
        onClick={() =>
          useStore.getState().update((p) => ({
            ...p,
            layers: p.layers.map((l) => (l.type === 'video' || (l.type === 'placeholder' && /oyun/i.test(l.name)) ? { ...l, x: win.x, y: win.y, width: win.w, height: win.h } : l)),
          }))
        }
      >
        Oyun videolarını pencereye yerleştir
      </Btn>
    </Section>
  );
};
