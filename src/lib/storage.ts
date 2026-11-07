import { createStore, del, get, keys, set } from 'idb-keyval';
import type { Asset, Project } from '../types';
import { uid } from './factory';

const projectStore = createStore('slotolog-projects', 'projects');
const assetStore = createStore('slotolog-assets', 'assets');

export interface ProjectSummary {
  id: string;
  name: string;
  aspect: Project['aspect'];
  updatedAt: number;
  layers: number;
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
    .map((p) => ({ id: p.id, name: p.name, aspect: p.aspect, updatedAt: p.updatedAt, layers: p.layers.length }))
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
