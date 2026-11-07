import { create } from 'zustand';
import { baseLayer, makeEffect, uid } from './lib/factory';
import { propAt } from './lib/anim';
import { getAssetBlob, saveAssetBlob, saveProject } from './lib/storage';
import { multiplierTemplate } from './lib/templates';
import type { AnimProp, Asset, AssetKind, Aspect, Effect, EffectType, Layer, Project } from './types';
import { ASPECT_SIZES } from './types';

type Updater = (p: Project) => Project;

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

  const commit = (fn: Updater, record = true) => {
    const { project, past } = get();
    const next = { ...fn(project), updatedAt: Date.now() };
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

    loadIntoEditor: async (p) => {
      Object.values(get().assetUrls).forEach((u) => URL.revokeObjectURL(u));
      const urls: Record<string, string> = {};
      for (const a of p.assets) {
        const b = await getAssetBlob(a.id);
        if (b) urls[a.id] = URL.createObjectURL(b);
      }
      set({ project: p, assetUrls: urls, selectedId: null, past: [], future: [], frame: 0 });
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
    updateLayer: (id, patch, record = true) => commit((p) => mapLayer(p, id, (l) => ({ ...l, ...patch })), record),
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
      return asset;
    },
    addAssetLayer: (assetId, at) => {
      const { project, frame } = get();
      const a = project.assets.find((x) => x.id === assetId);
      if (!a) return;
      const { width: W, height: H } = ASPECT_SIZES[project.aspect];
      const aw = a.width ?? 500;
      const ah = a.height ?? 500;
      const fit = Math.min((W * 0.7) / aw, (H * 0.7) / ah, a.kind === 'image' ? 1.5 : 10);
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
          return { ...l, type: a.kind, assetId, width, height, name: a.name, objectFit: l.objectFit ?? (a.kind === 'video' ? 'cover' : 'contain') };
        }),
      );
    },
    removeAsset: (assetId) =>
      commit((p) => ({ ...p, assets: p.assets.filter((a) => a.id !== assetId), layers: p.layers.filter((l) => l.assetId !== assetId) })),

    setAspect: (aspect) =>
      commit((p) => {
        if (p.aspect === aspect) return p;
        const from = ASPECT_SIZES[p.aspect];
        const to = ASPECT_SIZES[aspect];
        const sx = to.width / from.width;
        const sy = to.height / from.height;
        const s = Math.min(sx, sy);
        return {
          ...p,
          aspect,
          layers: p.layers.map((l) => {
            const full = l.type === 'background' || l.type === 'particles';
            const scaleKf = (prop: 'x' | 'y', f: number) => l.keyframes[prop]?.map((k) => ({ ...k, value: k.value * f }));
            return {
              ...l,
              x: l.x * sx,
              y: l.y * sy,
              width: full ? to.width : Math.round(l.width * s),
              height: full ? to.height : Math.round(l.height * s),
              text: l.text ? { ...l.text, fontSize: Math.round(l.text.fontSize * s) } : l.text,
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
