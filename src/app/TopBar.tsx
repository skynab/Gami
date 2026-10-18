import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { LANGUAGES, setLanguage, type Language } from '../i18n';
import { DonateButton } from './Donate';

/** The 52px bar at the top of every page. Pages fill the start, middle and end slots. */
export function TopBar({ start, center, end }: { start?: ReactNode; center?: ReactNode; end?: ReactNode }) {
  return (
    <header className="topbar">
      <div className="topbar-start">{start ?? <Brand />}</div>
      {center && <div className="topbar-center">{center}</div>}
      <div className="topbar-end">
        {end}
        <LanguageMenu />
        <DonateButton />
      </div>
    </header>
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

export function Brand() {
  return (
    <Link to="/" className="brand">
      <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width="26" height="26" />
      <span>Gami</span>
    </Link>
  );
}
