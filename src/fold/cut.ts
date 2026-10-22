import { FoldError, fromFlat, placeLike, toFlat, type FlatFace } from './fold';
import { cross, dot, split, sub, type Cut, type Line } from './geometry2d';
import type { FoldFrame, Vec2 } from './types';

/**
 * Scissor cuts. A cut is a straight snip along a segment on the table, through every layer it crosses (or the
 * top N, or the faces `only` picks). Each face it crosses is split along the cut's line, and the stretch of the
 * cut inside it is kept, as a segment on the sheet, in the frame's `cuts`: faces meeting along a cut aren't
 * joined there, so folds after it can move them apart. Paper beyond the cut's ends stays joined.
 */

export interface CutOptions {
  from: Vec2;
  to: Vec2;
  /** Cut only the top N layers where the cut crosses. Leave out to cut through every layer. */
  layers?: number;
  /** Cut only faces whose corners on the sheet pass this test. */
  only?: (paper: Vec2[]) => boolean;
}

const EPS = 1e-9;

/** The paper after a cut from `from` to `to` on the table. */
export function cut(frame: FoldFrame, { from, to, layers, only }: CutOptions): FoldFrame {
  const faces = toFlat(frame);
  const reach = faces.map((f) => clip(f.world, from, to));
  const crossed = faces.map((_, i) => reach[i] !== null && (!only || only(faces[i].paper)));
  if (!crossed.some(Boolean)) throw new FoldError('That cut doesn’t cross any paper.');
  const top = Math.max(...faces.filter((_, i) => crossed[i]).map((f) => f.layer));
  const lowest = layers === undefined ? -Infinity : top - layers + 1;

  const d = sub(to, from);
  const line: Line = { p: from, d };
  const pieces: FlatFace[] = [];
  const cuts: Cut[] = [...(frame.cuts ?? [])];
  faces.forEach((f, i) => {
    const seg = reach[i];
    if (!crossed[i] || !seg || f.layer < lowest) {
      pieces.push({ ...f, parent: i });
      return;
    }
    // The stretch of the cut in this face, on the sheet.
    const toSheet = placeLike({ ...f, paper: f.world, world: f.paper });
    cuts.push([toSheet(seg[0]), toSheet(seg[1])]);
    const { pos, neg } = split(f, line);
    if (pos) pieces.push({ ...pos, layer: f.layer, parent: i });
    if (neg) pieces.push({ ...neg, layer: f.layer, parent: i });
  });
  return { ...fromFlat(pieces), cuts };
}

/** The part of the segment a–b inside a convex polygon (or on its edge), if more than a point. */
export function clip(poly: Vec2[], a: Vec2, b: Vec2): [Vec2, Vec2] | null {
  const d = sub(b, a);
  let lo = 0;
  let hi = 1;
  // Which way the polygon's corners turn, so "inside" is the same side of every edge.
  const turn = Math.sign(poly.reduce((s, p, i) => s + cross(p, poly[(i + 1) % poly.length]), 0)) || 1;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const e = sub(poly[(i + 1) % poly.length], p);
    const normal: Vec2 = [-e[1] * turn, e[0] * turn];
    const num = dot(normal, sub(a, p));
    const den = dot(normal, d);
    if (Math.abs(den) < EPS) {
      if (num < -EPS) return null;
      continue;
    }
    const t = -num / den;
    if (den > 0) lo = Math.max(lo, t);
    else hi = Math.min(hi, t);
    if (hi - lo < EPS) return null;
  }
  const len = Math.hypot(d[0], d[1]) * (hi - lo);
  if (len < 1e-7) return null;
  return [
    [a[0] + d[0] * lo, a[1] + d[1] * lo],
    [a[0] + d[0] * hi, a[1] + d[1] * hi],
  ];
}
