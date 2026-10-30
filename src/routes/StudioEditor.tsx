import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { TopBar } from '../app/TopBar';
import { FoldError } from '../fold/fold';
import { toFoldFile } from '../fold/fold-format';
import { applyOp, OpError, type Op } from '../fold/ops';
import { marksUpTo } from '../fold/marks';
import type { PresetKind } from '../fold/presets';
import { tapeStrip } from '../fold/tape';
import type { Step } from '../fold/types';
import { saveDraft, useDraft } from '../studio/draft';
import { foldRest, unfoldTarget } from '../studio/editor';
import { canInsert, canRemove, canReplace, insertStep, lastFixed, removeStep, replaceStep } from '../studio/steps';
import { CloudPanel } from '../studio/CloudPanel';
import { FoldEditor } from '../studio/FoldEditor';
import { AboutPanel, SheetsPanel } from '../studio/panels';
import { ToolBar } from '../studio/ToolBar';
import { FACE_ACTIONS, presetStep, stepFor, withParts } from '../studio/tools';
import { useTools } from '../studio/useTools';
import { usePlayback } from '../state/playback';
import { useViewer } from '../state/viewer';

const Stage = lazy(() => import('../viewer/Stage'));

/** What each named fold's picks are called on the paper: the two lines of a pleat or crimp, a squash's corner and landing line, and so on. */
const PRESET_LABELS: Record<PresetKind, string[]> = {
  pleat: ['A', 'A', 'B', 'B'],
  crimp: ['A', 'A', 'B', 'B'],
  squash: ['O', 'M'],
  petal: ['P'],
  rabbitEar: ['1', '2', '3'],
};

/**
 * The Studio editor: fold a design step by step, saved to this browser's library as it changes, and export it as
 * a .fold file. Opened from the library at /studio/<id>, with the design already in the draft store.
 *
 * This holds the model's steps and where the next one goes (at the end, in place of one, or before one, and
 * any parts held for a step made of several); the tools for making it are in studio/useTools.ts.
 */
export default function StudioEditor({ end, cloud = false }: {
  end?: React.ReactNode;
  /** Signed in as a creator: show saving to the cloud. */
  cloud?: boolean;
}) {
  const { t } = useTranslation();
  const model = useDraft((s) => s.model);
  const problem = useDraft((s) => s.problem);
  const canUndo = useDraft((s) => s.model.steps.length > 0 || s.history.length > 0);
  const designId = useDraft((s) => s.designId);
  const unsaved = useDraft((s) => s.unsaved);
  const { addStep, undo: undoDraft, change, removeFrom, editStep, setInfo, setSheets } = useDraft.getState();
  // Changing a step in the middle, or adding one before it: the tools then work on the paper before it.
  const [at, setAt] = useState<{ index: number; mode: 'edit' | 'insert' } | null>(null);
  const editing = at && at.index < model.steps.length ? at : null;
  const start = useMemo(() => (editing ? { ...model, steps: model.steps.slice(0, editing.index) } : model), [model, editing]);
  // Parts kept for a step that does several things at once: the tools work on the paper after them.
  const [held, setHeld] = useState<Op[]>([]);
  const before = useMemo(() => {
    try {
      return withParts(start, held);
    } catch {
      return start;
    }
  }, [start, held]);
  const tools = useTools(before);
  const { s } = tools;
  const [message, setMessage] = useState<string | null>(null);

  const add = (step: Step) => {
    if (editing?.mode === 'edit') {
      // The new fold takes the old step's place, keeping its words (its title too, unless it's one the Studio gave it).
      const { title, text, section } = model.steps[editing.index];
      const given = Object.values(t('studio.steps', { returnObjects: true }) as Record<string, string>).includes(title);
      change(replaceStep(model, editing.index, { ...step, ...(!given && { title }), ...(text && { text }), ...(section && { section }) }));
      setAt(null);
    } else if (editing) {
      change(insertStep(model, editing.index, step));
      setAt({ index: editing.index + 1, mode: 'insert' });
    } else addStep(step);
    setHeld([]);
    tools.reset();
    setMessage(null);
  };

  /** Adds a step made by `o` on the paper before any held parts, named as `named` says or after what it does. */
  const addOp = (o: Op, named?: Pick<Step, 'title' | 'kind'>) => {
    try {
      const { frame: next, via, marks: drawn } = applyOp(start, o);
      add({ ...(named ?? stepFor(o, t)), frame: next, ...(via && { via }), ...(drawn && { marks: drawn }), op: o });
    } catch (e) {
      if (!(e instanceof FoldError || e instanceof OpError)) throw e;
      setMessage(e.message);
    }
  };

  /** Ends a step made of the held parts and `last`, if any: one step that does them all at once. */
  const finish = (last?: Op, named?: Pick<Step, 'title' | 'kind'>) => {
    const ops = last ? [...held, last] : held;
    if (ops.length) addOp(ops.length === 1 ? ops[0] : { op: 'together', ops }, held.length ? undefined : named);
  };

  const undo = () => {
    if (held.length) return setHeld((h) => h.slice(0, -1));
    undoDraft();
    setAt(null);
  };

  const cancel = () => {
    setAt(null);
    setHeld([]);
    tools.reset();
  };

  /** Starts changing step `i`, with the tools set as it was made where they can be. */
  const startEdit = (i: number) => {
    setAt({ index: i, mode: 'edit' });
    const made = model.steps[i].op;
    const m = { ...model, steps: model.steps.slice(0, i) };
    // A step made of several parts opens with all but the last held, and the tools set to the last.
    let parts = made?.op === 'together' ? made.ops.slice(0, -1) : [];
    let withHeld = m;
    try {
      withHeld = withParts(m, parts);
    } catch {
      parts = [];
    }
    setHeld(parts);
    tools.load(made?.op === 'together' ? (parts.length ? made.ops.at(-1) : made.ops[0]) : made, withHeld);
    setMessage(null);
    usePlayback.getState().goTo(i);
  };

  const startInsert = (i: number) => {
    setAt({ index: i, mode: 'insert' });
    setHeld([]);
    tools.reset();
    setMessage(null);
    usePlayback.getState().goTo(i);
  };

  const remove = (i: number) => {
    change(removeStep(model, i));
    cancel();
  };

  const apply = () => {
    if (!tools.preview || !tools.op) return;
    finish(tools.op, s.action === 'preset' ? presetStep(s.preset, t) : undefined);
  };

  /** Keeps the step the tools describe as a part of the next step, and clears them for the next part. */
  const hold = () => {
    if (!tools.preview || !tools.op) return;
    setHeld((h) => [...h, tools.op!]);
    tools.reset();
  };

  /** Adds a step that needs no picks, or with parts held, adds it to them. */
  const now = (o: Op) => {
    try {
      applyOp(before, o);
    } catch (e) {
      if (!(e instanceof FoldError || e instanceof OpError)) throw e;
      return setMessage(e.message);
    }
    if (held.length) setHeld((h) => [...h, o]);
    else addOp(o);
  };

  const fixed = lastFixed(model);

  /** Something to draw for a step being picked, or nothing if the picks don't make one yet. */
  const planned = <T,>(make: () => T): T | null => {
    try {
      return make();
    } catch {
      return null;
    }
  };

  // The preview plays the newest step whenever one is added or removed.
  const total = model.steps.length;
  useEffect(() => {
    usePlayback.getState().load(total, total);
  }, [total]);
  useEffect(() => {
    useViewer.getState().init();
    // Leaving the page or the tab writes any change still waiting.
    const leave = () => void saveDraft();
    window.addEventListener('pagehide', leave);
    return () => {
      window.removeEventListener('pagehide', leave);
      leave();
      usePlayback.getState().load(0, 1);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === 'Enter') {
        if (s.action === 'collapse' && tools.line) tools.addCrease();
        else apply();
      } else if (e.key === 'Escape') {
        if (s.pickMode !== 'points') tools.set({ pickMode: 'points' });
        else if (!s.picks.length && editing) cancel();
        tools.startOver();
      }
      else if (e.key === 'f' || e.key === 'F') tools.update((prev) => ({ flipped: !prev.flipped }));
      else if (e.key === 'v' || e.key === 'V') tools.set({ kind: 'valley', creaseKind: 'valley' });
      else if (e.key === 'm' || e.key === 'M') tools.set({ kind: 'mountain', creaseKind: 'mountain' });
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

  const status = message ?? tools.error;
  const onPaper = useMemo(() => marksUpTo(before, before.steps.length).map((m) => m.mark), [before]);
  const { result } = tools;

  return (
    <div className="app">
      <TopBar
        center={t('common.studio')}
        end={
          <>
            {end}
            <Link to="/studio" className="secondary">
              {t('library.heading')}
            </Link>
            <Link to={`/mine/${designId}`} className="secondary" title={t('library.foldItTitle')}>
              {t('library.foldIt')}
            </Link>
            <button type="button" className="secondary" onClick={exportFile}>
              {t('studio.export')}
            </button>
          </>
        }
      />

      <main className="studio">
        <section className="studio-editor">
          <FoldEditor
            frame={tools.editFrame}
            model={model}
            picks={s.picks}
            labels={
              s.action === 'draw' ? [''] : s.action === 'popUp' ? ['O', '1'] : s.action === 'preset' ? PRESET_LABELS[s.preset] : s.tool === 'edges' ? ['A', 'A', 'B', 'B'] : undefined
            }
            line={tools.line}
            kind={s.action === 'fold' ? s.kind : s.action === 'collapse' && s.creaseKind === 'mountain' ? 'mountain' : 'valley'}
            preview={result && 'frame' in result ? (result.onFlat ?? result.frame) : null}
            extra={s.action === 'lift' ? s.bends.map((b) => ({ line: b.line, kind: 'valley' })) : s.action === 'preset' ? tools.presetCreases : s.creases}
            // A cut about to be made, or the way a pop-up's first crease points.
            cut={(s.action === 'cut' || s.action === 'popUp') && s.picks.length === 2 ? [s.picks[0], s.picks[1]] : null}
            tape={s.action === 'tape' && s.picks.length === 2 ? planned(() => tapeStrip(s.picks[0], s.picks[1], s.tapeWidth)) : null}
            free={s.action === 'cut' || s.action === 'tape' || s.action === 'preset' || s.action === 'draw' || s.action === 'popUp' || s.pickMode === 'anchor'}
            marks={onPaper}
            drawing={s.action === 'draw' ? [...s.marks.map((m) => ({ points: m.table, fill: !!m.mark.fill })), { points: s.picks, fill: s.fill }] : []}
            faces={FACE_ACTIONS.includes(s.action) && (s.pickMode === 'faces' || s.picked.length) ? s.picked : null}
            anchor={tools.anchor?.spot ?? null}
            onPick={tools.pick}
            onFace={s.pickMode === 'faces' ? tools.pickFace : undefined}
          />
          {(status || tools.hint) && <div className={status ? 'badge error' : 'badge'}>{status ?? tools.hint}</div>}
        </section>

        <aside className="studio-side">
          <div className="studio-preview">
            <Suspense fallback={null}>
              <Stage model={model} />
            </Suspense>
          </div>
          <div className="studio-steps">
            {unsaved && (
              <p className="error-text" role="alert">
                {t('studio.saveFailed')}
              </p>
            )}
            {cloud && <CloudPanel />}
            <label className="field">
              <span>{t('studio.title')}</span>
              <input value={model.title} onChange={(e) => setInfo({ title: e.target.value })} />
            </label>
            <label className="field">
              <span>{t('studio.fileName')}</span>
              <input value={model.id} onChange={(e) => setInfo({ id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} />
            </label>
            <AboutPanel model={model} onChange={setInfo} />
            <SheetsPanel sheets={model.sheets} locked={model.steps.length > 0} onChange={(next) => (setSheets(next), tools.set({ sheet: 'all' }))} />
            {editing && (
              <div className="studio-note">
                <span>{editing.mode === 'edit' ? t('studio.changing', { n: editing.index + 1 }) : t('studio.inserting', { n: editing.index + 1 })}</span>
                <button type="button" className="link small" onClick={cancel}>
                  {t('studio.cancel')}
                </button>
              </div>
            )}
            {held.length > 0 && (
              <div className="studio-note">
                <span>{t('studio.held', { count: held.length })}</span>
                <button type="button" className="link small" onClick={() => finish()} title={t('studio.finishTitle')}>
                  {t('studio.finish')}
                </button>
                <button type="button" className="link small" onClick={() => setHeld([])}>
                  {t('studio.drop')}
                </button>
              </div>
            )}
            {problem && (
              <div className="studio-note error" role="alert">
                <span>{t('studio.problem', { n: problem.step, error: problem.message })}</span>
                <button type="button" className="link small" onClick={() => startEdit(problem.step - 1)}>
                  {t('studio.fixStep')}
                </button>
                <button type="button" className="link small" onClick={() => (removeFrom(problem.step - 1), cancel())}>
                  {t('studio.removeFrom', { n: problem.step })}
                </button>
              </div>
            )}
            {fixed >= 0 && model.steps.length > 0 && <p className="muted small">{t('studio.fixed', { n: fixed + 1 })}</p>}
            <ol>
              {model.steps.map((step, i) => (
                <li key={i} className={[editing?.index === i && editing.mode, problem && i >= problem.step - 1 && 'stale'].filter(Boolean).join(' ') || undefined}>
                  <div className="step-head">
                    <button type="button" className="link small" onClick={() => usePlayback.getState().goTo(i + 1)}>
                      {t('studio.step', { n: i + 1 })}
                    </button>
                    <span className="step-tools">
                      <button type="button" className="link small" disabled={!canReplace(model, i)} title={t('studio.changeTitle')} onClick={() => startEdit(i)}>
                        {t('studio.change')}
                      </button>
                      <button type="button" className="link small" disabled={!canInsert(model, i)} title={t('studio.insertTitle')} onClick={() => startInsert(i)}>
                        {t('studio.insert')}
                      </button>
                      <button type="button" className="link small" disabled={!canRemove(model, i)} title={t('studio.removeTitle')} onClick={() => remove(i)}>
                        {t('studio.removeStep')}
                      </button>
                    </span>
                  </div>
                  <input aria-label={t('studio.stepTitle', { n: i + 1 })} value={step.title} onChange={(e) => editStep(i, { title: e.target.value })} />
                  <textarea
                    aria-label={t('studio.stepText', { n: i + 1 })}
                    placeholder={t('studio.instructions')}
                    rows={2}
                    value={step.text ?? ''}
                    onChange={(e) => editStep(i, { text: e.target.value || undefined })}
                  />
                </li>
              ))}
            </ol>
            {!model.steps.length && <p className="muted small">{t('studio.noSteps')}</p>}
          </div>
        </aside>
      </main>

      <ToolBar
        tools={tools}
        sheets={model.sheets.length}
        canUndo={canUndo || held.length > 0}
        unfoldable={unfoldTarget(before.steps) !== null}
        rest={typeof s.sheet === 'number' ? foldRest(before, s.sheet) : null}
        onHold={hold}
        onApply={apply}
        onNow={now}
        onUndo={undo}
      />
    </div>
  );
}
