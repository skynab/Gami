import { paper, Recipe, table } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';

/**
 * A diamond ring, Gami's own, from a strip and a small square: the strip folded to the middle into a band, the
 * square's corners folded to its middle into a faceted gem set on one end of the band, and the rest of the band
 * curled round underneath, so the gem sits on top and hides the join.
 */
export function diamondRing() {
  const r = new Recipe({
    id: 'diamond-ring',
    title: 'Diamond ring',
    card: 'finished',
    sheets: [
      { size: [0.5, 0.25], front: '#e8c35a', back: '#d6a531', origin: [0, 0], at: [-0.2, 0] },
      { size: [0.12, 0.12], front: '#d8f0fb', back: '#9fd3ec', origin: [10, 0], at: [0.35, 0] },
    ],
  });
  const band = ([u]: Vec2) => u < 5;
  const gem = ([u]: Vec2) => u > 5;

  // The band: its long edges folded to the middle, `w` either side of it.
  const w = 1 / 16;
  const [bx, bz] = r.where(paper(0, 0));
  r.together({ title: 'Fold the band', text: 'Fold the strip’s long edges to its middle: the band.' }, (q) => {
    for (const s of [-1, 1]) q.along(table(bx - 1, bz + s * w), table(bx + 1, bz + s * w), table(bx, bz + s * 0.11), { title: '', only: band });
  });

  // The gem: the small square, `g` from its middle to each edge, its corners folded to the middle, which turns it
  // into a smaller square standing on a corner: a diamond.
  const g = 0.06;
  const [gx, gz] = r.where(paper(10, 0));
  r.together({ title: 'Fold the gem', text: 'Light side up, fold the small square’s four corners to its middle: a little faceted diamond.' }, (q) => {
    for (const [x, z] of [[-g, -g], [g, -g], [g, g], [-g, g]]) q.onto(table(gx + x, gz + z), table(gx, gz), { title: '', only: gem });
  });

  // Set the gem on the band's left end, then curl the rest of the band round underneath it.
  const left = bx - 0.25;
  const seat = left + 0.14;
  r.move({ title: 'Set the gem', text: 'Lay the gem on the left end of the band.' }, gem, { to: table(left + 0.07, bz) });
  return r
    .shape({ title: 'Curl the band round', text: 'Curl the rest of the band down and round underneath, so it meets the end under the gem. Your ring is ready to wear.' }, [
      { through: [table(seat, -1), table(seat, 1)], moving: table(bx + 0.25, bz), degrees: -330, segments: 18, only: band },
    ])
    .build();
}
