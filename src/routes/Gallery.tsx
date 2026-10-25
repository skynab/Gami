import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { SearchIcon, StudioIcon } from '../app/icons';
import { TopBar } from '../app/TopBar';
import { AccountButton } from '../auth/AccountButton';
import { accountsEnabled } from '../auth/store';
import { CATEGORIES, filterModels, LEVELS, MODELS, type Category, type Level } from '../gallery/catalog';
import { ModelCard } from '../gallery/ModelCard';
import { readHideFolded, readProgress, saveHideFolded } from '../state/progress';

// Community models need the database, so they're only loaded on sites with accounts.
const Community = accountsEnabled ? lazy(() => import('../gallery/Community')) : null;

export function Gallery() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<Level | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [hideFolded, setHideFolded] = useState(readHideFolded);
  const named = MODELS.map((m) => ({ ...m, title: t(`models.${m.id}.title`, { defaultValue: m.title }), blurb: t(`models.${m.id}.blurb`, { defaultValue: m.blurb }) }));
  const models = filterModels(named, { query, level, category }).filter((m) => !hideFolded || !readProgress(m.id)?.done);
  const toggleHideFolded = () => {
    setHideFolded(!hideFolded);
    saveHideFolded(!hideFolded);
  };

  return (
    <div className="page">
      <TopBar
        end={
          <>
            <Link to="/studio" className="secondary" title={t('gallery.studioTitle')}>
              <StudioIcon width={18} height={18} />
              <span>{t('common.studio')}</span>
            </Link>
            <AccountButton />
          </>
        }
      />
      <main className="gallery">
        <h1>{t('gallery.title')}</h1>
        <p className="muted">{t('gallery.intro')}</p>

        <div className="filters">
          <label className="search">
            <SearchIcon width={18} height={18} />
            <span className="sr-only">{t('gallery.searchLabel')}</span>
            <input type="search" placeholder={t('gallery.search')} value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <div className="segmented" role="group" aria-label={t('gallery.difficulty')}>
            <button type="button" aria-pressed={level === null} onClick={() => setLevel(null)}>
              {t('gallery.all')}
            </button>
            {LEVELS.map((l) => (
              <button key={l.id} type="button" aria-pressed={level === l.id} onClick={() => setLevel(l.id)}>
                {t(`levels.${l.id}`)}
              </button>
            ))}
          </div>
          <div className="chips" role="group" aria-label={t('gallery.category')}>
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                className="chip"
                aria-pressed={category === c.id}
                onClick={() => setCategory(category === c.id ? null : c.id)}
              >
                {t(`categories.${c.id}`)}
              </button>
            ))}
          </div>
          <button type="button" className="chip" aria-pressed={hideFolded} onClick={toggleHideFolded}>
            {t('gallery.hideFolded')}
          </button>
        </div>

        {models.length > 0 ? (
          <ul className="grid">
            {models.map((m) => (
              <li key={m.id}>
                <ModelCard model={m} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty">
            <p className="muted">{t('gallery.noMatch')}</p>
          </div>
        )}
        {Community && (
          <Suspense fallback={null}>
            <Community />
          </Suspense>
        )}
      </main>
    </div>
  );
}
