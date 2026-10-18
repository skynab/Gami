import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
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
import { useStepText } from '../i18n/steps';
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
  const { t } = useTranslation();
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
  // Built-in models' steps in the interface's language; anything else as written.
  const say = useStepText();
  const name = title || data?.title || '';
  const none = data !== null && total === 0;

  return (
    <div className="app">
      <TopBar
        start={
          <>
            <Link to="/" className="icon" aria-label={t('viewer.allModels')} title={t('viewer.allModels')}>
              <BackIcon />
            </Link>
            <span className="page-title">{name}</span>
          </>
        }
        center={total > 0 && <span>{t('viewer.stepOf', { step, total })}</span>}
        end={
          <button type="button" className="icon" aria-label={t('viewer.shortcuts')} title={t('viewer.shortcutsTitle')} onClick={() => setHelp(true)}>
            <KeyboardIcon />
          </button>
        }
      />

      <main className="stage" aria-label={t('viewer.stage', { name })}>
        {data && (
          <Suspense fallback={null}>
            <Stage model={data} />
          </Suspense>
        )}
        {locked && <div className="badge">{t('viewer.locked')}</div>}
        {notice && <div className="viewer-notice">{notice}</div>}
        {current && (
          <section className="step-card" aria-label={t('viewer.instructions')} aria-live="polite">
            <div className="step-card-head">
              <h2>
                {step}. {say(current.title)}
              </h2>
              <div className="step-card-actions">
                <button
                  type="button"
                  className="icon small-icon"
                  aria-label={t('viewer.guides')}
                  title={t('viewer.guidesTitle')}
                  aria-pressed={guides}
                  onClick={toggleGuides}
                >
                  <GuidesIcon width={18} height={18} />
                </button>
                <button type="button" className="icon small-icon" aria-label={t('viewer.replay')} title={t('viewer.replayTitle')} onClick={replay}>
                  <ReplayIcon width={18} height={18} />
                </button>
              </div>
            </div>
            {current.text && <p className="muted small">{say(current.text)}</p>}
            {finished && (
              <div className="done">
                <p>
                  <strong>{t('viewer.done')}</strong> {t('viewer.doneText')}
                </p>
                <div className="done-actions">
                  <Link to="/" className="primary small-button">
                    {t('viewer.another')}
                  </Link>
                  <button type="button" className="secondary" onClick={() => goTo(1)}>
                    {t('viewer.startOver')}
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
        {none && failed && (
          <section className="step-card" aria-label={t('viewer.instructions')}>
            <h2>{t('viewer.failed')}</h2>
            <p className="muted small">{t('viewer.failedText')}</p>
          </section>
        )}
        {none && !failed && (
          <section className="step-card" aria-label={t('viewer.instructions')}>
            <h2>{t('viewer.soon')}</h2>
            <p className="muted small">
              <Trans
                i18nKey="viewer.soonText"
                values={{ model: t(`models.${MODELS[0].id}.title`, { defaultValue: MODELS[0].title }) }}
                components={[<Link key="model" to={`/learn/${MODELS[0].id}`} />]}
              />
            </p>
          </section>
        )}
      </main>

      {help && <ShortcutsDialog onClose={() => setHelp(false)} />}

      <footer className="bottombar">
        <div className="group">
          <button type="button" className="icon" aria-label={t('viewer.first')} title={t('viewer.firstTitle')} disabled={step <= 1} onClick={() => goTo(1)}>
            <FirstIcon />
          </button>
          <button type="button" className="icon" aria-label={t('viewer.prev')} title={t('viewer.prevTitle')} disabled={step <= 1} onClick={() => goTo(step - 1)}>
            <PrevIcon />
          </button>
          <button
            type="button"
            className="icon"
            aria-label={playing ? t('viewer.pause') : t('viewer.play')}
            title={playing ? t('viewer.pauseTitle') : t('viewer.playTitle')}
            disabled={!total}
            onClick={togglePlay}
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button type="button" className="icon" aria-label={t('viewer.next')} title={t('viewer.nextTitle')} disabled={step >= total} onClick={() => goTo(step + 1)}>
            <NextIcon />
          </button>
          <button type="button" className="icon" aria-label={t('viewer.last')} title={t('viewer.lastTitle')} disabled={step >= total} onClick={() => goTo(total)}>
            <LastIcon />
          </button>
          <button
            type="button"
            className="icon speed"
            aria-label={t('viewer.speed', { speed })}
            title={t('viewer.speedTitle')}
            disabled={!total}
            onClick={nextSpeed}
          >
            {speed}×
          </button>
        </div>

        <Scrubber />

        <div className="group">
          <div className="segmented" role="group" aria-label={t('viewer.view')}>
            {VIEWS.map((v, i) => (
              <button key={v.id} type="button" aria-pressed={view === v.id} title={t('viewer.viewTitle', { view: t(`views.${v.id}`), key: i + 1 })} onClick={() => setView(v.id)}>
                {t(`views.${v.id}`)}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="icon"
            aria-label={t('viewer.lock')}
            title={t('viewer.lockTitle')}
            aria-pressed={locked}
            onClick={toggleLock}
          >
            <LockIcon />
          </button>
          <button type="button" className="icon" aria-label={t('viewer.reset')} title={t('viewer.resetTitle')} onClick={resetCamera}>
            <ResetIcon />
          </button>
        </div>
      </footer>
    </div>
  );
}

/** Keys (or a key in `shortcuts`, for named keys) and what they do (a key in `shortcuts`). */
const SHORTCUTS: [string, string][] = [
  ['← →', 'prevNext'],
  ['shortcuts.homeEnd', 'firstLast'],
  ['shortcuts.space', 'play'],
  ['R', 'replay'],
  ['S', 'speed'],
  ['G', 'guides'],
  ['1 – 4', 'views'],
  ['L', 'lock'],
  ['0', 'reset'],
];

function ShortcutsDialog({ onClose }: { onClose(): void }) {
  const { t } = useTranslation();
  return (
    <Modal title={t('viewer.shortcuts')} onClose={onClose}>
      <dl className="shortcuts">
        {SHORTCUTS.map(([keys, what]) => (
          <div key={keys}>
            <dt>
              <kbd>{keys.startsWith('shortcuts.') ? t(keys) : keys}</kbd>
            </dt>
            <dd>{t(`shortcuts.${what}`)}</dd>
          </div>
        ))}
      </dl>
      <form method="dialog">
        <button className="primary small-button">{t('common.close')}</button>
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
  const { t } = useTranslation();
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
        aria-label={t('viewer.progress')}
        aria-valuetext={t('viewer.stepOf', { step, total })}
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
