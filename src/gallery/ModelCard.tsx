import { Link } from 'react-router';
import { PaperIcon } from '../app/icons';
import { modelUrl } from '../models';
import { readProgress } from '../state/progress';
import { LEVELS, levelOf, type ModelInfo } from './catalog';

export function ModelCard({ model }: { model: ModelInfo }) {
  const level = LEVELS.find((l) => l.id === levelOf(model.difficulty))!.label;
  const progress = model.steps ? readProgress(model.id) : null;
  const badge = !model.steps
    ? 'Coming soon'
    : progress?.done
      ? 'Folded ✓'
      : progress && progress.step > 1
        ? `Continue · step ${progress.step}`
        : null;

  return (
    <Link to={`/learn/${model.id}`} className="card">
      <div className="card-thumb">
        {model.steps ? (
          // The finished model from above, generated with its steps (scripts/build-models.ts).
          <img src={modelUrl(model.id, 'svg')} alt="" loading="lazy" />
        ) : (
          <PaperIcon className="placeholder" />
        )}
        {badge && <span className={model.steps ? 'card-badge' : 'card-badge soon'}>{badge}</span>}
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
          {model.steps ? `${model.steps} steps · ` : ''}
          {model.minutes} min{model.sheets > 1 ? ` · ${model.sheets} sheets` : ''}
        </p>
      </div>
    </Link>
  );
}
