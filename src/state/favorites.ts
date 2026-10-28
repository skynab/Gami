import { create } from 'zustand';

/**
 * The models someone has marked as favourites, kept in this browser. Storage can be blocked or cleared at any
 * time, so every read and write is allowed to fail quietly: the hearts just start empty.
 */

const KEY = 'gami.favorites';

function read(): string[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function save(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // Nothing to do: favourites are a convenience.
  }
}

interface FavoritesState {
  ids: string[];
  toggle(id: string): void;
}

export const useFavorites = create<FavoritesState>()((set, get) => ({
  ids: read(),
  toggle(id) {
    const { ids } = get();
    const next = ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id];
    save(next);
    set({ ids: next });
  },
}));

/** Whether a model is a favourite, re-rendering when that changes. */
export const useFavorite = (id: string) => useFavorites((s) => s.ids.includes(id));
