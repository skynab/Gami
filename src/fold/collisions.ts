import { partedBy, poseAt, stepTransition, together, type Transition } from './animate';
import { facePositions, framesOf } from './frames';
import { box, clearanceAt, clearanceDepth, cornerKeys, normalOf, overlapping } from './cross3d';
import { sheetOf } from './sheets';
import type { OrigamiModel, Vec2, Vec3 } from './types';

/**
 * Finding paper passing through paper while a step animates, and where it comes to rest. Faces that move together
 * can't cross each other, so only faces moving differently are compared, and faces that share a corner on the sheet
 * (joined along a crease, or meeting at a point) are left alone, since they touch where they're joined. At rest, and
 * with `joined` 'edge', only those joined along a crease are: a flap's point can pass through the paper it meets
 * at that point.
 */

export interface Crossing {
  /** The step (1-based) and how far through it (0–1). */
  step: number;
  at: number;
  /** The two faces of the step's frame that cross. */
  faces: [number, number];
  /** How far an edge pokes through, at most: tiny for faces only grazing each other. */
  depth: number;
}

const SAMPLES = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];

/**
 * Where through each step the checks look, as a model plays: every tenth, and near each end too, where a fold
 * starting or landing can cut through for a moment (the heart's and seal's, found 20 November 2026), and closer
 * still at the end, where paper the joins held the way it started jumped into place in the last fortieth of the
 * step, between the samples (the lily's petal folds and the folds lesson's square base, 6 and 18 mm through).
 */
export const PLAYING = [0.025, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.975, 0.99];

/**
 * Which faces count as joined, and so are never compared: those sharing any corner on the sheet ('point', as the
 * checks have always had it), or only those sharing two, joined along a crease ('edge'), which also finds a flap's
 * point tucked through the layers it meets at that point.
 */
export type Joined = 'point' | 'edge';

export function crossings(model: OrigamiModel, samples = SAMPLES, joined: Joined = 'point'): Crossing[] {
  const frames = framesOf(model);
  const out: Crossing[] = [];
  for (let k = 1; k < frames.length; k++) {
    const t = stepTransition(model, k);
    for (const at of samples) for (const { faces, depth } of crossingAt(t, at, joined)) out.push({ step: k, at, faces, depth });
  }
  return out;
}

/** Paper through paper where a step comes to rest, as the viewer shows it once the step has played. */
export interface RestingCrossing {
  /** The step (1-based) whose frame it is. */
  step: number;
  /** The two faces of the step's frame that cross. */
  faces: [number, number];
  /** How far an edge pokes through (see `clearanceDepth`). A sheet's width is 1, a layer `LAYER_GAP`. */
  depth: number;
  /** Where the deepest edge passes through, in the frame. */
  at: Vec3;
  /** Each face's middle on the sheet, to find it by. */
  paper: [Vec2, Vec2];
  /** Which sheet each face is part of. */
  sheets: [number, number];
  /**
   * The faces meet at a corner on the sheet (a point tucked in), rather than not at all. Crossings within `NEAR_JOIN`
   * of that corner are left out, as their layers' offset where they're joined.
   */
  pointJoined: boolean;
  /**
   * Bent paper lying nearly the same way (or opposite), as stacked layers do: these can pass a little into each
   * other (docs/bending-plan.md), and the viewer draws them in their stacking order where they meet (`LIFT`), so a
   * shallow one doesn't show.
   */
  stacked: boolean;
}

/** How nearly bent faces have to face the same way, or opposite, to count as stacked: as `stackLifts` has it. */
const STACKED_FACING = 0.8;

/**
 * Paper passing through paper in the frame each step comes to rest on, which `crossings` (sampled while steps play)
 * never looks at, though it's what's on screen most. Every pair of faces is compared, bent paper's triangles too,
 * except those joined along a crease (`joined`, 'edge' by default).
 */
export function restingCrossings(model: OrigamiModel, joined: Joined = 'edge'): RestingCrossing[] {
  const out: RestingCrossing[] = [];
  const middle = (p: Vec2[]): Vec2 => [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length];
  framesOf(model).forEach((frame, k) => {
    if (!k) return;
    const bent = !!frame.soft?.length;
    const pose = facePositions(frame);
    const paper = frame.faces_vertices.map((face) => face.map((v) => frame.vertices_paper[v]));
    const keys = paper.map(cornerKeys);
    const boxes = pose.map(box);
    const normals = bent ? pose.map(normalOf) : [];
    for (let a = 0; a < pose.length; a++) {
      for (let b = a + 1; b < pose.length; b++) {
        if (!overlapping(boxes[a], boxes[b])) continue;
        let shared = 0;
        for (const key of keys[a]) if (keys[b].has(key)) shared++;
        if (shared >= (joined === 'point' ? 1 : 2)) continue;
        const hit = clearanceAt(pose[a], pose[b]);
        if (!hit) continue;
        // Faces meeting at a corner, crossing right beside it, are only offset from each other by their layers there,
        // where they're joined (a cone's tip, where all its paper meets): not a point tucked through.
        if (shared === 1 && nearJoin(hit.at, [pose[a], pose[b]], [paper[a], paper[b]], keys[b])) continue;
        const [na, nb] = [normals[a], normals[b]];
        const stacked = bent && !!na && !!nb && Math.abs(na[0] * nb[0] + na[1] * nb[1] + na[2] * nb[2]) >= STACKED_FACING;
        out.push({
          step: k,
          faces: [a, b],
          depth: hit.depth,
          at: hit.at,
          paper: [middle(paper[a]), middle(paper[b])],
          sheets: [sheetOf(model.sheets, paper[a]), sheetOf(model.sheets, paper[b])],
          pointJoined: shared === 1,
          stacked,
        });
      }
    }
  });
  return out;
}

/**
 * How near the corner two faces share a crossing has to be to count as their layers' offset where they're joined,
 * rather than one passing through the other: 3 mm on a 15 cm sheet, the thickness of 30 layers.
 */
const NEAR_JOIN = 0.02;

/** Whether `at` is within `NEAR_JOIN` of where either face has the corner they share (its key in `other`). */
function nearJoin(at: Vec3, pose: [Vec3[], Vec3[]], paper: [Vec2[], Vec2[]], other: Set<string>): boolean {
  const i = paper[0].findIndex((q) => other.has(`${q[0].toFixed(6)},${q[1].toFixed(6)}`));
  if (i < 0) return false;
  const j = paper[1].findIndex((q) => q[0].toFixed(6) === paper[0][i][0].toFixed(6) && q[1].toFixed(6) === paper[0][i][1].toFixed(6));
  return [pose[0][i], j >= 0 ? pose[1][j] : null].some((c) => !!c && Math.hypot(at[0] - c[0], at[1] - c[1], at[2] - c[2]) < NEAR_JOIN);
}

/**
 * Points through a step to look for paper coming apart: often, as paper can part for a moment near the end, and in
 * the last fortieth, where the joins can let go of paper they held (see `PLAYING`).
 */
const PART_SAMPLES = [...Array.from({ length: 19 }, (_, i) => (i + 1) / 20), 0.975, 0.99];

/**
 * Paper coming apart while each step animates, as the viewer draws it: for each step (1-based), how much further
 * the same point of paper strays from where its corners are on average than it is at either end of the step
 * (see `partedBy`). A sheet's width is 1.
 */
export function partings(model: OrigamiModel, samples = PART_SAMPLES): { step: number; apart: number }[] {
  const frames = framesOf(model);
  const out: { step: number; apart: number }[] = [];
  for (let k = 1; k < frames.length; k++) out.push({ step: k, apart: partedBy(stepTransition(model, k), samples) });
  return out;
}

/** Pairs of faces that cross `s` of the way through a step. */
export function crossingAt(t: Transition, s: number, joined: Joined = 'point'): { faces: [number, number]; depth: number }[] {
  const pose = poseAt(t, s);
  const keys = t.faces.map((f) => cornerKeys(f.paper));
  const boxes = pose.map(box);
  const out: { faces: [number, number]; depth: number }[] = [];
  for (let a = 0; a < pose.length; a++) {
    for (let b = a + 1; b < pose.length; b++) {
      if (together(t, a, b)) continue;
      if (!overlapping(boxes[a], boxes[b])) continue;
      let shared = 0;
      for (const key of keys[a]) if (keys[b].has(key)) shared++;
      if (shared >= (joined === 'point' ? 1 : 2)) continue;
      if (!shared) {
        const depth = clearanceDepth(pose[a], pose[b]);
        if (depth > 0) out.push({ faces: [a, b], depth });
        continue;
      }
      // Meeting at a corner: as at rest, a crossing right beside it is only their layers' offset where they're joined.
      const hit = clearanceAt(pose[a], pose[b]);
      if (hit && !nearJoin(hit.at, [pose[a], pose[b]], [t.faces[a].paper, t.faces[b].paper], keys[b])) out.push({ faces: [a, b], depth: hit.depth });
    }
  }
  return out;
}
