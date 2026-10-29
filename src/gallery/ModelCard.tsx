import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { OrigamiHeartIcon, OrigamiStarIcon, PaperIcon, PenIcon, ScissorsIcon, TapeIcon } from '../app/icons';
import { modelUrl } from '../models';
import { useFavorite, useFavorites } from '../state/favorites';
import { readProgress } from '../state/progress';
import type { Sheet } from '../fold/types';
import { isNew, levelOf, type Difficulty, type ModelInfo, type Tool } from './catalog';

export function ModelCard({ model }: { model: ModelInfo }) {
  const { t } = useTranslation();
  const lesson = model.category === 'lesson';
  const { preview, ref, play } = usePreview(model);

  return (
    <>
      <Link to={`/learn/${model.id}`} ref={ref} className={lesson ? 'card lesson' : 'card'} {...play}>
        <div className="card-thumb">
          <Thumb model={model} preview={preview} />
        </div>
        <div className="card-body">
          <div className="card-title">
            <span>{model.title}</span>
            <NewStar model={model} />
            <Dots difficulty={model.difficulty} />
          </div>
          <p className="muted small">{model.blurb}</p>
          <p className="muted small">{details(model, t)}</p>
        </div>
      </Link>
      <FavoriteButton id={model.id} name={model.title} />
    </>
  );
}

/**
 * Two closely related models on one card (a box and its lid, say), its picture split by a slash: each half, and
 * each line below, opens its own model, and has its own heart.
 */
export function PairCard({ models }: { models: [ModelInfo, ModelInfo] }) {
  const { t } = useTranslation();
  const halves = [usePreview(models[0]), usePreview(models[1])];
  return (
    <div className="card pair-card">
      <div className="card-thumb">
        {models.map((model, i) => (
          // The lines below are the links to read out and tab to; the pictures are a bigger place to click.
          <Link
            key={model.id}
            to={`/learn/${model.id}`}
            ref={halves[i].ref}
            className={i === 0 ? 'pair-half first' : 'pair-half second'}
            tabIndex={-1}
            aria-hidden="true"
            {...halves[i].play}
          >
            <span className="pair-picture">
              <Thumb model={model} preview={halves[i].preview} />
            </span>
          </Link>
        ))}
        <svg className="pair-slash" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <line x1={SLASH[0]} y1={0} x2={SLASH[1]} y2={100} />
        </svg>
      </div>
      <div className="card-body">
        {models.map((model, i) => (
          <div key={model.id} className="pair-row">
            <Link to={`/learn/${model.id}`} className="card-title" {...halves[i].play}>
              <span>{model.title}</span>
              <NewStar model={model} />
              <Dots difficulty={model.difficulty} />
            </Link>
            <p className="muted small">{details(model, t)}</p>
            <FavoriteButton id={model.id} name={model.title} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Where the slash between a pair's pictures crosses the top and the bottom of the card, in percent across. */
const SLASH = [56, 44];

type Preview = 'off' | 'on' | 'loaded';

/**
 * A model's looping preview: it loads the first time the card is hovered or focused, and plays while it is. Touch
 * screens can't hover (a finger scrolling past would start it), so there it plays while `ref` is mid-screen
 * instead. `play` goes on whatever should start it.
 */
function usePreview(model: ModelInfo) {
  const [preview, setPreview] = useState<Preview>('off');
  const show = () => setPreview('on');
  const hide = () => setPreview((p) => (p === 'off' ? 'off' : 'loaded'));
  const hover = (e: PointerEvent, then: () => void) => e.pointerType !== 'touch' && then();
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (!model.steps || !ref.current || !matchMedia('(hover: none)').matches) return;
    // A thin line across the middle of the screen, so one card at a time crosses it.
    const seen = new IntersectionObserver(([entry]) => (entry.isIntersecting ? show() : hide()), {
      rootMargin: '-49.5% 0px -49.5% 0px',
    });
    seen.observe(ref.current);
    return () => seen.disconnect();
  }, [model.steps]);
  const play = {
    onPointerEnter: (e: PointerEvent) => hover(e, show),
    onPointerLeave: (e: PointerEvent) => hover(e, hide),
    onFocus: show,
    onBlur: hide,
  };
  return { preview, ref, play };
}

/** A model's picture on its card, with its badge and what it needs. */
function Thumb({ model, preview }: { model: ModelInfo; preview: Preview }) {
  const { t } = useTranslation();
  const progress = model.steps ? readProgress(model.id) : null;
  const badge = !model.steps
    ? t('card.soon')
    : progress?.done
      ? t('card.folded')
      : progress && progress.step > 1
        ? t('card.continue', { step: progress.step })
        : model.category === 'lesson'
          ? t('card.lesson')
          : null;
  return (
    <>
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
      <Needs tools={model.needs} paper={model.paper} />
    </>
  );
}

/** A model's steps, time and sheets, for its card. */
function details(model: ModelInfo, t: TFunction): string {
  return [
    model.steps && t('card.steps', { count: model.steps }),
    t('card.minutes', { count: model.minutes }),
    model.sheets > 1 && t('card.sheets', { count: model.sheets }),
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * The heart in a card's bottom corner, marking a model as a favourite. Beside the card's link rather than in it,
 * so pressing it doesn't open the model; the card's list item places it.
 */
export function FavoriteButton({ id, name }: { id: string; name: string }) {
  const { t } = useTranslation();
  const on = useFavorite(id);
  return (
    <button
      type="button"
      className="favorite"
      aria-pressed={on}
      aria-label={t('card.favorite', { name })}
      title={on ? t('card.unfavoriteTitle') : t('card.favoriteTitle')}
      onClick={() => useFavorites.getState().toggle(id)}
    >
      <OrigamiHeartIcon width={20} height={20} />
    </button>
  );
}

/** How much longer than wide a model's paper is (1 for squares): its longest sheet's long side over its short side. */
export function paperRatio(sheets: Sheet[]): number {
  return Math.max(1, ...sheets.map(({ size: [w, h] }) => Math.max(w, h) / Math.min(w, h)));
}

/**
 * What a model needs beyond a square of paper, so nobody starts it without: a rectangle (drawn to its shape, and
 * named when it's A4 or US Letter), scissors, a pen, tape.
 */
export function Needs({ tools, paper }: { tools?: Tool[]; paper?: number }) {
  const { t } = useTranslation();
  const rectangle = paper !== undefined && paper > 1 + 1e-6;
  if (!tools?.length && !rectangle) return null;
  const paperLabel = !rectangle
    ? ''
    : Math.abs(paper - Math.SQRT2) < 0.03
      ? t('card.paperA4')
      : Math.abs(paper - 11 / 8.5) < 0.02
        ? t('card.paperLetter')
        : t('card.paperRatio', { ratio: +paper.toFixed(2) });
  // The sheet stood upright, its long side 16 units in a 24-unit box.
  const [w, h] = rectangle ? [16 / paper, 16] : [0, 0];
  return (
    <span className="card-needs">
      {rectangle && (
        <span role="img" aria-label={paperLabel} title={paperLabel}>
          <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden="true">
            <rect x={12 - w / 2} y={12 - h / 2} width={w} height={h} rx={0.8} fill="none" stroke="currentColor" strokeWidth={1.8} />
          </svg>
        </span>
      )}
      {(tools ?? []).map((tool) => {
        const label = t(TOOL_LABELS[tool]);
        const Icon = TOOL_ICONS[tool];
        return (
          <span key={tool} role="img" aria-label={label} title={label}>
            <Icon width={16} height={16} />
          </span>
        );
      })}
    </span>
  );
}

const TOOL_LABELS = { scissors: 'card.needsScissors', pen: 'card.needsPen', tape: 'card.needsTape' } as const satisfies Record<Tool, string>;
const TOOL_ICONS = { scissors: ScissorsIcon, pen: PenIcon, tape: TapeIcon } satisfies Record<Tool, unknown>;

/** A purple origami star by the title of a model that's new (`NEW_SINCE`). */
export function NewStar({ model }: { model: ModelInfo }) {
  const { t } = useTranslation();
  if (!isNew(model)) return null;
  return (
    <span className="new-star" title={t('card.new')}>
      <OrigamiStarIcon width={14} height={14} />
      {t('card.new')}
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
