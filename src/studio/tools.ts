import type { TFunction } from 'i18next';
import type { CreaseKind } from '../fold/collapse';
import { FoldError, type FoldKind } from '../fold/fold';
import type { Line } from '../fold/geometry2d';
import { applyOp, lineOf, opKind, shapingBase, type At, type Faces, type LineSpec, type Op, type ShapeBend } from '../fold/ops';
import type { PresetKind } from '../fold/presets';
import { locate } from '../fold/select';
import { TAPE_WIDTH } from '../fold/tape';
import type { FoldFrame, Mark, OrigamiModel, StepKind, Vec2 } from '../fold/types';
import { markOnTable, popSettings } from './editor';

/** The Studio's tools as plain data, and what they make: no React here. */

export type Tool = 'onto' | 'through' | 'edges';
export type Layers = 'all' | 1 | 2 | 3;
/**
 * What the picked line does: a plain fold, a reverse fold, a crease for a collapse, or lifting into 3D. Or a named
 * compound fold (pleat, crimp, squash, petal, rabbit ear) worked out from a few picks (fold/presets.ts).
 * Or popping the model up about a point (picking the point, then which way the first crease points), a
 * scissor cut (picking where it starts and ends), a strip of tape (picking its two ends), drawing on the paper
 * (picking points along the mark), or, for models of several sheets, moving one sheet (picking where its middle goes).
 */
export type Action = 'fold' | 'reverse' | 'preset' | 'collapse' | 'lift' | 'popUp' | 'cut' | 'tape' | 'draw' | 'move';

export const ACTIONS: Action[] = ['fold', 'reverse', 'preset', 'collapse', 'lift', 'popUp', 'cut', 'tape', 'draw', 'move'];
/** How wide a strip of tape can be, on a 1 × 1 sheet: narrow, as it comes, and wide. */
export const TAPE_WIDTHS = [0.06, TAPE_WIDTH, 0.2];
/** Actions that can be limited to faces picked by clicking them. */
export const FACE_ACTIONS: Action[] = ['fold', 'reverse', 'collapse', 'lift', 'cut'];
/** Actions that pick a fold line. */
export const LINE_ACTIONS: Action[] = ['fold', 'reverse', 'collapse', 'lift'];
/** What clicks on the paper do: pick points, pick faces, or pick the paper that stays put while posing. */
export type PickMode = 'points' | 'faces' | 'anchor';

export type CreaseOp = Extract<Op, { op: 'collapse' }>['creases'][number];

/** Everything the tools are set to, and what they've gathered for the next step. */
export interface ToolState {
  tool: Tool;
  action: Action;
  kind: FoldKind;
  reverseKind: 'inside' | 'outside';
  creaseKind: 'valley' | 'mountain' | 'flat';
  /** Which named fold the preset action makes. */
  preset: PresetKind;
  /** A collapse's creases kept so far. */
  creases: { line: Line; kind: CreaseKind; op: CreaseOp }[];
  angle: number;
  segments: number;
  /** A lift's bends kept so far: it can turn the paper about several lines at once. */
  bends: { line: Line; op: ShapeBend }[];
  /** Bends whose lines cross rise together as walls. */
  corners: boolean;
  /** Posed crease by crease from paper that stays put. */
  chained: boolean;
  /** Where that paper was picked on the table, and the point of the sheet it names (kept exactly when loaded from a step). */
  anchorPick: { spot: Vec2; at: At } | null;
  /** Popping up: how many creases rise from the point, and how steeply every other one rises. */
  rays: number;
  steep: number;
  /** Drawing: marks kept for this step, with where they are on the table, and whether the next is filled in. */
  marks: { mark: Mark; table: Vec2[] }[];
  fill: boolean;
  tapeWidth: number;
  layers: Layers;
  /** Models of several sheets: which one the next step works on (or all), and for a move, how it's put down. */
  sheet: number | 'all';
  turn: number;
  overturn: boolean;
  underneath: boolean;
  tuck: number | null;
  picks: Vec2[];
  flipped: boolean;
  pickMode: PickMode;
  /** Faces picked by clicking, as outlines on the sheet: the step then folds only those. */
  picked: Vec2[][];
}

/** What the tools gather for one step, cleared once it's made. */
export const GATHERED = {
  picks: [],
  flipped: false,
  creases: [],
  bends: [],
  marks: [],
  picked: [],
  pickMode: 'points',
  anchorPick: null,
} satisfies Partial<ToolState>;

export const INITIAL: ToolState = {
  ...GATHERED,
  tool: 'onto',
  action: 'fold',
  kind: 'valley',
  reverseKind: 'inside',
  creaseKind: 'valley',
  preset: 'pleat',
  angle: 90,
  segments: 1,
  corners: false,
  chained: false,
  rays: 8,
  steep: 60,
  fill: false,
  tapeWidth: TAPE_WIDTH,
  layers: 'all',
  sheet: 'all',
  turn: 0,
  overturn: false,
  underneath: false,
  tuck: null,
};

/** The model with each of `ops` added as a step of its own: the paper a step's later parts are made on. */
export function withParts(m: OrigamiModel, ops: Op[]): OrigamiModel {
  let out = m;
  for (const o of ops) {
    const { frame, via, marks } = applyOp(out, o);
    out = { ...out, steps: [...out.steps, { title: '', kind: opKind(o), frame, op: o, ...(via && { via }), ...(marks && { marks }) }] };
  }
  return out;
}

/** Every selector given, all of which a face must pass (just the one, when there's one). */
export function allOf(...fs: (Faces | undefined)[]): Faces | undefined {
  const given = fs.filter((f) => f !== undefined);
  return given.length > 1 ? { all: given } : given[0];
}

/** What a compound fold's crease folds: the top N layers on its moving side, of one sheet, among picked faces. */
export function creaseFaces(n: number | undefined, sheet: number | null, faces?: Faces): Faces | undefined {
  return allOf(n === undefined ? undefined : { top: n }, sheet === null ? undefined : { sheet }, faces);
}

/** The step a named fold makes: its title and kind, as the collapse it's saved as wouldn't say. */
export function presetStep(kind: PresetKind, t: TFunction): { title: string; kind: StepKind } {
  return { title: t(`studio.steps.${kind}`), kind: kind === 'squash' || kind === 'petal' ? kind : kind === 'crimp' ? 'reverse' : 'fold' };
}

/** A step's default title and kind, from what it does. */
export function stepFor(o: Op, t: TFunction): { title: string; kind: StepKind } {
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
    case 'tape':
      return { title: t('studio.steps.tape'), kind: 'tape' };
    case 'move':
      return { title: t('studio.steps.move'), kind: 'assemble' };
    case 'shape':
      return { title: o.bends.some((b) => (b.segments ?? 1) > 1) ? t('studio.steps.curl') : t('studio.steps.lift'), kind: 'pose' };
    case 'popUp':
      return { title: t('studio.steps.popUp'), kind: 'pose' };
    case 'bend':
      return { title: t('studio.steps.bend'), kind: 'pose' };
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
    case 'copy':
      return { title: t('studio.steps.copy'), kind: 'assemble' };
    case 'settle':
      return { title: t('studio.steps.settle'), kind: 'pose' };
    case 'assemble':
      return { title: t('studio.steps.assemble'), kind: 'assemble' };
    case 'together':
      // Named after its first part; it acts as its last does.
      return { title: o.ops.length ? stepFor(o.ops[0], t).title : t('studio.steps.together'), kind: opKind(o) };
  }
}

/**
 * The tools set as a step's operation was made, on the model before it: what to change from a cleared set of
 * tools. Anything the tools can't show is left out.
 */
export function toolsFor(made: Op | undefined, m: OrigamiModel): Partial<ToolState> {
  const out: Partial<ToolState> = { corners: false, chained: false };
  if (!made) return out;
  const paperBefore = m.steps.at(-1)?.frame ?? m.start;
  const where = (a: At, on: FoldFrame): Vec2 => ('table' in a ? a.table : locate(on, a.paper));
  // Points no longer on the paper are left out, as the rest of the step still loads.
  const tryTo = (f: () => void) => {
    try {
      f();
    } catch (e) {
      if (!(e instanceof FoldError)) throw e;
    }
  };
  const layersOf = (k?: number): Layers => (k ? (Math.min(3, k) as Layers) : 'all');
  // A fold line as the tool and points that pick it.
  const pick = (spec: LineSpec, on: FoldFrame, flip?: boolean) =>
    tryTo(() => {
      if ('onto' in spec) Object.assign(out, { tool: 'onto', picks: spec.onto.map((a) => where(a, on)) });
      else if ('edgeOnto' in spec) Object.assign(out, { tool: 'edges', picks: spec.edgeOnto.flat().map((a) => where(a, on)) });
      else if ('through' in spec && spec.moving === 'smaller') Object.assign(out, { tool: 'through', picks: spec.through.map((a) => where(a, on)) });
      else return;
      out.flipped = !!flip;
    });
  // Which sheet, how many layers and which picked faces a step works on.
  const limits = (f?: Faces, layersToo = false) => {
    const parts = !f ? [] : 'all' in f ? f.all : [f];
    const one = parts.find((g) => 'sheet' in g);
    const top = parts.find((g) => 'top' in g);
    const outlines = parts.find((g) => 'inPaper' in g);
    out.sheet = one && 'sheet' in one ? one.sheet : 'all';
    out.picked = outlines && 'inPaper' in outlines ? outlines.inPaper : [];
    if (layersToo) out.layers = layersOf(top && 'top' in top ? top.top : undefined);
  };

  if (made.op === 'fold') {
    Object.assign(out, { action: 'fold', kind: made.kind ?? 'valley', layers: layersOf(made.layers) });
    limits(made.only);
    pick(made.line, paperBefore, made.flip);
  } else if (made.op === 'collapse' && made.creases.length === 1 && (made.creases[0].kind === 'inside' || made.creases[0].kind === 'outside')) {
    const c = made.creases[0];
    Object.assign(out, { action: 'reverse', reverseKind: c.kind });
    limits(c.only, true);
    pick(c.line, paperBefore, c.flip);
  } else if (made.op === 'collapse') {
    out.action = 'collapse';
    tryTo(() => (out.creases = made.creases.map((c) => ({ line: lineOf(c.line, paperBefore, c.flip), kind: c.kind, op: c }))));
    out.tuck = made.under && 'sheet' in made.under ? made.under.sheet : null;
    if ('auto' in made.anchor) limits(made.anchor.among);
  } else if (made.op === 'shape') {
    const flat = shapingBase(m) ?? paperBefore;
    const b = made.bends.at(-1);
    Object.assign(out, { action: 'lift', corners: !!made.corners, chained: !!made.chained });
    if (made.chained) tryTo(() => (out.anchorPick = { spot: locate(flat, made.chained!.paper), at: made.chained! }));
    if (!b) return out;
    Object.assign(out, { angle: b.degrees, segments: b.segments ?? 1, layers: layersOf(b.layers) });
    limits(b.only);
    // One bend goes in the tools; several are all kept, ready to lift together.
    if (made.bends.length === 1) pick(b.line, flat, b.flip);
    else tryTo(() => (out.bends = made.bends.map((o) => ({ line: lineOf(o.line, flat, o.flip), op: o }))));
  } else if (made.op === 'popUp') {
    out.action = 'popUp';
    const s = popSettings(made.rays);
    if (!s) return out;
    Object.assign(out, { rays: s.count, steep: Math.round((s.steep * 180) / Math.PI) });
    tryTo(() => {
      const c = where(made.centre, paperBefore);
      out.picks = [c, [c[0] + 0.3 * Math.cos(s.azimuth), c[1] + 0.3 * Math.sin(s.azimuth)]];
    });
  } else if (made.op === 'draw') {
    Object.assign(out, {
      action: 'draw',
      marks: made.marks.map((mk) => ({ mark: mk, table: markOnTable(paperBefore, mk) ?? [] })),
      fill: !!made.marks.at(-1)?.fill,
    });
  } else if (made.op === 'cut') {
    Object.assign(out, { action: 'cut', layers: layersOf(made.layers) });
    limits(made.only);
    tryTo(() => (out.picks = [where(made.from, paperBefore), where(made.to, paperBefore)]));
  } else if (made.op === 'tape') {
    Object.assign(out, { action: 'tape', tapeWidth: made.width ?? TAPE_WIDTH });
    tryTo(() => (out.picks = [where(made.from, paperBefore), where(made.to, paperBefore)]));
  } else if (made.op === 'move') {
    out.action = 'move';
    limits(made.only);
    Object.assign(out, { turn: made.degrees ?? 0, overturn: !!made.flip, underneath: !!made.under });
    if (made.to && 'table' in made.to) out.picks = [made.to.table];
  }
  return out;
}
