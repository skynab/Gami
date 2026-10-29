import { paper, Recipe, table } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';

/**
 * A three-pointed crown, Gami's own: a triangle whose top is the middle point, its two bottom corners folded up
 * into points leaning out either side, and its bottom folded behind for a straight band.
 */
export function crown() {
  // Turned to a diamond, the sheet's corners sit this far from the centre:
  // TL on the left, TR at the top, BR on the right, BL at the bottom.
  const h = Math.SQRT1_2;
  const TR: Vec2 = [0.5, -0.5];
  const BL: Vec2 = [-0.5, 0.5];
  // Folded in half, the triangle's long edge runs along z = 0, its point at (0, −h). Each bottom corner folds up
  // about a line from a point on the long edge, `foot` from the middle, so it leans out by `lean`.
  const foot = 0.05;
  const lean = (22.5 * Math.PI) / 180;
  // The corner points straight out sideways; to point up, leaning out by `lean`, it turns by 90° − lean, so the
  // line rises from the long edge at half that.
  const half = (Math.PI / 2 - lean) / 2;
  const side = (s: 1 | -1) => ({
    from: table(-s * foot, 0),
    to: table(-s * foot - s * Math.cos(half) * 0.3, -Math.sin(half) * 0.3),
    moving: table(-s * (h - 0.01), -0.005),
  });
  const [L, R] = [side(1), side(-1)];
  // The band's bottom edge.
  const band = -0.12;

  return new Recipe({ id: 'crown', title: 'Crown', sheet: { size: [1, 1], front: '#f6f3ec', back: '#e3a92b' } })
    .rotate(45, { title: 'Start as a diamond', text: 'Start white side up, with a corner pointing towards you.' })
    .onto(paper(...BL), paper(...TR), {
      title: 'Fold in half',
      text: 'Fold the bottom corner up onto the top corner, making a triangle.',
    })
    .along(L.from, L.to, L.moving, {
      title: 'Fold up the left point',
      text: 'Fold the left corner up so it points up and a little out to the left.',
    })
    .along(R.from, R.to, R.moving, {
      title: 'Fold up the right point',
      text: 'Fold the right corner up to match. That’s three points.',
    })
    .along(table(-1, band), table(1, band), table(0, -0.01), {
      title: 'Fold the bottom behind',
      text: 'Fold the bottom edge behind, for a straight band. Your crown is done!',
      kind: 'mountain',
    })
    .build();
}

