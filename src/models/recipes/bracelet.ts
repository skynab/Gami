import { Recipe, table } from '../../fold/recipe';

/**
 * A bracelet, Gami's own: a square folded to the middle twice into a narrow band, then curled round into a ring,
 * its ends meeting. A 15 cm square makes a band about 15 cm round, a child's wrist.
 */
export function bracelet() {
  // Folded to the middle twice, the band is `w` either side of z = 0, from x = −½ to ½.
  const w = 1 / 8;
  const r = new Recipe({ id: 'bracelet', title: 'Bracelet', card: 'finished', sheet: { size: [1, 1], front: '#f2c84b', back: '#e0703a' } });
  r.together({ title: 'Fold the edges to the middle', text: 'Start yellow side up. Fold the top and bottom edges to the middle.' }, (q) => {
    for (const s of [-1, 1]) q.along(table(-1, s / 4), table(1, s / 4), table(0, s * 0.4), { title: '' });
  });
  r.together({ title: 'And again', text: 'Fold the new top and bottom edges to the middle again: a narrow band.' }, (q) => {
    for (const s of [-1, 1]) q.along(table(-1, s * w), table(1, s * w), table(0, s * 0.2), { title: '' });
  });
  return r
    .turnOver('Turn the band over.')
    .shape({ title: 'Curl it round', text: 'Curl the band round into a ring, until its ends meet. Slip it on your wrist.' }, [
      { through: [table(-0.47, -1), table(-0.47, 1)], moving: table(0.5, 0), degrees: 340, segments: 24 },
    ])
    .build();
}
