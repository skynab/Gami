import { lazy, Suspense, useEffect, useLayoutEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { OrigamiHeartIcon, SearchIcon, SortIcon, StudioIcon } from '../app/icons';
import { TopBar } from '../app/TopBar';
import { AccountButton } from '../auth/AccountButton';
import { accountsEnabled } from '../auth/store';
import { CATEGORIES, filterModels, LEVELS, MODELS, SORTS, sortModels, type Category, type Level, type Sort } from '../gallery/catalog';
import { ModelCard } from '../gallery/ModelCard';
import { useFavorites } from '../state/favorites';
import { readHideFolded, readProgress, saveHideFolded } from '../state/progress';

// Community models need the database, so they're only loaded on sites with accounts.
const Community = accountsEnabled ? lazy(() => import('../gallery/Community')) : null;

/** Where the gallery was left: its filters and how far down it was scrolled. */
interface Place {
  query: string;
  level: Level | null;
  category: Category | null;
  sort: Sort;
  favorites: boolean;
  scroll: number;
}

// Kept for this tab only, so coming back from a model lands where it was, but a new visit starts at the top.
const PLACE_KEY = 'gami.gallery';

function readPlace(): Partial<Place> {
  try {
    return JSON.parse(sessionStorage.getItem(PLACE_KEY) ?? '{}') as Partial<Place>;
  } catch {
    return {};
  }
}

function savePlace(change: Partial<Place>) {
  try {
    sessionStorage.setItem(PLACE_KEY, JSON.stringify({ ...readPlace(), ...change }));
  } catch {
    // Nothing to do: the gallery just starts at the top next time.
  }
}

export function Gallery() {
  const { t, i18n } = useTranslation();
  const [place] = useState(readPlace);
  const [query, setQuery] = useState(place.query ?? '');
  const [level, setLevel] = useState<Level | null>(place.level ?? null);
  const [category, setCategory] = useState<Category | null>(place.category ?? null);
  const [sort, setSort] = useState<Sort>(SORTS.includes(place.sort as Sort) ? place.sort! : 'natural');
  const [onlyFavorites, setOnlyFavorites] = useState(place.favorites === true);
  const favorites = useFavorites((s) => s.ids);
  const [hideFolded, setHideFolded] = useState(readHideFolded);
  useEffect(() => savePlace({ query, level, category, sort, favorites: onlyFavorites }), [query, level, category, sort, onlyFavorites]);
  // Before the first paint, so the page doesn't flash at the top first.
  useLayoutEffect(() => {
    if (place.scroll) window.scrollTo(0, place.scroll);
    const onScroll = () => savePlace({ scroll: window.scrollY });
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [place]);
  const named = MODELS.map((m) => ({ ...m, title: t(`models.${m.id}.title`, { defaultValue: m.title }), blurb: t(`models.${m.id}.blurb`, { defaultValue: m.blurb }) }));
  const models = sortModels(
    filterModels(named, { query, level, category }).filter(
      (m) => (!hideFolded || !readProgress(m.id)?.done) && (!onlyFavorites || favorites.includes(m.id)),
    ),
    sort,
    i18n.language,
  );
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
          <button type="button" className="chip favorites-chip" aria-pressed={onlyFavorites} onClick={() => setOnlyFavorites(!onlyFavorites)}>
            <OrigamiHeartIcon width={16} height={16} />
            {t('gallery.favorites')}
          </button>
          <button type="button" className="chip" aria-pressed={hideFolded} onClick={toggleHideFolded}>
            {t('gallery.hideFolded')}
          </button>
          {/* Small and out of the way at the end of the row: most people keep the natural order. */}
          <label className="sort" title={t('gallery.sortLabel')} data-changed={sort !== 'natural' || undefined}>
            <SortIcon width={16} height={16} />
            <span className="sr-only">{t('gallery.sortLabel')}</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              {SORTS.map((s) => (
                <option key={s} value={s}>
                  {t(`sorts.${s}`)}
                </option>
              ))}
            </select>
          </label>
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
            <p className="muted">{onlyFavorites && !favorites.length ? t('gallery.noFavorites') : t('gallery.noMatch')}</p>
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
