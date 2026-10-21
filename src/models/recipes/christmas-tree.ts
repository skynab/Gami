import { locate, Recipe, table } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';

/**
 * The traditional Christmas tree, following the order of folds at origami.me/christmas-tree: a kite, folded in
 * half bottom to top into a pentagon, narrowed again, then the bottom half folded back down and its point up
 * into a white pot under the tree.
 */
export function christmasTree() {
  // Turned to a diamond, the sheet's corners sit this far from the centre.
  const h = Math.SQRT1_2;
  const top = table(0, -h);
  const r = new Recipe({ id: 'christmas-tree', title: 'Christmas tree', sheet: { size: [1, 1], front: '#f6f3ec', back: '#4f8a3c' } })
    .rotate(45, { title: 'Start as a diamond', text: 'Start white side up, with a corner pointing towards you.' })
    .crease(top, table(0, h), { title: 'Crease down the middle', text: 'Fold the left corner to the right corner, then unfold.' })
    .edgeOnto([top, table(-h, 0)], [top, table(0, h)], { title: 'Fold the top left edge in', text: 'Fold the top left edge to the middle crease.' })
    .edgeOnto([top, table(h, 0)], [top, table(0, h)], { title: 'Fold the top right edge in', text: 'And the top right edge. It’s a kite.' });
  // The lower half of the sheet, before it folds up: it becomes the pot.
  const flat = r.current;
  const lower = (c: Vec2) => locate(flat, c)[1] > 1e-9;
  r.along(table(-1, 0), table(1, 0), table(0, h), {
    title: 'Fold the bottom up',
    text: 'Fold the bottom corner up to the top corner. It’s all green now: a pentagon.',
  });
  // The pentagon's shoulders: the kite's side corners, (±(√2 − 1), 1 − h) on the diamond, turned up.
  const [wide, shoulder] = [Math.SQRT2 - 1, h - 1];
  r.edgeOnto([top, table(-Math.abs(wide), shoulder)], [top, table(0, 1)], { title: 'Fold the left side in', text: 'Fold the top left edge to the middle again.' })
    .edgeOnto([top, table(Math.abs(wide), shoulder)], [top, table(0, 1)], { title: 'Fold the right side in', text: 'And the top right edge.' });
  // The layer that came up from the bottom folds back down, level with where the sides' corners now meet in
  // the middle (each top edge's end, √2 − 1 out, lands 1 − (√2 − 1) below the top), so it hangs below the tree.
  const meet = -h + 2 - Math.SQRT2;
  const narrowed = r.current;
  const hanging = (c: Vec2) => lower(c) && locate(narrowed, c)[1] < meet;
  r.along(table(-1, meet), table(1, meet), top, {
    title: 'Fold the front flap down',
    text: 'Fold the front layer’s point back down, level with where the side folds meet in the middle. It hangs below the tree.',
    only: lower,
  });
  // Its point folds up to the bottom of the tree (z = 0), leaving a pot below it.
  const tip = r.where({ paper: [-0.5, 0.5] })[1];
  r.along(table(-1, tip / 2), table(1, tip / 2), table(0, tip), {
    title: 'Fold the point up',
    text: 'Fold the bottom point up to the bottom of the tree, to square off the pot.',
    only: hanging,
  }).turnOver('Turn it over. Your tree is done!');
  return r.build();
}
