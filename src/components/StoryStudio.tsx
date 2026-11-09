import { VOICE_PROVIDERS } from '../lib/voice';
import React, { useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import { seek } from '../lib/player';
import {
  SCENE_KINDS,
  STORY_FIELDS,
  TRANSITIONS,
  clipRange,
  defaultSubtitleStyle,
  estimateSpeech,
  fitScenesToVoice,
  generateSubtitles,
  makeScene,
  sceneStarts,
  splitScriptToScenes,
  storyDuration,
  storyWarnings,
  wordCount,
} from '../lib/story';
import { uid } from '../lib/factory';
import type { Layer, SceneKind, SceneTransition, StoryData, StoryScene, SubtitleStyle } from '../types';
import { Btn, ColorInput, Modal, NumInput, Select, TextInput, Toggle } from './ui';

type Tab = 'data' | 'scenes' | 'script' | 'subs' | 'frame';
const TABS: { id: Tab; label: string }[] = [
  { id: 'data', label: 'Veriler' },
  { id: 'scenes', label: 'Sahneler' },
  { id: 'script', label: 'Senaryo ve Seslendirme' },
  { id: 'subs', label: 'Altyazı' },
  { id: 'frame', label: 'Çerçeve' },
];

/** shared handles to the recording / voice players for "take time from player" buttons */
const players: { rec: HTMLVideoElement | null; voice: HTMLAudioElement | null } = { rec: null, voice: null };
const r2 = (x: number) => Math.round(x * 100) / 100;

const useStory = () => useStore((s) => s.project.story);
const upd = (fn: (s: StoryData) => StoryData) => useStore.getState().updateStory(fn);
const updScene = (id: string, patch: Partial<StoryScene> | ((s: StoryScene) => Partial<StoryScene>)) =>
  upd((st) => ({ ...st, scenes: st.scenes.map((s) => (s.id === id ? { ...s, ...(typeof patch === 'function' ? patch(s) : patch) } : s)) }));

const Field: React.FC<{ label: string; children: React.ReactNode; hint?: string }> = ({ label, children, hint }) => (
  <label className="block text-[11px] text-neutral-400">
    <span>{label}</span>
    <div className="mt-0.5">{children}</div>
    {hint && <span className="text-[10px] text-neutral-600">{hint}</span>}
  </label>
);

/* ---------------- left column: recordings and markers ---------------- */

const Recordings: React.FC = () => {
  const story = useStory()!;
  const allAssets = useStore((s) => s.project.assets);
  const assets = useMemo(() => allAssets.filter((a) => a.kind === 'video'), [allAssets]);
  const urls = useStore((s) => s.assetUrls);
  const [sel, setSel] = useState<string>(assets[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cur = assets.find((a) => a.id === sel) ?? assets[0];
  const vref = useRef<HTMLVideoElement>(null);
  React.useEffect(() => {
    players.rec = vref.current;
  });
  const markers = story.markers.filter((m) => m.assetId === cur?.id).sort((a, b) => a.time - b.time);
  const addMarker = (bigWin: boolean) => {
    if (!cur || !vref.current) return;
    const time = r2(vref.current.currentTime);
    upd((st) => ({ ...st, markers: [...st.markers, { id: uid(), assetId: cur.id, time, label: bigWin ? 'Büyük kazanç' : `Önemli an ${markers.length + 1}`, bigWin }] }));
  };
  return (
    <div className="space-y-2" data-testid="recordings">
      <div className="flex items-center justify-between">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#FF8E16]">Oyun kayıtları</h4>
        <Btn small onClick={() => fileRef.current?.click()} disabled={busy}>
          {busy ? 'Yükleniyor…' : '+ MP4 / MOV yükle'}
        </Btn>
        <input
          ref={fileRef}
          data-testid="story-upload-video"
          type="file"
          accept="video/mp4,video/quicktime,video/webm,.mov"
          multiple
          className="hidden"
          onChange={async (e) => {
            setBusy(true);
            for (const f of Array.from(e.target.files ?? [])) {
              try {
                const a = await useStore.getState().addAssetFromFile(f);
                setSel(a.id);
              } catch (err) {
                alert((err as Error).message);
              }
            }
            setBusy(false);
            e.target.value = '';
          }}
        />
      </div>
      {assets.length === 0 ? (
        <p className="rounded bg-[#141414] p-3 text-[11px] text-neutral-500">Henüz oyun kaydı yok. Oyun kaydını yükle; sonra önemli anları burada işaretle ve sahnelere bağla.</p>
      ) : (
        <>
          <Select value={cur?.id ?? ''} onChange={setSel} options={assets.map((a) => ({ value: a.id, label: `🎬 ${a.name}${a.duration ? ` (${a.duration.toFixed(1)} sn)` : ''}` }))} />
          {cur && urls[cur.id] && <video ref={vref} src={urls[cur.id]} controls className="w-full rounded bg-black" style={{ maxHeight: 300 }} data-testid="rec-player" />}
          <div className="flex gap-1">
            <Btn small className="flex-1" onClick={() => addMarker(false)} data-testid="add-marker">
              ◆ Bu anı işaretle
            </Btn>
            <Btn small variant="primary" className="flex-1" onClick={() => addMarker(true)} data-testid="add-bigwin">
              ★ Büyük kazanç anı
            </Btn>
          </div>
          <p className="text-[10px] text-neutral-500">İşaretleme elle yapılır; otomatik an algılama yok.</p>
          <div className="space-y-1" data-testid="marker-list">
            {markers.map((m) => (
              <div key={m.id} className={`grid grid-cols-[58px_1fr_auto_auto] items-center gap-1 rounded px-1 py-0.5 ${m.bigWin ? 'bg-[#FF8E16]/15' : 'bg-[#141414]'}`}>
                <NumInput value={m.time} step={0.05} digits={2} min={0} onChange={(v) => upd((st) => ({ ...st, markers: st.markers.map((x) => (x.id === m.id ? { ...x, time: v } : x)) }))} />
                <input
                  value={m.label}
                  onChange={(e) => upd((st) => ({ ...st, markers: st.markers.map((x) => (x.id === m.id ? { ...x, label: e.target.value } : x)) }))}
                  className="min-w-0 rounded bg-[#121212] px-1 py-0.5 text-[11px]"
                />
                <button title="Kayıtta bu ana git" className="text-[11px] text-neutral-400 hover:text-white" onClick={() => vref.current && (vref.current.currentTime = m.time)}>
                  ▶
                </button>
                <button title="Sil" className="text-[11px] text-neutral-500 hover:text-red-400" onClick={() => upd((st) => ({ ...st, markers: st.markers.filter((x) => x.id !== m.id) }))}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

/* ---------------- tabs ---------------- */

const DurationInput: React.FC<{ current: number }> = ({ current }) => {
  const [v, setV] = useState(current.toFixed(1));
  React.useEffect(() => setV(current.toFixed(1)), [current]);
  const apply = () => {
    const target = parseFloat(v.replace(',', '.'));
    if (!Number.isFinite(target) || target < 1) return setV(current.toFixed(1));
    const k = target / Math.max(0.1, current);
    upd((st) => {
      const scenes = st.scenes.map((s) => ({ ...s, duration: Math.max(0.5, Math.round(s.duration * k * 10) / 10) }));
      // rounding: the last scene absorbs the difference so the total is exactly the target
      const diff = Math.round((target - scenes.reduce((a, s) => a + s.duration, 0)) * 10) / 10;
      if (scenes.length) scenes[scenes.length - 1].duration = Math.max(0.5, Math.round((scenes[scenes.length - 1].duration + diff) * 10) / 10);
      return { ...st, scenes };
    });
  };
  return (
    <div className="flex gap-1">
      <input
        data-testid="story-duration"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && apply()}
        className="w-full rounded border border-white/10 bg-[#121212] px-2 py-1 text-xs text-neutral-100 outline-none focus:border-[#FF8E16]"
      />
      <Btn small onClick={apply}>
        Uygula
      </Btn>
    </div>
  );
};

const DataTab: React.FC = () => {
  const story = useStory()!;
  const fps = useStore((s) => s.project.fps);
  const dur = useStore((s) => s.project.durationInFrames) / fps;
  return (
    <div className="space-y-3" data-testid="story-data">
      <p className="text-[11px] text-neutral-500">Bu alanlar yazı katmanlarındaki {'{alan}'} yerlerine otomatik yazılır. Tutarları sen girersin; sistem rakam üretmez. Boş alan videoda [alan adı] olarak görünür.</p>
      <div className="grid grid-cols-2 gap-2">
        {STORY_FIELDS.map((f) => (
          <Field key={f.key} label={`${f.label} · {${f.key}}`} hint={f.hint}>
            <input
              data-testid={`field-${f.key}`}
              value={story.fields[f.key]}
              onChange={(e) => upd((st) => ({ ...st, fields: { ...st.fields, [f.key]: e.target.value } }))}
              className="w-full rounded border border-white/10 bg-[#121212] px-2 py-1 text-xs text-neutral-100 outline-none focus:border-[#FF8E16]"
            />
          </Field>
        ))}
        <Field label="Video süresi (sn)" hint="Sahnelerin toplamı. Yeni süre girilirse tüm sahneler orantılı ölçeklenir.">
          <DurationInput current={dur} />
        </Field>
      </div>
    </div>
  );
};

const SceneCard: React.FC<{ s: StoryScene; i: number; start: number; n: number }> = ({ s, i, start, n }) => {
  const story = useStory()!;
  const project = useStore((st) => st.project);
  const videos = project.assets.filter((a) => a.kind === 'video');
  const audios = project.assets.filter((a) => a.kind === 'audio' && !a.src);
  const markers = story.markers;
  const r = clipRange(project, s);
  const est = estimateSpeech(s.voText, story.wordsPerSecond);
  const move = (d: number) =>
    upd((st) => {
      const sc = [...st.scenes];
      const j = Math.max(0, Math.min(sc.length - 1, i + d));
      [sc[i], sc[j]] = [sc[j], sc[i]];
      return { ...st, scenes: sc };
    });
  const fromPlayer = () => r2(players.rec?.currentTime ?? 0);
  return (
    <div className="rounded-lg border border-white/10 bg-[#141414] p-2.5" data-testid={`scene-${i}`}>
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded bg-[#FF8E16] px-1.5 text-[11px] font-black text-black">{i + 1}</span>
        <input value={s.title} onChange={(e) => updScene(s.id, { title: e.target.value })} className="min-w-0 flex-1 rounded bg-transparent px-1 text-sm font-semibold text-white focus:bg-[#121212]" />
        <span className="font-mono text-[10px] text-neutral-500">
          {start.toFixed(1)}–{(start + s.duration).toFixed(1)} sn
        </span>
        <button title="Sahneye git" className="text-xs text-neutral-400 hover:text-white" onClick={() => seek(Math.round(start * project.fps) + 2)}>
          ▶
        </button>
        <button title="Yukarı" disabled={i === 0} className="text-xs text-neutral-400 hover:text-white disabled:opacity-30" onClick={() => move(-1)} data-testid={`scene-up-${i}`}>
          ↑
        </button>
        <button title="Aşağı" disabled={i === n - 1} className="text-xs text-neutral-400 hover:text-white disabled:opacity-30" onClick={() => move(1)}>
          ↓
        </button>
        <button title="Çoğalt" className="text-xs text-neutral-400 hover:text-white" onClick={() => upd((st) => ({ ...st, scenes: [...st.scenes.slice(0, i + 1), { ...structuredClone(s), id: uid() }, ...st.scenes.slice(i + 1)] }))}>
          ⧉
        </button>
        <button title="Sil" className="text-xs text-neutral-500 hover:text-red-400" onClick={() => upd((st) => ({ ...st, scenes: st.scenes.filter((x) => x.id !== s.id) }))}>
          ✕
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Bölüm">
          <Select<SceneKind> value={s.kind} onChange={(v) => updScene(s.id, { kind: v })} options={SCENE_KINDS.map((k) => ({ value: k.kind, label: k.label }))} />
        </Field>
        <Field label="Süre (sn)">
          <NumInput value={s.duration} step={0.1} digits={1} min={0.3} onChange={(v) => updScene(s.id, { duration: v })} />
        </Field>
        <Field label="Geçiş">
          <Select<SceneTransition> value={s.transition} onChange={(v) => updScene(s.id, { transition: v })} options={TRANSITIONS.map((t) => ({ value: t.value, label: t.label }))} />
        </Field>
      </div>
      <div className="mt-2">
        <Field label="Ekran yazısı ({alan} kullanılabilir, boş = yok)">
          <TextInput value={s.caption} onChange={(v) => updScene(s.id, { caption: v })} />
        </Field>
      </div>
      <div className="mt-2 rounded bg-black/30 p-2">
        <div className="mb-1 text-[10px] font-bold uppercase text-neutral-400">Oyun kaydı</div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Kayıt">
            <Select
              value={s.clip.assetId ?? ''}
              onChange={(v) => updScene(s.id, (x) => ({ clip: { ...x.clip, assetId: v || undefined } }))}
              options={[{ value: '', label: s.kind === 'outro' ? '— kampanya kartı —' : '— yer tutucu —' }, ...videos.map((a) => ({ value: a.id, label: a.name }))]}
            />
          </Field>
          <Field label="Bağlı önemli an (işaret)">
            <Select
              value={s.markerId ?? ''}
              onChange={(v) => {
                const m = markers.find((x) => x.id === v);
                updScene(s.id, (x) => ({ markerId: v || undefined, clip: m ? { ...x.clip, assetId: m.assetId } : x.clip }));
              }}
              options={[{ value: '', label: '— yok (elle başlangıç) —' }, ...markers.map((m) => ({ value: m.id, label: `${m.bigWin ? '★' : '◆'} ${m.label} · ${m.time.toFixed(2)} sn` }))]}
            />
          </Field>
        </div>
        {s.clip.assetId && (
          <div className="mt-1.5 grid grid-cols-4 gap-2">
            {s.markerId ? (
              <Field label="An sahnede (sn)" hint="İşaretli an sahnenin bu saniyesinde görünür">
                <NumInput value={s.hitAt ?? (s.voice?.assetId ? s.voice.delay + 0.2 : s.duration * 0.6)} step={0.1} digits={1} min={0} onChange={(v) => updScene(s.id, { hitAt: v })} />
              </Field>
            ) : (
              <>
                <Field label="Kayıttan başla (sn)">
                  <div className="flex gap-0.5">
                    <NumInput value={s.clip.in} step={0.1} digits={2} min={0} onChange={(v) => updScene(s.id, (x) => ({ clip: { ...x.clip, in: v } }))} />
                    <button title="Oynatıcıdaki an" className="text-[10px] text-[#FF8E16]" onClick={() => updScene(s.id, (x) => ({ clip: { ...x.clip, in: fromPlayer() } }))} data-testid={`clip-in-from-player-${i}`}>
                      ▼
                    </button>
                  </div>
                </Field>
                <Field label="Bitiş (sn, 0 = otomatik)">
                  <div className="flex gap-0.5">
                    <NumInput value={s.clip.out} step={0.1} digits={2} min={0} onChange={(v) => updScene(s.id, (x) => ({ clip: { ...x.clip, out: v } }))} />
                    <button title="Oynatıcıdaki an" className="text-[10px] text-[#FF8E16]" onClick={() => updScene(s.id, (x) => ({ clip: { ...x.clip, out: fromPlayer() } }))}>
                      ▼
                    </button>
                  </div>
                </Field>
              </>
            )}
            <Field label="Hız (×)">
              <NumInput value={s.clip.speed} step={0.05} digits={2} min={0.25} max={4} onChange={(v) => updScene(s.id, (x) => ({ clip: { ...x.clip, speed: v } }))} />
            </Field>
            <Field label="Yakınlaşma (×)">
              <NumInput value={s.clip.zoom} step={0.05} digits={2} min={1} max={4} onChange={(v) => updScene(s.id, (x) => ({ clip: { ...x.clip, zoom: v } }))} />
            </Field>
            <Field label="Odak X (0–1)">
              <NumInput value={s.clip.zoomX} step={0.05} digits={2} min={0} max={1} onChange={(v) => updScene(s.id, (x) => ({ clip: { ...x.clip, zoomX: v } }))} />
            </Field>
            <Field label="Odak Y (0–1)">
              <NumInput value={s.clip.zoomY} step={0.05} digits={2} min={0} max={1} onChange={(v) => updScene(s.id, (x) => ({ clip: { ...x.clip, zoomY: v } }))} />
            </Field>
            <Field label="Oyun sesi">
              <div className="flex items-center gap-1">
                <Toggle value={!s.clip.muted} onChange={(v) => updScene(s.id, (x) => ({ clip: { ...x.clip, muted: !v } }))} />
                <input type="range" min={0} max={1} step={0.05} value={s.clip.volume} onChange={(e) => updScene(s.id, (x) => ({ clip: { ...x.clip, volume: parseFloat(e.target.value) } }))} className="w-14 accent-[#FF8E16]" />
              </div>
            </Field>
            <Field label="Efekt">
              <div className="space-y-0.5">
                <Toggle value={s.clip.zoomAnimate} onChange={(v) => updScene(s.id, (x) => ({ clip: { ...x.clip, zoomAnimate: v } }))} label="Yavaş yakınlaş" />
                <Select
                  value={s.colorFilter ?? 'none'}
                  onChange={(v) => updScene(s.id, { colorFilter: v as StoryScene['colorFilter'] })}
                  options={[
                    { value: 'none', label: 'Renk: normal' },
                    { value: 'sepia', label: 'Renk: geçmiş (sepya)' },
                    { value: 'bw', label: 'Renk: siyah-beyaz' },
                    { value: 'warm', label: 'Renk: sıcak' },
                  ]}
                />
              </div>
            </Field>
            <div className="col-span-4 text-[10px] text-neutral-500">
              Kullanılan aralık: {r.in.toFixed(2)} – {(r.in + s.duration * s.clip.speed).toFixed(2)} sn (kayıtta)
            </div>
          </div>
        )}
      </div>
      <div className="mt-2 rounded bg-black/30 p-2">
        <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase text-neutral-400">
          <span>Seslendirme</span>
          <span className={`font-mono normal-case ${est > s.duration ? 'text-yellow-400' : 'text-neutral-500'}`}>
            {wordCount(s.voText)} kelime · tahmini {est.toFixed(1)} sn
          </span>
        </div>
        <textarea
          value={s.voText}
          onChange={(e) => updScene(s.id, { voText: e.target.value })}
          rows={2}
          placeholder="Bu sahnede söylenecek metin"
          className="w-full rounded border border-white/10 bg-[#121212] px-2 py-1 text-xs"
          data-testid={`votext-${i}`}
        />
        <div className="mt-1 grid grid-cols-4 gap-2">
          <Field label="Ses kaydı">
            <Select
              value={s.voice?.assetId ?? ''}
              onChange={(v) => updScene(s.id, (x) => ({ voice: v ? { from: x.voice?.from ?? 0, to: x.voice?.to ?? Math.min(x.duration, audios.find((a) => a.id === v)?.duration ?? x.duration), delay: x.voice?.delay ?? 0.2, assetId: v } : undefined }))}
              options={[{ value: '', label: '— yok —' }, ...audios.map((a) => ({ value: a.id, label: a.name }))]}
            />
          </Field>
          {s.voice?.assetId && (
            <>
              <Field label="Kayıtta başlangıç">
                <div className="flex gap-0.5">
                  <NumInput value={s.voice.from} step={0.05} digits={2} min={0} onChange={(v) => updScene(s.id, (x) => ({ voice: { ...x.voice!, from: v } }))} />
                  <button className="text-[10px] text-[#FF8E16]" title="Ses oynatıcısındaki an" onClick={() => updScene(s.id, (x) => ({ voice: { ...x.voice!, from: r2(players.voice?.currentTime ?? 0) } }))}>
                    ▼
                  </button>
                </div>
              </Field>
              <Field label="Kayıtta bitiş">
                <div className="flex gap-0.5">
                  <NumInput value={s.voice.to} step={0.05} digits={2} min={0} onChange={(v) => updScene(s.id, (x) => ({ voice: { ...x.voice!, to: v } }))} />
                  <button className="text-[10px] text-[#FF8E16]" title="Ses oynatıcısındaki an" onClick={() => updScene(s.id, (x) => ({ voice: { ...x.voice!, to: r2(players.voice?.currentTime ?? 0) } }))}>
                    ▼
                  </button>
                </div>
              </Field>
              <Field label="Sahnede gecikme (sn)">
                <NumInput value={s.voice.delay} step={0.05} digits={2} min={0} onChange={(v) => updScene(s.id, (x) => ({ voice: { ...x.voice!, delay: v } }))} />
              </Field>
            </>
          )}
        </div>
        {s.voice?.assetId && (
          <Btn small className="mt-1" onClick={() => updScene(s.id, (x) => ({ duration: Math.round(Math.max(1, x.voice!.delay + (x.voice!.to - x.voice!.from) + 0.4) * 10) / 10 }))}>
            Sahne süresini seslendirmeye uydur
          </Btn>
        )}
      </div>
    </div>
  );
};

const ScenesTab: React.FC = () => {
  const story = useStory()!;
  const starts = sceneStarts(story);
  const [kind, setKind] = useState<SceneKind>('custom');
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-neutral-400">
          {story.scenes.length} sahne · toplam {storyDuration(story).toFixed(1)} sn
        </span>
        <div className="ml-auto flex gap-1">
          <Select<SceneKind> value={kind} onChange={setKind} options={SCENE_KINDS.map((k) => ({ value: k.kind, label: k.label }))} />
          <Btn small variant="primary" onClick={() => upd((st) => ({ ...st, scenes: [...st.scenes, makeScene(kind)] }))} data-testid="add-scene">
            + Sahne
          </Btn>
        </div>
      </div>
      {story.scenes.map((s, i) => (
        <SceneCard key={s.id} s={s} i={i} start={starts[i]} n={story.scenes.length} />
      ))}
    </div>
  );
};

const ScriptTab: React.FC = () => {
  const story = useStory()!;
  const allAssets = useStore((s) => s.project.assets);
  const audios = useMemo(() => allAssets.filter((a) => a.kind === 'audio' && !a.src), [allAssets]);
  const urls = useStore((s) => s.assetUrls);
  const [sel, setSel] = useState('');
  const cur = audios.find((a) => a.id === sel) ?? audios[0];
  const aref = useRef<HTMLAudioElement>(null);
  React.useEffect(() => {
    players.voice = aref.current;
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const totalEst = estimateSpeech(story.script, story.wordsPerSecond);
  return (
    <div className="space-y-3">
      <Field label="Seslendirme metni (paragraflar = sahneler; boş satırla ayır)">
        <textarea
          value={story.script}
          onChange={(e) => upd((st) => ({ ...st, script: e.target.value }))}
          rows={7}
          className="w-full rounded border border-white/10 bg-[#121212] px-2 py-1 text-xs leading-relaxed"
          placeholder={'Bir gecede {totalWin} kazandı!\n\nPeki nasıl başladı?\n\n…'}
          data-testid="script"
        />
      </Field>
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-400">
        <span>
          {wordCount(story.script)} kelime · tahmini {totalEst.toFixed(1)} sn · video {storyDuration(story).toFixed(1)} sn
        </span>
        <span className="ml-auto">Konuşma hızı</span>
        <div className="w-16">
          <NumInput value={story.wordsPerSecond} step={0.1} digits={1} min={1} max={5} onChange={(v) => upd((st) => ({ ...st, wordsPerSecond: v }))} />
        </div>
        <span>kelime/sn</span>
      </div>
      <div className="flex flex-wrap gap-1">
        <Btn small variant="primary" onClick={() => upd(splitScriptToScenes)} data-testid="split-script">
          Metni sahnelere böl
        </Btn>
        <Btn small onClick={() => upd((st) => fitScenesToVoice(st, () => undefined))} data-testid="fit-scenes">
          Sahne sürelerini seslendirmeye / metne göre ayarla
        </Btn>
      </div>
      <div className="rounded bg-[#141414] p-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase text-neutral-400">Ses kaydın</span>
          <Btn small onClick={() => fileRef.current?.click()}>
            + Ses dosyası yükle
          </Btn>
          <input
            ref={fileRef}
            data-testid="story-upload-voice"
            type="file"
            accept="audio/*,.m4a,.mp3,.wav"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) {
                const a = await useStore.getState().addAssetFromFile(f);
                setSel(a.id);
              }
              e.target.value = '';
            }}
          />
        </div>
        {cur && urls[cur.id] ? (
          <>
            <Select value={cur.id} onChange={setSel} options={audios.map((a) => ({ value: a.id, label: `🎙 ${a.name}${a.duration ? ` (${a.duration.toFixed(1)} sn)` : ''}` }))} />
            <audio ref={aref} src={urls[cur.id]} controls className="mt-1 w-full" />
            <p className="mt-1 text-[10px] text-neutral-500">
              Her sahnede “Seslendirme” bölümünden bu kaydın hangi kısmının çalacağını seç (▼ = oynatıcıdaki an). Ya da kaydı tek parça olarak zaman çizelgesine ekle ve sürükleyerek kaydır.
            </p>
            <Btn
              small
              className="mt-1"
              onClick={() => {
                const st = useStore.getState();
                st.setFrame(0);
                st.addAssetLayer(cur.id);
                const l = st.project.layers[st.project.layers.length - 1];
                st.updateLayer(l.id, { channel: 'voice', name: `Seslendirme: ${cur.name}` });
              }}
            >
              Tek parça olarak zaman çizelgesine ekle
            </Btn>
          </>
        ) : (
          <>
          <p className="text-[11px] text-neutral-500">Kendi ses kaydını yükle (MP3, WAV, M4A). Yapay zekâ seslendirme şu an yok; ileride eklenebilecek şekilde hazırlandı.</p>
          <div className="rounded border border-white/10 p-2 text-[11px]" data-testid="voice-providers">
            <div className="mb-1 font-semibold text-neutral-300">Seslendirme kaynağı</div>
            {VOICE_PROVIDERS.map((vp) => (
              <label key={vp.id} className={`flex items-start gap-2 py-0.5 ${vp.available() ? 'text-neutral-200' : 'text-neutral-500'}`}>
                <input type="radio" name="voice-provider" disabled={!vp.available()} defaultChecked={vp.id === 'upload'} className="mt-0.5 accent-[#FF8E16]" />
                <span>
                  {vp.name}
                  <span className="block text-[10px] text-neutral-500">{vp.note}</span>
                </span>
              </label>
            ))}
          </div>
          </>
        )}
      </div>
    </div>
  );
};

const SubsTab: React.FC = () => {
  const story = useStory()!;
  const sub = useStore((s) => s.project.layers.find((l) => l.storyRole === 'subtitles'));
  const style: SubtitleStyle = sub?.subtitleStyle ?? defaultSubtitleStyle();
  const setStyle = (p: Partial<SubtitleStyle>) => sub && useStore.getState().updateLayer(sub.id, { subtitleStyle: { ...style, ...p } });
  const cues = story.subtitles.cues;
  const setCues = (fn: (c: typeof cues) => typeof cues) => upd((st) => ({ ...st, subtitles: { ...st.subtitles, cues: fn(st.subtitles.cues) } }));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Toggle value={story.subtitles.enabled} onChange={(v) => upd((st) => ({ ...st, subtitles: { ...st.subtitles, enabled: v } }))} label="Altyazılar açık" />
        <Select<'sentence' | 'word'>
          value={story.subtitles.mode}
          onChange={(v) => upd((st) => ({ ...st, subtitles: { ...st.subtitles, mode: v } }))}
          options={[
            { value: 'sentence', label: 'Cümle cümle' },
            { value: 'word', label: 'Kelime grupları (2–3 kelime)' },
          ]}
        />
        <Btn small variant="primary" onClick={() => upd((st) => ({ ...st, subtitles: { ...st.subtitles, cues: generateSubtitles(st, st.subtitles.mode) } }))} data-testid="gen-subs">
          Sahne metinlerinden oluştur
        </Btn>
      </div>
      <p className="text-[10px] text-neutral-500">Zamanlar metin uzunluğuna göre hesaplanır; konuşma tanıma yok. Gerekirse aşağıdan elle düzelt.</p>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Boyut">
          <NumInput value={style.fontSize} min={16} max={160} onChange={(v) => setStyle({ fontSize: v })} />
        </Field>
        <Field label="Yazı rengi">
          <ColorInput value={style.color} onChange={(v) => setStyle({ color: v })} />
        </Field>
        <Field label="Kontur rengi">
          <ColorInput value={style.strokeColor} onChange={(v) => setStyle({ strokeColor: v })} />
        </Field>
        <Field label="Kontur kalınlığı">
          <NumInput value={style.strokeWidth} min={0} max={30} onChange={(v) => setStyle({ strokeWidth: v })} />
        </Field>
        <Field label="Arka kutu">
          <Toggle value={style.box} onChange={(v) => setStyle({ box: v })} />
        </Field>
        <Field label="Hazır stil">
          <div className="flex gap-1">
            <Btn small onClick={() => setStyle({ color: '#FFFFFF', strokeColor: '#FF8E16', strokeWidth: 10 })}>Beyaz-turuncu</Btn>
            <Btn small onClick={() => setStyle({ color: '#FF8E16', strokeColor: '#FFFFFF', strokeWidth: 9 })}>Turuncu-beyaz</Btn>
          </div>
        </Field>
      </div>
      <div className="space-y-1" data-testid="cue-list">
        {cues.map((c) => (
          <div key={c.id} className="grid grid-cols-[56px_56px_1fr_16px] items-center gap-1">
            <NumInput value={c.start} step={0.05} digits={2} min={0} onChange={(v) => setCues((cs) => cs.map((x) => (x.id === c.id ? { ...x, start: v } : x)))} />
            <NumInput value={c.end} step={0.05} digits={2} min={0} onChange={(v) => setCues((cs) => cs.map((x) => (x.id === c.id ? { ...x, end: v } : x)))} />
            <input value={c.text} onChange={(e) => setCues((cs) => cs.map((x) => (x.id === c.id ? { ...x, text: e.target.value } : x)))} className="min-w-0 rounded bg-[#121212] px-1 py-0.5 text-[11px]" />
            <button className="text-[11px] text-neutral-500 hover:text-red-400" onClick={() => setCues((cs) => cs.filter((x) => x.id !== c.id))}>
              ✕
            </button>
          </div>
        ))}
        <Btn
          small
          onClick={() => {
            const t = useStore.getState().frame / useStore.getState().project.fps;
            setCues((cs) => [...cs, { id: uid(), text: 'Yeni altyazı', start: Math.round(t * 100) / 100, end: Math.round((t + 1.5) * 100) / 100 }].sort((a, b) => a.start - b.start));
          }}
        >
          + Oynatma çizgisine altyazı
        </Btn>
      </div>
    </div>
  );
};

const FrameTab: React.FC = () => {
  const story = useStory()!;
  const fr = useStore((s) => s.project.layers.find((l) => l.type === 'frame'));
  const setF = (p: Partial<NonNullable<Layer['frame']>>) => {
    if (!fr?.frame) return;
    useStore.getState().updateLayer(fr.id, { frame: { ...fr.frame, ...p } });
    upd((st) => st); // rebuild so the scene videos follow the window
  };
  return (
    <div className="space-y-3">
      <Toggle value={story.frameEnabled} onChange={(v) => upd((st) => ({ ...st, frameEnabled: v }))} label="Slotolog çerçevesi açık (kapalıyken oyun videosu tam ekran)" />
      {fr?.frame && (
        <div className="grid grid-cols-3 gap-2">
          <Toggle value={fr.frame.lights} onChange={(v) => setF({ lights: v })} label="Işıklar" />
          <Toggle value={fr.frame.fruits} onChange={(v) => setF({ fruits: v })} label="Meyveler" />
          <Toggle value={fr.frame.sevens} onChange={(v) => setF({ sevens: v })} label="777 sembolleri" />
          <Field label="Renk 1">
            <ColorInput value={fr.frame.colorA} onChange={(v) => setF({ colorA: v })} />
          </Field>
          <Field label="Renk 2">
            <ColorInput value={fr.frame.colorB} onChange={(v) => setF({ colorB: v })} />
          </Field>
          <Field label="Kalınlık">
            <NumInput value={fr.frame.thickness} min={6} max={80} onChange={(v) => setF({ thickness: v })} />
          </Field>
          <Field label="Pencere Y (merkez)">
            <NumInput value={fr.frame.window.y} onChange={(v) => setF({ window: { ...fr.frame!.window, y: v } })} />
          </Field>
          <Field label="Pencere genişlik">
            <NumInput value={fr.frame.window.w} onChange={(v) => setF({ window: { ...fr.frame!.window, w: v } })} />
          </Field>
          <Field label="Pencere yükseklik">
            <NumInput value={fr.frame.window.h} onChange={(v) => setF({ window: { ...fr.frame!.window, h: v } })} />
          </Field>
        </div>
      )}
      <div className="rounded bg-[#141414] p-2">
        <Toggle value={story.dramatization.enabled} onChange={(v) => upd((st) => ({ ...st, dramatization: { ...st.dramatization, enabled: v } }))} label="Canlandırma etiketi göster" />
        <p className="mt-1 text-[10px] text-neutral-500">Gerçek oyuncu sözü olmayan, kurgusal anlatımlı videolarda açık tut.</p>
        <div className="mt-1">
          <TextInput value={story.dramatization.text} onChange={(v) => upd((st) => ({ ...st, dramatization: { ...st.dramatization, text: v } }))} />
        </div>
      </div>
      <p className="text-[11px] text-neutral-500">Logo, kampanya yazıları, BONUSU AL butonu ve 18+ notu normal katmanlardır: önizlemede tıklayıp taşıyabilir, düzenleyebilir veya gizleyebilirsin.</p>
    </div>
  );
};

export const StoryStudio: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const story = useStory();
  const project = useStore((s) => s.project);
  const [tab, setTab] = useState<Tab>('scenes');
  const warnings = useMemo(() => storyWarnings(project), [project]);
  if (!story) return null;
  return (
    <Modal title="🎬 Büyük Kazanç Hikâyesi — Hikâye Stüdyosu" onClose={onClose} wide="xl">
      <div className="-m-4 flex max-h-[80vh] min-h-[60vh]" data-testid="story-studio">
        <div className="w-80 shrink-0 overflow-y-auto border-r border-white/10 p-3">
          <Recordings />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex gap-1 border-b border-white/10 px-3 pt-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                data-testid={`story-tab-${t.id}`}
                className={`rounded-t px-3 py-1.5 text-xs ${tab === t.id ? 'bg-[#FF8E16] font-bold text-black' : 'text-neutral-400 hover:text-white'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {warnings.length > 0 && (
            <details className="border-b border-white/10 bg-yellow-500/10 px-3 py-1.5 text-[11px] text-yellow-200" data-testid="story-warnings">
              <summary className="cursor-pointer">⚠ {warnings.length} uyarı</summary>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {warnings.map((w, i) => (
                  <li key={i} className={w.level === 'error' ? 'text-red-300' : ''}>
                    {w.text}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {tab === 'data' && <DataTab />}
            {tab === 'scenes' && <ScenesTab />}
            {tab === 'script' && <ScriptTab />}
            {tab === 'subs' && <SubsTab />}
            {tab === 'frame' && <FrameTab />}
          </div>
        </div>
      </div>
    </Modal>
  );
};
