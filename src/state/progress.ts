/**
 * How far someone has got with each model, kept in this browser so they can pick up where they left off.
 * Storage can be blocked or cleared at any time, so every read and write is allowed to fail quietly.
 */

export interface Progress {
  step: number;
  total: number;
  /** Reached the last step at least once. */
  done: boolean;
}

const key = (id: string) => `gami.progress.${id}`;

export function readProgress(id: string): Progress | null {
  try {
    const saved = JSON.parse(localStorage.getItem(key(id)) ?? 'null') as Progress | null;
    return saved && saved.step >= 1 && saved.total >= 1 ? saved : null;
  } catch {
    return null;
  }
}

export function saveProgress(id: string, step: number, total: number) {
  try {
    const done = step >= total || !!readProgress(id)?.done;
    localStorage.setItem(key(id), JSON.stringify({ step, total, done }));
  } catch {
    // Nothing to do: progress is a convenience.
  }
}

/** Whether the gallery leaves out the models already folded to the end. */
export function readHideFolded(): boolean {
  try {
    return localStorage.getItem('gami.hideFolded') === '1';
  } catch {
    return false;
  }
}

export function saveHideFolded(hide: boolean) {
  try {
    localStorage.setItem('gami.hideFolded', hide ? '1' : '0');
  } catch {
    // Nothing to do: the gallery just shows everything next time.
  }
}
