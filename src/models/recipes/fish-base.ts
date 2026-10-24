import { paper, table, type At, type Recipe } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';

/**
 * The fish base, as the whale folds it: a diamond creased down the middle and across, its four edges creased to
 * the middle crease, then collapsed so each side corner's edges meet in the middle and the corner stands up as
 * a flap, laid upwards. Shared by the whale and the dolphin. Returns the diamond's measurements.
 */
export function fishBase(r: Recipe, start = 'Start white side up, with a corner pointing towards you.') {
  // Turned to a diamond, the sheet's corners sit this far from the centre: top (½, −½), bottom (−½, ½),
  // left (−½, −½), right (½, ½).
  const h = Math.SQRT1_2;
  // Where an edge folded to the middle crease from the top or bottom corner crosses the side-to-side diagonal.
  const k = h * (Math.SQRT2 - 1);
  // A point on the sheet given as (x, z) on the diamond before anything is folded.
  const sheet = (x: number, z: number): Vec2 => [(x - z) / Math.SQRT2, (x + z) / Math.SQRT2];
  const onDiamond = ([u, v]: Vec2): Vec2 => [(u + v) / Math.SQRT2, (v - u) / Math.SQRT2];
  const T = (x: number, z: number) => table(x, z);

  r.rotate(45, { title: 'Start as a diamond', text: start })
    .crease(T(0, -h), T(0, h), { title: 'Crease down the middle', text: 'Fold the left corner to the right corner, then unfold.' })
    .crease(T(-h, 0), T(h, 0), { title: 'Crease across', text: 'Fold the bottom corner to the top corner, then unfold.' })
    .crease(T(0, h), T(-k, 0), { title: 'Crease the lower left edge', text: 'Fold the lower left edge to the middle crease, then unfold.' })
    .crease(T(0, h), T(k, 0), { title: 'Crease the lower right edge', text: 'The same with the lower right edge.' })
    .crease(T(0, -h), T(-k, 0), { title: 'Crease the upper left edge', text: 'Now fold the upper left edge to the middle crease, and unfold.' })
    .crease(T(0, -h), T(k, 0), { title: 'Crease the upper right edge', text: 'And the upper right edge.' });

  // The fish base: each side corner's edges fold in along the creases just made, and the corner itself
  // stands up as a flap, folded upwards.
  const creases: { through: [At, At]; kind: 'valley' | 'mountain'; only: (c: Vec2) => boolean }[] = [];
  for (const s of [-1, 1]) {
    const side = (c: Vec2) => s * onDiamond(c)[0] > 0;
    const outer = (c: Vec2) => s * onDiamond(c)[0] > k - 1e-9;
    const P = T(s * k, 0);
    creases.push(
      { through: [T(0, -h), P], kind: 'valley', only: (c) => side(c) && onDiamond(c)[1] < 0 },
      { through: [T(0, h), P], kind: 'valley', only: (c) => side(c) && onDiamond(c)[1] > 0 },
      { through: [P, T(s * h, 0)], kind: 'mountain', only: outer },
      { through: [P, T(s * (k + 0.1), -0.1)], kind: 'valley', only: (c) => outer(c) && onDiamond(c)[1] < 0 },
    );
  }
  r.collapse(
    {
      title: 'Collapse into a fish base',
      text: 'Push the left and right corners in along the creases, so the edges meet in the middle and each corner pinches up into a little flap. Lay both flaps upwards.',
    },
    creases,
    paper(0, 0),
  );
  return { h, k, sheet, onDiamond, T };
}
