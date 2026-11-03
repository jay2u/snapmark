import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

/** Editable state saved alongside a capture so it can be re-opened later. */
export interface SavedState {
  /** Crop rectangle relative to the original image, if the user cropped. */
  crop: { x: number; y: number; w: number; h: number } | null;
  /** Serialized annotation nodes (see editor/serialize.ts). */
  nodes: string[];
}

export interface CaptureRecord {
  id: string;
  blob: Blob;
  saved?: SavedState;
}

export interface CaptureMeta {
  id: string;
  createdAt: number;
  updatedAt: number;
  title: string;
  url: string;
  width: number;
  height: number;
  thumb?: Blob;
}

interface Schema extends DBSchema {
  captures: { key: string; value: CaptureRecord };
  meta: { key: string; value: CaptureMeta; indexes: { byDate: number } };
}

let dbp: Promise<IDBPDatabase<Schema>> | null = null;
function db() {
  dbp ??= openDB<Schema>('snapmark', 1, {
    upgrade(d) {
      d.createObjectStore('captures', { keyPath: 'id' });
      d.createObjectStore('meta', { keyPath: 'id' }).createIndex('byDate', 'updatedAt');
    },
  });
  return dbp;
}

export const DEFAULT_MAX_HISTORY = 100;

export async function createCapture(
  blob: Blob,
  info: { title: string; url: string; width: number; height: number; thumb?: Blob },
): Promise<string> {
  const id = crypto.randomUUID();
  const now = Date.now();
  const d = await db();
  const tx = d.transaction(['captures', 'meta'], 'readwrite');
  tx.objectStore('captures').put({ id, blob });
  tx.objectStore('meta').put({ id, createdAt: now, updatedAt: now, ...info });
  await tx.done;
  await pruneHistory().catch(() => {});
  return id;
}

export async function getCapture(id: string) {
  const d = await db();
  const [record, meta] = await Promise.all([d.get('captures', id), d.get('meta', id)]);
  return record && meta ? { record, meta } : undefined;
}

export async function saveState(id: string, saved: SavedState, thumb?: Blob) {
  const d = await db();
  const tx = d.transaction(['captures', 'meta'], 'readwrite');
  const rec = await tx.objectStore('captures').get(id);
  const meta = await tx.objectStore('meta').get(id);
  if (rec && meta) {
    rec.saved = saved;
    meta.updatedAt = Date.now();
    if (thumb) meta.thumb = thumb;
    tx.objectStore('captures').put(rec);
    tx.objectStore('meta').put(meta);
  }
  await tx.done;
}

/** Newest first. Does not load image blobs. */
export async function listMeta(): Promise<CaptureMeta[]> {
  const d = await db();
  return (await d.getAllFromIndex('meta', 'byDate')).reverse();
}

export async function deleteCapture(id: string) {
  const d = await db();
  const tx = d.transaction(['captures', 'meta'], 'readwrite');
  tx.objectStore('captures').delete(id);
  tx.objectStore('meta').delete(id);
  await tx.done;
}

export async function clearAll() {
  const d = await db();
  const tx = d.transaction(['captures', 'meta'], 'readwrite');
  tx.objectStore('captures').clear();
  tx.objectStore('meta').clear();
  await tx.done;
}

export async function getMaxHistory(): Promise<number> {
  try {
    const { maxHistory } = await chrome.storage.local.get('maxHistory');
    return typeof maxHistory === 'number' && maxHistory > 0 ? maxHistory : DEFAULT_MAX_HISTORY;
  } catch {
    return DEFAULT_MAX_HISTORY;
  }
}

export async function pruneHistory(max?: number) {
  const limit = max ?? (await getMaxHistory());
  const all = await listMeta();
  for (const m of all.slice(limit)) await deleteCapture(m.id);
}
