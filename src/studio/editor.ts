import { lerp } from '../fold/geometry2d';
export { frontUp } from '../fold/geometry2d';
import { project } from '../fold/select';
export { anchorFor, project, smallerSideMoves, topLayers } from '../fold/select';
import type { FoldFrame, Step, Vec2 } from '../fold/types';

/** Helpers for the Studio's fold editor that don't need React. */

/** Points a fold line can snap to: every corner, plus the middle of every edge. */
export function snapPoints(frame: FoldFrame): Vec2[] {
  const seen = new Map<string, Vec2>();
  const add = (p: Vec2) => seen.set(`${p[0].toFixed(5)},${p[1].toFixed(5)}`, p);
  for (const face of project(frame)) {
    face.world.forEach((p, i) => {
      add(p);
      add(lerp(p, face.world[(i + 1) % face.world.length], 0.5));
    });
  }
  return [...seen.values()];
}

/**
 * The frame to unfold back to: the one before the latest fold made since the last unfold.
 * Frame k is the paper after step k, so the frame before step i (0-based) is frame i.
 */
export function unfoldTarget(steps: Step[]): number | null {
  const lastUnfold = steps.findLastIndex((s) => s.kind === 'unfold');
  const lastFold = steps.findLastIndex((s) => s.kind === 'fold');
  return lastFold > lastUnfold ? lastFold : null;
}

/** A square box (x, z, size, size) centred on some points, with room to spare. */
export function viewBox(points: Vec2[], pad = 0.15): [number, number, number, number] {
  const xs = points.map((p) => p[0]);
  const zs = points.map((p) => p[1]);
  const size = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) + 2 * pad;
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  return [cx - size / 2, cz - size / 2, size, size];
}
