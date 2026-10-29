import { paper, Recipe, table } from '../../fold/recipe';
import { moved } from './waterbomb-base';

/**
 * A pleated palm leaf, Gami's own, after the look of OrigamiOK's: a diamond with all four edges folded to the
 * middle into a long, narrow leaf, then pleated back and forth across its length and let open a little, so it
 * ripples.
 */
export function palmLeaf() {
  const h = Math.SQRT1_2;
  // The leaf pleats `n` times along its length.
  const n = 12;
  const r = new Recipe({ id: 'palm-leaf', title: 'Palm leaf', card: 'finished', sheet: { size: [1, 1], front: '#77b85a', back: '#3f8f3a' } })
    .rotate(45, { title: 'Start as a diamond', text: 'Start light side up, with a corner pointing towards you.' })
    .crease(table(-h, 0), table(h, 0), { title: 'Crease down the middle', text: 'Fold the left corner to the right corner, and unfold.' });
  const [top, bottom] = [table(0, -h), table(0, h)];
  // The kite's side corners, where the first folds' edges end. The flaps the folds make ride on the middle
  // layer when it's pleated.
  const corner = (s: number) => table(s * (Math.SQRT2 - 1) * h * Math.SQRT2, h * (1 - Math.SQRT2));
  const flaps = moved(r, () => {
    r.together({ title: 'Fold the lower edges in', text: 'Fold the lower edges to the middle crease.' }, (q) => {
      for (const s of [-1, 1]) q.edgeOnto([bottom, table(s * h, 0)], [bottom, top], { title: '' });
    });
    r.together({ title: 'Fold the upper edges in', text: 'And the upper edges, so the paper is a long, narrow leaf.' }, (q) => {
      for (const s of [-1, 1]) q.edgeOnto([top, corner(s)], [top, bottom], { title: '' });
    });
  });
  // Pleat lines across the leaf, evenly spaced from tip to tip, each bending the opposite way to the one before.
  const lines = Array.from({ length: n - 1 }, (_, i) => -h + ((i + 1) * 2 * h) / n);
  return r
    .shape(
      { title: 'Pleat the leaf', text: 'Pleat the leaf back and forth across its length, like a fan, then let it open a little so it ripples.' },
      lines.map((z, i) => ({ through: [table(-1, z), table(1, z)], moving: table(0, h), degrees: i % 2 ? -40 : 40 })),
      { chained: paper(0.45, -0.45), ride: flaps },
    )
    .build();
}
