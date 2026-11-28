import { facePositions, framesOf, normal, sphereAround } from '../fold/frames';
import { overlapArea, signedArea } from '../fold/geometry2d';
import type { FoldFrame, OrigamiModel, Vec2, Vec3 } from '../fold/types';
import { CAMERA, nearFor } from './views';

/**
 * Whether paper underneath stays hidden behind the paper on top of it, as the viewer draws it: the GPU's depth buffer
 * keeps two faces apart only if they're a few of its steps apart, and its steps grow with the square of the distance
 * over the near plane. The viewer draws stacked layers a layer's gap apart (`LAYER_GAP`, 0.1 mm on a 15 cm sheet),
 * pushes the paper back a step so its own crease lines show on top of it, and lets the camera zoom out to
 * `CAMERA.maxDistance`. With the near plane fixed at `CAMERA.near`, a step there was more than half a layer's gap,
 * too coarse to keep the layer underneath behind the layer on top, seen straight on (as from the top view); the near
 * plane now follows the camera out (`nearFor`). Paper lying right on other paper, no gap at all, shows through
 * however close (`showingThrough` finds it, step by step).
 *
 * At a slant the paper is pushed back further, by a pixel's worth of its slope: see `lineCovers` below for that, and
 * what the viewer does about it. Bent paper is left out: the viewer draws its stacked triangles in their stacking
 * order where they meet (`LIFT` in FoldedPaper.tsx).
 */

/** Bits in the depth buffer: 24 on nearly every GPU WebGL runs on. */
export const DEPTH_BITS = 24;
/** How many steps the paper's surfaces are pushed back so their crease lines draw on top (`polygonOffsetUnits`). */
export const SURFACE_OFFSET = 1;
/**
 * How many more steps two faces have to be apart to be told apart reliably: depth worked out in single precision
 * for each pixel, lines and triangles each their own way, can be a step or two out either way.
 */
export const SLACK = 2;

/** Paper underneath that shows through what's on top of it, in one step's frame. */
export interface ShowingThrough {
  /** The step (1-based) whose frame it is. */
  step: number;
  /** The face on top, as seen from straight on, and the face it covers (by index in the frame). */
  faces: [number, number];
  /** How far apart they are, along their normal. A sheet's width is 1, a layer's gap 0.0007. */
  gap: number;
  /** How many of the depth buffer's steps apart they are, from the camera at the distance looked from. */
  steps: number;
}

/** How many depth-buffer steps apart two points `gap` apart along the line of sight are, `z` from the camera. */
export function depthSteps(gap: number, z: number, near: number, far = CAMERA.far): number {
  // Window depth is far (z − near) / (z (far − near)), from 0 at the near plane to 1 at the far one.
  return ((far * near * gap) / ((far - near) * z * (z + gap))) * (2 ** DEPTH_BITS - 1);
}

/**
 * Paper underneath showing through the paper on top in each step's frame (bent frames left out), looked at straight
 * on from `distance` away (the camera zoomed right out, by default), with the near plane the viewer gives that
 * distance (or `near`).
 */
export function showingThrough(model: OrigamiModel, { distance = CAMERA.maxDistance, near = nearFor(distance) }: { distance?: number; near?: number } = {}): ShowingThrough[] {
  return framesOf(model).flatMap((frame, k) => (k && !frame.soft?.length ? showingIn(frame, distance, near).map((s) => ({ ...s, step: k })) : []));
}

/** The steps (1-based) with paper underneath showing through, zoomed right out (see `showingThrough`). */
export function stepsShowingThrough(model: OrigamiModel, options?: { distance?: number; near?: number }): number[] {
  return [...new Set(showingThrough(model, options).map((s) => s.step))];
}

/** How nearly two faces have to face the same way, or opposite, to lie on one another. */
const PARALLEL = 0.9999;
/** How much two faces have to overlap, seen straight on, to cover one another: a 1.5 mm square on a 15 cm sheet. */
const COVERS = 1e-4;

function showingIn(frame: FoldFrame, distance: number, near: number): Omit<ShowingThrough, 'step'>[] {
  const pose = facePositions(frame);
  // The camera looks at the middle of the model; the steps are biggest for paper on its far side, as far from the
  // middle as the model reaches (`z`), or as the faces compared do.
  const { center, radius } = sphereAround(pose.flat());
  const z = distance + radius;
  const reach = (face: Vec3[]) => Math.max(...face.map((p) => Math.hypot(...sub(p, center))));
  // Closer together than this, faces are under the steps needed (the steps shrink as the gap grows, but barely).
  const steps = SURFACE_OFFSET + SLACK;
  const within = (steps / depthSteps(1, z, near)) * 1.01;
  const normals = pose.map(normal);
  const boxes = pose.map((face) => [0, 1, 2].map((c) => [Math.min(...face.map((p) => p[c])), Math.max(...face.map((p) => p[c]))]));
  const out: Omit<ShowingThrough, 'step'>[] = [];
  for (let a = 0; a < pose.length; a++) {
    for (let b = a + 1; b < pose.length; b++) {
      if (boxes[a].some(([lo, hi], c) => lo > boxes[b][c][1] + within || boxes[b][c][0] > hi + within)) continue;
      const n = normals[a];
      if (Math.abs(dot(n, normals[b])) < PARALLEL) continue;
      const gap = dot(n, sub(pose[b][0], pose[a][0]));
      if (Math.abs(gap) >= within) continue;
      const [e1, e2] = across(n);
      const flat = (face: Vec3[]) => face.map((p): Vec2 => [dot(p, e1), dot(p, e2)]);
      if (overlapArea(flat(pose[a]), flat(pose[b])) < COVERS) continue;
      const apart = depthSteps(Math.abs(gap), distance + Math.max(reach(pose[a]), reach(pose[b])), near);
      if (apart >= steps) continue;
      // The face further along its normal is on top, seen from that side; both ways round when they lie as one.
      out.push({ faces: gap > 0 ? [b, a] : [a, b], gap: Math.abs(gap), steps: apart });
    }
  }
  return out;
}

/**
 * Looked at at a slant, the paper is pushed back further than straight on: by a pixel's worth of its slope (the
 * polygon offset's factor, there so its own crease lines draw on top of it all along them). Zoomed out, a pixel can
 * span more depth than many layers, so the crease lines of the layers underneath came out in front of the paper on
 * top: the kestrel's wing, from the free view, showed the creases inside it as a web of lines, and at the usual zoom
 * a triangle (November 2026). The depth buffer can't keep those apart, so the viewer leaves out the stretches of
 * crease line that lie under paper too close above them to hide them (`lineCovers`, `coverNeeded`).
 */

/** How far above a crease line paper is looked for, that may cover it: more than `coverNeeded` ever asks for. */
export const COVER_RANGE = 0.03;

/**
 * A stretch of a crease line, from `from` to `to` of the way along its edge, and how far away along the face's normal
 * the nearest paper lying over it is, on its front side and on its back (Infinity where there's none within
 * `COVER_RANGE`).
 */
export interface Covered {
  from: number;
  to: number;
  front: number;
  back: number;
}

/**
 * For the faces of a frame where they rest (each face's corners), a function giving the stretches of a crease line
 * (from `a` to `b`, `from` to `to` of the way along, on face `face`) and the paper lying over each: faces facing the
 * same way or opposite, within `COVER_RANGE` of the line's face, that it passes under, seen straight on. Paper lying
 * right on the face, no gap at all, isn't counted: which of the two is on top is anyone's guess.
 */
export function lineCovers(pose: Vec3[][]): (face: number, a: Vec3, b: Vec3, from: number, to: number) => Covered[] {
  const normals = pose.map(normal);
  const boxes = pose.map(boxOf);
  // The paper that may lie over each face, worked out once for all its edges (the kusudama's frames have a thousand
  // faces): how far off along the face's normal, its box, and its outline seen straight on.
  interface Over {
    gap: number;
    box: number[];
    outline: Vec2[];
    turn: number;
  }
  const near = new Map<number, { e1: Vec3; e2: Vec3; over: Over[] }>();
  const nearTo = (face: number) => {
    const known = near.get(face);
    if (known) return known;
    const n = normals[face];
    const [e1, e2] = across(n);
    const box = boxes[face];
    const level = dot(n, pose[face][0]);
    const over: Over[] = [];
    for (let o = 0; o < pose.length; o++) {
      const other = boxes[o];
      if (o === face || other[0] > box[3] + COVER_RANGE || box[0] > other[3] + COVER_RANGE || other[1] > box[4] + COVER_RANGE || box[1] > other[4] + COVER_RANGE || other[2] > box[5] + COVER_RANGE || box[2] > other[5] + COVER_RANGE) continue;
      if (Math.abs(dot(n, normals[o])) < PARALLEL) continue;
      const gap = dot(n, pose[o][0]) - level;
      if (Math.abs(gap) < 1e-7 || Math.abs(gap) > COVER_RANGE) continue;
      const outline = pose[o].map((p): Vec2 => [dot(p, e1), dot(p, e2)]);
      over.push({ gap, box: other, outline, turn: Math.sign(signedArea(outline)) || 1 });
    }
    const found = { e1, e2, over };
    near.set(face, found);
    return found;
  };
  return (face, a, b, from, to) => {
    const { e1, e2, over } = nearTo(face);
    const p0: Vec2 = [dot(a, e1), dot(a, e2)];
    const p1: Vec2 = [dot(b, e1), dot(b, e2)];
    const line = boxOf([a, b]);
    const under: { lo: number; hi: number; front: boolean; gap: number }[] = [];
    for (const o of over) {
      const x = o.box;
      if (x[0] > line[3] + COVER_RANGE || line[0] > x[3] + COVER_RANGE || x[1] > line[4] + COVER_RANGE || line[1] > x[4] + COVER_RANGE || x[2] > line[5] + COVER_RANGE || line[2] > x[5] + COVER_RANGE) continue;
      const inside = within(o.outline, o.turn, p0, p1, from, to);
      if (inside) under.push({ lo: inside[0], hi: inside[1], front: o.gap > 0, gap: Math.abs(o.gap) });
    }
    if (!under.length) return [{ from, to, front: Infinity, back: Infinity }];
    const cuts = [...new Set([from, to, ...under.flatMap((u) => [u.lo, u.hi])])].sort((x, y) => x - y);
    const out: Covered[] = [];
    for (let i = 0; i + 1 < cuts.length; i++) {
      const m = (cuts[i] + cuts[i + 1]) / 2;
      let [f, k] = [Infinity, Infinity];
      for (const u of under) if (u.lo <= m && m <= u.hi) u.front ? (f = Math.min(f, u.gap)) : (k = Math.min(k, u.gap));
      const last = out[out.length - 1];
      if (last && last.front === f && last.back === k) last.to = cuts[i + 1];
      else out.push({ from: cuts[i], to: cuts[i + 1], front: f, back: k });
    }
    return out;
  };
}

/** A box round some points: its lowest x, y and z, then its highest. */
function boxOf(points: Vec3[]): number[] {
  const box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const p of points) for (let c = 0; c < 3; c++) (box[c] = Math.min(box[c], p[c])), (box[c + 3] = Math.max(box[c + 3], p[c]));
  return box;
}

/**
 * The part of the line from `p0` to `p1` (as fractions along it, within `from` to `to`) strictly inside the convex
 * polygon `poly` (going round anticlockwise for `turn` 1, clockwise for -1): not along its edges, where a fold joins
 * the line's face to it and the line shows.
 */
function within(poly: Vec2[], turn: number, p0: Vec2, p1: Vec2, from: number, to: number): [number, number] | null {
  let lo = from;
  let hi = to;
  for (let i = 0; i < poly.length && lo < hi; i++) {
    const q = poly[i];
    const r = poly[(i + 1) % poly.length];
    const dx = r[0] - q[0];
    const dy = r[1] - q[1];
    const len = Math.hypot(dx, dy);
    if (len < 1e-12) continue;
    // How far inside this edge each end of the line is, on the polygon's side of it.
    const f0 = (turn * (dx * (p0[1] - q[1]) - dy * (p0[0] - q[0]))) / len - 1e-6;
    const f1 = (turn * (dx * (p1[1] - q[1]) - dy * (p1[0] - q[0]))) / len - 1e-6;
    if (f0 < 0 && f1 < 0) return null;
    if (f0 < 0) lo = Math.max(lo, f0 / (f0 - f1));
    else if (f1 < 0) hi = Math.min(hi, f0 / (f0 - f1));
  }
  return hi - lo > 1e-6 ? [lo, hi] : null;
}

/**
 * How far above a crease line paper has to lie for the depth buffer to hide the line behind it, with the line's face
 * at `sin` of a right angle to the line of sight (0 straight on), `z` from the camera, where a pixel spans `pixel`:
 * further than the paper is pushed back (a pixel's worth of its slope, and `SURFACE_OFFSET` steps), with room for
 * the depth buffer's slack. The viewer works this out for each line as it draws it.
 */
export function coverNeeded(pixel: number, sin: number, z: number, near: number): number {
  return 1.25 * pixel * sin + ((SURFACE_OFFSET + SLACK) * z * z) / (near * (2 ** DEPTH_BITS - 1));
}

/** Two directions across a face with normal `n`, at right angles to each other. */
function across(n: Vec3): [Vec3, Vec3] {
  const u: Vec3 = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const e1 = unit(cross(n, u));
  return [e1, cross(n, e1)];
}

const sub = (p: Vec3, q: Vec3): Vec3 => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
const dot = (p: Vec3, q: Vec3) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
const cross = (p: Vec3, q: Vec3): Vec3 => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
const unit = (p: Vec3): Vec3 => {
  const l = Math.hypot(...p);
  return [p[0] / l, p[1] / l, p[2] / l];
};
