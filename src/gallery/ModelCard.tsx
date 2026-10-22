import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { PaperIcon, PenIcon, ScissorsIcon } from '../app/icons';
import { modelUrl } from '../models';
import { readProgress } from '../state/progress';
import { levelOf, type Difficulty, type ModelInfo, type Tool } from './catalog';

export function ModelCard({ model }: { model: ModelInfo }) {
  const { t } = useTranslation();
  const progress = model.steps ? readProgress(model.id) : null;
  const lesson = model.category === 'lesson';
  // The looping preview loads the first time the card is hovered or focused, and plays while it is.
  const [preview, setPreview] = useState<'off' | 'on' | 'loaded'>('off');
  const show = () => setPreview('on');
  const hide = () => setPreview((p) => (p === 'off' ? 'off' : 'loaded'));
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
    <Link
      to={`/learn/${model.id}`}
      className={lesson ? 'card lesson' : 'card'}
      onPointerEnter={show}
      onPointerLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      <div className="card-thumb">
        {model.steps ? (
          // The finished model from above, generated with its steps (scripts/build-models.ts).
          <img src={modelUrl(model.id, 'svg')} alt="" loading="lazy" />
        ) : (
          <PaperIcon className="placeholder" />
        )}
        {model.steps && preview !== 'off' && (
          // A few of its steps in turn (scripts/build-models.ts), over the finished model.
          <img src={modelUrl(model.id, 'preview.svg')} alt="" className={preview === 'on' ? 'card-preview playing' : 'card-preview'} />
        )}
        {badge && <span className={model.steps ? 'card-badge' : 'card-badge soon'}>{badge}</span>}
        <Needs tools={model.needs} />
      </div>
      <div className="card-body">
        <div className="card-title">
          <span>{model.title}</span>
          <Dots difficulty={model.difficulty} />
        </div>
        <p className="muted small">{model.blurb}</p>
        <p className="muted small">{details.join(' · ')}</p>
      </div>
    </Link>
  );
}

/** Tools beyond paper, so nobody starts a model without them. */
export function Needs({ tools }: { tools?: Tool[] }) {
  const { t } = useTranslation();
  if (!tools?.length) return null;
  return (
    <span className="card-needs">
      {tools.map((tool) => {
        const label = t(tool === 'scissors' ? 'card.needsScissors' : 'card.needsPen');
        const Icon = tool === 'scissors' ? ScissorsIcon : PenIcon;
        return (
          <span key={tool} role="img" aria-label={label} title={label}>
            <Icon width={16} height={16} />
          </span>
        );
      })}
    </span>
  );
}

/** Difficulty as five dots. */
export function Dots({ difficulty }: { difficulty: Difficulty }) {
  const { t } = useTranslation();
  const level = t(`levels.${levelOf(difficulty)}`);
  return (
    <span className="dots" role="img" aria-label={t('card.difficulty', { level, n: difficulty })} title={level}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= difficulty ? 'on' : undefined} />
      ))}
    </span>
  );
}
