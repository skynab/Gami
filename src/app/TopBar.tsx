import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';
import { LANGUAGES, setLanguage, type Language } from '../i18n';
import { useSettings } from '../state/settings';
import { patternCanvas, PATTERNS, type Pattern } from '../viewer/patterns';
import { DonateButton } from './Donate';
import { AutoThemeIcon, MoonIcon, SunIcon } from './icons';
import { getTheme, setTheme, THEMES } from './theme';

/**
 * The 52px bar at the top of every page. Pages fill the start, middle and end slots. With `crowded`, a page with
 * more at its end than a phone's width holds (the Studio's editor) lets the end slide sideways there, rather than
 * run the page off the screen.
 */
export function TopBar({ start, center, end, crowded }: { start?: ReactNode; center?: ReactNode; end?: ReactNode; crowded?: boolean }) {
  return (
    <header className={crowded ? 'topbar crowded' : 'topbar'}>
      <div className="topbar-start">{start ?? <Brand />}</div>
      {center && <div className="topbar-center">{center}</div>}
      <div className="topbar-end">
        {end}
        <ThemeButton />
        <LanguageMenu />
        <DonateButton />
      </div>
    </header>
  );
}

/** Light, dark, or whatever the device uses: one small button that steps through them. */
function ThemeButton() {
  const { t } = useTranslation();
  const [theme, choose] = useState(getTheme);
  const Icon = { system: AutoThemeIcon, light: SunIcon, dark: MoonIcon }[theme];
  const label = `${t('common.theme')}: ${t(`common.themes.${theme}`)}`;
  return (
    <button
      type="button"
      className="icon"
      aria-label={label}
      title={label}
      onClick={() => {
        const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
        setTheme(next);
        choose(next);
      }}
    >
      <Icon />
    </button>
  );
}

/** Choosing the interface's language. */
function LanguageMenu() {
  const { t, i18n } = useTranslation();
  return (
    <label className="language" title={t('common.language')}>
      <span className="sr-only">{t('common.language')}</span>
      <select value={i18n.resolvedLanguage} onChange={(e) => setLanguage(e.target.value as Language)}>
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code} lang={l.code}>
            {l.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * The Gami name and logo. Elsewhere it goes back to the gallery; on the gallery itself, where that would go
 * nowhere, it opens a small menu of quieter settings, kept out of the way: whether the cards play their folds.
 */
export function Brand() {
  const home = useLocation().pathname === '/';
  const face = (
    <>
      <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width="26" height="26" />
      <span>Gami</span>
    </>
  );
  if (!home) {
    return (
      <Link to="/" className="brand">
        {face}
      </Link>
    );
  }
  return <BrandMenu>{face}</BrandMenu>;
}

function BrandMenu({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const previews = useSettings((s) => s.previews);
  const paper = useSettings((s) => s.paper);

  // Close when clicking anywhere else, or pressing Escape.
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', away);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', away);
    };
  }, [open]);

  return (
    <div className="brand-box" ref={box}>
      <button type="button" className="brand" aria-haspopup="menu" aria-expanded={open} title={t('brandMenu.title')} onClick={() => setOpen(!open)}>
        {children}
      </button>
      {open && (
        <div className="menu brand-menu" role="menu" aria-label={t('brandMenu.title')}>
          <button type="button" role="menuitemcheckbox" aria-checked={previews} onClick={() => useSettings.getState().set({ previews: !previews })}>
            <span className="check" aria-hidden="true">
              {previews ? '✓' : ''}
            </span>
            {t('brandMenu.previews')}
          </button>
          <div className="menu-section" role="group" aria-label={t('brandMenu.paper')}>
            <span className="menu-label">
              {t('brandMenu.paper')} <span className="experimental">{t('brandMenu.experimental')}</span>
            </span>
            <div className="swatches">
              {(['plain', ...PATTERNS] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={paper === id}
                  className="swatch"
                  title={t(`brandMenu.patterns.${id}`)}
                  aria-label={t(`brandMenu.patterns.${id}`)}
                  onClick={() => useSettings.getState().set({ paper: id })}
                >
                  <img src={swatch(id)} alt="" width={32} height={32} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** The colour the paper swatches are drawn in: the gallery's sample blue, a typical model colour. */
const SWATCH_COLOUR = '#3f7cc0';
const swatches = new Map<string, string>();

/** A small picture of a paper choice, for its button in the menu: made once. */
function swatch(id: 'plain' | Pattern): string {
  let url = swatches.get(id);
  if (!url) {
    if (id === 'plain') {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 64;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = SWATCH_COLOUR;
      ctx.fillRect(0, 0, 64, 64);
      url = canvas.toDataURL();
    } else {
      // Two repeats of its tile across, so the motif reads at this size.
      const tile = patternCanvas(id, SWATCH_COLOUR, 48);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 64;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = ctx.createPattern(tile, 'repeat')!;
      ctx.fillRect(0, 0, 64, 64);
      url = canvas.toDataURL();
    }
    swatches.set(id, url);
  }
  return url;
}
