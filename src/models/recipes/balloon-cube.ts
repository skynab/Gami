import { placeLike, toFlat, unplaceLike } from '../../fold/fold';
import { LAYER_GAP } from '../../fold/frames';
import { signedArea } from '../../fold/geometry2d';
import type { BendGoal } from '../../fold/ops';
import type { FoldFrame, Vec2, Vec3 } from '../../fold/types';

/**
 * The water bomb blown up into a cube, worked out face by face, as guides for the balloon's bend (see
 * docs/bending-plan.md, step 7, the paper balloon).
 *
 * Flat, the water bomb is a cube pressed flat. The paper round the sheet's centre, a plus with pointed arms (|u| or
 * |v| under ⅛, inside |u| + |v| = ½), covers a cube ¼ across exactly once: the centre square is the end at T (the
 * sheet's centre), the four arms its sides, their points the end at the hole (the edge midpoints). Pressed flat, the
 * front and back sides lie in the middle of the stack (layers 8 and 15), the left and right sides fold in half
 * between them (layers 9 and 14, folded at the middle) and both ends fold up as water bomb bases do. The rest of the
 * sheet, the corners, lies against the outside of those faces, a layer or more out. So each point of the flat model
 * goes where the face it lies on goes, out from it by as many layers.
 *
 * Opening: the front and back sides stay flat and part, d = ¼ sin θ apart; the left and right sides open as gussets
 * (each half turning about its edge); the end triangles on the front and back turn up about their edges. The end
 * triangles on the sides can't follow rigidly (no path between flat and cube keeps every face of the plus flat, as a
 * paper bag can't open rigidly): they bulge out, and where they meet at T and the hole the paper crumples on the way
 * (the bend's `crumple`, over `CUBE_ENDS`). θ runs from 0 (flat) to a quarter turn (the cube).
 */

/** Half the width of the plus's arms, and a quarter of the cube's side. */
const E = 0.125;
/** How far in from a face's edges the lattice of guides keeps. */
const MARGIN = 0.006;

type V = Vec3;
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V, k: number): V => [a[0] * k, a[1] * k, a[2] * k];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: V): V => mul(a, 1 / (Math.hypot(...a) || 1));
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Barycentric weights of q in the triangle (a, b, c), on the sheet. */
export function bary(q: Vec2, a: Vec2, b: Vec2, c: Vec2): [number, number, number] {
  const det = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
  const wb = ((q[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (q[1] - a[1])) / det;
  const wc = ((b[0] - a[0]) * (q[1] - a[1]) - (q[0] - a[0]) * (b[1] - a[1])) / det;
  return [1 - wb - wc, wb, wc];
}

/**
 * One half of an end triangle on the left side, at θ: its corners in 3D (the end's tip, T or the hole; its corner on
 * the front or back side; the middle of the gusset's edge, which the two halves meet along; and the other half's
 * corner) and on the sheet, and which way is out of the cube from a direction.
 */
export interface EndHalf {
  q: Vec2;
  theta: number;
  /** T's end (rather than the hole's), and the half on the front side (rather than the back). */
  top: boolean;
  front: boolean;
  tip: V;
  corner: V;
  middle: V;
  other: V;
  pt: Vec2;
  pc: Vec2;
  pm: Vec2;
  /** A direction turned to point out of the cube, from this half (or the other, `front` false). */
  outward: (a: V, front?: boolean) => V;
}

/** Where a point of an end triangle on the side goes, and the way out of the cube there. */
export type EndShape = (half: EndHalf) => { at: V; out: V };

/**
 * The end triangles on the sides, bulging: their two halves can't both stay flat, as the line from the tip to the
 * middle of the gusset's edge is shorter in 3D than on the sheet, so it bulges out by about the sag of an arc that
 * long (stretching them up to about 18% on the way, which crumpling at the ends takes up).
 */
export const bulge: EndShape = ({ q, tip, corner, middle, other, pt, pc, pm, front, outward }) => {
  const [wt, wc, wm] = bary(q, pt, pc, pm);
  const flat = add(add(mul(tip, wt), mul(corner, wc)), mul(middle, wm));
  const n = outward(unit(cross(sub(corner, tip), sub(middle, tip))));
  const m = outward(unit(cross(sub(other, tip), sub(middle, tip))), !front);
  const along = unit(sub(mul(add(tip, middle), 0.5), mul(add(corner, other), 0.5)));
  const towards = unit(add(add(n, m), mul(along, 0.5)));
  const chord = Math.hypot(...sub(middle, tip));
  const sag = Math.sqrt(Math.max(0, (3 * chord * (E - chord)) / 8));
  return { at: add(flat, mul(towards, 4 * wt * wm * sag)), out: n };
};

/**
 * Where a point of the plus (on the sheet) is at θ, with the way out of the cube there. The cube's front side lies
 * on the table (y = 0), x across, the end at T towards −z: x ∈ [−⅛, ⅛], z ∈ [−⅜, −⅛], y ∈ [0, d].
 */
export function plus(q: Vec2, theta: number, end: EndShape = bulge): { at: V; out: V } {
  const [u, v] = q;
  if (Math.abs(u) > Math.abs(v) + 1e-12 && Math.abs(v) <= E + 1e-12) {
    // The left and right sides and their ends, worked out for the left and mirrored.
    if (u > 0) {
      const { at, out } = side([-u, v], theta, end);
      return { at: [-at[0], at[1], at[2]], out: [-out[0], out[1], out[2]] };
    }
    return side(q, theta, end);
  }
  const s = Math.sin(theta);
  const c = Math.cos(theta);
  const d = 2 * E * s;
  if (v < 0) {
    if (v >= -E) {
      const r = v + E;
      return { at: [u, r * s, -3 * E - r * c], out: [0, -c, -s] };
    }
    if (v >= -3 * E) return { at: [u, 0, -0.5 - v], out: [0, -1, 0] };
    const r = -3 * E - v;
    return { at: [u, r * s, -E + r * c], out: [0, -c, s] };
  }
  if (v <= E) {
    const r = E - v;
    return { at: [u, d - r * s, -3 * E - r * c], out: [0, c, -s] };
  }
  if (v <= 3 * E) return { at: [u, d, -0.5 + v], out: [0, 1, 0] };
  const r = v - 3 * E;
  return { at: [u, d - r * s, -E + r * c], out: [0, c, s] };
}

/** The left side (u < 0, |v| < |u|): the gusset's halves, and the end triangles at either end. */
function side(q: Vec2, theta: number, end: EndShape): { at: V; out: V } {
  const [u, v] = q;
  const s = Math.sin(theta);
  const c = Math.cos(theta);
  const d = 2 * E * s;
  const front = v < 0;
  const w = E - Math.abs(v);
  if (u <= -E && u >= -3 * E) {
    return { at: [-E + w * c, front ? w * s : d - w * s, -0.5 - u], out: front ? [-s, c, 0] : [-s, -c, 0] };
  }
  // An end: T's (u > −⅛) or the hole's (u < −⅜). The triangle T (or H), its corner on the front (or back) and the
  // middle of the gusset's edge, which its two halves meet along.
  const top = u > -E;
  const zEdge = top ? -3 * E : -E;
  const [pt, pc, pm]: Vec2[] = top ? [[0, 0], [-E, front ? -E : E], [-E, 0]] : [[-0.5, 0], [-3 * E, front ? -E : E], [-3 * E, 0]];
  return end({
    q,
    theta,
    top,
    front,
    tip: [0, E * s, top ? -3 * E - E * c : -E + E * c],
    corner: [-E, front ? 0 : d, zEdge],
    middle: [-E + E * c, E * s, zEdge],
    other: [-E, front ? d : 0, zEdge],
    pt,
    pc,
    pm,
    outward: (a, f = front) => (dot(a, [0, f ? 1 : -1, top ? -1 : 1]) < 0 ? mul(a, -1) : a),
  });
}

/**
 * Points close in to a face's corners at the sheet's centre and at the edges' midpoints (T and the hole), which the
 * lattice, kept in from the edges, misses: there the creases meet at 45°, and paper left unguided pops through.
 */
function tips(poly: Vec2[]): Vec2[] {
  const out: Vec2[] = [];
  poly.forEach((p, i) => {
    const atT = Math.hypot(p[0], p[1]) < 1e-9;
    const atH = Math.abs(Math.abs(p[0]) + Math.abs(p[1]) - 0.5) < 1e-9 && Math.min(Math.abs(p[0]), Math.abs(p[1])) < 1e-9;
    if (!atT && !atH) return;
    const [a, b] = [poly[(i + poly.length - 1) % poly.length], poly[(i + 1) % poly.length]];
    const toward = (q: Vec2): Vec2 => {
      const l = Math.hypot(q[0] - p[0], q[1] - p[1]);
      return [(q[0] - p[0]) / l, (q[1] - p[1]) / l];
    };
    const [da, db] = [toward(a), toward(b)];
    const sum = Math.hypot(da[0] + db[0], da[1] + db[1]);
    const mid: Vec2 = [(da[0] + db[0]) / sum, (da[1] + db[1]) / sum];
    for (const r of [0.004, 0.012, 0.022, 0.034]) out.push([p[0] + r * mid[0], p[1] + r * mid[1]]);
    for (const dir of [da, db]) for (const r of [0.012, 0.024]) out.push([p[0] + r * dir[0] + 0.003 * mid[0], p[1] + r * dir[1] + 0.003 * mid[1]]);
  });
  return out;
}

/** Points of a triangular lattice on the sheet inside a convex face, `spacing` apart, all at least `MARGIN` in from its edges. */
function lattice(poly: Vec2[], spacing: number): Vec2[] {
  const turn = Math.sign(signedArea(poly));
  const within = (q: Vec2) =>
    poly.every((a, i) => {
      const b = poly[(i + 1) % poly.length];
      return (turn * ((b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]))) / Math.hypot(b[0] - a[0], b[1] - a[1]) >= MARGIN;
    });
  const us = poly.map((q) => q[0]);
  const vs = poly.map((q) => q[1]);
  const row = spacing * (Math.sqrt(3) / 2);
  const out: Vec2[] = [];
  for (let j = Math.floor(Math.min(...vs) / row); j <= Math.ceil(Math.max(...vs) / row); j++) {
    for (let i = Math.floor(Math.min(...us) / spacing) - 1; i <= Math.ceil(Math.max(...us) / spacing); i++) {
      const q: Vec2 = [(i + (Math.abs(j) % 2) / 2) * spacing, j * row];
      if (within(q)) out.push(q);
    }
  }
  // A face too small for the lattice still gets its middle.
  if (!out.length) out.push([us.reduce((a, b) => a + b) / us.length, vs.reduce((a, b) => a + b) / vs.length]);
  return out;
}

/**
 * For each face of the flat water bomb (`frame`): whether it's part of the plus (by its middle on the sheet, split by
 * creases or not); where its points lie on the table (`place`); the face of the plus it lies against, as a map from
 * the table to that face's sheet (`back`): of the faces stacked at its middle, the plus's nearest in the stack; and
 * how far out from it it is (`gap`), by the layers between.
 */
function placements(frame: FoldFrame) {
  const faces = toFlat(frame);
  const layers = frame.faces_layer!;
  const core = faces.map((f) => {
    const [u, v] = f.paper.reduce((m, q) => [m[0] + Math.abs(q[0]) / f.paper.length, m[1] + Math.abs(q[1]) / f.paper.length], [0, 0]);
    return (u < E || v < E) && u + v < 0.5;
  });
  const covers = (poly: Vec2[], q: Vec2) => {
    let odd = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [a, b] = [poly[i], poly[j]];
      if (a[1] > q[1] !== b[1] > q[1] && q[0] < ((b[0] - a[0]) * (q[1] - a[1])) / (b[1] - a[1]) + a[0]) odd = !odd;
    }
    return odd;
  };
  const middleOf = (poly: Vec2[]): Vec2 => [poly.reduce((s, q) => s + q[0], 0) / poly.length, poly.reduce((s, q) => s + q[1], 0) / poly.length];
  return faces.map((f, n) => {
    const mid = middleOf(f.world);
    const stack = faces.map((_, k) => k).filter((k) => covers(faces[k].world, mid)).sort((a, b) => layers[a] - layers[b]);
    const rank = (k: number) => stack.indexOf(k);
    const under = core[n] ? n : stack.filter((k) => core[k]).reduce((a, b) => (Math.abs(rank(b) - rank(n)) < Math.abs(rank(a) - rank(n)) ? b : a));
    return { face: f, core: core[n], layer: layers[n], place: placeLike(f), back: unplaceLike(faces[under]), gap: Math.abs(rank(under) - rank(n)) * LAYER_GAP };
  });
}

/** Where each point of the flat water bomb (`frame`) goes on the cube at θ, by the face of the frame it's on. */
export function onCube(frame: FoldFrame, end: EndShape = bulge): (face: number, q: Vec2, theta: number) => V {
  const all = placements(frame);
  return (face, q, theta) => {
    const { place, back, gap } = all[face];
    const p = plus(back(place(q)), theta, end);
    return add(p.at, mul(p.out, gap));
  };
}

/**
 * The cube's top and bottom edges in the flat stack: every face of the plus folds onto the end faces at one of
 * these two lines across the table, and so does whatever lies on it (see the bend's `lines`).
 */
export const CUBE_EDGES: [Vec2, Vec2][] = [
  [[-1, -3 * E], [1, -3 * E]],
  [[-1, -E], [1, -E]],
];

/**
 * The cube's ends in the flat stack, past its top and bottom edges (T's end towards −z, the hole's towards +z):
 * where the paper may crumple on the way (see the bend's `crumple`).
 */
export const CUBE_ENDS: Vec2[][] = [
  [[-1, -1], [1, -1], [1, -3 * E], [-1, -3 * E]],
  [[-1, -E], [1, -E], [1, 1], [-1, 1]],
];

export interface CubeGuideOptions {
  /** The bend's stages: each guide has a place for each. */
  stages: number;
  /** How far apart guides are on the sheet. */
  spacing?: number;
  /** How the end triangles on the sides take their shape. */
  end?: EndShape;
  /** Guides left out, by the point of the plus they lie on and whether they're on the plus itself. */
  skip?: (onPlus: Vec2, core: boolean) => boolean;
  /** Guides close in to T and the hole too (see `tips`). */
  tips?: boolean;
}

/** Guides taking the flat water bomb (`frame`) to the cube, from where it lies flat, layers and all, eased into the shape as it opens. */
export function cubeGuides(frame: FoldFrame, { stages, spacing = 0.04, end = bulge, skip, tips: nearTips = true }: CubeGuideOptions): BendGoal[] {
  const round = (x: number) => Math.round(x * 1e6) / 1e6 || 0;
  return placements(frame).flatMap(({ face: f, core, layer, place, back, gap }) =>
    [...lattice(f.paper, spacing), ...(core && nearTips ? tips(f.paper) : [])].flatMap((q): BendGoal[] => {
      const xz = place(q);
      const onPlus = back(xz);
      if (skip?.(onPlus, core)) return [];
      const at = (theta: number) => {
        const p = plus(onPlus, theta, end);
        return add(p.at, mul(p.out, gap));
      };
      const start = at(0);
      const lying: V = [xz[0], layer * LAYER_GAP, xz[1]];
      const path = Array.from({ length: stages }, (_, k): Vec3 => {
        const s = (k + 1) / stages;
        return add(at((s * Math.PI) / 2), mul(sub(lying, start), 1 - s)).map(round) as Vec3;
      });
      return [{ guide: { paper: q.map(round) as Vec2 }, path }];
    }),
  );
}
