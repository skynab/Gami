import { lazy, Suspense, useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import {
  BackIcon,
  FirstIcon,
  LastIcon,
  LockIcon,
  NextIcon,
  PlayIcon,
  PrevIcon,
  ResetIcon,
} from '../app/icons';
import { TopBar } from '../app/TopBar';
import { findModel } from '../gallery/catalog';
import { useViewer } from '../state/viewer';
import { VIEWS } from '../viewer/views';
import { NotFound } from './NotFound';

// three.js is most of the download, so the gallery never loads it.
const Stage = lazy(() => import('../viewer/Stage'));

export function Learn() {
  const { modelId } = useParams();
  const model = findModel(modelId);
  const [params, setParams] = useSearchParams();
  const view = useViewer((s) => s.view);
  const locked = useViewer((s) => s.locked);
  const { setView, toggleLock, resetCamera } = useViewer.getState();

  const total = model?.steps ?? 1;
  const step = clamp(Number(params.get('step')) || 1, 1, total);
  // Replace, not push: stepping through a model shouldn't fill the back button's history.
  const goTo = (n: number) => setParams({ step: String(clamp(n, 1, total)) }, { replace: true });

  // Each model starts in the default view, unlocked.
  useEffect(() => useViewer.getState().init(), [modelId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowLeft') goTo(step - 1);
      else if (e.key === 'ArrowRight') goTo(step + 1);
      else if (e.key === 'Home') goTo(1);
      else if (e.key === 'End') goTo(total);
      else if (e.key >= '1' && e.key <= '4') setView(VIEWS[Number(e.key) - 1].id);
      else if (e.key === '0') resetCamera();
      else if (e.key === 'l' || e.key === 'L') toggleLock();
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
        <Suspense fallback={null}>
          <Stage />
        </Suspense>
        {locked && <div className="badge">View locked · drag to pan</div>}
        <section className="step-card" aria-label="Instructions">
          <h2>Step {step}</h2>
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
            title="Lock view: drag pans instead of rotating (L)"
            aria-pressed={locked}
            onClick={toggleLock}
          >
            <LockIcon />
          </button>
          <button type="button" className="icon" aria-label="Reset view" title="Reset view (0)" onClick={resetCamera}>
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
