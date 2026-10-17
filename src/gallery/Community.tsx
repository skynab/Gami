import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { publishedModels, type SavedModel } from '../cloud/models';
import { thumbnailSvg } from '../fold/thumbnail';

/**
 * Models made by creators and published by an admin. Loaded separately from the gallery (and only on sites
 * with accounts), since it needs the database and the fold engine for thumbnails.
 */
export default function Community() {
  const [models, setModels] = useState<SavedModel[] | null>(null);
  useEffect(() => {
    publishedModels().then(setModels, () => setModels([]));
  }, []);
  if (!models?.length) return null;
  return (
    <section className="community">
      <h2>From the community</h2>
      <p className="muted">Made in the Studio by Gami creators.</p>
      <ul className="grid">
        {models.map((m) => (
          <li key={m.id}>
            <CommunityCard saved={m} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function CommunityCard({ saved }: { saved: SavedModel }) {
  const src = useMemo(() => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(thumbnailSvg(saved.model))}`, [saved.model]);
  return (
    <Link to={`/m/${saved.id}`} className="card">
      <div className="card-thumb">
        <img src={src} alt="" />
      </div>
      <div className="card-body">
        <div className="card-title">
          <span>{saved.title}</span>
        </div>
        <p className="muted small">{saved.model.steps.length} steps</p>
      </div>
    </Link>
  );
}
