import { useEffect, useState } from 'react';
import { THEME_CHANGE } from './theme';

const NAMES = ['fg', 'muted', 'line', 'surface', 'bg', 'accent', 'accent-soft'] as const;
export type ThemeColors = Record<(typeof NAMES)[number], string>;

function read(): ThemeColors {
  const style = getComputedStyle(document.documentElement);
  return Object.fromEntries(NAMES.map((n) => [n, style.getPropertyValue(`--${n}`).trim()])) as ThemeColors;
}

/** The CSS colour tokens from app.css, for things drawn in WebGL. Follows light/dark changes, the device's or the menu's. */
export function useThemeColors(): ThemeColors {
  const [colors, setColors] = useState(read);
  useEffect(() => {
    const query = matchMedia('(prefers-color-scheme: dark)');
    const update = () => setColors(read());
    query.addEventListener('change', update);
    window.addEventListener(THEME_CHANGE, update);
    return () => {
      query.removeEventListener('change', update);
      window.removeEventListener(THEME_CHANGE, update);
    };
  }, []);
  return colors;
}
