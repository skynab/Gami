import { Recipe, table } from '../../fold/recipe';

/**
 * A green leaf, Gami's own: a diamond with its lower and upper edges folded to the middle, turned over so the
 * front is plain, then its two halves raised a little either side of the midrib, the middle crease.
 */
export function greenLeaf() {
  const h = Math.SQRT1_2;
  const r = new Recipe({ id: 'green-leaf', title: 'Green leaf', sheet: { size: [1, 1], front: '#a8d67e', back: '#4a9a3a' } })
    .rotate(45, { title: 'Start as a diamond', text: 'Start light side up, with a corner pointing towards you.' })
    .crease(table(-h, 0), table(h, 0), { title: 'Crease down the middle', text: 'Fold the left corner to the right corner, and unfold.' });
  const [top, bottom] = [table(0, -h), table(0, h)];
  r.together({ title: 'Fold a kite', text: 'Fold the lower edges to the middle crease, making a kite.' }, (q) => {
    for (const s of [-1, 1]) q.edgeOnto([bottom, table(s * h, 0)], [bottom, top], { title: '' });
  });
  // The kite's side corners, where those folds' edges ended.
  const corner = (s: number) => table(s * (Math.SQRT2 - 1) * h * Math.SQRT2, h * (1 - Math.SQRT2));
  r.together({ title: 'Fold the top edges in', text: 'Fold the short upper edges to the middle too.' }, (q) => {
    for (const s of [-1, 1]) q.edgeOnto([top, corner(s)], [top, bottom], { title: '' });
  });
  r.turnOver('Turn it over: a plain green leaf.');
  // The midrib runs from tip to tip along x = 0; each half rises a little about it.
  return r
    .shape({ title: 'Shape the leaf', text: 'Pinch the leaf along the middle crease, so its two halves rise a little either side. Your leaf is done.' }, [
      { through: [table(0, -1), table(0, 1)], moving: table(-0.1, 0), degrees: 25 },
      { through: [table(0, -1), table(0, 1)], moving: table(0.1, 0), degrees: 25 },
    ])
    .build();
}
