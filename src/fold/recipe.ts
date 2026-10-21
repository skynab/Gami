import { collapse, type CreaseKind } from './collapse';
import { fold, FoldError, placeLike, rotate, toFlat, turnOver, unfoldStep, type FoldKind } from './fold';
import { inside, locate } from './select';
export { locate } from './select';
import { place } from './place';
import { radial, reparent, shape, type Bend, type Ray } from './shape';
import { startFrame } from './sheets';
import { frontUp, sideOf } from './geometry2d';
import { lineOf, type At, type Faces, type LineSpec, type Op } from './ops';
import type { FoldFrame, Mark, OrigamiModel, Sheet, Step, Vec2 } from './types';

/**
 * Writing a model as code: a list of folds described the way a diagram would ("this corner onto that
 * point"), worked out by the fold engine. Used for the built-in models, which scripts/build-models.ts
 * turns into .fold files.
 *
 * Points are given on the sheet with `paper(u, v)` and are found wherever that bit of paper is now,
 * or on the table with `table(x, z)`.
 *
 * Each step also records its operation (ops.ts), so a model built here can be folded again, and edited, from
 * its .fold file. Tests on faces are recorded as the outlines of the faces they picked.
 */

export type { At } from './ops';
export const paper = (u: number, v: number): At => ({ paper: [u, v] });
export const table = (x: number, z: number): At => ({ table: [x, z] });

interface FoldStep {
  title: string;
  text?: string;
  kind?: FoldKind;
  /** Fold only the top N layers on the moving side. */
  layers?: number;
  /** Fold only the faces of this part of the sheet, given as a test on a face's centre on the sheet. */
  only?: (centre: Vec2) => boolean;
}

/**
 * One bend of a 3D shaping step: about the line through two points, turning the side `moving` is on up by
 * `degrees`. With `segments`, the turn is spread over that many bends between the line and `moving`, curling it.
 */
export interface ShapeBend {
  through: [At, At];
  moving: At;
  degrees: number;
  segments?: number;
  layers?: number;
  only?: (centre: Vec2) => boolean;
}

export class Recipe {
  private start: FoldFrame;
  private steps: Step[] = [];
  /** After 3D shaping: the flat state it started from, and its bends so far. */
  private shaping?: { base: FoldFrame; bends: Bend[] };
  /** The section the next step starts, from `section()`. */
  private sectionName?: string;

  private info: { id: string; title: string; sheets: Sheet[]; card?: OrigamiModel['card'] };

  /**
   * One `sheet`, or several `sheets`. Each sheet starts flat on the table, front up, with its centre at `at`
   * (by default, at its own `origin`).
   */
  constructor(info: { id: string; title: string; card?: OrigamiModel['card'] } & ({ sheet: Sheet } | { sheets: (Sheet & { at?: Vec2 })[] })) {
    const sheets: (Sheet & { at?: Vec2 })[] = 'sheet' in info ? [info.sheet] : info.sheets;
    this.info = { id: info.id, title: info.title, sheets: sheets.map(({ at: _, ...s }) => s as Sheet), ...(info.card && { card: info.card }) };
    this.start = startFrame(sheets);
  }

  get current(): FoldFrame {
    return this.steps.at(-1)?.frame ?? this.start;
  }

  /**
   * The point of the sheet lying at `spot` on the table: on the topmost face there that `only` accepts.
   * For anchoring a compound fold on a particular piece, in multi-sheet models.
   */
  sheetAt(spot: Vec2, only: (centre: Vec2) => boolean = () => true): At {
    const faces = toFlat(this.current)
      .filter((f) => only([avg(f.paper, 0), avg(f.paper, 1)]) && inside(f.world, spot))
      .sort((a, b) => b.layer - a.layer);
    if (!faces.length) throw new FoldError(`${this.info.id}: no paper at (${spot.join(', ')}).`);
    const f = faces[0];
    // The face's map from table back to sheet: the same construction with the roles swapped.
    return paper(...placeLike({ ...f, paper: f.world, world: f.paper })(spot));
  }

  /** Where a point is on the table right now (or, once shaping has started, in the flat state it started from). */
  where(at: At): Vec2 {
    return 'table' in at ? at.table : locate(this.shaping?.base ?? this.current, at.paper);
  }

  /** How high up the paper picked out by `only` (a test on faces' centres on the sheet) is at a point on the table. */
  layerAt(spot: Vec2, only: (centre: Vec2) => boolean): number {
    const here = toFlat(this.current).filter((f) => only([avg(f.paper, 0), avg(f.paper, 1)]) && inside(f.world, spot));
    return Math.max(-Infinity, ...here.map((f) => f.layer));
  }

  /** The paper over a point on the table, top first, as each face's centre on the sheet. */
  stackAt(spot: Vec2): Vec2[] {
    return toFlat(this.current)
      .filter((f) => inside(f.world, spot))
      .sort((a, b) => b.layer - a.layer)
      .map((f): Vec2 => [avg(f.paper, 0), avg(f.paper, 1)]);
  }

  /** The faces passing a test on their centre on the sheet and on the table, as their outlines on the sheet. */
  pieces(test: (centre: Vec2, at: Vec2) => boolean): Vec2[][] {
    return toFlat(this.current)
      .filter((f) => test([avg(f.paper, 0), avg(f.paper, 1)], [avg(f.world, 0), avg(f.world, 1)]))
      .map((f) => f.paper);
  }

  /** Folds so `from` lands exactly on `to`. */
  onto(from: At, to: At, step: FoldStep): this {
    return this.fold({ onto: [from, to] }, step);
  }

  /** Folds the edge from `a1` to `a2` onto the line from `b1` to `b2` (`a1`'s end going `b1`'s way). */
  edgeOnto(edge: [At, At], onto: [At, At], step: FoldStep): this {
    return this.fold({ edgeOnto: [edge, onto] }, step);
  }

  /** Folds along the line through `a` and `b`, moving the side `moving` is on. */
  along(a: At, b: At, moving: At, step: FoldStep): this {
    return this.fold({ through: [a, b], moving }, step);
  }

  /** Folds and unfolds again, leaving just a crease. */
  crease(from: At, to: At, step: Omit<FoldStep, 'layers'>): this {
    this.onto(from, to, step);
    return this.unfold({ title: 'Unfold', text: 'Open it back up, leaving a crease.' });
  }

  /**
   * Opens the paper back up, keeping the creases. By default undoes the last fold; pass `to` (from `mark()`)
   * to open everything folded since then.
   */
  unfold(step: { title?: string; text?: string; to?: number } = {}): this {
    let to = step.to;
    if (to === undefined) {
      const lastUnfold = this.steps.findLastIndex((s) => s.kind === 'unfold');
      const lastFold = this.steps.findLastIndex((s) => s.kind === 'fold');
      if (lastFold <= lastUnfold) throw new FoldError(`${this.info.id}: nothing to unfold at step ${this.steps.length + 1}`);
      to = lastFold;
    }
    const { frame, via } = unfoldStep(this.frames(), to);
    this.push({ title: step.title ?? 'Unfold', text: step.text, kind: 'unfold' }, frame, { op: 'unfold', ...(step.to !== undefined && { to }) });
    if (via) this.steps.at(-1)!.via = via;
    return this;
  }

  /**
   * Picks up the faces `only` selects (a sheet, usually) and puts them down: optionally turned over and
   * turned by `degrees`, with their middle at `to`, on top of or under the rest.
   */
  move(
    step: { title: string; text?: string },
    only: (centre: Vec2) => boolean,
    how: { to?: At; degrees?: number; flip?: boolean; under?: boolean },
  ): this {
    const test = recorder(only);
    const to = how.to && this.where(how.to);
    const frame = place(this.current, { only: test, to, angle: ((how.degrees ?? 0) * Math.PI) / 180, flip: how.flip, under: how.under });
    return this.push({ title: step.title, text: step.text, kind: 'assemble' }, frame, {
      op: 'move',
      only: test.faces(),
      ...(how.to && { to: how.to }),
      ...(how.degrees !== undefined && { degrees: how.degrees }),
      ...(how.flip !== undefined && { flip: how.flip }),
      ...(how.under !== undefined && { under: how.under }),
    });
  }

  /**
   * Several folds shown as one step, such as the same fold on both sheets of a modular model.
   * `make` adds the folds as usual; they're then merged, and play at the same time.
   */
  together(step: { title: string; text?: string; kind?: Step['kind'] }, make: (r: this) => void): this {
    const before = this.steps.length;
    make(this);
    const added = this.steps.splice(before);
    if (!added.length) return this;
    this.sectionName ??= added[0].section;
    const last = added.at(-1)!.frame;
    // Each face's parent, followed back through the merged folds to the frame before them.
    const faces_parent = last.faces_vertices.map((_, f) => {
      let p = f;
      for (let k = added.length - 1; k >= 0; k--) p = added[k].frame.faces_parent?.[p] ?? p;
      return p;
    });
    const op: Op = { op: 'together', ops: added.map((s) => s.op!) };
    this.push({ title: step.title, text: step.text, kind: step.kind ?? added.at(-1)!.kind }, { ...last, faces_parent }, op);
    const marks = added.flatMap((s) => s.marks ?? []);
    if (marks.length) this.steps.at(-1)!.marks = marks;
    return this;
  }

  /**
   * Puts the paper aside and starts again on a fresh, uncreased sheet (or sheets) as at the start. The paper
   * must be flat and open where it began, as after unfolding everything: the new sheet appears in its place.
   */
  newSheet(step: { title: string; text?: string }): this {
    const faces_parent = this.start.faces_vertices.map((_, f) => this.sheetFace(f));
    return this.push({ title: step.title, text: step.text, kind: 'assemble' }, { ...this.start, faces_parent }, { op: 'newSheet' });
  }

  /** A face of the current paper on the same sheet as the start's face `f`, to grow the fresh sheet from. */
  private sheetFace(f: number): number {
    const face = this.start.faces_vertices[f].map((v) => this.start.vertices_paper[v]);
    const centre: Vec2 = [avg(face, 0), avg(face, 1)];
    const at = this.current.faces_vertices.findIndex((g) => inside(g.map((v) => this.current.vertices_paper[v]), centre));
    if (at < 0) throw new FoldError(`${this.info.id}: no paper to replace at step ${this.steps.length + 1}`);
    return at;
  }

  /** Starts a part of the model called `name` (each topic of a lesson, say) with the next step. */
  section(name: string): this {
    this.sectionName = name;
    return this;
  }

  /** A bookmark for `unfold({ to })`: the paper as it is now. */
  mark(): number {
    return this.steps.length;
  }

  /**
   * Several creases at once: a squash, petal, reverse or sink fold, or collapsing into a base.
   * Each crease runs through two points; `anchor` is a point on the sheet that stays put.
   */
  collapse(
    step: { title: string; text?: string; kind?: Step['kind'] },
    creases: { through: [At, At]; kind: CreaseKind; only?: (centre: Vec2) => boolean }[],
    anchor: At,
    /** Tucking: the moving paper slides under the faces this picks out (by their centre on the sheet). */
    under?: (centre: Vec2) => boolean,
  ): this {
    const lines = creases.map((c) => ({
      spec: { through: c.through } as LineSpec,
      line: lineOf({ through: c.through }, this.current),
      kind: c.kind,
      only: c.only && recorder(c.only),
    }));
    const at = 'paper' in anchor ? anchor.paper : null;
    if (!at) throw new FoldError(`${this.info.id}: a collapse's anchor must be a point on the sheet.`);
    try {
      const tuck = under && recorder(under);
      const frame = collapse(this.current, { creases: lines, anchor: at, under: tuck });
      return this.push({ title: step.title, text: step.text, kind: step.kind ?? 'fold' }, frame, {
        op: 'collapse',
        creases: lines.map((c) => ({ line: c.spec, kind: c.kind, ...(c.only && { only: c.only.faces() }) })),
        anchor: { paper: at },
        ...(tuck && { under: tuck.faces() }),
      });
    } catch (e) {
      if (e instanceof FoldError) e.message = `${this.info.id}, step ${this.steps.length + 1} (${step.title}): ${e.message}`;
      throw e;
    }
  }

  /**
   * Shapes the paper in 3D: opening flaps partway, curling petals. Lines are drawn on the last flat state,
   * and a later shaping step adds its bends to the earlier ones'. Nothing can be folded flat afterwards.
   */
  shape(step: { title: string; text?: string }, bends: ShapeBend[]): this {
    const base = this.shaping?.base ?? this.current;
    const tests = bends.map((b) => b.only && recorder(b.only));
    const added = bends.flatMap((b, k): Bend[] => {
      const test = tests[k];
      const line = lineOf({ through: b.through, moving: b.moving }, base);
      const tip = this.where(b.moving);
      const n = b.segments ?? 1;
      // A curl: the same line moved towards the tip, a step at a time, each turning its share of the angle.
      const len = Math.hypot(line.d[0], line.d[1]);
      const across: Vec2 = [-line.d[1] / len, line.d[0] / len];
      const reach = sideOf(line, tip) / len;
      return Array.from({ length: n }, (_, i) => ({
        line: { p: [line.p[0] + (across[0] * reach * i) / n, line.p[1] + (across[1] * reach * i) / n] as Vec2, d: line.d },
        angle: ((b.degrees / n) * Math.PI) / 180,
        layers: b.layers,
        only: test,
      }));
    });
    const bendsSoFar = [...(this.shaping?.bends ?? []), ...added];
    try {
      // Shaped again from the flat state: each face's parent is the face of the last step it lies within.
      const frame = this.shaping ? reparent(this.current, shape(base, bendsSoFar)) : shape(base, bendsSoFar);
      this.push({ title: step.title, text: step.text, kind: 'pose' }, frame, {
        op: 'shape',
        bends: bends.map((b, k) => ({
          line: { through: b.through, moving: b.moving },
          degrees: b.degrees,
          ...(b.segments !== undefined && { segments: b.segments }),
          ...((b.segments ?? 1) > 1 && { reach: b.moving }),
          ...(b.layers !== undefined && { layers: b.layers }),
          ...(tests[k] && { only: tests[k].faces() }),
        })),
      });
    } catch (e) {
      if (e instanceof FoldError) e.message = `${this.info.id}, step ${this.steps.length + 1} (${step.title}): ${e.message}`;
      throw e;
    }
    this.shaping = { base, bends: bendsSoFar };
    return this;
  }

  /** Pops the model up about a point, creases from it rising along `rays` (see `radial`). Nothing can be folded after. */
  popUp(step: { title: string; text?: string }, centre: At, rays: Ray[]): this {
    try {
      return this.push({ ...step, kind: 'pose' }, radial(this.current, this.where(centre), rays), { op: 'popUp', centre, rays });
    } catch (e) {
      if (e instanceof FoldError) e.message = `${this.info.id}, step ${this.steps.length + 1} (${step.title}): ${e.message}`;
      throw e;
    }
  }

  /**
   * Draws on the paper where it lies now, as a face drawn on at the end: lines through points on the table, or
   * shapes filled in. Each mark goes on whatever paper is on top under its first point, on the side facing up,
   * and moves with it from then on.
   */
  draw(step: { title: string; text?: string }, marks: ({ line: Vec2[] } | { fill: Vec2[] })[]): this {
    const faces = toFlat(this.current).sort((a, b) => b.layer - a.layer);
    const drawn = marks.map((m): Mark => {
      const points = 'line' in m ? m.line : m.fill;
      const f = faces.find((face) => inside(face.world, points[0]));
      if (!f) throw new FoldError(`${this.info.id}: no paper to draw on at (${points[0].join(', ')}).`);
      // The face's map from table back to sheet: the same construction with the roles swapped.
      const toSheet = placeLike({ ...f, paper: f.world, world: f.paper });
      // Rounded as .fold files round coordinates, so the model and its file agree exactly.
      const round = (x: number) => Math.round(x * 1e9) / 1e9 || 0;
      const onSheet = points.map((p) => toSheet(p).map(round) as Vec2);
      return { side: frontUp(f.world, f.paper) ? 'front' : 'back', points: onSheet, ...('fill' in m && { fill: true }) };
    });
    this.push({ ...step, kind: 'draw' }, { ...this.current, faces_parent: undefined }, { op: 'draw', marks: drawn });
    this.steps.at(-1)!.marks = drawn;
    return this;
  }

  turnOver(text = 'Flip the paper over from left to right.'): this {
    return this.push({ title: 'Turn over', text, kind: 'turn-over' }, turnOver(this.current), { op: 'turnOver' });
  }

  /** Turns the paper on the table, anticlockwise seen from above. */
  rotate(degrees: number, step: { title: string; text?: string }): this {
    return this.push({ ...step, kind: 'rotate' }, rotate(this.current, (degrees * Math.PI) / 180), { op: 'rotate', degrees });
  }

  build(): OrigamiModel {
    return { ...this.info, start: this.start, steps: this.steps };
  }

  private fold(spec: LineSpec, { title, text, kind = 'valley', layers, only }: FoldStep): this {
    const test = only && recorder(only);
    try {
      const frame = fold(this.current, { line: lineOf(spec, this.current), kind, layers, only: test });
      return this.push({ title, text, kind: 'fold' }, frame, {
        op: 'fold',
        line: spec,
        ...(kind !== 'valley' && { kind }),
        ...(layers !== undefined && { layers }),
        ...(test && { only: test.faces() }),
      });
    } catch (e) {
      if (e instanceof FoldError) e.message = `${this.info.id}, step ${this.steps.length + 1} (${title}): ${e.message}`;
      throw e;
    }
  }

  private push({ title, text, kind }: Omit<Step, 'frame' | 'op'>, frame: FoldFrame, op: Op): this {
    this.shaping = undefined;
    const section = this.sectionName;
    this.sectionName = undefined;
    this.steps.push({ title, ...(text && { text }), kind, ...(section && { section }), frame, op });
    return this;
  }

  private frames(): FoldFrame[] {
    return [this.start, ...this.steps.map((s) => s.frame)];
  }
}

const avg = (poly: Vec2[], i: number) => poly.reduce((sum, p) => sum + p[i], 0) / poly.length;

/**
 * A test on faces' centres on the sheet, as the engine takes it (a test on their corners), that remembers the
 * faces it picked so the step's operation can name them.
 */
function recorder(only: (centre: Vec2) => boolean): ((poly: Vec2[]) => boolean) & { faces(): Faces } {
  const picked = new Map<string, Vec2[]>();
  const test = (poly: Vec2[]) => {
    const yes = only([avg(poly, 0), avg(poly, 1)]);
    if (yes) picked.set(poly.map((p) => p.join(',')).join(' '), poly);
    return yes;
  };
  // Rounded as .fold files round coordinates: each face's centre stays well inside its outline.
  const round = (x: number) => Math.round(x * 1e9) / 1e9 || 0;
  return Object.assign(test, { faces: (): Faces => ({ inPaper: [...picked.values()].map((poly) => poly.map((p) => p.map(round) as Vec2)) }) });
}
