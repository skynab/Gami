import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
  BackIcon,
  FirstIcon,
  GuidesIcon,
  KeyboardIcon,
  LastIcon,
  LockIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PrevIcon,
  ReplayIcon,
  ResetIcon,
} from '../app/icons';
import { Modal } from '../app/Modal';
import { TopBar } from '../app/TopBar';
import type { OrigamiModel } from '../fold/types';
import { MODELS } from '../gallery/catalog';
import { BLANK_SHEET } from '../models';
import { usePlayback } from '../state/playback';
import { readProgress, saveProgress } from '../state/progress';
import { useViewer } from '../state/viewer';
import { VIEWS } from './views';

const SPEEDS = [1, 2, 0.5];

// three.js is most of the download, so the gallery never loads it.
const Stage = lazy(() => import('./Stage'));

/**
 * The viewer page: the 3D stage, the step card and the step bar, for any model.
 * `load` fetches the model's steps, or is null for a model whose steps aren't written yet.
 * `progressKey` names where this person's place in the model is remembered.
 */
export function ModelViewer({ progressKey, title, load, notice }: {
  progressKey: string;
  /** Shown straight away; the loaded model's own title replaces it if this is empty. */
  title: string;
  load: (() => Promise<OrigamiModel>) | null;
  /** A note above the step card, such as "Shared draft". */
  notice?: ReactNode;
}) {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<OrigamiModel | null>(null);
  const [failed, setFailed] = useState(false);
  const [help, setHelp] = useState(false);
  const view = useViewer((s) => s.view);
  const locked = useViewer((s) => s.locked);
  const guides = useViewer((s) => s.guides);
  const { setView, toggleLock, toggleGuides, resetCamera } = useViewer.getState();
  const step = usePlayback((s) => s.step);
  const total = usePlayback((s) => s.total);
  const playing = usePlayback((s) => s.playing);
  const speed = usePlayback((s) => s.speed);
  const finished = usePlayback((s) => s.total > 0 && s.pos >= s.total);
  const { goTo, replay, togglePlay, setSpeed } = usePlayback.getState();
  const nextSpeed = () => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]);

  // The step in the address when the page opened, or where this person left off. After that, the address follows playback.
  const startStep = useRef(Number(params.get('step')) || readProgress(progressKey)?.step || 1);
  const loader = useRef(load);
  loader.current = load;

  // Each model starts in the default view, unlocked, and plays its first step (or the linked one).
  useEffect(() => {
    useViewer.getState().init();
    setData(null);
    setFailed(false);
    let live = true;
    const loading = loader.current?.() ?? null;
    if (!loading) {
      setData(BLANK_SHEET);
      usePlayback.getState().load(0, 1);
    } else {
      loading.then(
        (model) => {
          if (!live) return;
          setData(model);
          usePlayback.getState().load(model.steps.length, startStep.current);
        },
        () => {
          if (!live) return;
          setFailed(true);
          setData(BLANK_SHEET);
        },
      );
    }
    return () => {
      live = false;
      usePlayback.getState().load(0, 1);
    };
  }, [progressKey]);

  useEffect(() => {
    if (total) saveProgress(progressKey, step, total);
  }, [progressKey, step, total]);

  useEffect(() => {
    if (!total || params.get('step') === String(step)) return;
    // Replace, not push: stepping through a model shouldn't fill the back button's history.
    setParams({ step: String(step) }, { replace: true });
  }, [step, total, params, setParams]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (help || e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
      // Space on a focused button presses that button.
      if (e.key === ' ' && e.target instanceof HTMLButtonElement) return;
      if (e.key === 'ArrowLeft') goTo(step - 1);
      else if (e.key === 'ArrowRight') goTo(step + 1);
      else if (e.key === 'Home') goTo(1);
      else if (e.key === 'End') goTo(total);
      else if (e.key === ' ') togglePlay();
      else if (e.key === 'r' || e.key === 'R') replay();
      else if (e.key >= '1' && e.key <= '4') setView(VIEWS[Number(e.key) - 1].id);
      else if (e.key === '0') resetCamera();
      else if (e.key === 'l' || e.key === 'L') toggleLock();
      else if (e.key === 'g' || e.key === 'G') toggleGuides();
      else if (e.key === 's' || e.key === 'S') nextSpeed();
      else if (e.key === '?') setHelp(true);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const current = data?.steps[step - 1];
  const name = title || data?.title || '';
  const none = data !== null && total === 0;

  return (
    <div className="app">
      <TopBar
        start={
          <>
            <Link to="/" className="icon" aria-label="All models" title="All models">
              <BackIcon />
            </Link>
            <span className="page-title">{name}</span>
          </>
        }
        center={total > 0 && <span>Step {step} of {total}</span>}
        end={
          <button type="button" className="icon" aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)" onClick={() => setHelp(true)}>
            <KeyboardIcon />
          </button>
        }
      />

      <main className="stage" aria-label={`${name} in 3D. Drag to turn it, scroll or pinch to zoom.`}>
        {data && (
          <Suspense fallback={null}>
            <Stage model={data} />
          </Suspense>
        )}
        {locked && <div className="badge">View locked · drag to pan</div>}
        {notice && <div className="viewer-notice">{notice}</div>}
        {current && (
          <section className="step-card" aria-label="Instructions" aria-live="polite">
            <div className="step-card-head">
              <h2>
                {step}. {current.title}
              </h2>
              <div className="step-card-actions">
                <button
                  type="button"
                  className="icon small-icon"
                  aria-label="Show fold lines and arrows"
                  title="Show fold lines and arrows (G)"
                  aria-pressed={guides}
                  onClick={toggleGuides}
                >
                  <GuidesIcon width={18} height={18} />
                </button>
                <button type="button" className="icon small-icon" aria-label="Replay this step" title="Replay this step (R)" onClick={replay}>
                  <ReplayIcon width={18} height={18} />
                </button>
              </div>
            </div>
            {current.text && <p className="muted small">{current.text}</p>}
            {finished && (
              <div className="done">
                <p>
                  <strong>Done!</strong> Nice folding.
                </p>
                <div className="done-actions">
                  <Link to="/" className="primary small-button">
                    Fold another
                  </Link>
                  <button type="button" className="secondary" onClick={() => goTo(1)}>
                    Start over
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
        {none && failed && (
          <section className="step-card" aria-label="Instructions">
            <h2>Couldn’t load the steps</h2>
            <p className="muted small">Check your connection and reload the page to try again.</p>
          </section>
        )}
        {none && !failed && (
          <section className="step-card" aria-label="Instructions">
            <h2>Instructions coming soon</h2>
            <p className="muted small">
              The steps for this model aren’t ready yet. Try <Link to={`/learn/${MODELS[0].id}`}>{MODELS[0].title}</Link> in the
              meantime.
            </p>
          </section>
        )}
      </main>

      {help && <ShortcutsDialog onClose={() => setHelp(false)} />}

      <footer className="bottombar">
        <div className="group">
          <button type="button" className="icon" aria-label="First step" title="First step (Home)" disabled={step <= 1} onClick={() => goTo(1)}>
            <FirstIcon />
          </button>
          <button type="button" className="icon" aria-label="Previous step" title="Previous step (←)" disabled={step <= 1} onClick={() => goTo(step - 1)}>
            <PrevIcon />
          </button>
          <button
            type="button"
            className="icon"
            aria-label={playing ? 'Pause' : 'Play'}
            title={playing ? 'Pause (Space)' : 'Play (Space)'}
            disabled={!total}
            onClick={togglePlay}
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button type="button" className="icon" aria-label="Next step" title="Next step (→)" disabled={step >= total} onClick={() => goTo(step + 1)}>
            <NextIcon />
          </button>
          <button type="button" className="icon" aria-label="Last step" title="Last step (End)" disabled={step >= total} onClick={() => goTo(total)}>
            <LastIcon />
          </button>
          <button
            type="button"
            className="icon speed"
            aria-label={`Speed ${speed}×`}
            title="Folding speed (S)"
            disabled={!total}
            onClick={nextSpeed}
          >
            {speed}×
          </button>
        </div>

        <Scrubber />

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

const SHORTCUTS: [string, string][] = [
  ['← →', 'Previous / next step'],
  ['Home / End', 'First / last step'],
  ['Space', 'Play or pause'],
  ['R', 'Replay this step'],
  ['S', 'Change the folding speed'],
  ['G', 'Show or hide fold lines and arrows'],
  ['1 – 4', 'Free, top, front or side view'],
  ['L', 'Lock the view'],
  ['0', 'Reset the view'],
];

function ShortcutsDialog({ onClose }: { onClose(): void }) {
  return (
    <Modal title="Keyboard shortcuts" onClose={onClose}>
      <dl className="shortcuts">
        {SHORTCUTS.map(([keys, what]) => (
          <div key={keys}>
            <dt>
              <kbd>{keys}</kbd>
            </dt>
            <dd>{what}</dd>
          </div>
        ))}
      </dl>
      <form method="dialog">
        <button className="primary small-button">Close</button>
      </form>
    </Modal>
  );
}

/**
 * Drag through the whole model, stopping anywhere, even halfway through a fold.
 * Its own component because it re-renders on every animation frame.
 */
function Scrubber() {
  const pos = usePlayback((s) => s.pos);
  const total = usePlayback((s) => s.total);
  const step = usePlayback((s) => s.step);
  return (
    <>
      <input
        type="range"
        className="scrubber"
        min={0}
        max={Math.max(1, total)}
        step={0.001}
        value={pos}
        list="step-ticks"
        disabled={!total}
        aria-label="Progress through the steps"
        aria-valuetext={`Step ${step} of ${total}`}
        onChange={(e) => usePlayback.getState().scrub(Number(e.target.value))}
      />
      {/* A tick where each step ends. */}
      <datalist id="step-ticks">
        {Array.from({ length: total + 1 }, (_, i) => (
          <option key={i} value={i} />
        ))}
      </datalist>
    </>
  );
}
