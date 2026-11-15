import { create } from 'zustand';

/**
 * Small preferences kept in this browser, set from the menu behind the Gami name at the top of the gallery.
 * Storage can be blocked or cleared at any time, so every read and write is allowed to fail quietly: the
 * defaults come back.
 */

const KEY = 'gami.settings';

interface Settings {
  /** Whether a gallery card plays its folds when hovered, or when it's mid-screen on a touch screen. */
  previews: boolean;
}

const DEFAULTS: Settings = { previews: true };

function read(): Settings {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    const s = saved && typeof saved === 'object' ? (saved as Partial<Settings>) : {};
    return { previews: typeof s.previews === 'boolean' ? s.previews : DEFAULTS.previews };
  } catch {
    return { ...DEFAULTS };
  }
}

function save(settings: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Nothing to do: the setting lasts until the page is left.
  }
}

interface SettingsState extends Settings {
  set(change: Partial<Settings>): void;
}

export const useSettings = create<SettingsState>()((set, get) => ({
  ...read(),
  set(change) {
    const { previews } = { ...get(), ...change };
    save({ previews });
    set({ previews });
  },
}));
