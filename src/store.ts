import { create } from 'zustand';
import { baseLayer, makeEffect, uid } from './lib/factory';
import { propAt } from './lib/anim';
import { getAssetBlob, saveAssetBlob, saveProject } from './lib/storage';
import { multiplierTemplate } from './lib/templates';
import type { LibraryItem } from './lib/library';
import { BRAND_ASSETS, brandUrl, type BrandKey } from './lib/brand';
import type { AnimProp, Asset, AssetKind, Aspect, Effect, EffectType, Layer, Project, ProjectAudio, SfxKey, SpeedRamp, StoryData } from './types';
import { captureOverrides, rebuildStory, sceneStarts } from './lib/story';
import { seek } from './lib/player';
import { analyzeAudio, measurePeak, normalizeGain } from './lib/beats';
import { projectAudio } from './lib/music';
import { SFX } from './lib/sfx';
import { LOOPING_EFFECTS } from './lib/anim';
import { rampPatch } from './lib/speedramp';
import { ASPECT_SIZES, projectSize } from './types';

type Updater = (p: Project) => Project;
export type LayoutKind = '2+3' | '3+2' | '2x2' | '1x3';
export const LAYOUTS: { id: LayoutKind; label: string; rows: number[] }[] = [
  { id: '2+3', label: '2 üstte · 3 altta', rows: [2, 3] },
  { id: '3+2', label: '3 üstte · 2 altta', rows: [3, 2] },
  { id: '2x2', label: '2 × 2', rows: [2, 2] },
  { id: '1x3', label: 'Yan yana 3', rows: [3] },
];

interface State {
  project: Project;
  selectedId: string | null;
  frame: number;
  playing: boolean;
  assetUrls: Record<string, string>;
  past: Project[];
  future: Project[];
  saveState: 'saved' | 'saving' | 'unsaved' | 'error';

  loadIntoEditor: (p: Project) => Promise<void>;
  update: (fn: Updater, record?: boolean) => void;
  checkpoint: () => void;
  undo: () => void;
  redo: () => void;
  select: (id: string | null) => void;
  setFrame: (f: number) => void;
  setPlaying: (p: boolean) => void;

  addLayer: (l: Layer) => void;
  updateLayer: (id: string, patch: Partial<Layer>, record?: boolean) => void;
  setLayerProp: (id: string, prop: AnimProp, value: number, record?: boolean) => void;
  toggleKeyframe: (id: string, prop: AnimProp) => void;
  removeLayer: (id: string) => void;
  duplicateLayer: (id: string) => void;
  reorderLayer: (id: string, delta: number) => void;

  addEffect: (layerId: string, type: EffectType) => void;
  updateEffect: (layerId: string, effectId: string, patch: Partial<Effect>, record?: boolean) => void;
  removeEffect: (layerId: string, effectId: string) => void;

  addAssetFromFile: (file: File) => Promise<Asset>;
  addAssetLayer: (assetId: string, at?: { x: number; y: number }) => void;
  addBrandAsset: (key: BrandKey) => string;
  /** copies a Varlık Kütüphanesi item into the project (once) and returns its asset id */
  addLibraryAsset: (item: LibraryItem) => string;
  addSfxLayer: (key: SfxKey) => void;
  analyzing: string[];
  analyzeAsset: (assetId: string) => Promise<void>;
  setAudio: (patch: Partial<ProjectAudio>) => void;
  /** change the story data and regenerate the scene layers */
  updateStory: (fn: (s: StoryData) => StoryData, record?: boolean) => void;
  /** Story Studio workspace (scenes | preview | settings) */
  storyMode: boolean;
  selectedSceneId: string | null;
  setStoryMode: (on: boolean) => void;
  /** select a scene and move the preview to its start */
  selectScene: (id: string) => void;
  /** forget the user's edits of story layers whose slot starts with prefix (scene id, or scene:part) */
  resetOverrides: (prefix: string) => void;
  setSpeedRamp: (layerId: string, ramp: SpeedRamp | undefined, record?: boolean) => void;
  fitProjectToVideo: (layerId: string) => void;
  fitGameToFrame: (layerId?: string) => void;
  addVoiceFile: (file: File) => Promise<Asset>;
  normalizeLayer: (layerId: string, targetDb?: number) => Promise<number | null>;
  setBeatGrid: (assetId: string, grid: { bpm: number; firstBeat: number; beatsPerBar?: number }) => void;
  arrangeLayout: (layerId: string, layout: LayoutKind) => void;
  applyAssetToLayer: (layerId: string, assetId: string) => void;
  removeAsset: (assetId: string) => void;

  setAspect: (a: Aspect) => void;
  setDuration: (frames: number) => void;
  rename: (name: string) => void;
}

const HISTORY_LIMIT = 80;

const mapLayer = (p: Project, id: string, fn: (l: Layer) => Layer): Project => ({
  ...p,
  layers: p.layers.map((l) => (l.id === id ? fn(l) : l)),
});

function kindOf(file: File): AssetKind | null {
  if (file.type.startsWith('image/') || /\.(png|jpe?g|svg|webp|gif)$/i.test(file.name)) return 'image';
  if (file.type.startsWith('video/') || /\.(mp4|mov|webm|m4v)$/i.test(file.name)) return 'video';
  if (file.type.startsWith('audio/') || /\.(mp3|wav|m4a|aac|ogg)$/i.test(file.name)) return 'audio';
  return null;
}

function readMeta(url: string, kind: AssetKind): Promise<Partial<Asset>> {
  return new Promise((resolve) => {
    if (kind === 'image') {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth || 500, height: img.naturalHeight || 500 });
      img.onerror = () => resolve({ width: 500, height: 500 });
      img.src = url;
      return;
    }
    const el = document.createElement(kind === 'video' ? 'video' : 'audio');
    el.preload = 'metadata';
    el.onloadedmetadata = () =>
      resolve({
        duration: Number.isFinite(el.duration) ? el.duration : undefined,
        width: (el as HTMLVideoElement).videoWidth || undefined,
        height: (el as HTMLVideoElement).videoHeight || undefined,
      });
    el.onerror = () => resolve({});
    el.src = url;
  });
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export const useStore = create<State>((set, get) => {
  const scheduleSave = () => {
    set({ saveState: 'unsaved' });
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      set({ saveState: 'saving' });
      try {
        await saveProject(get().project);
        set({ saveState: 'saved' });
      } catch (e) {
        console.error(e);
        set({ saveState: 'error' });
      }
    }, 700);
  };

  const commit = (fn: Updater, record = true, opts: { rebuild?: boolean } = {}) => {
    const { project, past } = get();
    let next = { ...fn(project), updatedAt: Date.now() };
    // edits of story-generated layers are remembered per scene, so rebuilds keep them
    if (next.story && !opts.rebuild) next = captureOverrides(project, next);
    set({
      project: next,
      past: record ? [...past, project].slice(-HISTORY_LIMIT) : past,
      future: record ? [] : get().future,
    });
    scheduleSave();
  };

  return {
    project: multiplierTemplate(),
    selectedId: null,
    frame: 0,
    playing: false,
    assetUrls: {},
    past: [],
    future: [],
    saveState: 'saved',
    analyzing: [],

    loadIntoEditor: async (p) => {
      Object.values(get().assetUrls).forEach((u) => URL.revokeObjectURL(u));
      const urls: Record<string, string> = {};
      for (const a of p.assets) {
        if (a.src) {
          urls[a.id] = brandUrl(a.src);
          continue;
        }
        const b = await getAssetBlob(a.id);
        if (b) urls[a.id] = URL.createObjectURL(b);
      }
      set({ project: p, assetUrls: urls, selectedId: null, past: [], future: [], frame: 0, selectedSceneId: null, storyMode: p.story ? get().storyMode : false });
      await saveProject(p);
      set({ saveState: 'saved' });
    },

    update: commit,
    checkpoint: () => set({ past: [...get().past, get().project].slice(-HISTORY_LIMIT), future: [] }),
    undo: () => {
      const { past, project, future } = get();
      if (!past.length) return;
      set({ project: past[past.length - 1], past: past.slice(0, -1), future: [project, ...future] });
      scheduleSave();
    },
    redo: () => {
      const { past, project, future } = get();
      if (!future.length) return;
      set({ project: future[0], future: future.slice(1), past: [...past, project] });
      scheduleSave();
    },
    select: (id) => set({ selectedId: id }),
    setFrame: (f) => set({ frame: f }),
    setPlaying: (p) => set({ playing: p }),

    addLayer: (l) => {
      commit((p) => ({ ...p, layers: [...p.layers, l] }));
      set({ selectedId: l.id });
    },
    updateLayer: (id, patch, record = true) => {
      const p0 = get().project;
      const l0 = p0.layers.find((x) => x.id === id);
      const voiceEdit =
        !!l0 && !!p0.story && l0.storyRole === 'scene' && l0.type === 'audio' && !!l0.storySceneId && ('start' in patch || 'duration' in patch || 'trimStart' in patch);
      commit(
        (p) => {
          const l = p.layers.find((x) => x.id === id);
          // story voice-over: moving / trimming it on the timeline updates the scene, then layers are rebuilt
          if (voiceEdit && l && p.story) {
            const scenes = p.story.scenes;
            const idx = scenes.findIndex((s) => s.id === l.storySceneId);
            const sc = scenes[idx];
            if (sc?.voice) {
              const starts = sceneStarts(p.story);
              const nl = { ...l, ...patch };
              const from = nl.trimStart ?? sc.voice.from;
              const voice = { ...sc.voice, from, to: from + nl.duration / p.fps, delay: Math.max(0, nl.start / p.fps - starts[idx]) };
              return rebuildStory({ ...p, story: { ...p.story, scenes: scenes.map((s) => (s.id === sc.id ? { ...s, voice } : s)) } });
            }
          }
          return mapLayer(p, id, (x) => ({ ...x, ...patch }));
        },
        record,
        { rebuild: voiceEdit },
      );
    },
    setLayerProp: (id, prop, value, record = true) =>
      commit(
        (p) =>
          mapLayer(p, id, (l) => {
            const kfs = l.keyframes[prop];
            if (!kfs || kfs.length === 0) return { ...l, [prop]: value };
            const local = Math.round(get().frame - l.start);
            const others = kfs.filter((k) => k.frame !== local);
            const existing = kfs.find((k) => k.frame === local);
            const nk = [...others, { frame: local, value, easing: existing?.easing ?? 'easeInOut' }].sort((a, b) => a.frame - b.frame);
            return { ...l, keyframes: { ...l.keyframes, [prop]: nk } };
          }),
        record,
      ),
    toggleKeyframe: (id, prop) =>
      commit((p) =>
        mapLayer(p, id, (l) => {
          const local = Math.round(get().frame - l.start);
          const kfs = l.keyframes[prop] ?? [];
          if (kfs.some((k) => k.frame === local)) {
            const rest = kfs.filter((k) => k.frame !== local);
            // keep the value the animation had at this frame as the static value
            const base = rest.length === 0 ? propAt(l, prop, local) : l[prop];
            return { ...l, [prop]: base, keyframes: { ...l.keyframes, [prop]: rest } };
          }
          const value = propAt(l, prop, local);
          return {
            ...l,
            keyframes: { ...l.keyframes, [prop]: [...kfs, { frame: local, value, easing: 'easeInOut' as const }].sort((a, b) => a.frame - b.frame) },
          };
        }),
      ),
    removeLayer: (id) => {
      // story-generated layers would come back on the next rebuild: hide them instead (kept as an edit)
      if (get().project.layers.find((l) => l.id === id)?.storySlot) {
        get().updateLayer(id, { visible: false });
        return;
      }
      commit((p) => ({ ...p, layers: p.layers.filter((l) => l.id !== id) }));
      if (get().selectedId === id) set({ selectedId: null });
    },
    duplicateLayer: (id) => {
      const l = get().project.layers.find((x) => x.id === id);
      if (!l) return;
      const copy: Layer = {
        ...structuredClone(l),
        id: uid(),
        name: `${l.name} kopya`,
        x: l.x + 40,
        y: l.y + 40,
        effects: l.effects.map((e) => ({ ...e, id: uid() })),
      };
      commit((p) => {
        const idx = p.layers.findIndex((x) => x.id === id);
        const layers = [...p.layers];
        layers.splice(idx + 1, 0, copy);
        return { ...p, layers };
      });
      set({ selectedId: copy.id });
    },
    reorderLayer: (id, delta) =>
      commit((p) => {
        const idx = p.layers.findIndex((l) => l.id === id);
        const to = Math.max(0, Math.min(p.layers.length - 1, idx + delta));
        if (idx < 0 || to === idx) return p;
        const layers = [...p.layers];
        const [l] = layers.splice(idx, 1);
        layers.splice(to, 0, l);
        return { ...p, layers };
      }),

    addEffect: (layerId, type) => {
      const { project, frame } = get();
      const l = project.layers.find((x) => x.id === layerId);
      if (!l) return;
      const local = Math.max(0, Math.min(l.duration - 1, frame - l.start));
      const e = makeEffect(type, project.fps, { start: local });
      e.duration = Math.min(e.duration, Math.max(1, l.duration - local));
      commit((p) => mapLayer(p, layerId, (x) => ({ ...x, effects: [...x.effects, e] })));
    },
    updateEffect: (layerId, effectId, patch, record = true) =>
      commit((p) => mapLayer(p, layerId, (l) => ({ ...l, effects: l.effects.map((e) => (e.id === effectId ? { ...e, ...patch } : e)) })), record),
    removeEffect: (layerId, effectId) =>
      commit((p) => mapLayer(p, layerId, (l) => ({ ...l, effects: l.effects.filter((e) => e.id !== effectId) }))),

    addAssetFromFile: async (file) => {
      const kind = kindOf(file);
      if (!kind) throw new Error(`Desteklenmeyen dosya türü: ${file.name}`);
      const id = uid();
      await saveAssetBlob(id, file);
      const url = URL.createObjectURL(file);
      const meta = await readMeta(url, kind);
      const asset: Asset = { id, name: file.name, kind, mime: file.type, ...meta };
      set({ assetUrls: { ...get().assetUrls, [id]: url } });
      commit((p) => ({ ...p, assets: [...p.assets, asset] }));
      // music: detect tempo and beats in the background
      if (kind === 'audio') void get().analyzeAsset(id);
      return asset;
    },
    addBrandAsset: (key) => {
      const a = BRAND_ASSETS[key];
      set({ assetUrls: { ...get().assetUrls, [a.id]: brandUrl(a.src) } });
      if (!get().project.assets.some((x) => x.id === a.id)) commit((p) => ({ ...p, assets: [...p.assets, { ...a }] }));
      return a.id;
    },
    addLibraryAsset: (item) => {
      const have = get().project.assets.find((a) => a.libId === item.id);
      if (have) return have.id;
      const id = uid();
      void saveAssetBlob(id, item.blob);
      set({ assetUrls: { ...get().assetUrls, [id]: URL.createObjectURL(item.blob) } });
      const asset: Asset = { id, name: item.name, kind: 'image', mime: item.mime, width: item.width, height: item.height, libId: item.id };
      commit((p) => ({ ...p, assets: [...p.assets, asset] }));
      return id;
    },
    analyzeAsset: async (assetId) => {
      const url = get().assetUrls[assetId];
      if (!url || get().analyzing.includes(assetId)) return;
      set({ analyzing: [...get().analyzing, assetId] });
      try {
        const blob = await (await fetch(url)).blob();
        const analysis = await analyzeAudio(blob);
        commit((p) => ({ ...p, assets: p.assets.map((a) => (a.id === assetId ? { ...a, analysis } : a)) }), false);
      } catch (e) {
        console.warn('Ritim analizi başarısız', e);
      } finally {
        set({ analyzing: get().analyzing.filter((x) => x !== assetId) });
      }
    },
    setBeatGrid: (assetId, { bpm, firstBeat, beatsPerBar = 4 }) =>
      commit((p) => ({
        ...p,
        assets: p.assets.map((a) => {
          if (a.id !== assetId) return a;
          const duration = a.analysis?.duration ?? a.duration ?? 600;
          const period = 60 / Math.max(20, Math.min(300, bpm));
          const beats: number[] = [];
          const strengths: number[] = [];
          // grid from the first beat; earlier beats too, if the first beat is not at 0
          let t = firstBeat - Math.floor(firstBeat / period) * period;
          let i = -Math.floor(firstBeat / period);
          for (; t < duration; t += period, i++) {
            beats.push(Math.round(t * 1000) / 1000);
            const pos = ((i % beatsPerBar) + beatsPerBar) % beatsPerBar;
            strengths.push(pos === 0 ? 1 : pos === beatsPerBar / 2 ? 0.7 : 0.5);
          }
          return { ...a, analysis: { bpm: Math.round(bpm * 100) / 100, beats, strengths, duration, manual: true, firstBeat, beatsPerBar, peak: a.analysis?.peak } };
        }),
      })),
    normalizeLayer: async (layerId, targetDb = -1.5) => {
      const l = get().project.layers.find((x) => x.id === layerId);
      const url = l?.assetId ? get().assetUrls[l.assetId] : undefined;
      if (!l || !url) return null;
      let peak = get().project.assets.find((a) => a.id === l.assetId)?.analysis?.peak;
      if (!peak) {
        peak = await measurePeak(await (await fetch(url)).blob());
        commit((p) => ({ ...p, assets: p.assets.map((a) => (a.id === l.assetId && a.analysis ? { ...a, analysis: { ...a.analysis, peak } } : a)) }), false);
      }
      const gain = Math.round(normalizeGain(peak, targetDb) * 100) / 100;
      get().updateLayer(layerId, { volume: gain });
      return gain;
    },
    updateStory: (fn, record = true) =>
      commit((p) => (p.story ? rebuildStory({ ...p, story: fn(p.story) }) : p), record, { rebuild: true }),
    storyMode: false,
    selectedSceneId: null,
    setStoryMode: (on) => set({ storyMode: on }),
    selectScene: (id) => {
      const p = get().project;
      if (!p.story) return;
      const i = p.story.scenes.findIndex((s) => s.id === id);
      if (i < 0) return;
      const frame = Math.min(p.durationInFrames - 1, Math.round(sceneStarts(p.story)[i] * p.fps) + 1);
      set({ selectedSceneId: id, frame });
      seek(frame);
    },
    setSpeedRamp: (layerId, ramp, record = true) => {
      const l = get().project.layers.find((x) => x.id === layerId);
      if (l) get().updateLayer(layerId, rampPatch(l, ramp, get().project.fps), record);
    },
    fitGameToFrame: (layerId) =>
      commit((p) => {
        const fr = p.layers.find((l) => l.type === 'frame' && l.frame);
        const g = p.layers.find((l) => (layerId ? l.id === layerId : l.gameSlot));
        if (!fr?.frame || !g) return p;
        const area = fr.frame.area ?? fr.frame.window;
        const a = p.assets.find((x) => x.id === g.assetId);
        const c = g.mediaCrop ?? { top: 0, bottom: 0, left: 0, right: 0 };
        // ratio of what is visible from the source (after crop); a placeholder keeps the full area
        const r = a?.width && a.height ? (a.width * (1 - c.left - c.right)) / (a.height * (1 - c.top - c.bottom)) : area.w / area.h;
        let w = area.w;
        let h = Math.round(w / r);
        if (h > area.h) {
          h = area.h;
          w = Math.round(h * r);
        }
        const win = { x: area.x, y: area.y, w, h };
        return {
          ...p,
          layers: p.layers.map((l) =>
            l.id === fr.id ? { ...l, frame: { ...l.frame!, window: win } } : l.id === g.id ? { ...l, x: win.x, y: win.y, width: w, height: h, objectFit: 'cover' as const } : l,
          ),
        };
      }),
    fitProjectToVideo: (layerId) =>
      commit((p) => {
        const l = p.layers.find((x) => x.id === layerId);
        const a = p.assets.find((x) => x.id === l?.assetId);
        if (!l || !a?.width || !a.height) return p;
        const k = Math.min(1, 1920 / Math.max(a.width, a.height));
        const even = (v: number) => Math.max(2, Math.round((v * k) / 2) * 2);
        const size = { width: even(a.width), height: even(a.height) };
        return {
          ...p,
          size,
          layers: p.layers.map((x) => (x.id === layerId ? { ...x, x: size.width / 2, y: size.height / 2, width: size.width, height: size.height, objectFit: 'cover' as const, keyframes: { ...x.keyframes, x: [], y: [], scale: [] }, scale: 1, rotation: 0 } : x)),
        };
      }),
    resetOverrides: (prefix) =>
      get().updateStory((st) => ({
        ...st,
        layerOverrides: Object.fromEntries(Object.entries(st.layerOverrides ?? {}).filter(([k]) => !k.startsWith(prefix))),
      })),
    addVoiceFile: async (file) => {
      const a = await get().addAssetFromFile(file);
      return a;
    },
    setAudio: (patch) => commit((p) => ({ ...p, audio: { ...projectAudio(p), ...patch } })),
    addSfxLayer: (key) => {
      const { project, frame } = get();
      const id = `sfx-${key}`;
      const meta = SFX[key];
      if (!project.assets.some((a) => a.id === id)) {
        commit((p) => ({ ...p, assets: [...p.assets, { id, name: meta.name, kind: 'audio', mime: 'audio/wav', src: meta.src, duration: meta.duration }] }));
        set({ assetUrls: { ...get().assetUrls, [id]: brandUrl(meta.src) } });
      }
      const start = Math.min(frame, project.durationInFrames - 1);
      get().addLayer(
        baseLayer(
          { type: 'audio', name: `Ses: ${meta.name}`, assetId: id, start, duration: Math.ceil(meta.duration * project.fps) + 2, channel: 'sfx', volume: 0.8 },
          project,
        ),
      );
    },
    arrangeLayout: (layerId, layout) => {
      const { project } = get();
      const l = project.layers.find((x) => x.id === layerId);
      const def = LAYOUTS.find((x) => x.id === layout);
      if (!l || !def) return;
      const { width: W } = projectSize(project);
      const ratio = l.height / l.width;
      const maxPerRow = Math.max(...def.rows);
      const w = Math.min(l.width, (W * 0.94) / maxPerRow - 16);
      const h = w * ratio;
      const gapY = h * 0.08;
      const totalH = def.rows.length * h + (def.rows.length - 1) * gapY;
      const placed: { x: number; y: number; w: number; h: number }[] = [];
      def.rows.forEach((n, r) => {
        // rows with fewer items use slightly bigger objects, like 2 over 3
        const rw = n < maxPerRow ? Math.min(w * 1.15, (W * 0.94) / n - 16) : w;
        const rh = rw * ratio;
        const y = l.y - totalH / 2 + r * (h + gapY) + h / 2;
        const span = W * 0.94;
        for (let i = 0; i < n; i++) placed.push({ x: W / 2 - span / 2 + (span / n) * (i + 0.5), y, w: rw, h: rh });
      });
      const copies: Layer[] = placed.map((pl, i) => ({
        ...structuredClone(l),
        id: i === 0 ? l.id : uid(),
        name: `${l.name.replace(/ \d+$/, '')} ${i + 1}`,
        x: Math.round(pl.x),
        y: Math.round(pl.y),
        width: Math.round(pl.w),
        height: Math.round(pl.h),
        keyframes: { ...l.keyframes, x: undefined, y: undefined },
        // independent timing so the copies do not move in sync
        effects: l.effects.map((e) => ({
          ...e,
          id: i === 0 ? e.id : uid(),
          phase: LOOPING_EFFECTS.includes(e.type) ? Math.round(((e.phase ?? 0) + i * 0.73) * 100) / 100 : e.phase,
          speed: LOOPING_EFFECTS.includes(e.type) ? Math.round(e.speed * (1 + ((i % 3) - 1) * 0.08) * 100) / 100 : e.speed,
        })),
      }));
      commit((p) => {
        const idx = p.layers.findIndex((x) => x.id === layerId);
        const layers = [...p.layers];
        layers.splice(idx, 1, ...copies);
        return { ...p, layers };
      });
    },
    addAssetLayer: (assetId, at) => {
      const { project, frame } = get();
      const a = project.assets.find((x) => x.id === assetId);
      if (!a) return;
      const { width: W, height: H } = projectSize(project);
      const aw = a.width ?? 500;
      const ah = a.height ?? 500;
      const box = a.libId ? 0.4 : 0.7; // library icons start as a smaller sticker
      const fit = Math.min((W * box) / aw, (H * box) / ah, a.kind === 'image' && !a.src ? 1.5 : 10);
      const start = a.kind === 'image' ? 0 : Math.min(frame, project.durationInFrames - 1);
      const mediaFrames = a.duration ? Math.ceil(a.duration * project.fps) : project.durationInFrames;
      const l = baseLayer(
        {
          type: a.kind,
          name: a.name,
          assetId,
          width: Math.round(aw * fit),
          height: Math.round(ah * fit),
          x: at?.x ?? W / 2,
          y: at?.y ?? H / 2,
          start,
          duration: a.kind === 'image' ? project.durationInFrames : Math.max(1, Math.min(mediaFrames, project.durationInFrames - start)),
          objectFit: a.kind === 'video' ? 'cover' : 'contain',
          volume: 1,
          muted: false,
          ...(a.kind === 'audio' ? { channel: 'music' as const, fadeIn: 0, fadeOut: 0, trimStart: 0 } : {}),
        },
        project,
      );
      get().addLayer(l);
    },
    applyAssetToLayer: (layerId, assetId) => {
      const a = get().project.assets.find((x) => x.id === assetId);
      if (!a) return;
      commit((p) =>
        mapLayer(p, layerId, (l) => {
          if (a.kind === 'audio') return l;
          let { width, height } = l;
          if (a.width && a.height && l.type !== 'placeholder') {
            // keep the box area, adopt the media's aspect ratio
            const r = a.width / a.height;
            const area = l.width * l.height;
            width = Math.round(Math.sqrt(area * r));
            height = Math.round(width / r);
          }
          const loop = a.kind === 'video' && !!a.duration && a.duration * p.fps < l.duration;
          return { ...l, type: a.kind, assetId, width, height, name: l.gameSlot ? `Oyun videosu: ${a.name}` : a.name, loop, objectFit: l.objectFit ?? (a.kind === 'video' ? 'cover' : 'contain') };
        }),
      );
      // game slot of a frame template: size the frame window to the new video and centre it
      if (get().project.layers.find((l) => l.id === layerId)?.gameSlot) get().fitGameToFrame(layerId);
    },
    removeAsset: (assetId) =>
      commit((p) => ({ ...p, assets: p.assets.filter((a) => a.id !== assetId), layers: p.layers.filter((l) => l.assetId !== assetId) })),

    setAspect: (aspect) =>
      commit((p) => {
        if (p.aspect === aspect && !p.size) return p;
        const from = projectSize(p);
        const to = ASPECT_SIZES[aspect];
        const sx = to.width / from.width;
        const sy = to.height / from.height;
        const s = Math.min(sx, sy);
        return {
          ...p,
          aspect,
          size: undefined,
          layers: p.layers.map((l) => {
            const full = l.type === 'background' || l.type === 'particles';
            const scaleKf = (prop: 'x' | 'y', f: number) => l.keyframes[prop]?.map((k) => ({ ...k, value: k.value * f }));
            return {
              ...l,
              x: l.x * sx,
              y: l.y * sy,
              width: full ? to.width : Math.round(l.width * s),
              height: full ? to.height : Math.round(l.height * s),
              text: l.text ? { ...l.text, fontSize: Math.round(l.text.fontSize * s), strokeWidth: Math.round(l.text.strokeWidth * s) } : l.text,
              button: l.button ? { ...l.button, fontSize: Math.round(l.button.fontSize * s) } : l.button,
              keyframes: { ...l.keyframes, x: scaleKf('x', sx), y: scaleKf('y', sy) },
            };
          }),
        };
      }),
    setDuration: (frames) => commit((p) => ({ ...p, durationInFrames: Math.max(15, Math.round(frames)) })),
    rename: (name) => commit((p) => ({ ...p, name })),
  };
});

export const useSelectedLayer = () => useStore((s) => s.project.layers.find((l) => l.id === s.selectedId) ?? null);
