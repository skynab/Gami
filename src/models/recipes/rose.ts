import { Recipe, table } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';
import { moved } from './waterbomb-base';

/**
 * A flat rose, Gami's own, after the look of OrigamiOK's twisted rose: the corners folded to the middle twice,
 * then each of the four points folded back out past the edge, each turned the same way round, so the petals
 * spiral.
 */
export function rose() {
  const r = new Recipe({ id: 'rose', title: 'Rose', sheet: { size: [1, 1], front: '#f7a9b8', back: '#d62f4b' } });
  r.together({ title: 'Fold the corners in', text: 'Start light side up. Fold all four corners to the middle.' }, (q) => {
    for (const [x, z] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]) q.onto(table(x, z), table(0, 0), { title: '' });
  });
  // The second round's four flaps, each kept for folding its point back out.
  const flaps: ((c: Vec2) => boolean)[] = [];
  const sides: Vec2[] = [[-1, 0], [0, -1], [1, 0], [0, 1]];
  r.together({ title: 'And again', text: 'Fold the four new corners to the middle again.' }, (q) => {
    for (const [x, z] of sides) flaps.push(moved(r, () => q.onto(table(x * Math.SQRT1_2 * 0.5 * Math.SQRT2, z * 0.5), table(0, 0), { title: '' })));
  });
  // Each point folds out to just past the middle of its edge, shifted along it the same way round each time.
  const out = 0.07;
  const turn = 0.09;
  const tips = sides.map(([x, z]): Vec2 => [x * (0.25 + out) - z * turn, z * (0.25 + out) + x * turn]);
  r.together({ title: 'Fold out the petals', text: 'Fold each point back out, past the edge and a little to one side, all the same way round.' }, (q) => {
    tips.forEach((tip, i) => q.onto(table(0, 0), table(...tip), { title: '', only: flaps[i] }));
  });
  // Each petal's point folded behind, `round` in from its tip, square to the way it points.
  const round = 0.06;
  r.together({ title: 'Round the petals', text: 'Fold the tip of each petal behind, just a little. Your rose is in bloom.' }, (q) => {
    tips.forEach(([x, z]) => {
      const len = Math.hypot(x, z);
      const [ux, uz] = [x / len, z / len];
      const [cx, cz] = [x - ux * round, z - uz * round];
      q.along(table(cx - uz, cz + ux), table(cx + uz, cz - ux), table(x, z), { title: '', kind: 'mountain' });
    });
  });
  return r.build();
}
