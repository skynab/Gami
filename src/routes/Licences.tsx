import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackLink } from '../app/BackLink';
import { Footer } from '../app/Footer';
import { TopBar } from '../app/TopBar';
import type { Notices } from '../../scripts/third-party-licences';

/** Written into every build by the plugin in scripts/third-party-licences.ts (and served under `npm run dev`). */
const NOTICES_URL = `${import.meta.env.BASE_URL}third-party-licences.json`;

/** The open-source notices: every library in the build, with its licence's full text a click away. */
export function Licences() {
  const { t } = useTranslation();
  const [notices, setNotices] = useState<Notices | 'failed' | null>(null);
  useEffect(() => {
    window.scrollTo(0, 0);
    let live = true;
    fetch(NOTICES_URL)
      .then((r) => (r.ok ? (r.json() as Promise<Notices>) : Promise.reject(new Error(String(r.status)))))
      .then((n) => live && setNotices(n))
      .catch(() => live && setNotices('failed'));
    return () => {
      live = false;
    };
  }, []);
  return (
    <div className="page">
      <TopBar />
      <main className="legal">
        <BackLink />
        <h1>{t('licences.title')}</h1>
        <p>{t('licences.intro')}</p>
        {notices === null && <p className="muted">{t('common.loading')}</p>}
        {notices === 'failed' && <p className="muted">{t('licences.failed')}</p>}
        {notices && notices !== 'failed' && (
          <>
            <p className="muted">{t('licences.count', { count: notices.packages.length })}</p>
            <ul className="licence-list">
              {notices.packages.map((p) => (
                <li key={`${p.name}@${p.version}`}>
                  <details>
                    <summary>
                      <span className="licence-name">{p.name}</span>
                      <span className="muted">{p.version}</span>
                      <span className="licence-tag">{p.licence}</span>
                    </summary>
                    <p className="muted small">
                      {p.author && t('licences.by', { author: p.author })}
                      {p.author && p.homepage && ' · '}
                      {p.homepage && (
                        <a href={p.homepage} target="_blank" rel="noreferrer">
                          {t('licences.homepage')}
                        </a>
                      )}
                    </p>
                    <pre>{notices.texts[p.text]}</pre>
                  </details>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
