import { createStore, del, get, keys, set } from 'idb-keyval';
import type { Asset, Project } from '../types';
import { uid } from './factory';

const projectStore = createStore('slotolog-projects', 'projects');
const assetStore = createStore('slotolog-assets', 'assets');
const templateStore = createStore('slotolog-templates', 'templates');

export interface ProjectSummary {
  id: string;
  name: string;
  aspect: Project['aspect'];
  updatedAt: number;
  layers: number;
  /** set for Telegram Emoji Studio projects */
  emoji?: Project['emoji'];
}

export async function saveProject(p: Project): Promise<void> {
  await set(p.id, p, projectStore);
  localStorage.setItem('slotolog:lastProject', p.id);
}

export async function loadProject(id: string): Promise<Project | undefined> {
  return get<Project>(id, projectStore);
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const ids = (await keys(projectStore)) as string[];
  const all = await Promise.all(ids.map((id) => get<Project>(id, projectStore)));
  return all
    .filter((p): p is Project => !!p)
    .map((p) => ({ id: p.id, name: p.name, aspect: p.aspect, updatedAt: p.updatedAt, layers: p.layers.length, emoji: p.emoji }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteProject(id: string): Promise<void> {
  const p = await loadProject(id);
  if (p) await Promise.all(p.assets.map((a) => del(a.id, assetStore)));
  await del(id, projectStore);
}

export const saveAssetBlob = (id: string, blob: Blob) => set(id, blob, assetStore);
export const getAssetBlob = (id: string) => get<Blob>(id, assetStore);

const blobToDataUrl = (b: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(b);
  });

interface ProjectFile {
  format: 'slotolog-motion-studio';
  version: 1;
  project: Project;
  assets: Record<string, string>;
}

/** Bundles the project and all its media into a single JSON file. */
export async function exportProjectFile(p: Project): Promise<Blob> {
  const assets: Record<string, string> = {};
  for (const a of p.assets) {
    const b = await getAssetBlob(a.id);
    if (b) assets[a.id] = await blobToDataUrl(b);
  }
  const data: ProjectFile = { format: 'slotolog-motion-studio', version: 1, project: p, assets };
  return new Blob([JSON.stringify(data)], { type: 'application/json' });
}

export async function importProjectFile(file: File): Promise<Project> {
  const data = JSON.parse(await file.text()) as ProjectFile;
  if (data.format !== 'slotolog-motion-studio') throw new Error('Bu dosya bir Slotolog projesi değil.');
  const project: Project = { ...data.project, id: uid(), updatedAt: Date.now() };
  // give assets fresh ids so that importing twice does not clash
  const idMap: Record<string, string> = {};
  const newAssets: Asset[] = [];
  for (const a of project.assets) {
    const nid = uid();
    idMap[a.id] = nid;
    newAssets.push({ ...a, id: nid });
    const url = data.assets[a.id];
    if (url) await saveAssetBlob(nid, await (await fetch(url)).blob());
  }
  project.assets = newAssets;
  project.layers = project.layers.map((l) => (l.assetId ? { ...l, assetId: idMap[l.assetId] ?? l.assetId } : l));
  await saveProject(project);
  return project;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export interface UserTemplate {
  id: string;
  name: string;
  createdAt: number;
  project: Project;
}

/**
 * Saves the project as a reusable template. Uploaded media (game recordings, voice files)
 * is NOT kept — each new video brings its own; built-in brand assets stay.
 */
export async function saveUserTemplate(p: Project, name: string): Promise<UserTemplate> {
  const keepAssets = p.assets.filter((a) => !!a.src);
  const keepIds = new Set(keepAssets.map((a) => a.id));
  const project: Project = {
    ...structuredClone(p),
    assets: keepAssets,
    layers: p.layers.filter((l) => !l.assetId || keepIds.has(l.assetId)).map((l) => structuredClone(l)),
  };
  if (project.story) {
    project.story = {
      ...project.story,
      // amounts belong to one specific game session: the next video must enter its own
      fields: { ...project.story.fields, gameName: '', betAmount: '', freeSpinValue: '', totalWin: '' },
      markers: [],
      scenes: project.story.scenes.map((s) => ({ ...s, markerId: undefined, clip: { ...s.clip, assetId: undefined, in: 0, out: 0 }, voice: undefined })),
    };
  }
  const t: UserTemplate = { id: uid(), name, createdAt: Date.now(), project };
  await set(t.id, t, templateStore);
  return t;
}

export async function listUserTemplates(): Promise<UserTemplate[]> {
  const ids = (await keys(templateStore)) as string[];
  const all = await Promise.all(ids.map((id) => get<UserTemplate>(id, templateStore)));
  return all.filter((x): x is UserTemplate => !!x).sort((a, b) => b.createdAt - a.createdAt);
}

export const deleteUserTemplate = (id: string) => del(id, templateStore);

/**
 * Saves a format copy (Toplu Reklam Formatı Oluşturucu) as an independent project: media files are copied
 * under new ids, so deleting either project never affects the other. An earlier copy of the same source
 * and format is replaced (no duplicate test copies); the source project is never changed.
 */
export async function saveFormatVariant(source: Project, variant: Project): Promise<Project> {
  const aspect = variant.aspect;
  const all = await listProjects();
  let existing: Project | undefined;
  for (const s of all) {
    const q = await loadProject(s.id);
    if (q?.variantOf?.sourceId === source.id && q.variantOf.aspect === aspect) {
      existing = q;
      break;
    }
  }
  const idMap: Record<string, string> = {};
  for (const a of variant.assets) {
    if (a.src) continue;
    const nid = uid();
    idMap[a.id] = nid;
    const b = await getAssetBlob(a.id);
    if (b) await saveAssetBlob(nid, b);
  }
  let json = JSON.stringify(variant);
  for (const [o, n] of Object.entries(idMap)) json = json.split(`"${o}"`).join(`"${n}"`);
  const out: Project = { ...(JSON.parse(json) as Project), id: existing?.id ?? uid(), updatedAt: Date.now(), variantOf: { sourceId: source.id, aspect } };
  if (existing) await Promise.all(existing.assets.filter((a) => !a.src).map((a) => del(a.id, assetStore)));
  await set(out.id, out, projectStore);
  return out;
}

/** object URLs for a stored project's media (for rendering it without opening it in the editor) */
export async function assetUrlsFor(p: Project, brandUrl: (src: string) => string): Promise<Record<string, string>> {
  const urls: Record<string, string> = {};
  for (const a of p.assets) {
    if (a.src) urls[a.id] = brandUrl(a.src);
    else {
      const b = await getAssetBlob(a.id);
      if (b) urls[a.id] = URL.createObjectURL(b);
    }
  }
  return urls;
}

/** media of a stored project whose file is not in the browser any more (reported, never replaced) */
export async function missingAssets(p: Project): Promise<Asset[]> {
  const out: Asset[] = [];
  for (const a of p.assets) if (!a.src && !(await getAssetBlob(a.id))) out.push(a);
  return out;
}
