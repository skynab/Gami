import { paper, Recipe, type At } from '../../fold/recipe';
import type { CreaseKind } from '../../fold/collapse';
import type { Vec2 } from '../../fold/types';

/**
 * The traditional pinwheel (windmill), following the order of folds at origami.me/pinwheel: the sides folded
 * to the middle, the top and bottom creased to the middle, then each end squashed flat with one corner pulled
 * out sideways and the other up (or down), so the four arms point round the same way.
 */
export function pinwheel() {
  const r = new Recipe({ id: 'pinwheel', title: 'Pinwheel', sheet: { size: [1, 1], front: '#e5484d', back: '#f2c14e' } })
    .crease(paper(-0.5, 0), paper(0.5, 0), { title: 'Fold in half', text: 'Fold in half side to side, then unfold.' })
    .crease(paper(0, -0.5), paper(0, 0.5), { title: 'Fold in half the other way', text: 'And top to bottom, then unfold.' })
    .onto(paper(-0.5, 0), paper(0, 0), { title: 'Fold the left side in', text: 'Fold the left edge to the middle crease.' })
    .onto(paper(0.5, 0), paper(0, 0), { title: 'Fold the right side in', text: 'And the right edge.' })
    .crease(paper(0, -0.5), paper(0, 0), { title: 'Fold the top to the middle', text: 'Fold the top edge to the middle, then unfold.' })
    .crease(paper(0, 0.5), paper(0, 0), { title: 'Fold the bottom to the middle', text: 'And the bottom edge, then unfold.' });

  // The top end, squashed (crease kinds found by search). Its edge folds to the middle along the quarter crease.
  // The top-left corner is pulled out sideways: that corner square of the sheet folds in half along its diagonal
  // through Q = (−¼, −¼), the square below it along its diagonal from Q to the left edge's middle, and the corner
  // square's inner edge opens out. The top-right corner is pulled up: its corner square folds along its diagonal
  // through (¼, −¼), the square beside it along the diagonal from there to the top edge's middle, and both of the
  // corner square's inner edges open out. Turned half a turn, the same creases squash the bottom end.
  const eps = 1e-9;
  type Crease = { through: [Vec2, Vec2]; kind: CreaseKind; only: (c: Vec2) => boolean };
  const top: Crease[] = [
    { through: [[-0.25, -0.25], [0, -0.25]], kind: 'valley', only: ([u]) => u < eps && u > -0.25 - eps },
    { through: [[-0.25, -0.5], [-0.25, -0.25]], kind: 'flat', only: ([u, v]) => u < 0 && v < -0.25 + eps },
    { through: [[-0.25, -0.25], [-0.5, -0.5]], kind: 'mountain', only: ([u, v]) => u < -0.25 + eps && v < -0.25 + eps },
    { through: [[-0.25, -0.25], [-0.5, 0]], kind: 'valley', only: ([u, v]) => u < -0.25 + eps && v > -0.25 - eps && v < eps },
    { through: [[0, -0.25], [0.25, -0.25]], kind: 'valley', only: ([u]) => u > -eps && u < 0.25 + eps },
    { through: [[0.25, -0.25], [0.5, -0.25]], kind: 'flat', only: ([u, v]) => u > 0.25 - eps && v < eps },
    { through: [[0.25, -0.5], [0.25, -0.25]], kind: 'flat', only: ([u, v]) => u > 0 && v < -0.25 + eps },
    { through: [[0.25, -0.25], [0.5, -0.5]], kind: 'mountain', only: ([u, v]) => u > 0.25 - eps && v < -0.25 + eps },
    { through: [[0.25, -0.25], [0, -0.5]], kind: 'mountain', only: ([u, v]) => u > -eps && u < 0.25 + eps && v < -0.25 + eps },
  ];
  const turn = ([u, v]: Vec2): Vec2 => [-u, -v];
  const squash = (half: boolean, step: { title: string; text: string }) =>
    r.collapse(
      { ...step, kind: 'fold' },
      top.map((c) => ({
        through: c.through.map((p) => paper(...(half ? turn(p) : p))) as [At, At],
        kind: c.kind,
        only: half ? (p: Vec2) => c.only(turn(p)) : c.only,
      })),
      paper(0, half ? -0.1 : 0.1),
    );
  squash(false, {
    title: 'Squash the top',
    text: 'Fold the top edge down to the middle, pulling the top left corner out to the side and the top right corner up. Flatten them into triangles.',
  });
  squash(true, {
    title: 'Squash the bottom',
    text: 'The same at the bottom, the other way round: the bottom right corner out to the side and the bottom left one down. Pin the middle to a stick and blow: it spins!',
  });
  return r.build();
}
