import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { TopBar } from '../app/TopBar';
import { collapse, type Crease } from '../fold/collapse';
import { fold, FoldError, rotate, turnOver, unfoldTo, type FoldKind } from '../fold/fold';
import { fromFoldFile, toFoldFile } from '../fold/fold-format';
import { framesOf } from '../fold/frames';
import { flipLine, lineOnto, lineThrough, type Line } from '../fold/geometry2d';
import type { FoldFrame, Step, Vec2 } from '../fold/types';
import { useDraft } from '../studio/draft';
import { curl, reparent, shape, type Bend } from '../fold/shape';
import { anchorFor, smallerSideMoves, topLayers, unfoldTarget } from '../studio/editor';
import { CloudPanel } from '../studio/CloudPanel';
import { FoldEditor } from '../studio/FoldEditor';
import { usePlayback } from '../state/playback';
import { useViewer } from '../state/viewer';

const Stage = lazy(() => import('../viewer/Stage'));

type Tool = 'onto' | 'through';
type Layers = 'all' | 1 | 2 | 3;
/** What the picked line does: a plain fold, a reverse fold, a crease for a collapse, or lifting into 3D. */
type Action = 'fold' | 'reverse' | 'collapse' | 'lift';

const HINTS: Record<Tool, string> = {
  onto: 'Pick the point to move (A), then where it should land (B).',
  through: 'Pick two points the crease goes through.',
};

const READY: Record<Action, string> = {
  fold: 'Enter to fold · F to fold the other side · Esc to start again.',
  reverse: 'Enter to reverse-fold · F for the other side · Esc to start again.',
  collapse: 'Enter adds this crease · add every crease that changes, then press Collapse.',
  lift: 'Enter to lift · F to lift the other side · Esc to start again.',
};

const ACTIONS: { id: Action; label: string; title: string }[] = [
  { id: 'fold', label: 'Fold', title: 'A valley or mountain fold' },
  { id: 'reverse', label: 'Reverse', title: 'Push a flap between its layers (inside) or wrap it round them (outside)' },
  { id: 'collapse', label: 'Collapse', title: 'Several creases at once: squash, petal and sink folds, or collapsing into a base' },
  { id: 'lift', label: 'Lift', title: 'Turn part of the paper up off the table, for 3D finishing steps' },
];

const APPLY_LABEL: Record<Action, string> = { fold: 'Fold', reverse: 'Reverse fold', collapse: 'Collapse', lift: 'Lift' };

/**
 * The Studio editor: fold a model step by step and export it as a .fold file. Creators reach it through
 * /studio (signed in); in development builds it's also at /studio/dev without signing in.
 */
export default function StudioEditor({ end, cloud = false }: {
  end?: React.ReactNode;
  /** Signed in as a creator: show saving to the cloud. */
  cloud?: boolean;
}) {
  const model = useDraft((s) => s.model);
  const { addStep, undo, editStep, setInfo, replace, clear, current } = useDraft.getState();
  const frame = useMemo(() => current(), [model, current]);

  const [tool, setTool] = useState<Tool>('onto');
  const [action, setAction] = useState<Action>('fold');
  const [kind, setKind] = useState<FoldKind>('valley');
  const [reverseKind, setReverseKind] = useState<'inside' | 'outside'>('inside');
  const [creaseKind, setCreaseKind] = useState<'valley' | 'mountain' | 'flat'>('valley');
  const [creases, setCreases] = useState<Crease[]>([]);
  const [angle, setAngle] = useState(90);
  const [segments, setSegments] = useState(1);
  // Lifts made this session, by the step count after them: the flat state they started from and their
  // bends, so another lift can add to them. (Lines are picked on that flat state.)
  const shaped = useRef(new Map<number, { base: FoldFrame; bends: Bend[] }>());
  const shaping = shaped.current.get(model.steps.length);
  const editFrame = shaping?.base ?? frame;
  const [layers, setLayers] = useState<Layers>('all');
  const [picks, setPicks] = useState<Vec2[]>([]);
  const [flipped, setFlipped] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const line = useMemo((): Line | null => {
    if (picks.length < 2) return null;
    const [a, b] = picks;
    const base = tool === 'onto' ? lineOnto(a, b) : smallerSideMoves(editFrame, lineThrough(a, b));
    return flipped ? flipLine(base) : base;
  }, [picks, tool, editFrame, flipped]);

  const n = layers === 'all' ? undefined : layers;
  // For a lift, `onFlat` is the preview with its faces matched to the flat state the lines are picked on.
  const result = useMemo((): { frame: FoldFrame; onFlat?: FoldFrame; bends?: Bend[] } | { error: string } | null => {
    // A collapse previews the creases added so far; the others preview the picked line.
    if (action === 'collapse' ? !creases.length : !line) return null;
    try {
      if (action === 'fold') return { frame: fold(frame, { line: line!, kind, layers: n }) };
      if (action === 'lift') {
        if (!shaping && frame.vertices_coords.some((p) => Math.abs(p[1]) > 1e-6))
          throw new FoldError('This step is already shaped in 3D. Undo it to shape again from the flat paper.');
        const bends = [...(shaping?.bends ?? []), ...curl(editFrame, { line: line!, angle: (angle * Math.PI) / 180, layers: n }, segments)];
        const lifted = shape(editFrame, bends);
        return { frame: shaping ? reparent(frame, lifted) : lifted, onFlat: lifted, bends };
      }
      const anchor = anchorFor(frame, action === 'reverse' ? [line!] : creases.map((c) => c.line));
      if (!anchor) throw new FoldError('There’s no paper on the side that stays still. Try Flip side.');
      const list: Crease[] =
        action === 'reverse' ? [{ line: line!, kind: reverseKind, only: n === undefined ? undefined : topLayers(frame, line!, n) }] : creases;
      return { frame: collapse(frame, { creases: list, anchor }) };
    } catch (e) {
      if (e instanceof FoldError) return { error: e.message };
      throw e;
    }
  }, [frame, editFrame, shaping, line, kind, n, action, reverseKind, creases, angle, segments]);
  const preview = result && 'frame' in result ? result.frame : null;

  const startOver = () => {
    setPicks([]);
    setFlipped(false);
  };

  const switchAction = (a: Action) => {
    setAction(a);
    setCreases([]);
    startOver();
  };

  /** Collapse mode: keeps the picked line as one of the creases that change. */
  const addCrease = () => {
    if (!line) return;
    try {
      const only = n === undefined ? undefined : topLayers(frame, line, n);
      setCreases((cs) => [...cs, { line, kind: creaseKind, only }]);
      startOver();
    } catch (e) {
      if (!(e instanceof FoldError)) throw e;
      setMessage(e.message);
    }
  };

  const add = (step: Step) => {
    shaped.current.delete(model.steps.length + 1);
    addStep(step);
    startOver();
    setMessage(null);
  };

  const apply = () => {
    if (!preview) return;
    if (action === 'fold') add({ title: kind === 'valley' ? 'Valley fold' : 'Mountain fold', kind: 'fold', frame: preview });
    else if (action === 'reverse') add({ title: reverseKind === 'inside' ? 'Inside reverse fold' : 'Outside reverse fold', kind: 'reverse', frame: preview });
    else if (action === 'collapse') {
      add({ title: 'Collapse', kind: 'fold', frame: preview });
      setCreases([]);
    } else if (result && 'bends' in result && result.bends) {
      const after = model.steps.length + 1;
      add({ title: segments > 1 ? 'Curl' : 'Lift', kind: 'pose', frame: preview });
      shaped.current.set(after, { base: editFrame, bends: result.bends });
    }
  };

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
      if (e.key === 'Enter') {
        if (action === 'collapse' && line) addCrease();
        else apply();
      } else if (e.key === 'Escape') startOver();
      else if (e.key === 'f' || e.key === 'F') setFlipped((f) => !f);
      else if (e.key === 'v' || e.key === 'V') {
        setKind('valley');
        setCreaseKind('valley');
      } else if (e.key === 'm' || e.key === 'M') {
        setKind('mountain');
        setCreaseKind('mountain');
      }
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
      shaped.current.clear();
      startOver();
      setMessage(null);
    } catch (e) {
      setMessage(`Couldn’t open that file: ${(e as Error).message}`);
    }
  };

  const status = message ?? (result && 'error' in result ? result.error : null);
  const waiting = creases.length === 1 ? '1 crease ready' : `${creases.length} creases ready`;
  const hint =
    action === 'collapse' && creases.length && picks.length < 2
      ? `${waiting} · add more, or press Collapse.`
      : picks.length < 2
        ? HINTS[tool]
        : action === 'collapse' || preview
          ? READY[action]
          : null;

  return (
    <div className="app">
      <TopBar
        center="Studio"
        end={
          <>
            {end}
            <button type="button" className="secondary" onClick={() => file.current?.click()}>
              Open
            </button>
            <input ref={file} type="file" accept=".fold,.json" hidden onChange={(e) => void importFile(e.target.files?.[0])} />
            <button type="button" className="secondary" onClick={exportFile}>
              Export .fold
            </button>
            <button type="button" className="secondary" onClick={() => confirm('Start a new model? The current one will be cleared.') && (clear(), shaped.current.clear(), startOver())}>
              New
            </button>
          </>
        }
      />

      <main className="studio">
        <section className="studio-editor">
          <FoldEditor
            frame={editFrame}
            model={model}
            picks={picks}
            line={line}
            kind={action === 'fold' ? kind : action === 'collapse' && creaseKind === 'mountain' ? 'mountain' : 'valley'}
            preview={result && 'frame' in result ? (result.onFlat ?? result.frame) : null}
            extra={creases}
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
            {cloud && <CloudPanel />}
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
          <div className="segmented" role="group" aria-label="Action">
            {ACTIONS.map((a) => (
              <button key={a.id} type="button" aria-pressed={action === a.id} title={a.title} onClick={() => switchAction(a.id)}>
                {a.label}
              </button>
            ))}
          </div>
          <div className="segmented" role="group" aria-label="Fold line">
            <button type="button" aria-pressed={tool === 'onto'} onClick={() => (setTool('onto'), startOver())}>
              Point to point
            </button>
            <button type="button" aria-pressed={tool === 'through'} onClick={() => (setTool('through'), startOver())}>
              Through 2 points
            </button>
          </div>
          {action === 'fold' && (
            <div className="segmented" role="group" aria-label="Fold type">
              <button type="button" aria-pressed={kind === 'valley'} title="Valley (V)" onClick={() => setKind('valley')}>
                Valley
              </button>
              <button type="button" aria-pressed={kind === 'mountain'} title="Mountain (M)" onClick={() => setKind('mountain')}>
                Mountain
              </button>
            </div>
          )}
          {action === 'reverse' && (
            <div className="segmented" role="group" aria-label="Reverse fold">
              <button type="button" aria-pressed={reverseKind === 'inside'} title="The flap goes between its own layers" onClick={() => setReverseKind('inside')}>
                Inside
              </button>
              <button type="button" aria-pressed={reverseKind === 'outside'} title="The flap wraps round its own layers" onClick={() => setReverseKind('outside')}>
                Outside
              </button>
            </div>
          )}
          {action === 'collapse' && (
            <div className="segmented" role="group" aria-label="Crease">
              <button type="button" aria-pressed={creaseKind === 'valley'} title="Fold as a valley (V)" onClick={() => setCreaseKind('valley')}>
                Valley
              </button>
              <button type="button" aria-pressed={creaseKind === 'mountain'} title="Fold as a mountain (M)" onClick={() => setCreaseKind('mountain')}>
                Mountain
              </button>
              <button type="button" aria-pressed={creaseKind === 'flat'} title="Open this crease out flat" onClick={() => setCreaseKind('flat')}>
                Open
              </button>
            </div>
          )}
          {action === 'lift' && (
            <label className="field inline">
              <span>Angle</span>
              <input type="range" min={10} max={170} step={5} value={angle} onChange={(e) => setAngle(Number(e.target.value))} />
              <span className="angle">{angle}°</span>
            </label>
          )}
          {action === 'lift' && (
            <label className="field inline" title="Spread the turn over several bends, rolling the paper instead of creasing it">
              <span>Curl</span>
              <select value={segments} onChange={(e) => setSegments(Number(e.target.value))}>
                <option value={1}>No curl</option>
                <option value={3}>Gentle</option>
                <option value={6}>Smooth</option>
                <option value={10}>Smoother</option>
              </select>
            </label>
          )}
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
          {action === 'collapse' && (
            <>
              <button type="button" className="secondary" disabled={!line} onClick={addCrease} title="Add this crease (Enter)">
                Add crease
              </button>
              <button type="button" className="secondary" disabled={!creases.length} onClick={() => setCreases([])}>
                Clear creases
              </button>
            </>
          )}
          <button
            type="button"
            className="primary"
            disabled={!preview}
            onClick={apply}
            title={action === 'collapse' ? 'Collapse along the added creases' : 'Apply (Enter)'}
          >
            {APPLY_LABEL[action]}
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
