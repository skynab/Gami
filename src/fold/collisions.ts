import { poseAt, stepTransition, together, type Transition } from './animate';
import { framesOf } from './frames';
import { box, clearanceDepth, cornerKeys, overlapping } from './cross3d';
import type { OrigamiModel } from './types';

/**
 * Finding paper passing through paper while a step animates. Faces that move together can't cross each
 * other, so only faces moving differently are compared, and faces that share a corner on the sheet (joined
 * along a crease, or meeting at a point) are left alone, since they touch where they're joined.
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

export function crossings(model: OrigamiModel, samples = SAMPLES): Crossing[] {
  const frames = framesOf(model);
  const out: Crossing[] = [];
  for (let k = 1; k < frames.length; k++) {
    const t = stepTransition(model, k);
    for (const at of samples) for (const { faces, depth } of crossingAt(t, at)) out.push({ step: k, at, faces, depth });
  }
  return out;
}

/** Pairs of faces that cross `s` of the way through a step. */
export function crossingAt(t: Transition, s: number): { faces: [number, number]; depth: number }[] {
  const pose = poseAt(t, s);
  const keys = t.faces.map((f) => cornerKeys(f.paper));
  const boxes = pose.map(box);
  const out: { faces: [number, number]; depth: number }[] = [];
  for (let a = 0; a < pose.length; a++) {
    for (let b = a + 1; b < pose.length; b++) {
      if (together(t, a, b)) continue;
      if (!overlapping(boxes[a], boxes[b])) continue;
      if ([...keys[a]].some((key) => keys[b].has(key))) continue;
      const depth = clearanceDepth(pose[a], pose[b]);
      if (depth > 0) out.push({ faces: [a, b], depth });
    }
  }
  return out;
}
