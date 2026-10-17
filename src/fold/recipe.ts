import { collapse, type CreaseKind } from './collapse';
import { fold, FoldError, placeLike, rotate, toFlat, turnOver, unfoldTo, type FoldKind } from './fold';
import { flipLine, lineOnto, lineThrough, sideOf, signedArea, sub, type Line } from './geometry2d';
import type { FoldFrame, OrigamiModel, Sheet, Step, Vec2, Vec3 } from './types';

/**
 * Writing a model as code: a list of folds described the way a diagram would ("this corner onto that
 * point"), worked out by the fold engine. Used for the built-in models, which scripts/build-models.ts
 * turns into .fold files.
 *
 * Points are given on the sheet with `paper(u, v)` and are found wherever that bit of paper is now,
 * or on the table with `table(x, z)`.
 */

export type At = { paper: Vec2 } | { table: Vec2 };
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

export class Recipe {
  private start: FoldFrame;
  private steps: Step[] = [];

  private info: { id: string; title: string; sheets: Sheet[] };

  /**
   * One `sheet`, or several `sheets`. Each sheet starts flat on the table, front up, with its centre at `at`
   * (by default, at its own `origin`).
   */
  constructor(info: { id: string; title: string } & ({ sheet: Sheet } | { sheets: (Sheet & { at?: Vec2 })[] })) {
    const sheets: (Sheet & { at?: Vec2 })[] = 'sheet' in info ? [info.sheet] : info.sheets;
    this.info = { id: info.id, title: info.title, sheets: sheets.map(({ at: _, ...s }) => s as Sheet) };
    const vertices_paper: Vec2[] = [];
    const vertices_coords: Vec3[] = [];
    const faces_vertices: number[][] = [];
    for (const s of sheets) {
      const [w, h] = s.size;
      const [ou, ov] = s.origin ?? [0, 0];
      const [ax, az] = s.at ?? [ou, ov];
      const base = vertices_paper.length;
      for (const [du, dv] of [[-w / 2, h / 2], [w / 2, h / 2], [w / 2, -h / 2], [-w / 2, -h / 2]]) {
        vertices_paper.push([ou + du, ov + dv]);
        vertices_coords.push([ax + du, 0, az + dv]);
      }
      faces_vertices.push([base, base + 1, base + 2, base + 3]);
    }
    this.start = { vertices_paper, vertices_coords, faces_vertices };
  }

  get current(): FoldFrame {
    return this.steps.at(-1)?.frame ?? this.start;
  }

  /** Where a point is on the table right now. */
  where(at: At): Vec2 {
    return 'table' in at ? at.table : locate(this.current, at.paper);
  }

  /** Folds so `from` lands exactly on `to`. */
  onto(from: At, to: At, step: FoldStep): this {
    return this.fold(lineOnto(this.where(from), this.where(to)), step);
  }

  /** Folds along the line through `a` and `b`, moving the side `moving` is on. */
  along(a: At, b: At, moving: At, step: FoldStep): this {
    const line = lineThrough(this.where(a), this.where(b));
    return this.fold(sideOf(line, this.where(moving)) > 0 ? line : flipLine(line), step);
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
    return this.push({ title: step.title ?? 'Unfold', text: step.text, kind: 'unfold' }, unfoldTo(this.frames(), to));
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
  ): this {
    const lines = creases.map((c) => ({
      line: lineThrough(this.where(c.through[0]), this.where(c.through[1])),
      kind: c.kind,
      only: c.only && ((poly: Vec2[]) => c.only!([avg(poly, 0), avg(poly, 1)])),
    }));
    const at = 'paper' in anchor ? anchor.paper : null;
    if (!at) throw new FoldError(`${this.info.id}: a collapse's anchor must be a point on the sheet.`);
    try {
      return this.push({ title: step.title, text: step.text, kind: step.kind ?? 'fold' }, collapse(this.current, { creases: lines, anchor: at }));
    } catch (e) {
      if (e instanceof FoldError) e.message = `${this.info.id}, step ${this.steps.length + 1} (${step.title}): ${e.message}`;
      throw e;
    }
  }

  turnOver(text = 'Flip the paper over from left to right.'): this {
    return this.push({ title: 'Turn over', text, kind: 'turn-over' }, turnOver(this.current));
  }

  /** Turns the paper on the table, anticlockwise seen from above. */
  rotate(degrees: number, step: { title: string; text?: string }): this {
    return this.push({ ...step, kind: 'rotate' }, rotate(this.current, (degrees * Math.PI) / 180));
  }

  build(): OrigamiModel {
    return { ...this.info, start: this.start, steps: this.steps };
  }

  private fold(line: Line, { title, text, kind = 'valley', layers, only }: FoldStep): this {
    const test = only && ((poly: Vec2[]) => only([avg(poly, 0), avg(poly, 1)]));
    try {
      return this.push({ title, text, kind: 'fold' }, fold(this.current, { line, kind, layers, only: test }));
    } catch (e) {
      if (e instanceof FoldError) e.message = `${this.info.id}, step ${this.steps.length + 1} (${title}): ${e.message}`;
      throw e;
    }
  }

  private push({ title, text, kind }: Omit<Step, 'frame'>, frame: FoldFrame): this {
    this.steps.push({ title, ...(text && { text }), kind, frame });
    return this;
  }

  private frames(): FoldFrame[] {
    return [this.start, ...this.steps.map((s) => s.frame)];
  }
}

const avg = (poly: Vec2[], i: number) => poly.reduce((sum, p) => sum + p[i], 0) / poly.length;

/** Where a point of the sheet is on the table in a flat frame. */
export function locate(frame: FoldFrame, p: Vec2): Vec2 {
  for (const face of toFlat(frame)) if (inside(face.paper, p)) return placeLike(face)(p);
  throw new FoldError(`(${p.join(', ')}) isn’t on the paper.`);
}

function inside(poly: Vec2[], p: Vec2): boolean {
  const s = Math.sign(signedArea(poly));
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const e = sub(b, a);
    if (s * (e[0] * (p[1] - a[1]) - e[1] * (p[0] - a[0])) < -1e-9) return false;
  }
  return true;
}
