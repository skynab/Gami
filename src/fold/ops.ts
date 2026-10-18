import { collapse, type CreaseKind } from './collapse';
import { fold, FoldError, rotate, turnOver, unfoldStep, type FoldKind } from './fold';
import { flipLine, lineEdgeOnto, lineOnto, lineThrough, sideOf, type Line } from './geometry2d';
import { place } from './place';
import { anchorFor, centre, inside, locate, smallerSideMoves, topLayers } from './select';
import { curl, radial, reparent, shape, type Bend } from './shape';
import { sheetOf } from './sheets';
import type { FoldFrame, OrigamiModel, Step, StepKind, Vec2 } from './types';

/**
 * Fold operations: how each step was made, as plain data, so a model can be folded again from the start
 * after one of its steps changes. Stored in .fold files as `gami:op` on each step (see
 * docs/fold-operations-plan.md). The baked frames stay the record of what the paper looks like; an
 * operation is what the Studio edits.
 */

/** Version of the operation format, kept in .fold files as `gami:ops`. */
export const OPS_VERSION = 1;

/** A point on the sheet, found wherever that bit of paper is now, or a fixed point on the table. */
export type At = { paper: Vec2 } | { table: Vec2 };

export type LineSpec =
  /** Fold so the first point lands on the second. */
  | { onto: [At, At] }
  /** Fold the first edge onto the line of the second, the first end going the second's way. */
  | { edgeOnto: [[At, At], [At, At]] }
  /** Along the line through two points, moving the side `moving` is on, or the smaller side. Left out: as given. */
  | { through: [At, At]; moving?: At | 'smaller' }
  /** A line on the table. */
  | { line: { p: Vec2; d: Vec2 } };

/** Which faces take part, tested on each face's corners on the sheet. */
export type Faces =
  | { sheet: number }
  /** The top N layers on the moving side of the crease it limits. */
  | { top: number }
  /** Faces whose centre on the sheet is inside one of these outlines. */
  | { inPaper: Vec2[][] }
  | { all: Faces[] };

export interface ShapeBend {
  line: LineSpec;
  flip?: boolean;
  degrees: number;
  /** Spread the turn over this many bends, curling the paper. */
  segments?: number;
  /** How far a curl reaches; left out, to the farthest paper it turns. */
  reach?: At;
  layers?: number;
  only?: Faces;
}

export type Op =
  | { op: 'fold'; line: LineSpec; flip?: boolean; kind?: FoldKind; layers?: number; only?: Faces }
  | {
      op: 'collapse';
      creases: { line: LineSpec; flip?: boolean; kind: CreaseKind; only?: Faces }[];
      /** The point of the sheet that stays put, or worked out, from the faces `among` picks if given. */
      anchor: { paper: Vec2 } | { auto: true; among?: Faces };
      /** Tucking: the moving paper slides under these faces. */
      under?: Faces;
    }
  /** Opens back up to the paper after step `to` (0: the start). Left out: undoes the last fold since the last unfold. */
  | { op: 'unfold'; to?: number }
  | { op: 'turnOver' }
  | { op: 'rotate'; degrees: number }
  | { op: 'move'; only: Faces; to?: At; degrees?: number; flip?: boolean; under?: boolean }
  | { op: 'newSheet' }
  /** Bends in 3D. Lines are found on the flat state before a run of shaping steps; each adds to the run's bends. */
  | { op: 'shape'; bends: ShapeBend[] }
  | { op: 'popUp'; centre: At; rays: { azimuth: number; elevation: number }[] }
  /** Several operations shown as one step. */
  | { op: 'together'; ops: Op[] };

export class OpError extends Error {}

const LIMITS = { list: 256, outline: 64, outlines: 512, nesting: 4, steps: 2000, faces: 20000 };

// ——— Checking operations read from a file ———

/** Checks an operation read from a file is well formed, throwing an OpError that says where if not. */
export function parseOp(x: unknown, path = 'op', depth = 0): Op {
  const o = record(x, path);
  switch (o.op) {
    case 'fold':
      return {
        op: 'fold',
        line: lineSpec(o.line, `${path}.line`),
        ...opt(o, 'flip', bool, path),
        ...opt(o, 'kind', (v, p) => oneOf(v, p, ['valley', 'mountain'] as const), path),
        ...opt(o, 'layers', count, path),
        ...opt(o, 'only', (v, p) => faces(v, p, 0), path),
      };
    case 'collapse':
      return {
        op: 'collapse',
        creases: list(o.creases, `${path}.creases`, (c, p) => {
          const r = record(c, p);
          return {
            line: lineSpec(r.line, `${p}.line`),
            ...opt(r, 'flip', bool, p),
            kind: oneOf(r.kind, `${p}.kind`, ['valley', 'mountain', 'flat', 'inside', 'outside'] as const),
            ...opt(r, 'only', (v, q) => faces(v, q, 0), p),
          };
        }),
        anchor: anchor(o.anchor, `${path}.anchor`),
        ...opt(o, 'under', (v, p) => faces(v, p, 0), path),
      };
    case 'unfold':
      return { op: 'unfold', ...opt(o, 'to', count, path) };
    case 'turnOver':
    case 'newSheet':
      return { op: o.op };
    case 'rotate':
      return { op: 'rotate', degrees: num(o.degrees, `${path}.degrees`) };
    case 'move':
      return {
        op: 'move',
        only: faces(o.only, `${path}.only`, 0),
        ...opt(o, 'to', at, path),
        ...opt(o, 'degrees', num, path),
        ...opt(o, 'flip', bool, path),
        ...opt(o, 'under', bool, path),
      };
    case 'shape':
      return {
        op: 'shape',
        bends: list(o.bends, `${path}.bends`, (b, p) => {
          const r = record(b, p);
          return {
            line: lineSpec(r.line, `${p}.line`),
            ...opt(r, 'flip', bool, p),
            degrees: num(r.degrees, `${p}.degrees`),
            ...opt(r, 'segments', (v, q) => between(count(v, q), q, 1, 64), p),
            ...opt(r, 'reach', at, p),
            ...opt(r, 'layers', count, p),
            ...opt(r, 'only', (v, q) => faces(v, q, 0), p),
          };
        }),
      };
    case 'popUp':
      return {
        op: 'popUp',
        centre: at(o.centre, `${path}.centre`),
        rays: list(o.rays, `${path}.rays`, (r, p) => {
          const ray = record(r, p);
          return { azimuth: num(ray.azimuth, `${p}.azimuth`), elevation: num(ray.elevation, `${p}.elevation`) };
        }),
      };
    case 'together':
      if (depth >= LIMITS.nesting) throw new OpError(`${path}: nested too deeply`);
      return { op: 'together', ops: list(o.ops, `${path}.ops`, (v, p) => parseOp(v, p, depth + 1)) };
    default:
      throw new OpError(`${path}.op: unknown operation ${JSON.stringify(o.op)}`);
  }
}

type Check<T> = (x: unknown, path: string) => T;

function record(x: unknown, path: string): Record<string, unknown> {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) throw new OpError(`${path}: expected an object`);
  return x as Record<string, unknown>;
}

/** `{ key: value }` when the field is there, checked; `{}` when it isn't. */
function opt<K extends string, T>(o: Record<string, unknown>, key: K, check: Check<T>, path: string): { [k in K]?: T } {
  return o[key] === undefined ? {} : ({ [key]: check(o[key], `${path}.${key}`) } as { [k in K]: T });
}

const num: Check<number> = (x, path) => {
  if (typeof x !== 'number' || !Number.isFinite(x)) throw new OpError(`${path}: expected a number`);
  return x;
};

const count: Check<number> = (x, path) => {
  const n = num(x, path);
  if (!Number.isInteger(n) || n < 0) throw new OpError(`${path}: expected a whole number`);
  return n;
};

function between(n: number, path: string, lo: number, hi: number): number {
  if (n < lo || n > hi) throw new OpError(`${path}: expected ${lo} to ${hi}`);
  return n;
}

const bool: Check<boolean> = (x, path) => {
  if (typeof x !== 'boolean') throw new OpError(`${path}: expected true or false`);
  return x;
};

function oneOf<T extends string>(x: unknown, path: string, values: readonly T[]): T {
  if (!values.includes(x as T)) throw new OpError(`${path}: expected one of ${values.join(', ')}`);
  return x as T;
}

function list<T>(x: unknown, path: string, check: Check<T>, max = LIMITS.list): T[] {
  if (!Array.isArray(x)) throw new OpError(`${path}: expected a list`);
  if (x.length > max) throw new OpError(`${path}: more than ${max} items`);
  return x.map((v, i) => check(v, `${path}[${i}]`));
}

const vec2: Check<Vec2> = (x, path) => {
  if (!Array.isArray(x) || x.length !== 2) throw new OpError(`${path}: expected [x, y]`);
  return [num(x[0], `${path}[0]`), num(x[1], `${path}[1]`)];
};

function pair<T>(x: unknown, path: string, check: Check<T>): [T, T] {
  const l = list(x, path, check, 2);
  if (l.length !== 2) throw new OpError(`${path}: expected two items`);
  return [l[0], l[1]];
}

const at: Check<At> = (x, path) => {
  const o = record(x, path);
  if ('paper' in o) return { paper: vec2(o.paper, `${path}.paper`) };
  if ('table' in o) return { table: vec2(o.table, `${path}.table`) };
  throw new OpError(`${path}: expected { paper } or { table }`);
};

const paperAt: Check<{ paper: Vec2 }> = (x, path) => {
  const a = at(x, path);
  if (!('paper' in a)) throw new OpError(`${path}: expected a point on the sheet`);
  return a;
};

function anchor(x: unknown, path: string): Extract<Op, { op: 'collapse' }>['anchor'] {
  const o = record(x, path);
  if ('auto' in o) {
    if (o.auto !== true) throw new OpError(`${path}.auto: expected true`);
    return { auto: true, ...opt(o, 'among', (v, p) => faces(v, p, 0), path) };
  }
  return paperAt(o, path);
}

const lineSpec: Check<LineSpec> = (x, path) => {
  const o = record(x, path);
  if ('onto' in o) return { onto: pair(o.onto, `${path}.onto`, at) };
  if ('edgeOnto' in o) return { edgeOnto: pair(o.edgeOnto, `${path}.edgeOnto`, (e, p) => pair(e, p, at)) };
  if ('through' in o) {
    const moving = o.moving === undefined ? {} : { moving: o.moving === 'smaller' ? ('smaller' as const) : at(o.moving, `${path}.moving`) };
    return { through: pair(o.through, `${path}.through`, at), ...moving };
  }
  if ('line' in o) {
    const l = record(o.line, `${path}.line`);
    const d = vec2(l.d, `${path}.line.d`);
    if (!d[0] && !d[1]) throw new OpError(`${path}.line.d: a line needs a direction`);
    return { line: { p: vec2(l.p, `${path}.line.p`), d } };
  }
  throw new OpError(`${path}: expected onto, edgeOnto, through or line`);
};

function faces(x: unknown, path: string, depth: number): Faces {
  const o = record(x, path);
  if ('sheet' in o) return { sheet: count(o.sheet, `${path}.sheet`) };
  if ('top' in o) return { top: between(count(o.top, `${path}.top`), `${path}.top`, 1, Infinity) };
  if ('inPaper' in o) {
    return {
      inPaper: list(o.inPaper, `${path}.inPaper`, (poly, p) => {
        const l = list(poly, p, vec2, LIMITS.outline);
        if (l.length < 3) throw new OpError(`${p}: an outline needs three corners`);
        return l;
      }, LIMITS.outlines),
    };
  }
  if ('all' in o) {
    if (depth >= LIMITS.nesting) throw new OpError(`${path}: nested too deeply`);
    return { all: list(o.all, `${path}.all`, (v, p) => faces(v, p, depth + 1)) };
  }
  throw new OpError(`${path}: expected sheet, top, inPaper or all`);
}

// ——— Replaying ———

/** The step kind an operation makes, when nothing else says (as for the parts of a `together`). */
export function opKind(op: Op): StepKind {
  switch (op.op) {
    case 'fold':
    case 'collapse':
      return 'fold';
    case 'unfold':
      return 'unfold';
    case 'turnOver':
      return 'turn-over';
    case 'rotate':
      return 'rotate';
    case 'move':
    case 'newSheet':
      return 'assemble';
    case 'shape':
    case 'popUp':
      return 'pose';
    case 'together':
      return op.ops.length ? opKind(op.ops[op.ops.length - 1]) : 'fold';
  }
}

/**
 * What became of each step: kept as it was (before `from`), folded again, failed (it and every step after
 * it keep their old paper), or a step with no operation, which replaying can't go past.
 */
export type StepStatus = 'kept' | 'replayed' | 'failed' | 'baked' | 'skipped';

export interface Replay {
  model: OrigamiModel;
  status: StepStatus[];
  /** Why the failed step failed, numbered from 1 as the Studio shows steps. */
  error?: { step: number; message: string };
}

/**
 * Folds a model again from step `from` (0-based) using each step's operation. Earlier steps are kept as they
 * are. Titles, text, kinds and sections are kept; only the paper changes.
 */
export function replay(model: OrigamiModel, from = 0): Replay {
  const steps: Step[] = [];
  const status: StepStatus[] = [];
  const stop = (k: number, why: StepStatus, message?: string): Replay => {
    status.push(why, ...model.steps.slice(k + 1).map((): StepStatus => 'skipped'));
    steps.push(...model.steps.slice(k));
    return { model: { ...model, steps }, status, ...(message !== undefined && { error: { step: k + 1, message } }) };
  };
  if (model.steps.length > LIMITS.steps) return stop(Math.min(from, model.steps.length - 1), 'failed', `more than ${LIMITS.steps} steps`);

  for (let k = 0; k < model.steps.length; k++) {
    const step = model.steps[k];
    if (k < from) {
      steps.push(step);
      status.push('kept');
      continue;
    }
    if (!step.op) return stop(k, 'baked');
    try {
      const { frame, via } = run(step.op, { model, steps });
      if (frame.faces_vertices.length > LIMITS.faces) throw new OpError(`more than ${LIMITS.faces} faces`);
      const { via: _, ...rest } = step;
      steps.push({ ...rest, frame, ...(via && { via }) });
      status.push('replayed');
    } catch (e) {
      if (!(e instanceof Error)) throw e;
      return stop(k, 'failed', e.message);
    }
  }
  return { model: { ...model, steps }, status };
}

interface Context {
  model: Pick<OrigamiModel, 'sheets' | 'start'>;
  /** The steps before this one, already replayed. */
  steps: Step[];
}

const radians = (degrees: number) => (degrees * Math.PI) / 180;

function run(op: Op, ctx: Context): { frame: FoldFrame; via?: FoldFrame[] } {
  const frames = [ctx.model.start, ...ctx.steps.map((s) => s.frame)];
  const frame = frames[frames.length - 1];
  const where = (a: At, on = frame): Vec2 => ('table' in a ? a.table : locate(on, a.paper));
  const test = (f: Faces | undefined, line?: Line, on = frame) => f && select(f, { frame: on, sheets: ctx.model.sheets, line });

  switch (op.op) {
    case 'fold': {
      const line = lineOf(op.line, frame, op.flip);
      return { frame: fold(frame, { line, kind: op.kind ?? 'valley', layers: op.layers, only: test(op.only, line) }) };
    }
    case 'collapse': {
      const creases = op.creases.map((c) => {
        const line = lineOf(c.line, frame, c.flip);
        return { line, kind: c.kind, only: test(c.only, line) };
      });
      let anchor: Vec2;
      if ('paper' in op.anchor) anchor = op.anchor.paper;
      else {
        const found = anchorFor(frame, creases.map((c) => c.line), test(op.anchor.among));
        if (!found) throw new FoldError('No part of the paper stays still.');
        anchor = found;
      }
      return { frame: collapse(frame, { creases, anchor, under: test(op.under) }) };
    }
    case 'unfold': {
      let to = op.to;
      if (to === undefined) {
        const lastUnfold = ctx.steps.findLastIndex((s) => s.kind === 'unfold');
        const lastFold = ctx.steps.findLastIndex((s) => s.kind === 'fold');
        if (lastFold <= lastUnfold) throw new FoldError('Nothing to unfold.');
        to = lastFold;
      }
      if (to >= frames.length - 1) throw new OpError(`Can’t unfold to step ${to}, which hasn’t happened yet.`);
      return unfoldStep(frames, to);
    }
    case 'turnOver':
      return { frame: turnOver(frame) };
    case 'rotate':
      return { frame: rotate(frame, radians(op.degrees)) };
    case 'move':
      return {
        frame: place(frame, {
          only: test(op.only)!,
          to: op.to && where(op.to),
          angle: radians(op.degrees ?? 0),
          flip: op.flip,
          under: op.under,
        }),
      };
    case 'newSheet': {
      const { start } = ctx.model;
      const faces_parent = start.faces_vertices.map((face) => {
        const c = centre(face.map((v) => start.vertices_paper[v]));
        const at = frame.faces_vertices.findIndex((g) => inside(g.map((v) => frame.vertices_paper[v]), c));
        if (at < 0) throw new FoldError('No paper to replace with a fresh sheet.');
        return at;
      });
      return { frame: { ...start, faces_parent } };
    }
    case 'shape': {
      // The run of shaping steps this one adds to, and the flat state before it.
      let first = ctx.steps.length;
      while (first > 0 && ctx.steps[first - 1].op?.op === 'shape') first--;
      if (first > 0 && !ctx.steps[first - 1].op && ctx.steps[first - 1].kind === 'pose')
        throw new OpError('Can’t add to a 3D step that has no operation saved.');
      const base = frames[first];
      const bends = [...ctx.steps.slice(first).map((s) => s.op as Extract<Op, { op: 'shape' }>), op].flatMap((o) =>
        o.bends.flatMap((b) => bendsOf(b, base, ctx.model.sheets)),
      );
      const shaped = shape(base, bends);
      return { frame: first < ctx.steps.length ? reparent(frame, shaped) : shaped };
    }
    case 'popUp':
      return { frame: radial(frame, where(op.centre), op.rays) };
    case 'together': {
      const added: Step[] = [];
      for (const part of op.ops) {
        const { frame: f } = run(part, { model: ctx.model, steps: [...ctx.steps, ...added] });
        added.push({ title: '', kind: opKind(part), frame: f, op: part });
      }
      if (!added.length) return { frame };
      const last = added[added.length - 1].frame;
      // Each face's parent, followed back through the merged steps to the frame before them.
      const faces_parent = last.faces_vertices.map((_, f) => {
        let p = f;
        for (let k = added.length - 1; k >= 0; k--) p = added[k].frame.faces_parent?.[p] ?? p;
        return p;
      });
      return { frame: { ...last, faces_parent } };
    }
  }
}

/** A line spec as a line on the table, for the paper as it is in `frame`. */
export function lineOf(spec: LineSpec, frame: FoldFrame, flip = false): Line {
  const where = (a: At): Vec2 => ('table' in a ? a.table : locate(frame, a.paper));
  let line: Line;
  if ('onto' in spec) line = lineOnto(where(spec.onto[0]), where(spec.onto[1]));
  else if ('edgeOnto' in spec) {
    const [[a1, a2], [b1, b2]] = spec.edgeOnto;
    const l = lineEdgeOnto(where(a1), where(a2), where(b1), where(b2));
    if (!l) throw new FoldError('That edge is already on that line.');
    line = l;
  } else if ('through' in spec) {
    line = lineThrough(where(spec.through[0]), where(spec.through[1]));
    if (spec.moving === 'smaller') line = smallerSideMoves(frame, line);
    else if (spec.moving && sideOf(line, where(spec.moving)) < 0) line = flipLine(line);
  } else line = spec.line;
  return flip ? flipLine(line) : line;
}

/** A face selector as a test on faces' corners on the sheet. `top` needs the line of the crease it limits. */
export function select(f: Faces, ctx: { frame: FoldFrame; sheets: OrigamiModel['sheets']; line?: Line }): (paper: Vec2[]) => boolean {
  if ('sheet' in f) return (paper) => sheetOf(ctx.sheets, paper) === f.sheet;
  if ('top' in f) {
    if (!ctx.line) throw new OpError('“top” only works on something with a fold line.');
    return topLayers(ctx.frame, ctx.line, f.top);
  }
  if ('inPaper' in f) {
    return (paper) => {
      const c = centre(paper);
      return f.inPaper.some((poly) => inside(poly, c));
    };
  }
  const tests = f.all.map((g) => select(g, ctx));
  return (paper) => tests.every((t) => t(paper));
}

/** One bend of a shaping step as the bends `shape` takes, on the flat state `base`. */
function bendsOf(b: ShapeBend, base: FoldFrame, sheets: OrigamiModel['sheets']): Bend[] {
  const line = lineOf(b.line, base, b.flip);
  const bend: Bend = { line, angle: radians(b.degrees), layers: b.layers, only: b.only && select(b.only, { frame: base, sheets, line }) };
  const n = b.segments ?? 1;
  if (n <= 1 || !b.reach) return curl(base, bend, n);
  // A curl out to a given point: the line moved towards it a step at a time, each turning its share.
  const tip = 'table' in b.reach ? b.reach.table : locate(base, b.reach.paper);
  const len = Math.hypot(line.d[0], line.d[1]);
  const across: Vec2 = [-line.d[1] / len, line.d[0] / len];
  const reach = sideOf(line, tip) / len;
  return Array.from({ length: n }, (_, i) => ({
    ...bend,
    line: { p: [line.p[0] + (across[0] * reach * i) / n, line.p[1] + (across[1] * reach * i) / n] as Vec2, d: line.d },
    angle: radians(b.degrees / n),
  }));
}
