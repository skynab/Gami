import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router';
import { SearchIcon, StudioIcon } from '../app/icons';
import { TopBar } from '../app/TopBar';
import { AccountButton } from '../auth/AccountButton';
import { accountsEnabled } from '../auth/store';
import { CATEGORIES, filterModels, LEVELS, MODELS, type Category, type Level } from '../gallery/catalog';
import { ModelCard } from '../gallery/ModelCard';

// Community models need the database, so they're only loaded on sites with accounts.
const Community = accountsEnabled ? lazy(() => import('../gallery/Community')) : null;

export function Gallery() {
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<Level | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const models = filterModels(MODELS, { query, level, category });

  return (
    <div className="page">
      <TopBar
        end={
          <>
            <Link to="/studio" className="secondary" title="Build your own models (creators only)">
              <StudioIcon width={18} height={18} />
              <span>Studio</span>
            </Link>
            <AccountButton />
          </>
        }
      />
      <main className="gallery">
        <h1>Learn to fold</h1>
        <p className="muted">Pick a model and follow every fold in 3D. Turn it, zoom in, go at your own pace.</p>

        <div className="filters">
          <label className="search">
            <SearchIcon width={18} height={18} />
            <span className="sr-only">Search models</span>
            <input type="search" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <div className="segmented" role="group" aria-label="Difficulty">
            <button type="button" aria-pressed={level === null} onClick={() => setLevel(null)}>
              All
            </button>
            {LEVELS.map((l) => (
              <button key={l.id} type="button" aria-pressed={level === l.id} onClick={() => setLevel(l.id)}>
                {l.label}
              </button>
            ))}
          </div>
          <div className="chips" role="group" aria-label="Category">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                className="chip"
                aria-pressed={category === c.id}
                onClick={() => setCategory(category === c.id ? null : c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
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
            <p className="muted">No models match. Try another search or filter.</p>
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
