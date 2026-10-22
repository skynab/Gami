import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TopBar } from '../app/TopBar';
import type { CreaseKind } from '../fold/collapse';
import { FoldError, type FoldKind } from '../fold/fold';
import { fromFoldFile, toFoldFile } from '../fold/fold-format';
import type { Line } from '../fold/geometry2d';
import { applyOp, atOf, lineOf, NoStillError, OpError, opKind, shapingBase, type At, type Faces, type LineSpec, type Op, type ShapeBend } from '../fold/ops';
import { marksUpTo } from '../fold/marks';
import { locate } from '../fold/select';
import { CATEGORIES, DIFFICULTIES, type About, type FoldFrame, type Mark, type OrigamiModel, type Sheet, type Step, type StepKind, type Vec2 } from '../fold/types';
import { useDraft } from '../studio/draft';
import { markAt, markOnTable, popRays, popSettings, project, toggleFace, unfoldTarget, viewBox } from '../studio/editor';
import { canInsert, canRemove, canReplace, insertStep, lastFixed, removeStep, replaceStep } from '../studio/steps';
import { CloudPanel } from '../studio/CloudPanel';
import { FoldEditor } from '../studio/FoldEditor';
import { usePlayback } from '../state/playback';
import { useViewer } from '../state/viewer';

const Stage = lazy(() => import('../viewer/Stage'));

type Tool = 'onto' | 'through' | 'edges';
type Layers = 'all' | 1 | 2 | 3;
/**
 * What the picked line does: a plain fold, a reverse fold, a crease for a collapse, or lifting into 3D.
 * Or popping the model up about a point (picking the point, then which way the first crease points), a
 * scissor cut (picking where it starts and ends), drawing on the paper (picking points along the mark), or,
 * for models of several sheets, moving one sheet (picking where its middle goes).
 */
type Action = 'fold' | 'reverse' | 'collapse' | 'lift' | 'popUp' | 'cut' | 'draw' | 'move';

const ACTIONS: Action[] = ['fold', 'reverse', 'collapse', 'lift', 'popUp', 'cut', 'draw', 'move'];
/** Actions that can be limited to faces picked by clicking them. */
const FACE_ACTIONS: Action[] = ['fold', 'reverse', 'collapse', 'lift', 'cut'];
/** Actions that pick a fold line. */
const LINE_ACTIONS: Action[] = ['fold', 'reverse', 'collapse', 'lift'];
/** What clicks on the paper do: pick points, pick faces, or pick the paper that stays put while posing. */
type PickMode = 'points' | 'faces' | 'anchor';

/** Sheet sizes to start from (names in `studio.sizes`). */
const SIZES = [
  { id: 'square', size: [1, 1] },
  { id: 'half', size: [0.5, 1] },
  { id: 'a4', size: [1, Math.SQRT2] },
] as const;
const sizeOf = (s: Sheet) => SIZES.find((o) => o.size[0] === s.size[0] && o.size[1] === s.size[1])?.id ?? 'other';

const radians = (degrees: number) => (degrees * Math.PI) / 180;

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
  const problem = useDraft((s) => s.problem);
  const canUndo = useDraft((s) => s.model.steps.length > 0 || s.history.length > 0);
  const { addStep, undo: undoDraft, change, removeFrom, editStep, setInfo, setSheets, replace, clear } = useDraft.getState();
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
  const frame = before.steps.at(-1)?.frame ?? before.start;

  const [tool, setTool] = useState<Tool>('onto');
  const [action, setAction] = useState<Action>('fold');
  const [kind, setKind] = useState<FoldKind>('valley');
  const [reverseKind, setReverseKind] = useState<'inside' | 'outside'>('inside');
  const [creaseKind, setCreaseKind] = useState<'valley' | 'mountain' | 'flat'>('valley');
  const [creases, setCreases] = useState<{ line: Line; kind: CreaseKind; op: CreaseOp }[]>([]);
  const [angle, setAngle] = useState(90);
  const [segments, setSegments] = useState(1);
  // A lift can turn the paper about several lines at once, as walls rising together (`corners`), or posed
  // crease by crease from paper that stays put (`chained`).
  const [bends, setBends] = useState<{ line: Line; op: ShapeBend }[]>([]);
  const [corners, setCorners] = useState(false);
  const [chained, setChained] = useState(false);
  // Where it was picked on the table, and the point of the sheet it names (kept exactly when loaded from a step).
  const [anchorPick, setAnchorPick] = useState<{ spot: Vec2; at: At } | null>(null);
  // Popping up: how many creases rise from the point, and how steeply every other one rises.
  const [rays, setRays] = useState(8);
  const [steep, setSteep] = useState(60);
  // Drawing: marks kept for this step (with where they are on the table), and whether the next is filled in.
  const [marks, setMarks] = useState<{ mark: Mark; table: Vec2[] }[]>([]);
  const [fill, setFill] = useState(false);
  // After a lift, another lift adds to its bends, picking lines on the flat state the lifts started from.
  const base = useMemo(() => shapingBase(before), [before]);
  const editFrame = base ?? frame;
  const [layers, setLayers] = useState<Layers>('all');
  // Models of several sheets: which one the next step works on (or all), and for a move, how it's put down.
  const [sheet, setSheet] = useState<number | 'all'>('all');
  const [turn, setTurn] = useState(0);
  const [overturn, setOverturn] = useState(false);
  const [underneath, setUnderneath] = useState(false);
  const [tuck, setTuck] = useState<number | null>(null);
  const many = model.sheets.length > 1;
  const chosen = many && sheet !== 'all' && sheet < model.sheets.length ? sheet : null;
  const [picks, setPicks] = useState<Vec2[]>([]);
  const [flipped, setFlipped] = useState(false);
  // Faces picked by clicking, as outlines on the sheet: the step then folds only those.
  const [pickMode, setPickMode] = useState<PickMode>('points');
  const [picked, setPicked] = useState<Vec2[][]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  // Picks a fold line needs: two points, or for edge to edge, two along each edge (a cut needs its two ends,
  // a pop-up its point and a direction). A mark takes as many as it likes.
  // Each is kept as the point of the sheet picked, so the step follows the paper if an earlier one changes.
  const needs = action === 'draw' ? Infinity : tool === 'edges' && LINE_ACTIONS.includes(action) ? 4 : 2;
  const spec = useMemo((): LineSpec | null => {
    if (!LINE_ACTIONS.includes(action) || picks.length < needs) return null;
    const [a, b, c, d] = picks.map((p) => atOf(editFrame, p));
    return tool === 'onto' ? { onto: [a, b] } : tool === 'edges' ? { edgeOnto: [[a, b], [c, d]] } : { through: [a, b], moving: 'smaller' };
  }, [action, picks, needs, tool, editFrame]);
  const line = useMemo((): Line | null => {
    if (!spec) return null;
    try {
      return lineOf(spec, editFrame, flipped);
    } catch (e) {
      if (e instanceof FoldError) return null;
      throw e;
    }
  }, [spec, editFrame, flipped]);

  const n = layers === 'all' ? undefined : layers;
  const facesPicked: Faces | undefined = FACE_ACTIONS.includes(action) && picked.length ? { inPaper: picked } : undefined;
  const inSheet: Faces | undefined = chosen === null ? undefined : { sheet: chosen };
  const only = allOf(inSheet, facesPicked);

  // The mark the picks make so far, on the paper under its first point.
  const mark = useMemo(
    () => (action === 'draw' && picks.length >= (fill ? 3 : 2) ? markAt(editFrame, picks, fill) : null),
    [action, picks, fill, editFrame],
  );
  // Posing crease by crease: the paper that stays put, picked or else the middle of the paper.
  const anchor = useMemo((): { spot: Vec2; at: At } | null => {
    if (action !== 'lift' || !chained) return null;
    if (anchorPick) return anchorPick;
    const [x, z, s] = viewBox(project(editFrame).flatMap((f) => f.world), 0);
    const spot: Vec2 = [x + s / 2, z + s / 2];
    return { spot, at: atOf(editFrame, spot) };
  }, [action, chained, anchorPick, editFrame]);
  const anchorAt = anchor?.at ?? null;

  const bendOf = (s: LineSpec): ShapeBend => ({
    line: s,
    ...(flipped && { flip: true }),
    degrees: angle,
    ...(segments > 1 && { segments }),
    ...(n !== undefined && { layers: n }),
    ...(only && { only }),
  });

  // The step the tools describe now, if they describe one.
  const op = useMemo((): Op | null => {
    const anchor = { auto: true as const, ...(inSheet && { among: inSheet }) };
    const flip = flipped ? { flip: true } : {};
    if (action === 'move')
      return chosen === null ? null : { op: 'move', only: { sheet: chosen }, ...(picks[0] && { to: { table: picks[0] } }), degrees: turn, flip: overturn, under: underneath };
    if (action === 'cut') {
      if (picks.length < 2) return null;
      const [from, to] = picks.map((p) => atOf(editFrame, p));
      return { op: 'cut', from, to, ...(n !== undefined && { layers: n }), ...(only && { only }) };
    }
    if (action === 'draw') {
      const all = [...marks.map((m) => m.mark), ...(mark ? [mark] : [])];
      return all.length ? { op: 'draw', marks: all } : null;
    }
    if (action === 'popUp') {
      if (picks.length < 2) return null;
      const r = popRays(rays, Math.atan2(picks[1][1] - picks[0][1], picks[1][0] - picks[0][0]), radians(steep));
      return r && { op: 'popUp', centre: atOf(editFrame, picks[0]), rays: r };
    }
    if (action === 'collapse')
      return creases.length ? { op: 'collapse', creases: creases.map((c) => c.op), anchor, ...(tuck !== null && { under: { sheet: tuck } }) } : null;
    if (action === 'lift') {
      const all = [...bends.map((b) => b.op), ...(spec && line ? [bendOf(spec)] : [])];
      if (!all.length || (chained && !(anchorAt && 'paper' in anchorAt))) return null;
      return { op: 'shape', bends: all, ...(corners && { corners: true }), ...(chained && anchorAt && 'paper' in anchorAt && { chained: anchorAt }) };
    }
    if (!spec || !line) return null;
    if (action === 'fold') return { op: 'fold', line: spec, ...flip, kind, ...(n !== undefined && { layers: n }), ...(only && { only }) };
    const faces = creaseFaces(n, chosen, facesPicked);
    return { op: 'collapse', creases: [{ line: spec, ...flip, kind: reverseKind, ...(faces && { only: faces }) }], anchor };
    // bendOf reads angle, segments, n, only and flipped, all listed (only through chosen and picked).
  }, [action, chosen, picks, editFrame, turn, overturn, underneath, creases, tuck, spec, line, flipped, kind, n, reverseKind, angle, segments, marks, mark, rays, steep, bends, corners, chained, anchorAt, picked]);

  // For a lift, `onFlat` is the preview with its faces matched to the flat state the lines are picked on.
  const result = useMemo((): { frame: FoldFrame; onFlat?: FoldFrame; via?: FoldFrame[]; marks?: Mark[] } | { error: string } | null => {
    if (action === 'move' && chosen === null) return { error: t('studio.errors.chooseSheet') };
    if (action === 'draw' && picks.length >= (fill ? 3 : 2) && !mark) return { error: t('studio.errors.drawOnPaper') };
    if (action === 'popUp' && picks.length >= 2 && !op) return { error: t('studio.errors.tooSteep') };
    if (action === 'lift' && chained && !(anchorAt && 'paper' in anchorAt)) return { error: t('studio.errors.anchorOffPaper') };
    if (!op) return null;
    if (action === 'lift' && !base && frame.vertices_coords.some((p) => Math.abs(p[1]) > 1e-6)) return { error: t('studio.errors.shaped') };
    try {
      const { frame: next, flat, via, marks: drawn } = applyOp(before, op);
      return { frame: next, ...(flat && { onFlat: flat }), ...(via && { via }), ...(drawn && { marks: drawn }) };
    } catch (e) {
      if (e instanceof NoStillError) return { error: t('studio.errors.noStill') };
      if (e instanceof FoldError || e instanceof OpError) return { error: e.message };
      throw e;
    }
  }, [op, action, chosen, picks, fill, mark, chained, anchorAt, base, frame, before, t]);
  const preview = result && 'frame' in result ? result.frame : null;

  const startOver = () => {
    setPicks([]);
    setFlipped(false);
  };

  /** Clears everything the tools have gathered for the next step. */
  const resetTools = () => {
    startOver();
    setCreases([]);
    setBends([]);
    setMarks([]);
    setPicked([]);
    setPickMode('points');
    setAnchorPick(null);
  };

  const switchAction = (a: Action) => {
    setAction(a);
    resetTools();
  };

  /** Collapse mode: keeps the picked line as one of the creases that change. */
  const addCrease = () => {
    if (!spec || !line) return;
    const faces = creaseFaces(n, chosen, facesPicked);
    setCreases((cs) => [...cs, { line, kind: creaseKind, op: { line: spec, ...(flipped && { flip: true }), kind: creaseKind, ...(faces && { only: faces }) } }]);
    startOver();
  };

  /** Lift mode: keeps the picked line as one of the bends the step makes. */
  const addBend = () => {
    if (!spec || !line) return;
    setBends((bs) => [...bs, { line, op: bendOf(spec) }]);
    startOver();
  };

  /** Draw mode: keeps the mark picked so far and starts another. */
  const addMark = () => {
    if (!mark) return;
    setMarks((ms) => [...ms, { mark, table: picks }]);
    startOver();
  };

  /** A step's default title and kind, from what it does. */
  const stepFor = (o: Op): { title: string; kind: StepKind } => {
    switch (o.op) {
      case 'fold':
        return { title: t(`studio.steps.${o.kind ?? 'valley'}`), kind: 'fold' };
      case 'collapse': {
        const [c] = o.creases;
        return o.creases.length === 1 && (c.kind === 'inside' || c.kind === 'outside')
          ? { title: t(`studio.steps.${c.kind}`), kind: 'reverse' }
          : { title: t('studio.steps.collapse'), kind: 'fold' };
      }
      case 'cut':
        return { title: t('studio.steps.cut'), kind: 'cut' };
      case 'move':
        return { title: t('studio.steps.move'), kind: 'assemble' };
      case 'shape':
        return { title: o.bends.some((b) => (b.segments ?? 1) > 1) ? t('studio.steps.curl') : t('studio.steps.lift'), kind: 'pose' };
      case 'popUp':
        return { title: t('studio.steps.popUp'), kind: 'pose' };
      case 'draw':
        return { title: t('studio.steps.draw'), kind: 'draw' };
      case 'unfold':
        return { title: t('studio.steps.unfold'), kind: 'unfold' };
      case 'turnOver':
        return { title: t('studio.steps.turnOver'), kind: 'turn-over' };
      case 'rotate':
        return { title: t('studio.steps.rotate'), kind: 'rotate' };
      case 'newSheet':
        return { title: t('studio.steps.newSheet'), kind: 'assemble' };
      case 'together':
        // Named after its first part; it acts as its last does.
        return { title: o.ops.length ? stepFor(o.ops[0]).title : t('studio.steps.together'), kind: opKind(o) };
    }
  };

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
    resetTools();
    setMessage(null);
  };

  /** Adds a step made by `o` on the paper before any held parts. */
  const addOp = (o: Op) => {
    try {
      const { frame: next, via, marks: drawn } = applyOp(start, o);
      add({ ...stepFor(o), frame: next, ...(via && { via }), ...(drawn && { marks: drawn }), op: o });
    } catch (e) {
      if (!(e instanceof FoldError || e instanceof OpError)) throw e;
      setMessage(e.message);
    }
  };

  /** Ends a step made of the held parts and `last`, if any: one step that does them all at once. */
  const finish = (last?: Op) => {
    const ops = last ? [...held, last] : held;
    if (ops.length) addOp(ops.length === 1 ? ops[0] : { op: 'together', ops });
  };

  const undo = () => {
    if (held.length) return setHeld((h) => h.slice(0, -1));
    undoDraft();
    setAt(null);
  };

  const cancel = () => {
    setAt(null);
    setHeld([]);
    resetTools();
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
    loadTools(made?.op === 'together' ? (parts.length ? made.ops.at(-1) : made.ops[0]) : made, withHeld);
    setMessage(null);
    usePlayback.getState().goTo(i);
  };

  const startInsert = (i: number) => {
    setAt({ index: i, mode: 'insert' });
    setHeld([]);
    resetTools();
    setMessage(null);
    usePlayback.getState().goTo(i);
  };

  const remove = (i: number) => {
    change(removeStep(model, i));
    cancel();
  };

  /** Sets the tools from a step's operation, on the model before it. Anything the tools can't show is left as it is. */
  const loadTools = (made: Op | undefined, m: OrigamiModel) => {
    resetTools();
    setCorners(false);
    setChained(false);
    if (!made) return;
    const paperBefore = m.steps.at(-1)?.frame ?? m.start;
    const where = (a: At, on: FoldFrame): Vec2 => ('table' in a ? a.table : locate(on, a.paper));
    const tryTo = (f: () => void) => {
      try {
        f();
      } catch (e) {
        if (!(e instanceof FoldError)) throw e;
      }
    };
    // A fold line as the tool and points that pick it.
    const pick = (spec: LineSpec, on: FoldFrame, flip?: boolean) =>
      tryTo(() => {
        if ('onto' in spec) (setTool('onto'), setPicks(spec.onto.map((a) => where(a, on))));
        else if ('edgeOnto' in spec) (setTool('edges'), setPicks(spec.edgeOnto.flat().map((a) => where(a, on))));
        else if ('through' in spec && spec.moving === 'smaller') (setTool('through'), setPicks(spec.through.map((a) => where(a, on))));
        else return;
        setFlipped(!!flip);
      });
    // Which sheet, how many layers and which picked faces a step works on.
    const limits = (f?: Faces, layersToo = false) => {
      const parts = !f ? [] : 'all' in f ? f.all : [f];
      const one = parts.find((g) => 'sheet' in g);
      const top = parts.find((g) => 'top' in g);
      const outlines = parts.find((g) => 'inPaper' in g);
      setSheet(one && 'sheet' in one ? one.sheet : 'all');
      setPicked(outlines && 'inPaper' in outlines ? outlines.inPaper : []);
      if (layersToo) setLayers(top && 'top' in top ? (Math.min(3, top.top) as Layers) : 'all');
    };
    if (made.op === 'fold') {
      setAction('fold');
      setKind(made.kind ?? 'valley');
      setLayers(made.layers ? (Math.min(3, made.layers) as Layers) : 'all');
      limits(made.only);
      pick(made.line, paperBefore, made.flip);
    } else if (made.op === 'collapse' && made.creases.length === 1 && (made.creases[0].kind === 'inside' || made.creases[0].kind === 'outside')) {
      const c = made.creases[0];
      setAction('reverse');
      setReverseKind(c.kind as 'inside' | 'outside');
      limits(c.only, true);
      pick(c.line, paperBefore, c.flip);
    } else if (made.op === 'collapse') {
      setAction('collapse');
      tryTo(() => setCreases(made.creases.map((c) => ({ line: lineOf(c.line, paperBefore, c.flip), kind: c.kind, op: c }))));
      setTuck(made.under && 'sheet' in made.under ? made.under.sheet : null);
      if ('auto' in made.anchor) limits(made.anchor.among);
    } else if (made.op === 'shape') {
      const flat = shapingBase(m) ?? paperBefore;
      const b = made.bends.at(-1);
      setAction('lift');
      setCorners(!!made.corners);
      setChained(!!made.chained);
      if (made.chained) tryTo(() => setAnchorPick({ spot: locate(flat, made.chained!.paper), at: made.chained! }));
      if (!b) return;
      setAngle(b.degrees);
      setSegments(b.segments ?? 1);
      setLayers(b.layers ? (Math.min(3, b.layers) as Layers) : 'all');
      limits(b.only);
      // One bend goes in the tools; several are all kept, ready to lift together.
      if (made.bends.length === 1) pick(b.line, flat, b.flip);
      else tryTo(() => setBends(made.bends.map((o) => ({ line: lineOf(o.line, flat, o.flip), op: o }))));
    } else if (made.op === 'popUp') {
      setAction('popUp');
      const s = popSettings(made.rays);
      if (!s) return;
      setRays(s.count);
      setSteep(Math.round((s.steep * 180) / Math.PI));
      tryTo(() => {
        const c = where(made.centre, paperBefore);
        setPicks([c, [c[0] + 0.3 * Math.cos(s.azimuth), c[1] + 0.3 * Math.sin(s.azimuth)]]);
      });
    } else if (made.op === 'draw') {
      setAction('draw');
      setMarks(made.marks.map((mk) => ({ mark: mk, table: markOnTable(paperBefore, mk) ?? [] })));
      setFill(!!made.marks.at(-1)?.fill);
    } else if (made.op === 'cut') {
      setAction('cut');
      setLayers(made.layers ? (Math.min(3, made.layers) as Layers) : 'all');
      limits(made.only);
      tryTo(() => setPicks([where(made.from, paperBefore), where(made.to, paperBefore)]));
    } else if (made.op === 'move') {
      setAction('move');
      limits(made.only);
      setTurn(made.degrees ?? 0);
      setOverturn(!!made.flip);
      setUnderneath(!!made.under);
      if (made.to && 'table' in made.to) setPicks([made.to.table]);
    }
  };

  const apply = () => {
    if (!preview || !op) return;
    finish(op);
  };

  /** Keeps the step the tools describe as a part of the next step, and clears them for the next part. */
  const hold = () => {
    if (!preview || !op) return;
    setHeld((h) => [...h, op]);
    resetTools();
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

  const target = unfoldTarget(before.steps);
  const fixed = lastFixed(model);

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
      } else if (e.key === 'Escape') {
        if (pickMode !== 'points') setPickMode('points');
        else if (!picks.length && editing) cancel();
        startOver();
      }
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
      cancel();
      setMessage(null);
    } catch (e) {
      setMessage(t('studio.openFailed', { error: (e as Error).message }));
    }
  };

  const status = message ?? (result && 'error' in result ? result.error : null);
  const hint =
    pickMode === 'faces'
      ? t('studio.hints.faces')
      : pickMode === 'anchor'
        ? t('studio.hints.anchor')
        : action === 'move'
          ? preview
            ? picks.length
              ? t('studio.hints.move')
              : t('studio.hints.moveWhere')
            : null
          : action === 'cut' && picks.length < needs
            ? t('studio.hints.cutEnds')
            : action === 'draw'
              ? mark
                ? t('studio.hints.draw')
                : marks.length
                  ? t('studio.hints.marks', { count: marks.length })
                  : t('studio.hints.drawPoints')
              : action === 'popUp'
                ? preview
                  ? t('studio.hints.popUp')
                  : t('studio.hints.popUpPoints')
                : action === 'collapse' && creases.length && picks.length < needs
                  ? t('studio.hints.creases', { count: creases.length })
                  : action === 'lift' && bends.length && picks.length < needs
                    ? t('studio.hints.bends', { count: bends.length })
                    : picks.length < needs
                      ? t(`studio.hints.${tool}`)
                      : action === 'collapse' || preview
                        ? t(`studio.hints.${action}`)
                        : null;

  const onPaper = useMemo(() => marksUpTo(before, before.steps.length).map((m) => m.mark), [before]);

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
            <button type="button" className="secondary" onClick={() => confirm(t('studio.newConfirm')) && (clear(), cancel())}>
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
            labels={action === 'draw' ? [''] : action === 'popUp' ? ['O', '1'] : tool === 'edges' ? ['A', 'A', 'B', 'B'] : undefined}
            line={line}
            kind={action === 'fold' ? kind : action === 'collapse' && creaseKind === 'mountain' ? 'mountain' : 'valley'}
            preview={result && 'frame' in result ? (result.onFlat ?? result.frame) : null}
            extra={action === 'lift' ? bends.map((b) => ({ line: b.line, kind: 'valley' })) : creases}
            // A cut about to be made, or the way a pop-up's first crease points.
            cut={(action === 'cut' || action === 'popUp') && picks.length === 2 ? [picks[0], picks[1]] : null}
            free={action === 'cut' || action === 'draw' || action === 'popUp' || pickMode === 'anchor'}
            marks={onPaper}
            drawing={action === 'draw' ? [...marks.map((m) => ({ points: m.table, fill: !!m.mark.fill })), { points: picks, fill }] : []}
            faces={FACE_ACTIONS.includes(action) && (pickMode === 'faces' || picked.length) ? picked : null}
            anchor={anchor?.spot ?? null}
            onPick={(p) =>
              pickMode === 'anchor'
                ? (setAnchorPick({ spot: p, at: atOf(editFrame, p) }), setPickMode('points'))
                : setPicks((prev) => (action === 'move' || prev.length >= needs ? [p] : [...prev, p]))
            }
            onFace={pickMode === 'faces' ? (spot) => setPicked((p) => toggleFace(editFrame, p, spot)) : undefined}
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
            <AboutPanel model={model} onChange={setInfo} />
            <SheetsPanel sheets={model.sheets} locked={model.steps.length > 0} onChange={(next) => (setSheets(next), setSheet('all'))} />
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
              {model.steps.map((s, i) => (
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
          {many && action !== 'popUp' && action !== 'draw' && (
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
          {LINE_ACTIONS.includes(action) && (
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
          {action === 'lift' && (
            <>
              <label className="field inline" title={t('studio.cornersTitle')}>
                <input type="checkbox" checked={corners} onChange={(e) => setCorners(e.target.checked)} />
                <span>{t('studio.corners')}</span>
              </label>
              <label className="field inline" title={t('studio.chainedTitle')}>
                <input type="checkbox" checked={chained} onChange={(e) => (setChained(e.target.checked), setAnchorPick(null))} />
                <span>{t('studio.chained')}</span>
              </label>
              {chained && (
                <button type="button" className="secondary" aria-pressed={pickMode === 'anchor'} onClick={() => setPickMode(pickMode === 'anchor' ? 'points' : 'anchor')}>
                  {t('studio.stayPut')}
                </button>
              )}
            </>
          )}
          {action === 'popUp' && (
            <>
              <label className="field inline">
                <span>{t('studio.popCreases')}</span>
                <select value={rays} onChange={(e) => setRays(Number(e.target.value))}>
                  {[4, 6, 8].map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field inline" title={t('studio.steepTitle')}>
                <span>{t('studio.steep')}</span>
                <input type="range" min={10} max={85} step={1} value={steep} onChange={(e) => setSteep(Number(e.target.value))} />
                <span className="angle">{steep}°</span>
              </label>
            </>
          )}
          {action === 'draw' && (
            <div className="segmented" role="group" aria-label={t('studio.markType')}>
              <button type="button" aria-pressed={!fill} onClick={() => setFill(false)}>
                {t('studio.markLine')}
              </button>
              <button type="button" aria-pressed={fill} onClick={() => setFill(true)}>
                {t('studio.markFill')}
              </button>
            </div>
          )}
          {FACE_ACTIONS.includes(action) && (
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
          {FACE_ACTIONS.includes(action) && (
            <button
              type="button"
              className="secondary"
              aria-pressed={pickMode === 'faces'}
              title={t('studio.pickFacesTitle')}
              onClick={() => setPickMode(pickMode === 'faces' ? 'points' : 'faces')}
            >
              {picked.length ? t('studio.facesPicked', { count: picked.length }) : t('studio.pickFaces')}
            </button>
          )}
          {FACE_ACTIONS.includes(action) && picked.length > 0 && (
            <button type="button" className="link small" onClick={() => setPicked([])}>
              {t('studio.allFaces')}
            </button>
          )}
          {LINE_ACTIONS.includes(action) && (
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
          {action === 'lift' && (
            <>
              <button type="button" className="secondary" disabled={!line} onClick={addBend} title={t('studio.addBendTitle')}>
                {t('studio.addBend')}
              </button>
              <button type="button" className="secondary" disabled={!bends.length} onClick={() => setBends([])}>
                {t('studio.clearBends')}
              </button>
            </>
          )}
          {action === 'draw' && (
            <>
              <button type="button" className="secondary" disabled={!mark} onClick={addMark} title={t('studio.addMarkTitle')}>
                {t('studio.addMark')}
              </button>
              <button type="button" className="secondary" disabled={!marks.length} onClick={() => setMarks([])}>
                {t('studio.clearMarks')}
              </button>
            </>
          )}
          <button type="button" className="secondary" disabled={!preview} onClick={hold} title={t('studio.holdTitle')}>
            {t('studio.hold')}
          </button>
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
          <button type="button" className="secondary" onClick={() => now({ op: 'turnOver' })}>
            {t('studio.turnOverButton')}
          </button>
          <button type="button" className="secondary" onClick={() => now({ op: 'rotate', degrees: 90 })}>
            {t('studio.rotate')}
          </button>
          <button type="button" className="secondary" disabled={target === null} onClick={() => target !== null && now({ op: 'unfold' })}>
            {t('studio.unfold')}
          </button>
          <button type="button" className="secondary" onClick={() => now({ op: 'newSheet' })} title={t('studio.newSheetTitle')}>
            {t('studio.newSheet')}
          </button>
          <button type="button" className="secondary" disabled={!canUndo && !held.length} onClick={undo} title={t('studio.undoTitle')}>
            {t('studio.undo')}
          </button>
        </div>
      </footer>
    </div>
  );
}

type CreaseOp = Extract<Op, { op: 'collapse' }>['creases'][number];

/** The model with each of `ops` added as a step of its own: the paper a step's later parts are made on. */
function withParts(m: OrigamiModel, ops: Op[]): OrigamiModel {
  let out = m;
  for (const o of ops) {
    const { frame, via, marks } = applyOp(out, o);
    out = { ...out, steps: [...out.steps, { title: '', kind: opKind(o), frame, op: o, ...(via && { via }), ...(marks && { marks }) }] };
  }
  return out;
}

/** Every selector given, all of which a face must pass (just the one, when there's one). */
function allOf(...fs: (Faces | undefined)[]): Faces | undefined {
  const given = fs.filter((f) => f !== undefined);
  return given.length > 1 ? { all: given } : given[0];
}

/** What a compound fold's crease folds: the top N layers on its moving side, of one sheet, among picked faces. */
function creaseFaces(n: number | undefined, sheet: number | null, faces?: Faces): Faces | undefined {
  return allOf(n === undefined ? undefined : { top: n }, sheet === null ? undefined : { sheet }, faces);
}

/** How the gallery will describe the model, kept in its file: a blurb, difficulty, category, minutes and its card. */
function AboutPanel({ model, onChange }: { model: OrigamiModel; onChange(patch: Pick<OrigamiModel, 'about'> | Pick<OrigamiModel, 'card'>): void }) {
  const { t } = useTranslation();
  const about = model.about ?? {};
  const edit = <K extends keyof About>(key: K, value: About[K] | undefined) => {
    const { [key]: _, ...rest } = about;
    const next = value === undefined ? rest : { ...rest, [key]: value };
    onChange({ about: Object.keys(next).length ? next : undefined });
  };
  return (
    <details className="about">
      <summary>{t('studio.about.title')}</summary>
      <label className="field">
        <span>{t('studio.about.blurb')}</span>
        <textarea rows={2} maxLength={500} placeholder={t('studio.about.blurbHint')} value={about.blurb ?? ''} onChange={(e) => edit('blurb', e.target.value || undefined)} />
      </label>
      <div className="about-row">
        <label className="field">
          <span>{t('gallery.difficulty')}</span>
          <select value={about.difficulty ?? ''} onChange={(e) => edit('difficulty', e.target.value ? (Number(e.target.value) as About['difficulty']) : undefined)}>
            <option value="">{t('studio.about.unset')}</option>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {t('studio.about.difficultyN', { n: d })}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t('gallery.category')}</span>
          <select value={about.category ?? ''} onChange={(e) => edit('category', (e.target.value || undefined) as About['category'])}>
            <option value="">{t('studio.about.unset')}</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`categories.${c}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t('studio.about.minutes')}</span>
          <input
            type="number"
            min={1}
            max={600}
            value={about.minutes ?? ''}
            onChange={(e) => edit('minutes', e.target.value && Number(e.target.value) > 0 ? Math.min(600, Math.round(Number(e.target.value))) : undefined)}
          />
        </label>
      </div>
      <label className="field" title={t('studio.about.cardTitle')}>
        <span>{t('studio.about.card')}</span>
        <select value={model.card ?? 'flat'} onChange={(e) => onChange({ card: e.target.value === 'finished' ? 'finished' : undefined })}>
          <option value="flat">{t('studio.about.cards.flat')}</option>
          <option value="finished">{t('studio.about.cards.finished')}</option>
        </select>
      </label>
    </details>
  );
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
