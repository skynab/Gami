import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TopBar } from '../app/TopBar';
import { collapse, type Crease } from '../fold/collapse';
import { fold, FoldError, rotate, turnOver, unfoldStep, type FoldKind } from '../fold/fold';
import { fromFoldFile, toFoldFile } from '../fold/fold-format';
import { framesOf } from '../fold/frames';
import { flipLine, lineEdgeOnto, lineOnto, lineThrough, type Line } from '../fold/geometry2d';
import { place } from '../fold/place';
import { sheetOf } from '../fold/sheets';
import type { FoldFrame, Sheet, Step, Vec2 } from '../fold/types';
import { useDraft } from '../studio/draft';
import { curl, reparent, shape, type Bend } from '../fold/shape';
import { anchorFor, smallerSideMoves, topLayers, unfoldTarget } from '../studio/editor';
import { CloudPanel } from '../studio/CloudPanel';
import { FoldEditor } from '../studio/FoldEditor';
import { usePlayback } from '../state/playback';
import { useViewer } from '../state/viewer';

const Stage = lazy(() => import('../viewer/Stage'));

type Tool = 'onto' | 'through' | 'edges';
type Layers = 'all' | 1 | 2 | 3;
/**
 * What the picked line does: a plain fold, a reverse fold, a crease for a collapse, or lifting into 3D.
 * Or, for models of several sheets, moving one sheet (picking where its middle goes).
 */
type Action = 'fold' | 'reverse' | 'collapse' | 'lift' | 'move';

const ACTIONS: Action[] = ['fold', 'reverse', 'collapse', 'lift', 'move'];

/** Sheet sizes to start from (names in `studio.sizes`). */
const SIZES = [
  { id: 'square', size: [1, 1] },
  { id: 'half', size: [0.5, 1] },
  { id: 'a4', size: [1, Math.SQRT2] },
] as const;
const sizeOf = (s: Sheet) => SIZES.find((o) => o.size[0] === s.size[0] && o.size[1] === s.size[1])?.id ?? 'other';

/**
 * The Studio editor: fold a model step by step and export it as a .fold file. Creators reach it through
 * /studio (signed in); in development builds it's also at /studio/dev without signing in.
 */
export default function StudioEditor({ end, cloud = false }: {
  end?: React.ReactNode;
  /** Signed in as a creator: show saving to the cloud. */
  cloud?: boolean;
}) {
  const { t } = useTranslation();
  const model = useDraft((s) => s.model);
  const { addStep, undo, editStep, setInfo, setSheets, replace, clear, current } = useDraft.getState();
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
  // Models of several sheets: which one the next step works on (or all), and for a move, how it's put down.
  const [sheet, setSheet] = useState<number | 'all'>('all');
  const [turn, setTurn] = useState(0);
  const [overturn, setOverturn] = useState(false);
  const [underneath, setUnderneath] = useState(false);
  const [tuck, setTuck] = useState<number | null>(null);
  const many = model.sheets.length > 1;
  const chosen = many && sheet !== 'all' && sheet < model.sheets.length ? sheet : null;
  const inSheet = useMemo(() => (chosen === null ? undefined : (paper: Vec2[]) => sheetOf(model.sheets, paper) === chosen), [chosen, model.sheets]);
  const [picks, setPicks] = useState<Vec2[]>([]);
  const [flipped, setFlipped] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  // Picks a fold line needs: two points, or for edge to edge, two along each edge.
  const needs = tool === 'edges' ? 4 : 2;
  const line = useMemo((): Line | null => {
    if (picks.length < needs) return null;
    const [a, b, c, d] = picks;
    const base = tool === 'onto' ? lineOnto(a, b) : tool === 'edges' ? lineEdgeOnto(a, b, c, d) : smallerSideMoves(editFrame, lineThrough(a, b));
    return base && (flipped ? flipLine(base) : base);
  }, [picks, needs, tool, editFrame, flipped]);

  const n = layers === 'all' ? undefined : layers;
  // For a lift, `onFlat` is the preview with its faces matched to the flat state the lines are picked on.
  const result = useMemo((): { frame: FoldFrame; onFlat?: FoldFrame; bends?: Bend[] } | { error: string } | null => {
    if (action === 'move') {
      if (!inSheet) return { error: t('studio.errors.chooseSheet') };
      try {
        return { frame: place(frame, { only: inSheet, to: picks[0], angle: (turn * Math.PI) / 180, flip: overturn, under: underneath }) };
      } catch (e) {
        if (e instanceof FoldError) return { error: e.message };
        throw e;
      }
    }
    // A collapse previews the creases added so far; the others preview the picked line.
    if (action === 'collapse' ? !creases.length : !line) return null;
    try {
      if (action === 'fold') return { frame: fold(frame, { line: line!, kind, layers: n, only: inSheet }) };
      if (action === 'lift') {
        if (!shaping && frame.vertices_coords.some((p) => Math.abs(p[1]) > 1e-6))
          throw new FoldError(t('studio.errors.shaped'));
        const bends = [...(shaping?.bends ?? []), ...curl(editFrame, { line: line!, angle: (angle * Math.PI) / 180, layers: n, only: inSheet }, segments)];
        const lifted = shape(editFrame, bends);
        return { frame: shaping ? reparent(frame, lifted) : lifted, onFlat: lifted, bends };
      }
      const anchor = anchorFor(frame, action === 'reverse' ? [line!] : creases.map((c) => c.line), inSheet);
      if (!anchor) throw new FoldError(t('studio.errors.noStill'));
      const list: Crease[] =
        action === 'reverse' ? [{ line: line!, kind: reverseKind, only: both(n === undefined ? undefined : topLayers(frame, line!, n), inSheet) }] : creases;
      // Tucking: the paper that moves slides under the chosen sheet.
      const under = action === 'collapse' && tuck !== null ? (paper: Vec2[]) => sheetOf(model.sheets, paper) === tuck : undefined;
      return { frame: collapse(frame, { creases: list, anchor, under }) };
    } catch (e) {
      if (e instanceof FoldError) return { error: e.message };
      throw e;
    }
  }, [frame, editFrame, shaping, line, kind, n, action, reverseKind, creases, angle, segments, inSheet, picks, turn, overturn, underneath, tuck, model.sheets, t]);
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
      const only = both(n === undefined ? undefined : topLayers(frame, line, n), inSheet);
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
    if (action === 'fold') add({ title: t(`studio.steps.${kind}`), kind: 'fold', frame: preview });
    else if (action === 'reverse') add({ title: t(`studio.steps.${reverseKind}`), kind: 'reverse', frame: preview });
    else if (action === 'collapse') {
      add({ title: t('studio.steps.collapse'), kind: 'fold', frame: preview });
      setCreases([]);
    } else if (action === 'move') add({ title: t('studio.steps.move'), kind: 'assemble', frame: preview });
    else if (result && 'bends' in result && result.bends) {
      const after = model.steps.length + 1;
      add({ title: segments > 1 ? t('studio.steps.curl') : t('studio.steps.lift'), kind: 'pose', frame: preview });
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
  const doUnfold = () => target !== null && safely(() => ({ title: t('studio.steps.unfold'), kind: 'unfold', ...unfoldStep(framesOf(model), target) }));
  const doTurnOver = () => safely(() => ({ title: t('studio.steps.turnOver'), kind: 'turn-over', frame: turnOver(frame) }));
  const doRotate = () => safely(() => ({ title: t('studio.steps.rotate'), kind: 'rotate', frame: rotate(frame, Math.PI / 2) }));

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
      setMessage(t('studio.openFailed', { error: (e as Error).message }));
    }
  };

  const status = message ?? (result && 'error' in result ? result.error : null);
  const hint =
    action === 'move'
      ? preview
        ? picks.length
          ? t('studio.hints.move')
          : t('studio.hints.moveWhere')
        : null
      : action === 'collapse' && creases.length && picks.length < needs
        ? t('studio.hints.creases', { count: creases.length })
        : picks.length < needs
          ? t(`studio.hints.${tool}`)
          : action === 'collapse' || preview
            ? t(`studio.hints.${action}`)
            : null;

  return (
    <div className="app">
      <TopBar
        center={t('common.studio')}
        end={
          <>
            {end}
            <button type="button" className="secondary" onClick={() => file.current?.click()}>
              {t('studio.open')}
            </button>
            <input ref={file} type="file" accept=".fold,.json" hidden onChange={(e) => void importFile(e.target.files?.[0])} />
            <button type="button" className="secondary" onClick={exportFile}>
              {t('studio.export')}
            </button>
            <button type="button" className="secondary" onClick={() => confirm(t('studio.newConfirm')) && (clear(), shaped.current.clear(), startOver())}>
              {t('studio.new')}
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
            labels={tool === 'edges' ? ['A', 'A', 'B', 'B'] : undefined}
            line={line}
            kind={action === 'fold' ? kind : action === 'collapse' && creaseKind === 'mountain' ? 'mountain' : 'valley'}
            preview={result && 'frame' in result ? (result.onFlat ?? result.frame) : null}
            extra={creases}
            onPick={(p) => setPicks((prev) => (action === 'move' || prev.length >= needs ? [p] : [...prev, p]))}
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
              <span>{t('studio.title')}</span>
              <input value={model.title} onChange={(e) => setInfo({ title: e.target.value })} />
            </label>
            <label className="field">
              <span>{t('studio.fileName')}</span>
              <input value={model.id} onChange={(e) => setInfo({ id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} />
            </label>
            <SheetsPanel sheets={model.sheets} locked={model.steps.length > 0} onChange={(next) => (setSheets(next), setSheet('all'))} />
            <ol>
              {model.steps.map((s, i) => (
                <li key={i}>
                  <button type="button" className="link small" onClick={() => usePlayback.getState().goTo(i + 1)}>
                    {t('studio.step', { n: i + 1 })}
                  </button>
                  <input aria-label={t('studio.stepTitle', { n: i + 1 })} value={s.title} onChange={(e) => editStep(i, { title: e.target.value })} />
                  <textarea
                    aria-label={t('studio.stepText', { n: i + 1 })}
                    placeholder={t('studio.instructions')}
                    rows={2}
                    value={s.text ?? ''}
                    onChange={(e) => editStep(i, { text: e.target.value || undefined })}
                  />
                </li>
              ))}
            </ol>
            {!model.steps.length && <p className="muted small">{t('studio.noSteps')}</p>}
          </div>
        </aside>
      </main>

      <footer className="bottombar">
        <div className="group">
          <div className="segmented" role="group" aria-label={t('studio.actions.action')}>
            {ACTIONS.filter((a) => a !== 'move' || many).map((a) => (
              <button key={a} type="button" aria-pressed={action === a} title={t(`studio.actions.${a}Title`)} onClick={() => switchAction(a)}>
                {t(`studio.actions.${a}`)}
              </button>
            ))}
          </div>
          {many && (
            <label className="field inline" title={t('studio.sheetTitle')}>
              <span>{t('studio.sheet')}</span>
              <select value={String(sheet)} onChange={(e) => setSheet(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
                <option value="all">{action === 'move' ? t('studio.choose') : t('studio.all')}</option>
                {model.sheets.map((_, i) => (
                  <option key={i} value={i}>
                    {t('studio.sheetN', { n: i + 1 })}
                  </option>
                ))}
              </select>
            </label>
          )}
          {action === 'move' && (
            <>
              <label className="field inline">
                <span>{t('studio.turn')}</span>
                <select value={turn} onChange={(e) => setTurn(Number(e.target.value))}>
                  {[0, 45, 90, 135, 180, -135, -90, -45].map((d) => (
                    <option key={d} value={d}>
                      {d === 0 ? t('studio.none') : t(d > 0 ? 'studio.anticlockwise' : 'studio.clockwise', { deg: Math.abs(d) })}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field inline">
                <input type="checkbox" checked={overturn} onChange={(e) => setOverturn(e.target.checked)} />
                <span>{t('studio.turnOver')}</span>
              </label>
              <label className="field inline">
                <input type="checkbox" checked={underneath} onChange={(e) => setUnderneath(e.target.checked)} />
                <span>{t('studio.underneath')}</span>
              </label>
            </>
          )}
          {action !== 'move' && (
          <div className="segmented" role="group" aria-label={t('studio.foldLine')}>
            <button type="button" aria-pressed={tool === 'onto'} onClick={() => (setTool('onto'), startOver())}>
              {t('studio.pointToPoint')}
            </button>
            <button type="button" aria-pressed={tool === 'through'} onClick={() => (setTool('through'), startOver())}>
              {t('studio.throughTwo')}
            </button>
            <button type="button" aria-pressed={tool === 'edges'} title={t('studio.edgeToEdgeTitle')} onClick={() => (setTool('edges'), startOver())}>
              {t('studio.edgeToEdge')}
            </button>
          </div>
          )}
          {action === 'fold' && (
            <div className="segmented" role="group" aria-label={t('studio.foldType')}>
              <button type="button" aria-pressed={kind === 'valley'} title={t('studio.valleyTitle')} onClick={() => setKind('valley')}>
                {t('studio.valley')}
              </button>
              <button type="button" aria-pressed={kind === 'mountain'} title={t('studio.mountainTitle')} onClick={() => setKind('mountain')}>
                {t('studio.mountain')}
              </button>
            </div>
          )}
          {action === 'reverse' && (
            <div className="segmented" role="group" aria-label={t('studio.reverseFold')}>
              <button type="button" aria-pressed={reverseKind === 'inside'} title={t('studio.insideTitle')} onClick={() => setReverseKind('inside')}>
                {t('studio.inside')}
              </button>
              <button type="button" aria-pressed={reverseKind === 'outside'} title={t('studio.outsideTitle')} onClick={() => setReverseKind('outside')}>
                {t('studio.outside')}
              </button>
            </div>
          )}
          {action === 'collapse' && (
            <div className="segmented" role="group" aria-label={t('studio.crease')}>
              <button type="button" aria-pressed={creaseKind === 'valley'} title={t('studio.creaseValley')} onClick={() => setCreaseKind('valley')}>
                {t('studio.valley')}
              </button>
              <button type="button" aria-pressed={creaseKind === 'mountain'} title={t('studio.creaseMountain')} onClick={() => setCreaseKind('mountain')}>
                {t('studio.mountain')}
              </button>
              <button type="button" aria-pressed={creaseKind === 'flat'} title={t('studio.openTitle')} onClick={() => setCreaseKind('flat')}>
                {t('studio.openCrease')}
              </button>
            </div>
          )}
          {action === 'collapse' && many && (
            <label className="field inline" title={t('studio.slideUnderTitle')}>
              <span>{t('studio.slideUnder')}</span>
              <select value={tuck === null ? '' : String(tuck)} onChange={(e) => setTuck(e.target.value === '' ? null : Number(e.target.value))}>
                <option value="">{t('studio.nothing')}</option>
                {model.sheets.map((_, i) => (
                  <option key={i} value={i}>
                    {t('studio.sheetN', { n: i + 1 })}
                  </option>
                ))}
              </select>
            </label>
          )}
          {action === 'lift' && (
            <label className="field inline">
              <span>{t('studio.angle')}</span>
              <input type="range" min={10} max={170} step={5} value={angle} onChange={(e) => setAngle(Number(e.target.value))} />
              <span className="angle">{angle}°</span>
            </label>
          )}
          {action === 'lift' && (
            <label className="field inline" title={t('studio.curlTitle')}>
              <span>{t('studio.curl')}</span>
              <select value={segments} onChange={(e) => setSegments(Number(e.target.value))}>
                <option value={1}>{t('studio.curls.none')}</option>
                <option value={3}>{t('studio.curls.gentle')}</option>
                <option value={6}>{t('studio.curls.smooth')}</option>
                <option value={10}>{t('studio.curls.smoother')}</option>
              </select>
            </label>
          )}
          {action !== 'move' && (
          <label className="field inline">
            <span>{t('studio.layers')}</span>
            <select value={String(layers)} onChange={(e) => setLayers(e.target.value === 'all' ? 'all' : (Number(e.target.value) as Layers))}>
              <option value="all">{t('studio.all')}</option>
              {[1, 2, 3].map((k) => (
                <option key={k} value={k}>
                  {t('studio.topN', { n: k })}
                </option>
              ))}
            </select>
          </label>
          )}
          {action !== 'move' && (
          <button type="button" className="secondary" disabled={!line} onClick={() => setFlipped(!flipped)} title={t('studio.flipTitle')}>
            {t('studio.flipSide')}
          </button>
          )}
          {action === 'collapse' && (
            <>
              <button type="button" className="secondary" disabled={!line} onClick={addCrease} title={t('studio.addCreaseTitle')}>
                {t('studio.addCrease')}
              </button>
              <button type="button" className="secondary" disabled={!creases.length} onClick={() => setCreases([])}>
                {t('studio.clearCreases')}
              </button>
            </>
          )}
          <button
            type="button"
            className="primary"
            disabled={!preview}
            onClick={apply}
            title={action === 'collapse' ? t('studio.collapseTitle') : t('studio.applyTitle')}
          >
            {t(`studio.apply.${action}`)}
          </button>
        </div>
        <div className="group">
          <button type="button" className="secondary" onClick={doTurnOver}>
            {t('studio.turnOverButton')}
          </button>
          <button type="button" className="secondary" onClick={doRotate}>
            {t('studio.rotate')}
          </button>
          <button type="button" className="secondary" disabled={target === null} onClick={doUnfold}>
            {t('studio.unfold')}
          </button>
          <button type="button" className="secondary" disabled={!model.steps.length} onClick={undo} title={t('studio.undoTitle')}>
            {t('studio.undo')}
          </button>
        </div>
      </footer>
    </div>
  );
}

/** Both tests, when there are two (either one alone otherwise). */
function both(a?: (p: Vec2[]) => boolean, b?: (p: Vec2[]) => boolean): ((p: Vec2[]) => boolean) | undefined {
  return a && b ? (p) => a(p) && b(p) : (a ?? b);
}

/** The sheets a model starts from: their colours and size, and adding or removing sheets (before the first step). */
function SheetsPanel({ sheets, locked, onChange }: { sheets: Sheet[]; locked: boolean; onChange(sheets: Sheet[]): void }) {
  const { t } = useTranslation();
  const edit = (i: number, patch: Partial<Sheet>) => onChange(sheets.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  return (
    <fieldset className="sheets" disabled={locked}>
      <legend>{sheets.length === 1 ? t('studio.paper') : t('studio.paperSheets', { count: sheets.length })}</legend>
      {sheets.map((s, i) => (
        <div key={i} className="sheet-row">
          {sheets.length > 1 && <span className="small">{t('studio.sheetN', { n: i + 1 })}</span>}
          <input type="color" value={s.front} onChange={(e) => edit(i, { front: e.target.value })} title={t('studio.front')} aria-label={t('studio.frontColour', { n: i + 1 })} />
          <input type="color" value={s.back} onChange={(e) => edit(i, { back: e.target.value })} title={t('studio.back')} aria-label={t('studio.backColour', { n: i + 1 })} />
          <select
            value={sizeOf(s)}
            onChange={(e) => edit(i, { size: [...SIZES.find((o) => o.id === e.target.value)!.size] as [number, number] })}
            aria-label={t('studio.size', { n: i + 1 })}
          >
            {sizeOf(s) === 'other' && <option value="other">{`${s.size[0]} × ${s.size[1]}`}</option>}
            {SIZES.map((o) => (
              <option key={o.id} value={o.id}>
                {t(`studio.sizes.${o.id}`)}
              </option>
            ))}
          </select>
          {sheets.length > 1 && !locked && (
            <button type="button" className="link small" onClick={() => onChange(sheets.filter((_, j) => j !== i))}>
              {t('studio.remove')}
            </button>
          )}
        </div>
      ))}
      {locked ? (
        <p className="muted small">{t('studio.paperSet')}</p>
      ) : (
        <button type="button" className="link small" onClick={() => onChange([...sheets, { ...sheets.at(-1)!, origin: undefined }])}>
          {t('studio.addSheet')}
        </button>
      )}
    </fieldset>
  );
}
