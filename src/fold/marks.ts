import { signedArea } from './geometry2d';
import type { Op } from './ops';
import type { Mark, OrigamiModel, Vec2 } from './types';
export type { Mark } from './types';

/**
 * Marks drawn on the paper, such as a face drawn on at the end. Each is kept as points on the sheet and the
 * side of the paper it's on (see `Mark`), so it moves with the paper wherever it goes, and shows only from
 * that side. To draw one, it's cut into the pieces on each face of the paper (faces are convex), and each
 * piece is placed and stacked with its face: so a mark across a crease follows the paper either side of it.
 */

/** How wide a drawn line is, as a share of the sheet's longer side. */
export const MARK_WIDTH = 0.007;
export const MARK_COLOUR = '#2b2a33';

/**
 * The marks drawn by each of the first `k` steps, in order, with the step that drew them (1 for the first step).
 * A fresh sheet starts clean, so marks drawn before the last one are left out.
 */
export function marksUpTo(model: Pick<OrigamiModel, 'steps'>, k: number): { step: number; mark: Mark }[] {
  const steps = model.steps.slice(0, k);
  const fresh = (op?: Op): boolean => op?.op === 'newSheet' || (op?.op === 'together' && op.ops.some(fresh));
  const from = steps.findLastIndex((s) => fresh(s.op)) + 1;
  return steps.slice(from).flatMap((s, i) => (s.marks ?? []).map((mark) => ({ step: from + i + 1, mark })));
}

/**
 * The parts of a mark on one face, given by its corners on the sheet: a line's runs inside the face, or a
 * fill cut to the face's outline. Empty if none of it is on the face.
 */
export function onFace(mark: Mark, face: Vec2[]): Vec2[][] {
  const poly = signedArea(face) < 0 ? [...face].reverse() : face;
  return mark.fill ? clipFill(mark.points, poly) : clipLine(mark.points, poly);
}

/** Within ε of the face counts as on it, so a line along a crease isn't lost from both sides. */
const EPS = 1e-9;

/** The runs of a line (through `points`) inside a convex outline (anticlockwise), each two or more points. */
function clipLine(points: Vec2[], poly: Vec2[]): Vec2[][] {
  const runs: Vec2[][] = [];
  let run: Vec2[] | null = null;
  for (let i = 0; i + 1 < points.length; i++) {
    const [a, b] = [points[i], points[i + 1]];
    const span = clipSegment(a, b, poly);
    if (!span) {
      run = null;
      continue;
    }
    const [t0, t1] = span;
    const from = lerp(a, b, t0);
    const to = lerp(a, b, t1);
    // A run carries on across a point inside the face; it starts again where the line comes back in.
    if (!run || t0 > EPS) {
      run = [from];
      runs.push(run);
    }
    run.push(to);
    if (t1 < 1 - EPS) run = null;
  }
  return runs.filter((r) => r.length > 1 && dist(r[0], r.at(-1)!) > EPS);
}

/** The part of segment a→b inside a convex outline, as a range of 0–1 along it (Cyrus–Beck), or null. */
function clipSegment(a: Vec2, b: Vec2, poly: Vec2[]): [number, number] | null {
  let t0 = 0;
  let t1 = 1;
  const d: Vec2 = [b[0] - a[0], b[1] - a[1]];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    // Inside an anticlockwise outline is to the left of each edge: how far left a is, and how fast that changes.
    const e: Vec2 = [q[0] - p[0], q[1] - p[1]];
    const left = e[0] * (a[1] - p[1]) - e[1] * (a[0] - p[0]) + EPS;
    const rate = e[0] * d[1] - e[1] * d[0];
    if (Math.abs(rate) < 1e-15) {
      if (left < 0) return null;
      continue;
    }
    const t = -left / rate;
    if (rate > 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1) return null;
  }
  return [t0, t1];
}

/** A shape cut to a convex outline (anticlockwise; Sutherland–Hodgman), as one outline, or none if it misses. */
function clipFill(points: Vec2[], poly: Vec2[]): Vec2[][] {
  let out = signedArea(points) < 0 ? [...points].reverse() : points;
  for (let i = 0; i < poly.length && out.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const left = (x: Vec2) => (q[0] - p[0]) * (x[1] - p[1]) - (q[1] - p[1]) * (x[0] - p[0]) + EPS;
    const kept: Vec2[] = [];
    out.forEach((a, j) => {
      const b = out[(j + 1) % out.length];
      const [la, lb] = [left(a), left(b)];
      if (la >= 0) kept.push(a);
      if (la >= 0 !== lb >= 0) kept.push(lerp(a, b, la / (la - lb)));
    });
    out = kept;
  }
  return out.length >= 3 && Math.abs(signedArea(out)) > 1e-12 ? [out] : [];
}

const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const dist = (a: Vec2, b: Vec2) => Math.hypot(a[0] - b[0], a[1] - b[1]);
