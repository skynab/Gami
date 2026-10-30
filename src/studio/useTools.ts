import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FoldError } from '../fold/fold';
import type { Line } from '../fold/geometry2d';
import { applyOp, atOf, lineOf, NoStillError, OpError, shapingBase, type At, type Faces, type LineSpec, type Op, type ShapeBend } from '../fold/ops';
import type { FoldFrame, Mark, OrigamiModel, Vec2 } from '../fold/types';
import { PRESET_PICKS, presetOp } from '../fold/presets';
import { TAPE_WIDTH } from '../fold/tape';
import { markAt, popRays, project, toggleFace, viewBox } from './editor';
import { allOf, creaseFaces, FACE_ACTIONS, GATHERED, INITIAL, LINE_ACTIONS, toolsFor, type Action, type ToolState } from './tools';

const radians = (degrees: number) => (degrees * Math.PI) / 180;

export type Tools = ReturnType<typeof useTools>;

/**
 * The Studio's tools: what they're set to and have picked, and what that makes on the paper of `before` (the
 * model as the next step finds it): the fold line, the step's operation and its preview, and a hint.
 */
export function useTools(before: OrigamiModel) {
  const { t } = useTranslation();
  const [s, setS] = useState<ToolState>(INITIAL);
  const set = (patch: Partial<ToolState>) => setS((prev) => ({ ...prev, ...patch }));
  const update = (f: (prev: ToolState) => Partial<ToolState>) => setS((prev) => ({ ...prev, ...f(prev) }));
  const { action, tool, picks, flipped } = s;

  const frame = before.steps.at(-1)?.frame ?? before.start;
  // After a lift, another lift adds to its bends, picking lines on the flat state the lifts started from.
  const base = useMemo(() => shapingBase(before), [before]);
  const editFrame = base ?? frame;
  const many = before.sheets.length > 1;
  const chosen = many && s.sheet !== 'all' && s.sheet < before.sheets.length ? s.sheet : null;

  // Picks a fold line needs: two points, or for edge to edge, two along each edge (a cut needs its two ends,
  // a pop-up its point and a direction). A mark takes as many as it likes.
  // Each is kept as the point of the sheet picked, so the step follows the paper if an earlier one changes.
  const needs = action === 'draw' ? Infinity : action === 'preset' ? PRESET_PICKS[s.preset] : tool === 'edges' && LINE_ACTIONS.includes(action) ? 4 : 2;
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

  const n = s.layers === 'all' ? undefined : s.layers;
  const facesPicked: Faces | undefined = FACE_ACTIONS.includes(action) && s.picked.length ? { inPaper: s.picked } : undefined;
  const inSheet: Faces | undefined = chosen === null ? undefined : { sheet: chosen };
  const only = allOf(inSheet, facesPicked);

  // The mark the picks make so far, on the paper under its first point.
  const mark = useMemo(
    () => (action === 'draw' && picks.length >= (s.fill ? 3 : 2) ? markAt(editFrame, picks, s.fill) : null),
    [action, picks, s.fill, editFrame],
  );
  // Posing crease by crease: the paper that stays put, picked or else the middle of the paper.
  const anchor = useMemo((): { spot: Vec2; at: At } | null => {
    if (action !== 'lift' || !s.chained) return null;
    if (s.anchorPick) return s.anchorPick;
    const [x, z, size] = viewBox(project(editFrame).flatMap((f) => f.world), 0);
    const spot: Vec2 = [x + size / 2, z + size / 2];
    return { spot, at: atOf(editFrame, spot) };
  }, [action, s.chained, s.anchorPick, editFrame]);
  const anchorAt = anchor?.at ?? null;
  const anchored = !!anchorAt && 'paper' in anchorAt;

  const bendOf = (l: LineSpec): ShapeBend => ({
    line: l,
    ...(flipped && { flip: true }),
    degrees: s.angle,
    ...(s.segments > 1 && { segments: s.segments }),
    ...(n !== undefined && { layers: n }),
    ...(only && { only }),
  });

  // A named fold, worked out from its picks, or why it can't be made there.
  const named = useMemo((): { op: Op } | { error: string } | null => {
    if (action !== 'preset' || picks.length < needs) return null;
    try {
      return { op: presetOp(before, { kind: s.preset, picks, flip: flipped, ...(inSheet && { only: inSheet }) }) };
    } catch (e) {
      if (e instanceof FoldError || e instanceof OpError) return { error: e.message };
      throw e;
    }
  }, [action, picks, needs, before, s.preset, flipped, chosen]);

  // The step the tools describe now, if they describe one.
  const op = useMemo((): Op | null => {
    if (action === 'preset') return named && 'op' in named ? named.op : null;
    const auto = { auto: true as const, ...(inSheet && { among: inSheet }) };
    const flip = flipped ? { flip: true } : {};
    if (action === 'move')
      return chosen === null ? null : { op: 'move', only: { sheet: chosen }, ...(picks[0] && { to: { table: picks[0] } }), degrees: s.turn, flip: s.overturn, under: s.underneath };
    if (action === 'cut') {
      if (picks.length < 2) return null;
      const [from, to] = picks.map((p) => atOf(editFrame, p));
      return { op: 'cut', from, to, ...(n !== undefined && { layers: n }), ...(only && { only }) };
    }
    if (action === 'tape') {
      if (picks.length < 2) return null;
      const [from, to] = picks.map((p) => atOf(editFrame, p));
      return { op: 'tape', from, to, ...(s.tapeWidth !== TAPE_WIDTH && { width: s.tapeWidth }) };
    }
    if (action === 'draw') {
      const all = [...s.marks.map((m) => m.mark), ...(mark ? [mark] : [])];
      return all.length ? { op: 'draw', marks: all } : null;
    }
    if (action === 'popUp') {
      if (picks.length < 2) return null;
      const rays = popRays(s.rays, Math.atan2(picks[1][1] - picks[0][1], picks[1][0] - picks[0][0]), radians(s.steep));
      return rays && { op: 'popUp', centre: atOf(editFrame, picks[0]), rays };
    }
    if (action === 'collapse')
      return s.creases.length ? { op: 'collapse', creases: s.creases.map((c) => c.op), anchor: auto, ...(s.tuck !== null && { under: { sheet: s.tuck } }) } : null;
    if (action === 'lift') {
      const all = [...s.bends.map((b) => b.op), ...(spec && line ? [bendOf(spec)] : [])];
      if (!all.length || (s.chained && !anchored)) return null;
      return { op: 'shape', bends: all, ...(s.corners && { corners: true }), ...(s.chained && anchored && { chained: anchorAt as { paper: Vec2 } }) };
    }
    if (!spec || !line) return null;
    if (action === 'fold') return { op: 'fold', line: spec, ...flip, kind: s.kind, ...(n !== undefined && { layers: n }), ...(only && { only }) };
    const faces = creaseFaces(n, chosen, facesPicked);
    return { op: 'collapse', creases: [{ line: spec, ...flip, kind: s.reverseKind, ...(faces && { only: faces }) }], anchor: auto };
    // The operation is rebuilt from the whole tool state; `result` below only refolds when it changes.
  }, [s, chosen, editFrame, spec, line, mark, anchorAt, named]);
  const opKey = JSON.stringify(op);

  // For a lift, `onFlat` is the preview with its faces matched to the flat state the lines are picked on.
  const result = useMemo((): { frame: FoldFrame; onFlat?: FoldFrame; via?: FoldFrame[]; marks?: Mark[] } | { error: string } | null => {
    if (action === 'move' && chosen === null) return { error: t('studio.errors.chooseSheet') };
    if (action === 'draw' && picks.length >= (s.fill ? 3 : 2) && !mark) return { error: t('studio.errors.drawOnPaper') };
    if (action === 'popUp' && picks.length >= 2 && !op) return { error: t('studio.errors.tooSteep') };
    if (action === 'lift' && s.chained && !anchored) return { error: t('studio.errors.anchorOffPaper') };
    if (named && 'error' in named) return named;
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
    // `op` is followed by its key, so a tool change that leaves the step as it was doesn't fold it again.
  }, [opKey, action, chosen, picks.length, s.fill, mark, s.chained, anchored, base, frame, before, t, named]);
  const preview = result && 'frame' in result ? result.frame : null;
  // A named fold's creases, to show on the paper before it's made.
  const presetCreases = useMemo(() => {
    if (action !== 'preset' || op?.op !== 'collapse') return [];
    try {
      return op.creases.map((c) => ({ line: lineOf(c.line, editFrame, c.flip), kind: c.kind }));
    } catch (e) {
      if (e instanceof FoldError) return [];
      throw e;
    }
  }, [action, opKey, editFrame]);
  const error = result && 'error' in result ? result.error : null;

  const hint = (() => {
    if (s.pickMode === 'faces') return t('studio.hints.faces');
    if (s.pickMode === 'anchor') return t('studio.hints.anchor');
    if (action === 'move') return preview ? (picks.length ? t('studio.hints.move') : t('studio.hints.moveWhere')) : null;
    if (action === 'cut' && picks.length < needs) return t('studio.hints.cutEnds');
    if (action === 'tape' && picks.length < needs) return t('studio.hints.tapeEnds');
    if (action === 'preset') return picks.length < needs ? t(`studio.hints.presets.${s.preset}`) : preview ? t('studio.hints.preset') : null;
    if (action === 'draw') return mark ? t('studio.hints.draw') : s.marks.length ? t('studio.hints.marks', { count: s.marks.length }) : t('studio.hints.drawPoints');
    if (action === 'popUp') return preview ? t('studio.hints.popUp') : t('studio.hints.popUpPoints');
    if (action === 'collapse' && s.creases.length && picks.length < needs) return t('studio.hints.creases', { count: s.creases.length });
    if (action === 'lift' && s.bends.length && picks.length < needs) return t('studio.hints.bends', { count: s.bends.length });
    if (picks.length < needs) return t(`studio.hints.${tool}`);
    return action === 'collapse' || preview ? t(`studio.hints.${action}`) : null;
  })();

  /** Clears the picks and the side to fold. */
  const startOver = () => set({ picks: [], flipped: false });
  /** Clears everything the tools have gathered for the next step. */
  const reset = () => set(GATHERED);

  return {
    s,
    set,
    update,
    many,
    chosen,
    editFrame,
    needs,
    mark,
    line,
    anchor,
    op,
    result,
    preview,
    presetCreases,
    error,
    hint,
    startOver,
    reset,
    switchAction: (a: Action) => set({ ...GATHERED, action: a }),
    /** Collapse mode: keeps the picked line as one of the creases that change. */
    addCrease: () => {
      if (!spec || !line) return;
      const faces = creaseFaces(n, chosen, facesPicked);
      set({ picks: [], flipped: false, creases: [...s.creases, { line, kind: s.creaseKind, op: { line: spec, ...(flipped && { flip: true }), kind: s.creaseKind, ...(faces && { only: faces }) } }] });
    },
    /** Lift mode: keeps the picked line as one of the bends the step makes. */
    addBend: () => spec && line && set({ picks: [], flipped: false, bends: [...s.bends, { line, op: bendOf(spec) }] }),
    /** Draw mode: keeps the mark picked so far and starts another. */
    addMark: () => mark && set({ picks: [], flipped: false, marks: [...s.marks, { mark, table: picks }] }),
    /** Sets the tools from a step's operation, on the model before it. */
    load: (made: Op | undefined, m: OrigamiModel) => set({ ...GATHERED, ...toolsFor(made, m) }),
    /** A point picked on the paper: one more pick, or the paper that stays put. */
    pick: (p: Vec2) =>
      s.pickMode === 'anchor'
        ? set({ anchorPick: { spot: p, at: atOf(editFrame, p) }, pickMode: 'points' })
        : update((prev) => ({ picks: prev.action === 'move' || prev.picks.length >= needs ? [p] : [...prev.picks, p] })),
    /** A face clicked while picking faces: picked, or left out again. */
    pickFace: (spot: Vec2) => update((prev) => ({ picked: toggleFace(editFrame, prev.picked, spot) })),
  };
}
