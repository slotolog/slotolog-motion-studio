import { createStore, del, get, keys, set } from 'idb-keyval';
import { unzipSync } from 'fflate';
import { uid } from './factory';

/**
 * Varlık Kütüphanesi — görseller tarayıcıda (IndexedDB) kalıcı olarak saklanır ve tüm projelerde
 * kullanılabilir. Bir projeye eklenen öğe projeye kopyalanır, böylece .slotolog.json dışa aktarımı
 * ve eski projeler aynen çalışır. Dosyalar sunucuya / repoya gönderilmez.
 */
export interface LibraryItem {
  id: string;
  name: string;
  category: string;
  mime: string;
  width: number;
  height: number;
  size: number;
  addedAt: number;
  blob: Blob;
}

export const LIBRARY_CATEGORIES = ['Slot Sembolleri', 'Logolar', 'Dekorlar', 'Diğer'];
export const DEFAULT_CATEGORY = 'Slot Sembolleri';

const libStore = createStore('slotolog-library', 'items');

const IMG_RE = /\.(png|webp|jpe?g|gif|svg)$/i;
const MIME: Record<string, string> = { png: 'image/png', webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml' };

export async function listLibrary(): Promise<LibraryItem[]> {
  const ids = (await keys(libStore)) as string[];
  const all = await Promise.all(ids.map((id) => get<LibraryItem>(id, libStore)));
  return all.filter((x): x is LibraryItem => !!x).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name, 'tr', { numeric: true }));
}

export const removeLibraryItem = (id: string) => del(id, libStore);

export async function renameLibraryItem(id: string, patch: Partial<Pick<LibraryItem, 'name' | 'category'>>) {
  const it = await get<LibraryItem>(id, libStore);
  if (it) await set(id, { ...it, ...patch }, libStore);
}

function imageSize(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth || 500, height: img.naturalHeight || 500 });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Görsel okunamadı'));
    };
    img.src = url;
  });
}

const prettyName = (file: string) =>
  file
    .split('/')
    .pop()!
    .replace(/\.[^.]+$/, '')
    .replace(/_/g, ' ')
    .trim();

/** Bir ZIP'i veya görsel dosyalarını kütüphaneye ekler. Aynı ad + boyuttaki dosya tekrar eklenmez. */
export async function importToLibrary(
  files: File[],
  category = DEFAULT_CATEGORY,
): Promise<{ added: LibraryItem[]; skipped: string[] }> {
  const entries: { name: string; blob: Blob }[] = [];
  const skipped: string[] = [];
  for (const f of files) {
    if (/\.zip$/i.test(f.name) || f.type === 'application/zip' || f.type === 'application/x-zip-compressed') {
      const zip = unzipSync(new Uint8Array(await f.arrayBuffer()));
      for (const [path, data] of Object.entries(zip)) {
        if (path.endsWith('/') || path.includes('__MACOSX') || path.split('/').pop()!.startsWith('.')) continue;
        if (!IMG_RE.test(path)) {
          skipped.push(path);
          continue;
        }
        const ext = path.split('.').pop()!.toLowerCase();
        entries.push({ name: path, blob: new Blob([data as BlobPart], { type: MIME[ext] }) });
      }
    } else if (f.type.startsWith('image/') || IMG_RE.test(f.name)) {
      entries.push({ name: f.name, blob: f });
    } else skipped.push(f.name);
  }
  const existing = await listLibrary();
  const added: LibraryItem[] = [];
  entries.sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));
  for (const e of entries) {
    const name = prettyName(e.name);
    if (existing.some((x) => x.category === category && x.name === name && x.size === e.blob.size)) {
      skipped.push(`${e.name} (zaten var)`);
      continue;
    }
    let size: { width: number; height: number };
    try {
      size = await imageSize(e.blob);
    } catch {
      skipped.push(e.name);
      continue;
    }
    const item: LibraryItem = { id: uid(), name, category, mime: e.blob.type || 'image/png', ...size, size: e.blob.size, addedAt: Date.now(), blob: e.blob };
    await set(item.id, item, libStore);
    added.push(item);
  }
  return { added, skipped };
}
