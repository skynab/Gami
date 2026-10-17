import { Link } from 'react-router';
import { PaperIcon } from '../app/icons';
import { LEVELS, levelOf, type ModelInfo } from './catalog';

export function ModelCard({ model }: { model: ModelInfo }) {
  const level = LEVELS.find((l) => l.id === levelOf(model.difficulty))!.label;
  return (
    <Link to={`/learn/${model.id}`} className="card">
      {/* Replaced by a rendered thumbnail of the finished model in milestone 4. */}
      <div className="card-thumb" style={{ color: 'var(--accent)' }}>
        <PaperIcon />
      </div>
      <div className="card-body">
        <div className="card-title">
          <span>{model.title}</span>
          <span className="dots" role="img" aria-label={`${level}, difficulty ${model.difficulty} of 5`} title={level}>
            {[1, 2, 3, 4, 5].map((n) => (
              <span key={n} className={n <= model.difficulty ? 'on' : undefined} />
            ))}
          </span>
        </div>
        <p className="muted small">{model.blurb}</p>
        <p className="muted small">
          {model.steps} steps · {model.minutes} min{model.sheets > 1 ? ` · ${model.sheets} sheets` : ''}
        </p>
      </div>
    </Link>
  );
}
