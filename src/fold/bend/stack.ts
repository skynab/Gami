import { placeLike, toFlat } from '../fold';
import { LAYER_GAP } from '../frames';
import { frontUp, signedArea } from '../geometry2d';
import type { FoldFrame, Vec2, Vec3 } from '../types';

/**
 * Which of bent paper's layers to draw in front, where they lie on one another (see `LIFT` in the viewer): layers
 * bent from a flat stack can pass a little into each other, so the viewer draws each nearer the eye, or further,
 * by a number of places.
 *
 * Flat, the number is the layer: the stack's order, from whichever side it's seen. Bent, that goes wrong where the
 * stack has come apart. A balloon's walls are layers 8 and 15 of 24, its sides 9 and 14: blown up, the near wall's
 * outside was drawn 14 places back and the far wall's inside 14 forward, so the inside showed through along every
 * edge, where the two are close. So, bent, each triangle counts only against the paper still stacked with it: the
 * outermost of a pile, from the side it's seen, is drawn where it is, and each one under it as many places further
 * back as there are layers up to the top of what covers it (and of what covers that, so one that's covered is
 * always further back than its cover). What's on show is never moved, so nothing far off can be drawn over it;
 * only what's covered is, to keep it covered.
 */
export interface StackLifts {
  /** Each triangle's layer in the flat stack, signed by which way up it lay (minus if its back faced up). */
  layer: number[];
  /**
   * How many places nearer the eye (none are: these are 0 or less) each triangle is drawn once bent, seen from its
   * front, and from its back.
   */
  front: number[];
  back: number[];
}

/** How near two layers stay, bent, to count as still stacked. Paper lies a gap from the next, give or take a few. */
const STACKED = 12 * LAYER_GAP;
/** And how nearly the same way they still face (the cosine between them). */
const FACING = 0.8;
/** The paper over and under a triangle is looked for at its middle, and this far in from each corner towards it. */
const INSET = 0.1;

type V = Vec3;
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * `before` is the flat frame the paper was bent from, `bent` a frame of its triangles, and `parent` the face of
 * `before` each triangle is part of. Throws a FoldError if `before` isn't flat.
 */
export function stackLifts(before: FoldFrame, parent: number[], bent: FoldFrame): StackLifts {
  const flat = toFlat(before);
  const n = bent.faces_vertices.length;
  const layer = parent.map((f) => flat[f].layer);
  const up = parent.map((f) => frontUp(flat[f].world, flat[f].paper));
  const points = bent.faces_vertices.map((face) => face.map((v) => bent.vertices_coords[v]));
  // Where each triangle lay on the table.
  const table = bent.faces_vertices.map((face, f) => face.map((v) => bent.vertices_paper[v]).map(placeLike(flat[parent[f]])));
  const box = table.map((t) => [Math.min(...t.map((p) => p[0])), Math.max(...t.map((p) => p[0])), Math.min(...t.map((p) => p[1])), Math.max(...t.map((p) => p[1]))]);
  // The way that was up in the stack, as each triangle faces now. (On the table, corners turning anticlockwise
  // seen from above have their normal pointing down.)
  const upward = points.map((p, f): V => {
    const normal = cross(sub(p[1], p[0]), sub(p[2], p[0]));
    const length = Math.hypot(...normal) || 1;
    const sign = signedArea(table[f]) > 0 ? -1 : 1;
    return [(sign * normal[0]) / length, (sign * normal[1]) / length, (sign * normal[2]) / length];
  });
  /** Where the point of triangle `f` that lay at (x, z) on the table is now; null if it didn't lie there. */
  const now = (f: number, x: number, z: number): V | null => {
    const [t0, t1, t2] = table[f];
    const det = (t1[0] - t0[0]) * (t2[1] - t0[1]) - (t2[0] - t0[0]) * (t1[1] - t0[1]);
    if (Math.abs(det) < 1e-14) return null;
    const w1 = ((x - t0[0]) * (t2[1] - t0[1]) - (t2[0] - t0[0]) * (z - t0[1])) / det;
    const w2 = ((t1[0] - t0[0]) * (z - t0[1]) - (x - t0[0]) * (t1[1] - t0[1])) / det;
    if (w1 < -1e-9 || w2 < -1e-9 || w1 + w2 > 1 + 1e-9) return null;
    const [p0, p1, p2] = points[f];
    return [0, 1, 2].map((k) => p0[k] * (1 - w1 - w2) + p1[k] * w1 + p2[k] * w2) as V;
  };

  // For each triangle, the triangles lying next over it and next under it, still stacked with it: looked for at
  // a few of its points, among the paper that lay over and under each, in the stack's order.
  const over: number[][] = Array.from({ length: n }, () => []);
  const under: number[][] = Array.from({ length: n }, () => []);
  for (let f = 0; f < n; f++) {
    const middle: Vec2 = [(table[f][0][0] + table[f][1][0] + table[f][2][0]) / 3, (table[f][0][1] + table[f][1][1] + table[f][2][1]) / 3];
    const spots: Vec2[] = [middle, ...table[f].map((corner): Vec2 => [corner[0] + INSET * (middle[0] - corner[0]), corner[1] + INSET * (middle[1] - corner[1])])];
    for (const [x, z] of spots) {
      const column: { face: number; at: V }[] = [];
      for (let g = 0; g < n; g++) {
        if (x < box[g][0] || x > box[g][1] || z < box[g][2] || z > box[g][3]) continue;
        const at = now(g, x, z);
        if (at && (g === f || layer[g] !== layer[f])) column.push({ face: g, at });
      }
      column.sort((a, b) => layer[a.face] - layer[b.face]);
      const here = column.findIndex((c) => c.face === f);
      // Stacked: close by, facing the same way. (Not the halves of a fold that has opened out, which face opposite
      // ways now, nor a wall and the side that stood up from it.)
      const stacked = (a: number, b: number) => Math.hypot(...sub(column[a].at, column[b].at)) <= STACKED && dot(upward[column[a].face], upward[column[b].face]) >= FACING;
      if (here + 1 < column.length && stacked(here, here + 1)) {
        over[f].push(column[here + 1].face);
        under[column[here + 1].face].push(f);
      }
      if (here > 0 && stacked(here, here - 1)) {
        under[f].push(column[here - 1].face);
        over[column[here - 1].face].push(f);
      }
    }
  }
  // The highest layer covering each triangle, through whatever covers its cover; and the lowest under it likewise.
  const reach = (next: number[][], further: (a: number, b: number) => number) => {
    const found: (number | undefined)[] = new Array(n).fill(undefined);
    const from = (f: number): number => (found[f] ??= next[f].reduce((best, g) => further(best, from(g)), layer[f]));
    return layer.map((_, f) => from(f));
  };
  const top = reach(over, Math.max);
  const bottom = reach(under, Math.min);
  const front: number[] = [];
  const back: number[] = [];
  for (let f = 0; f < n; f++) {
    const [fromAbove, fromBelow] = [layer[f] - top[f] || 0, bottom[f] - layer[f] || 0];
    front.push(up[f] ? fromAbove : fromBelow);
    back.push(up[f] ? fromBelow : fromAbove);
  }
  return { layer: layer.map((l, f) => (up[f] ? l : -l) || 0), front, back };
}
