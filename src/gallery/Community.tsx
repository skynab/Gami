import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { publishedModels, type SavedModel } from '../cloud/models';
import { toolsNeeded } from '../fold/ops';
import { thumbnailSvg } from '../fold/thumbnail';
import { Dots, Needs, paperRatio } from './ModelCard';

/**
 * Models made by creators and published by an admin. Loaded separately from the gallery (and only on sites
 * with accounts), since it needs the database and the fold engine for thumbnails.
 */
export default function Community() {
  const { t } = useTranslation();
  const [models, setModels] = useState<SavedModel[] | null>(null);
  useEffect(() => {
    publishedModels().then(setModels, () => setModels([]));
  }, []);
  if (!models?.length) return null;
  return (
    <section className="community">
      <h2>{t('gallery.community')}</h2>
      <p className="muted">{t('gallery.communityIntro')}</p>
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
  const { t } = useTranslation();
  const src = useMemo(() => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(thumbnailSvg(saved.model))}`, [saved.model]);
  const tools = useMemo(() => toolsNeeded(saved.model.steps), [saved.model]);
  const { about, steps, sheets } = saved.model;
  const details = [
    t('card.steps', { count: steps.length }),
    about?.minutes && t('card.minutes', { count: about.minutes }),
    sheets.length > 1 && t('card.sheets', { count: sheets.length }),
  ].filter(Boolean);
  return (
    <Link to={`/m/${saved.id}`} className="card">
      <div className="card-thumb">
        <img src={src} alt="" />
        <Needs tools={tools} paper={paperRatio(saved.model.sheets)} />
      </div>
      <div className="card-body">
        <div className="card-title">
          <span>{saved.title}</span>
          {about?.difficulty && <Dots difficulty={about.difficulty} />}
        </div>
        {about?.blurb && <p className="muted small">{about.blurb}</p>}
        <p className="muted small">{details.join(' · ')}</p>
      </div>
    </Link>
  );
}
