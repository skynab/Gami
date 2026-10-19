import type { Mark } from './ops';
import type { OrigamiModel, Vec2 } from './types';
export type { Mark } from './ops';

/**
 * Marks drawn on the paper, such as a face drawn on at the end. Each is kept as points on the sheet and the
 * side of the paper it's on, so it moves with the paper wherever it goes, and shows only from that side.
 */

/** How wide a drawn line is, as a share of the sheet's longer side. */
export const MARK_WIDTH = 0.007;
export const MARK_COLOUR = '#2b2a33';

/** The marks drawn by each of the first `k` steps, in order, with the step that drew them (1 for the first step). */
export function marksUpTo(model: OrigamiModel, k: number): { step: number; mark: Mark }[] {
  return model.steps.slice(0, k).flatMap((s, i) => (s.op?.op === 'draw' ? s.op.marks.map((mark) => ({ step: i + 1, mark })) : []));
}

/** Which of these faces (by their corners on the sheet) a mark is on: the one holding its first point. -1 if none. */
export function faceOfMark(mark: Mark, faces: Vec2[][]): number {
  const [p] = mark.points;
  return faces.findIndex((poly) => containsPoint(poly, p));
}

function containsPoint(poly: Vec2[], p: Vec2): boolean {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const c = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    if (Math.abs(c) < 1e-9) continue;
    if (sign && Math.sign(c) !== sign) return false;
    sign = Math.sign(c);
  }
  return true;
}
