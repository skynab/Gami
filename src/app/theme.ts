/**
 * Light or dark. 'system' follows the device; choosing light or dark in the menu is remembered on this device.
 * The choice is applied as <html data-theme>, which app.css reads.
 */
export const THEMES = ['system', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

const STORAGE_KEY = 'gami.theme';
/** Fired on window when the theme changes, for things that read the colours in JS (WebGL). */
export const THEME_CHANGE = 'gami:themechange';

function savedTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && (THEMES as readonly string[]).includes(saved)) return saved as Theme;
  } catch {
    // Storage blocked: follow the device.
  }
  return 'system';
}

let current: Theme = savedTheme();

export const getTheme = () => current;

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
  // The browser bar colour: index.html gives one per scheme; a fixed choice uses that scheme's for both.
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    if (theme === 'system') meta.media = meta.dataset.media ?? meta.media;
    else {
      meta.dataset.media ??= meta.media;
      meta.media = meta.dataset.media.includes(theme) ? 'all' : 'not all';
    }
  }
}

export function setTheme(theme: Theme) {
  current = theme;
  apply(theme);
  try {
    if (theme === 'system') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage blocked: it still applies for this visit.
  }
  window.dispatchEvent(new Event(THEME_CHANGE));
}

// Before the first render, so a saved choice never flashes the other theme.
if (typeof document !== 'undefined') apply(current);
