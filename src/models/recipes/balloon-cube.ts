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
 *
 * The same goes for a base wrapped narrower than the water bomb, as the 3D tulip's is: with the plus's arms `e`
 * either side of the creases (|u| or |v| under e), it covers a box 2e square and ½ − 2e long, the arms' straight
 * stretches (from e out to ½ − e) its sides. The water bomb's e is ⅛, which makes the box a cube.
 */

/** Half the width of the water bomb's arms, and half its cube's side. */
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
  /** Half the width of the plus's arms. */
  e: number;
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
export const bulge: EndShape = ({ q, e, tip, corner, middle, other, pt, pc, pm, front, outward }) => {
  const [wt, wc, wm] = bary(q, pt, pc, pm);
  const flat = add(add(mul(tip, wt), mul(corner, wc)), mul(middle, wm));
  const n = outward(unit(cross(sub(corner, tip), sub(middle, tip))));
  const m = outward(unit(cross(sub(other, tip), sub(middle, tip))), !front);
  const along = unit(sub(mul(add(tip, middle), 0.5), mul(add(corner, other), 0.5)));
  const towards = unit(add(add(n, m), mul(along, 0.5)));
  const chord = Math.hypot(...sub(middle, tip));
  const sag = Math.sqrt(Math.max(0, (3 * chord * (e - chord)) / 8));
  return { at: add(flat, mul(towards, 4 * wt * wm * sag)), out: n };
};

/**
 * Where a point of the plus (on the sheet) is at θ, with the way out of the box there. The box's front side lies
 * on the table (y = 0), x across, the end at T towards −z: x ∈ [−e, e], z ∈ [e − ½, −e], y ∈ [0, d]. (The water
 * bomb's cube: x ∈ [−⅛, ⅛], z ∈ [−⅜, −⅛].)
 */
export function plus(q: Vec2, theta: number, end: EndShape = bulge, e = E): { at: V; out: V } {
  const [u, v] = q;
  // Where the arms' straight stretches end, at the hole's end of the box.
  const far = 0.5 - e;
  if (Math.abs(u) > Math.abs(v) + 1e-12 && Math.abs(v) <= e + 1e-12) {
    // The left and right sides and their ends, worked out for the left and mirrored.
    if (u > 0) {
      const { at, out } = side([-u, v], theta, end, e);
      return { at: [-at[0], at[1], at[2]], out: [-out[0], out[1], out[2]] };
    }
    return side(q, theta, end, e);
  }
  const s = Math.sin(theta);
  const c = Math.cos(theta);
  const d = 2 * e * s;
  if (v < 0) {
    if (v >= -e) {
      const r = v + e;
      return { at: [u, r * s, -far - r * c], out: [0, -c, -s] };
    }
    if (v >= -far) return { at: [u, 0, -0.5 - v], out: [0, -1, 0] };
    const r = -far - v;
    return { at: [u, r * s, -e + r * c], out: [0, -c, s] };
  }
  if (v <= e) {
    const r = e - v;
    return { at: [u, d - r * s, -far - r * c], out: [0, c, -s] };
  }
  if (v <= far) return { at: [u, d, -0.5 + v], out: [0, 1, 0] };
  const r = v - far;
  return { at: [u, d - r * s, -e + r * c], out: [0, c, s] };
}

/** The left side (u < 0, |v| < |u|): the gusset's halves, and the end triangles at either end. */
function side(q: Vec2, theta: number, end: EndShape, e: number): { at: V; out: V } {
  const [u, v] = q;
  const far = 0.5 - e;
  const s = Math.sin(theta);
  const c = Math.cos(theta);
  const d = 2 * e * s;
  const front = v < 0;
  const w = e - Math.abs(v);
  if (u <= -e && u >= -far) {
    return { at: [-e + w * c, front ? w * s : d - w * s, -0.5 - u], out: front ? [-s, c, 0] : [-s, -c, 0] };
  }
  // An end: T's (u > −e) or the hole's (u < e − ½). The triangle T (or H), its corner on the front (or back) and the
  // middle of the gusset's edge, which its two halves meet along.
  const top = u > -e;
  const zEdge = top ? -far : -e;
  const [pt, pc, pm]: Vec2[] = top ? [[0, 0], [-e, front ? -e : e], [-e, 0]] : [[-0.5, 0], [-far, front ? -e : e], [-far, 0]];
  return end({
    q,
    theta,
    e,
    top,
    front,
    tip: [0, e * s, top ? -far - e * c : -e + e * c],
    corner: [-e, front ? 0 : d, zEdge],
    middle: [-e + e * c, e * s, zEdge],
    other: [-e, front ? d : 0, zEdge],
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
function placements(frame: FoldFrame, e: number) {
  const faces = toFlat(frame);
  const layers = frame.faces_layer!;
  const core = faces.map((f) => {
    const [u, v] = f.paper.reduce((m, q) => [m[0] + Math.abs(q[0]) / f.paper.length, m[1] + Math.abs(q[1]) / f.paper.length], [0, 0]);
    return (u < e || v < e) && u + v < 0.5;
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
export function onCube(frame: FoldFrame, end: EndShape = bulge, e = E): (face: number, q: Vec2, theta: number) => V {
  const all = placements(frame, e);
  return (face, q, theta) => {
    const { place, back, gap } = all[face];
    const p = plus(back(place(q)), theta, end, e);
    return add(p.at, mul(p.out, gap));
  };
}

/**
 * The box's top and bottom edges in the flat stack: every face of the plus folds onto the end faces at one of
 * these two lines across the table, and so does whatever lies on it (see the bend's `lines`).
 */
export const boxEdges = (e: number): [Vec2, Vec2][] => [
  [[-1, e - 0.5], [1, e - 0.5]],
  [[-1, -e], [1, -e]],
];

/**
 * The box's ends in the flat stack, past its top and bottom edges (T's end towards −z, the hole's towards +z):
 * where the paper may crumple on the way (see the bend's `crumple`).
 */
export const boxEnds = (e: number): Vec2[][] => [
  [[-1, -1], [1, -1], [1, e - 0.5], [-1, e - 0.5]],
  [[-1, -e], [1, -e], [1, 1], [-1, 1]],
];

/** The water bomb's cube's. */
export const CUBE_EDGES = boxEdges(E);
export const CUBE_ENDS = boxEnds(E);

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
  /** Half the width of the plus's arms: ⅛, the water bomb's, unless given. */
  e?: number;
  /** Stood up on the hole's end as it opens, T's end on top, rather than left lying on its front. */
  stand?: boolean;
}

/** Guides taking the flat water bomb (`frame`) to the cube, from where it lies flat, layers and all, eased into the shape as it opens. */
export function cubeGuides(frame: FoldFrame, { stages, spacing = 0.04, end = bulge, skip, tips: nearTips = true, e = E, stand = false }: CubeGuideOptions): BendGoal[] {
  const round = (x: number) => Math.round(x * 1e6) / 1e6 || 0;
  // Standing up: a quarter turn about the line across the box's middle, eased in and out, T's end rising.
  const upright = (p: V, s: number): V => {
    const turn = (Math.PI / 2) * s * s * (3 - 2 * s);
    const [y, z] = [p[1] - e, p[2] + 0.25];
    return [p[0], e + y * Math.cos(turn) - z * Math.sin(turn), -0.25 + y * Math.sin(turn) + z * Math.cos(turn)];
  };
  return placements(frame, e).flatMap(({ face: f, core, layer, place, back, gap }) =>
    [...lattice(f.paper, spacing), ...(core && nearTips ? tips(f.paper) : [])].flatMap((q): BendGoal[] => {
      const xz = place(q);
      const onPlus = back(xz);
      if (skip?.(onPlus, core)) return [];
      const at = (theta: number) => {
        const p = plus(onPlus, theta, end, e);
        return add(p.at, mul(p.out, gap));
      };
      const start = at(0);
      const lying: V = [xz[0], layer * LAYER_GAP, xz[1]];
      const path = Array.from({ length: stages }, (_, k): Vec3 => {
        const s = (k + 1) / stages;
        const opening = add(at((s * Math.PI) / 2), mul(sub(lying, start), 1 - s));
        return (stand ? upright(opening, s) : opening).map(round) as Vec3;
      });
      return [{ guide: { paper: q.map(round) as Vec2 }, path }];
    }),
  );
}
