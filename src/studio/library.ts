import type { FoldFile } from '../fold/fold-format';
import type { CloudInfo, Problem } from './draft';

/**
 * The designs made in the Studio, kept in this browser's IndexedDB: a design with many sheets or bent steps runs
 * to megabytes, more than localStorage holds for the whole site. Storage can be blocked or cleared at any time, so
 * every call is allowed to fail quietly: reads come back empty, and writes say whether they worked.
 */

export interface LocalDesign {
  /** Random, never reused. */
  id: string;
  /** The model, exactly as it would be exported. */
  file: FoldFile;
  /** Kept beside the file so the list needn't read every model. */
  title: string;
  steps: number;
  created: number;
  updated: number;
  /** The finished model from above (thumbnail.ts), for the list. */
  thumbnail?: string;
  /** For creators: the cloud copy this design was saved to, and whether it has changed since. */
  cloud?: CloudInfo | null;
  dirty?: boolean;
  /** A step that couldn't be folded again after an earlier one changed. */
  problem?: Problem | null;
}

const DB = 'gami';
const STORE = 'designs';
/** The single draft the Studio kept before it had a library. */
const OLD_DRAFT = 'gami.studio.draft';

let opened: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  opened ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).then(moveOldDraft);
  // Blocked now needn't mean blocked for the rest of the visit.
  opened.catch(() => (opened = null));
  return opened;
}

function request<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>, base = db()): Promise<T> {
  return base.then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const tx = d.transaction(STORE, mode);
        const req = run(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = tx.onabort = () => reject(tx.error ?? req.error);
      }),
  );
}

/** Every design, the most recently changed first; null if this browser won't keep them. */
export async function listDesigns(): Promise<LocalDesign[] | null> {
  try {
    const all = await request('readonly', (s) => s.getAll() as IDBRequest<LocalDesign[]>);
    return all.sort((a, b) => b.updated - a.updated);
  } catch {
    return null;
  }
}

export async function getDesign(id: string): Promise<LocalDesign | null> {
  try {
    return (await request('readonly', (s) => s.get(id) as IDBRequest<LocalDesign | undefined>)) ?? null;
  } catch {
    return null;
  }
}

/** Writes a design, new or changed. False if it couldn't be kept. */
export async function putDesign(design: LocalDesign): Promise<boolean> {
  try {
    await request('readwrite', (s) => s.put(design));
    keep();
    return true;
  } catch {
    return false;
  }
}

export async function removeDesign(id: string): Promise<boolean> {
  try {
    await request('readwrite', (s) => s.delete(id));
    return true;
  } catch {
    return false;
  }
}

export const newDesignId = () => crypto.randomUUID();

/** A design record for a .fold file, as when one is imported or first saved. */
export function designOf(file: FoldFile, more: Partial<LocalDesign> = {}): LocalDesign {
  const now = Date.now();
  return { id: newDesignId(), file, title: file.file_title, steps: file.file_frames.length, created: now, updated: now, ...more };
}

let asked = false;

/** Asks the browser, once a visit, not to clear the designs when the device runs low on space. */
function keep() {
  if (asked) return;
  asked = true;
  navigator.storage?.persist?.().catch(() => {});
}

/** The Studio's old single draft, as it was kept in localStorage. */
interface OldDraft {
  fold: FoldFile;
  cloud: CloudInfo | null;
  dirty: boolean;
  problem?: Problem | null;
}

/**
 * Makes the draft kept before the library the first design in it. The old key goes only once the design is
 * written, so nothing is lost if this browser won't keep it.
 */
async function moveOldDraft(d: IDBDatabase): Promise<IDBDatabase> {
  try {
    const raw = localStorage.getItem(OLD_DRAFT);
    if (!raw) return d;
    const saved = JSON.parse(raw) as OldDraft | FoldFile;
    // Drafts saved before cloud saving were just the .fold file.
    const design = 'fold' in saved
      ? designOf(saved.fold, { cloud: saved.cloud, dirty: saved.dirty, problem: saved.problem ?? null })
      : designOf(saved, { dirty: true });
    await request('readwrite', (s) => s.put(design), Promise.resolve(d));
    localStorage.removeItem(OLD_DRAFT);
  } catch {
    // Storage blocked or the draft unreadable: it stays where it was.
  }
  return d;
}
