import { paper, type At, type Recipe } from '../../fold/recipe';
import type { CreaseKind } from '../../fold/collapse';
import type { Vec2 } from '../../fold/types';

/**
 * Squashing an end of the cupboard fold (the sheet's sides folded to the middle) with its corners pulled out,
 * as in the windmill base. Shared by the pinwheel and the butterfly. Crease kinds were found by search.
 *
 * Shown for the top end; `end` 1 turns them upside down for the bottom. Each of the end's two corners is pulled
 * out sideways or along the sheet (up at the top, down at the bottom). Sideways, the corner square folds in half
 * along its diagonal through Q (the quarter point next to it), the square below it along its diagonal from Q to
 * the side edge's middle, and the corner square's inner edge opens out. Along the sheet, the corner square folds
 * along its diagonal through Q, the square beside it along its diagonal from Q to the end edge's middle, and
 * both of the corner square's inner edges open out. The end's edge folds to the middle along the quarter crease.
 */
export type Pull = 'side' | 'end';

export type Crease = { through: [Vec2, Vec2]; kind: CreaseKind; only: (c: Vec2) => boolean };
const eps = 1e-9;

/** The creases for the top-left corner (u < 0) pulled out `pull`. */
function leftCorner(pull: Pull): Crease[] {
  const middle: Crease = { through: [[-0.25, -0.25], [0, -0.25]], kind: 'valley', only: ([u]) => u < eps && u > -0.25 - eps };
  const corner: Crease = { through: [[-0.25, -0.25], [-0.5, -0.5]], kind: 'mountain', only: ([u, v]) => u < -0.25 + eps && v < -0.25 + eps };
  const inner: Crease = { through: [[-0.25, -0.5], [-0.25, -0.25]], kind: 'flat', only: ([u, v]) => u < 0 && v < -0.25 + eps };
  if (pull === 'side')
    return [middle, corner, inner, { through: [[-0.25, -0.25], [-0.5, 0]], kind: 'valley', only: ([u, v]) => u < -0.25 + eps && v > -0.25 - eps && v < eps }];
  return [
    middle,
    corner,
    inner,
    { through: [[-0.25, -0.25], [-0.5, -0.25]], kind: 'flat', only: ([u, v]) => u < -0.25 + eps && v < eps },
    { through: [[-0.25, -0.25], [0, -0.5]], kind: 'mountain', only: ([u, v]) => u < eps && u > -0.25 - eps && v < -0.25 + eps },
  ];
}

/**
 * The creases for one corner of an end, on the sheet as it was before the cupboard fold: the left (`side` −1) or
 * right (1) corner of the top (`end` −1) or bottom (1) end, pulled out `pull`.
 */
export function cornerCreases(side: -1 | 1, end: -1 | 1, pull: Pull): Crease[] {
  // Mirror the left corner's creases for the right, then turn them upside down for the bottom.
  const [sx, sz] = [-side, -end];
  return leftCorner(pull).map((c) => ({
    through: c.through.map(([u, v]) => [sx * u, sz * v]) as [Vec2, Vec2],
    kind: c.kind,
    only: ([u, v]) => c.only([sx * u, sz * v]),
  }));
}

/** Squashes the top (`end` −1) or bottom (`end` 1) end, its left and right corners pulled as given. */
export function squashEnd(r: Recipe, end: -1 | 1, left: Pull, right: Pull, step: { title: string; text: string }): Recipe {
  const creases = [...cornerCreases(-1, end, left), ...cornerCreases(1, end, right)].map((c) => ({
    through: c.through.map(([u, v]) => paper(u, v)) as [At, At],
    kind: c.kind,
    only: c.only,
  }));
  return r.collapse({ ...step, kind: 'fold' }, creases, paper(0, -end * 0.1));
}
