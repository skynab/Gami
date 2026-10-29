import { afterEach, describe, expect, it, vi } from 'vitest';

/** A fresh copy of the store, over this storage. */
async function load(storage: Partial<Storage>) {
  vi.resetModules();
  vi.stubGlobal('localStorage', storage);
  return (await import('./favorites')).useFavorites;
}

afterEach(() => vi.unstubAllGlobals());

describe('favourites', () => {
  it('toggle on and off, and are remembered', async () => {
    const saved = new Map<string, string>();
    const storage = { getItem: (k: string) => saved.get(k) ?? null, setItem: (k: string, v: string) => void saved.set(k, v) };
    const favorites = await load(storage);
    favorites.getState().toggle('crane');
    favorites.getState().toggle('frog');
    favorites.getState().toggle('crane');
    expect(favorites.getState().ids).toEqual(['frog']);
    expect((await load(storage)).getState().ids).toEqual(['frog']);
  });

  it('start empty when storage is blocked or holds something else', async () => {
    const blocked = await load({
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(blocked.getState().ids).toEqual([]);
    blocked.getState().toggle('crane');
    expect(blocked.getState().ids).toEqual(['crane']);
    expect((await load({ getItem: () => '{"crane":true}' })).getState().ids).toEqual([]);
  });
});
