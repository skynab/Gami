import { Recipe, table } from '../../fold/recipe';
import { normalize } from '../../fold/geometry2d';
import type { Vec2 } from '../../fold/types';

/**
 * The traditional penguin, following the order of folds at origami.me/penguin: a diamond with its top edges
 * folded nearly to the middle (the dark wings, with a white strip between), turned over, the side corners and
 * the bottom point folded in, then folded in half and the head turned down by an outside reverse fold.
 */
export function penguin() {
  // Turned to a diamond, the sheet's corners sit this far from the centre.
  const h = Math.SQRT1_2;
  // The gap left each side of the middle once the top edges are folded in: the white front.
  const gap = 0.05;
  // How far the side corners fold in.
  const tuck = 0.1;
  const top = table(0, -h);

  // The top left edge folds onto the line x = −gap, about the line bisecting the two, which crosses the lower
  // left edge (z = x + h) at the kite's side corner.
  const pivot: Vec2 = [-gap, -h + gap];
  const along = normalize([-Math.SQRT1_2, Math.SQRT1_2 + 1]);
  const s = (pivot[1] - pivot[0] - h) / (along[0] - along[1]);
  const corner: Vec2 = [pivot[0] + s * along[0], pivot[1] + s * along[1]];
  // The side corner's fold: from a point up the kite's edge to one down the lower edge.
  const upper: Vec2 = [corner[0] - tuck * along[0], corner[1] - tuck * along[1]];
  const lower: Vec2 = [corner[0] + tuck * Math.SQRT1_2, corner[1] + tuck * Math.SQRT1_2];
  const mirror = (p: Vec2): Vec2 => [-p[0], p[1]];

  const r = new Recipe({ id: 'penguin', title: 'Penguin', sheet: { size: [1, 1], front: '#2d3240', back: '#f6f3ec' } })
    .rotate(45, { title: 'Start as a diamond', text: 'Start coloured side up, with a corner pointing towards you.' })
    .crease(top, table(0, h), { title: 'Crease down the middle', text: 'Fold the left corner to the right corner, then unfold.' })
    .turnOver('Turn it over, white side up.')
    .edgeOnto([top, table(-h, 0)], [table(...pivot), table(-gap, h)], {
      title: 'Fold the top left edge in',
      text: 'Fold the top left edge in towards the middle crease, stopping a little short of it.',
    })
    .edgeOnto([top, table(h, 0)], [table(...mirror(pivot)), table(gap, h)], {
      title: 'Fold the top right edge in',
      text: 'The same on the right, leaving a narrow white strip between the two.',
    })
    .turnOver('Turn it over.');
  // Turned over, left and right swap: the corner worked out on the left is now on the right.
  r.along(table(...mirror(upper)), table(...mirror(lower)), table(...mirror(corner)), {
    title: 'Fold the right corner in',
    text: 'Fold the right corner in a little way.',
  })
    .along(table(...upper), table(...lower), table(...corner), { title: 'Fold the left corner in', text: 'And the left corner, to match.' })
    .along(table(-1, lower[1]), table(1, lower[1]), table(0, h), {
      title: 'Fold the bottom up',
      text: 'Fold the bottom point up, level with the lower ends of those folds.',
    })
    .along(table(0, -1), table(0, 1), table(-0.05, 0), {
      title: 'Fold in half',
      text: 'Fold the left half over onto the right, along the middle crease.',
    });
  // The head: the top point wrapped round the outside, so its tip comes down and forwards as the beak.
  const beak: Vec2 = [-0.3, -h + 0.25];
  const mid: Vec2 = [beak[0] / 2, (beak[1] - h) / 2];
  const dir: Vec2 = [beak[1] + h, -beak[0]];
  r.collapse(
    { title: 'Turn the head down', text: 'Open the top a little and turn the point down round the outside, for the head and beak. Done!', kind: 'reverse' },
    [{ through: [table(...mid), table(mid[0] + dir[0], mid[1] + dir[1])], kind: 'outside' }],
    r.sheetAt([0.1, 0.1]),
  );
  return r.build();
}
