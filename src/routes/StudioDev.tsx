import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { TopBar } from '../app/TopBar';
import { fold, FoldError, rotate, turnOver, unfoldTo, type FoldKind } from '../fold/fold';
import { fromFoldFile, toFoldFile } from '../fold/fold-format';
import { framesOf } from '../fold/frames';
import { flipLine, lineOnto, lineThrough, type Line } from '../fold/geometry2d';
import type { FoldFrame, Step, Vec2 } from '../fold/types';
import { useDraft } from '../studio/draft';
import { smallerSideMoves, unfoldTarget } from '../studio/editor';
import { FoldEditor } from '../studio/FoldEditor';
import { usePlayback } from '../state/playback';
import { useViewer } from '../state/viewer';

const Stage = lazy(() => import('../viewer/Stage'));

type Tool = 'onto' | 'through';
type Layers = 'all' | 1 | 2 | 3;

const HINTS: Record<Tool, string> = {
  onto: 'Pick the point to move (A), then where it should land (B).',
  through: 'Pick two points the crease goes through.',
};

/**
 * The internal Studio, used to write the built-in models. Only in development builds: the public
 * Studio for creators (milestones 6–7) grows out of this.
 */
export default function StudioDev() {
  const model = useDraft((s) => s.model);
  const { addStep, undo, editStep, setInfo, replace, clear, current } = useDraft.getState();
  const frame = useMemo(() => current(), [model, current]);

  const [tool, setTool] = useState<Tool>('onto');
  const [kind, setKind] = useState<FoldKind>('valley');
  const [layers, setLayers] = useState<Layers>('all');
  const [picks, setPicks] = useState<Vec2[]>([]);
  const [flipped, setFlipped] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const line = useMemo((): Line | null => {
    if (picks.length < 2) return null;
    const [a, b] = picks;
    const base = tool === 'onto' ? lineOnto(a, b) : smallerSideMoves(frame, lineThrough(a, b));
    return flipped ? flipLine(base) : base;
  }, [picks, tool, frame, flipped]);

  const result = useMemo((): { frame: FoldFrame } | { error: string } | null => {
    if (!line) return null;
    try {
      return { frame: fold(frame, { line, kind, layers: layers === 'all' ? undefined : layers }) };
    } catch (e) {
      if (e instanceof FoldError) return { error: e.message };
      throw e;
    }
  }, [frame, line, kind, layers]);
  const preview = result && 'frame' in result ? result.frame : null;

  const startOver = () => {
    setPicks([]);
    setFlipped(false);
  };

  const add = (step: Step) => {
    addStep(step);
    startOver();
    setMessage(null);
  };

  const applyFold = () => preview && add({ title: kind === 'valley' ? 'Valley fold' : 'Mountain fold', kind: 'fold', frame: preview });

  const safely = (make: () => Step) => {
    try {
      add(make());
    } catch (e) {
      if (!(e instanceof FoldError)) throw e;
      setMessage(e.message);
    }
  };

  const target = unfoldTarget(model.steps);
  const doUnfold = () => target !== null && safely(() => ({ title: 'Unfold', kind: 'unfold', frame: unfoldTo(framesOf(model), target) }));
  const doTurnOver = () => safely(() => ({ title: 'Turn over', kind: 'turn-over', frame: turnOver(frame) }));
  const doRotate = () => safely(() => ({ title: 'Rotate a quarter turn', kind: 'rotate', frame: rotate(frame, Math.PI / 2) }));

  // The preview plays the newest step whenever one is added or removed.
  const total = model.steps.length;
  useEffect(() => {
    usePlayback.getState().load(total, total);
  }, [total]);
  useEffect(() => {
    useViewer.getState().init();
    return () => usePlayback.getState().load(0, 1);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === 'Enter') applyFold();
      else if (e.key === 'Escape') startOver();
      else if (e.key === 'f' || e.key === 'F') setFlipped((f) => !f);
      else if (e.key === 'v' || e.key === 'V') setKind('valley');
      else if (e.key === 'm' || e.key === 'M') setKind('mountain');
      else if ((e.ctrlKey || e.metaKey) && e.key === 'z') undo();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const exportFile = () => {
    const blob = new Blob([JSON.stringify(toFoldFile(model), null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${model.id || 'model'}.fold`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      replace(fromFoldFile(JSON.parse(await f.text())));
      startOver();
      setMessage(null);
    } catch (e) {
      setMessage(`Couldn’t open that file: ${(e as Error).message}`);
    }
  };

  const status = message ?? (result && 'error' in result ? result.error : null);
  const hint = picks.length < 2 ? HINTS[tool] : preview ? 'Enter to fold · F to fold the other side · Esc to start again.' : null;

  return (
    <div className="app">
      <TopBar
        center="Studio · development"
        end={
          <>
            <button type="button" className="secondary" onClick={() => file.current?.click()}>
              Open
            </button>
            <input ref={file} type="file" accept=".fold,.json" hidden onChange={(e) => void importFile(e.target.files?.[0])} />
            <button type="button" className="secondary" onClick={exportFile}>
              Export .fold
            </button>
            <button type="button" className="secondary" onClick={() => confirm('Start a new model? The current one will be cleared.') && (clear(), startOver())}>
              New
            </button>
          </>
        }
      />

      <main className="studio">
        <section className="studio-editor">
          <FoldEditor
            frame={frame}
            sheet={model.sheet}
            picks={picks}
            line={line}
            kind={kind}
            preview={preview}
            onPick={(p) => setPicks((prev) => (prev.length >= 2 ? [p] : [...prev, p]))}
          />
          {(status || hint) && <div className={status ? 'badge error' : 'badge'}>{status ?? hint}</div>}
        </section>

        <aside className="studio-side">
          <div className="studio-preview">
            <Suspense fallback={null}>
              <Stage model={model} />
            </Suspense>
          </div>
          <div className="studio-steps">
            <label className="field">
              <span>Title</span>
              <input value={model.title} onChange={(e) => setInfo({ title: e.target.value })} />
            </label>
            <label className="field">
              <span>File name</span>
              <input value={model.id} onChange={(e) => setInfo({ id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} />
            </label>
            <ol>
              {model.steps.map((s, i) => (
                <li key={i}>
                  <button type="button" className="link small" onClick={() => usePlayback.getState().goTo(i + 1)}>
                    Step {i + 1}
                  </button>
                  <input aria-label={`Step ${i + 1} title`} value={s.title} onChange={(e) => editStep(i, { title: e.target.value })} />
                  <textarea
                    aria-label={`Step ${i + 1} instructions`}
                    placeholder="Instructions (optional)"
                    rows={2}
                    value={s.text ?? ''}
                    onChange={(e) => editStep(i, { text: e.target.value || undefined })}
                  />
                </li>
              ))}
            </ol>
            {!model.steps.length && <p className="muted small">No steps yet. Make the first fold on the left.</p>}
          </div>
        </aside>
      </main>

      <footer className="bottombar">
        <div className="group">
          <div className="segmented" role="group" aria-label="Fold line">
            <button type="button" aria-pressed={tool === 'onto'} onClick={() => (setTool('onto'), startOver())}>
              Point to point
            </button>
            <button type="button" aria-pressed={tool === 'through'} onClick={() => (setTool('through'), startOver())}>
              Through 2 points
            </button>
          </div>
          <div className="segmented" role="group" aria-label="Fold type">
            <button type="button" aria-pressed={kind === 'valley'} title="Valley (V)" onClick={() => setKind('valley')}>
              Valley
            </button>
            <button type="button" aria-pressed={kind === 'mountain'} title="Mountain (M)" onClick={() => setKind('mountain')}>
              Mountain
            </button>
          </div>
          <label className="field inline">
            <span>Layers</span>
            <select value={String(layers)} onChange={(e) => setLayers(e.target.value === 'all' ? 'all' : (Number(e.target.value) as Layers))}>
              <option value="all">All</option>
              <option value="1">Top 1</option>
              <option value="2">Top 2</option>
              <option value="3">Top 3</option>
            </select>
          </label>
          <button type="button" className="secondary" disabled={!line} onClick={() => setFlipped(!flipped)} title="Fold the other side (F)">
            Flip side
          </button>
          <button type="button" className="primary" disabled={!preview} onClick={applyFold} title="Fold (Enter)">
            Fold
          </button>
        </div>
        <div className="group">
          <button type="button" className="secondary" onClick={doTurnOver}>
            Turn over
          </button>
          <button type="button" className="secondary" onClick={doRotate}>
            Rotate
          </button>
          <button type="button" className="secondary" disabled={target === null} onClick={doUnfold}>
            Unfold
          </button>
          <button type="button" className="secondary" disabled={!model.steps.length} onClick={undo} title="Remove the last step (Ctrl+Z)">
            Undo
          </button>
        </div>
      </footer>
    </div>
  );
}
