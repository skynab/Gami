import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { PaperIcon } from '../app/icons';
import { modelUrl } from '../models';
import { readProgress } from '../state/progress';
import { levelOf, type ModelInfo } from './catalog';

export function ModelCard({ model }: { model: ModelInfo }) {
  const { t } = useTranslation();
  const level = t(`levels.${levelOf(model.difficulty)}`);
  const progress = model.steps ? readProgress(model.id) : null;
  const lesson = model.category === 'math';
  const badge = !model.steps
    ? t('card.soon')
    : progress?.done
      ? t('card.folded')
      : progress && progress.step > 1
        ? t('card.continue', { step: progress.step })
        : lesson
          ? t('card.lesson')
          : null;
  const details = [
    model.steps && t('card.steps', { count: model.steps }),
    t('card.minutes', { count: model.minutes }),
    model.sheets > 1 && t('card.sheets', { count: model.sheets }),
  ].filter(Boolean);

  return (
    <Link to={`/learn/${model.id}`} className={lesson ? 'card lesson' : 'card'}>
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
          <span className="dots" role="img" aria-label={t('card.difficulty', { level, n: model.difficulty })} title={level}>
            {[1, 2, 3, 4, 5].map((n) => (
              <span key={n} className={n <= model.difficulty ? 'on' : undefined} />
            ))}
          </span>
        </div>
        <p className="muted small">{model.blurb}</p>
        <p className="muted small">{details.join(' · ')}</p>
      </div>
    </Link>
  );
}
