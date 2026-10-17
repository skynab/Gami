import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import {
  BackIcon,
  FirstIcon,
  LastIcon,
  LockIcon,
  NextIcon,
  PaperIcon,
  PlayIcon,
  PrevIcon,
  ResetIcon,
} from '../app/icons';
import { TopBar } from '../app/TopBar';
import { findModel } from '../gallery/catalog';
import { NotFound } from './NotFound';

const VIEWS = [
  { id: 'free', label: 'Free' },
  { id: 'top', label: 'Top' },
  { id: 'front', label: 'Front' },
  { id: 'side', label: 'Side' },
] as const;
type View = (typeof VIEWS)[number]['id'];

export function Learn() {
  const { modelId } = useParams();
  const model = findModel(modelId);
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<View>('free');
  const [locked, setLocked] = useState(false);

  const total = model?.steps ?? 1;
  const step = clamp(Number(params.get('step')) || 1, 1, total);
  // Replace, not push: stepping through a model shouldn't fill the back button's history.
  const goTo = (n: number) => setParams({ step: String(clamp(n, 1, total)) }, { replace: true });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowLeft') goTo(step - 1);
      else if (e.key === 'ArrowRight') goTo(step + 1);
      else if (e.key === 'Home') goTo(1);
      else if (e.key === 'End') goTo(total);
      else if (e.key >= '1' && e.key <= '4') setView(VIEWS[Number(e.key) - 1].id);
      else if (e.key === '0') setView('free');
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!model) return <NotFound />;

  return (
    <div className="app">
      <TopBar
        start={
          <>
            <Link to="/" className="icon" aria-label="All models" title="All models">
              <BackIcon />
            </Link>
            <span className="page-title">{model.title}</span>
          </>
        }
        center={
          <span aria-live="polite">
            Step {step} of {total}
          </span>
        }
      />

      <main className="stage">
        {/* The 3D viewport replaces this in milestone 1. */}
        <div className="stage-empty">
          <PaperIcon className="stage-icon" />
          <h1>{model.title}</h1>
          <p className="muted">The 3D viewer is on its way.</p>
        </div>
        <section className="step-card" aria-label="Instructions">
          <h2>
            Step {step}
          </h2>
          <p className="muted small">Instructions for each fold appear here.</p>
        </section>
      </main>

      <footer className="bottombar">
        <div className="group">
          <button type="button" className="icon" aria-label="First step" title="First step (Home)" disabled={step === 1} onClick={() => goTo(1)}>
            <FirstIcon />
          </button>
          <button type="button" className="icon" aria-label="Previous step" title="Previous step (←)" disabled={step === 1} onClick={() => goTo(step - 1)}>
            <PrevIcon />
          </button>
          <button type="button" className="icon" aria-label="Play" title="Play (Space)" disabled>
            <PlayIcon />
          </button>
          <button type="button" className="icon" aria-label="Next step" title="Next step (→)" disabled={step === total} onClick={() => goTo(step + 1)}>
            <NextIcon />
          </button>
          <button type="button" className="icon" aria-label="Last step" title="Last step (End)" disabled={step === total} onClick={() => goTo(total)}>
            <LastIcon />
          </button>
        </div>

        <input
          type="range"
          className="scrubber"
          min={1}
          max={total}
          step={1}
          value={step}
          aria-label="Step"
          onChange={(e) => goTo(Number(e.target.value))}
        />

        <div className="group">
          <div className="segmented" role="group" aria-label="View">
            {VIEWS.map((v, i) => (
              <button key={v.id} type="button" aria-pressed={view === v.id} title={`${v.label} view (${i + 1})`} onClick={() => setView(v.id)}>
                {v.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="icon"
            aria-label="Lock view"
            title="Lock view: zoom only, no rotating"
            aria-pressed={locked}
            onClick={() => setLocked(!locked)}
          >
            <LockIcon />
          </button>
          <button type="button" className="icon" aria-label="Reset view" title="Reset view (0)" onClick={() => setView('free')}>
            <ResetIcon />
          </button>
        </div>
      </footer>
    </div>
  );
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(n)));
}
