import { paper, Recipe, table } from '../../fold/recipe';
import { creased, pyramidRays, SLOPE } from './pyramid';

/**
 * A diamond, the gem, Gami's own: a creased square with its corners folded behind into an octagon, popped point
 * down as the pyramid is point up, so it's a cut stone's lower half, its rim the octagon. No glue.
 */
export function diamond() {
  const cut = 0.15;
  const r = creased(new Recipe({ id: 'diamond', title: 'Diamond', card: 'finished', sheet: { size: [1, 1], front: '#bfe3f2', back: '#7fc4e3' } }));
  r.together({ title: 'Fold the corners behind', text: 'Fold all four corners behind, a little way, so the square is an octagon.' }, (q) => {
    for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      q.along(table(x * (0.5 - cut), z * 0.5), table(x * 0.5, z * (0.5 - cut)), table(x * 0.5, z * 0.5), { title: '', kind: 'mountain' });
    }
  });
  // The pyramid's pop, point down.
  const slope = -SLOPE;
  return r
    .popUp(
      {
        title: 'Pop it into a gem',
        text: 'Push the middle down and lift the edges, pinching each diagonal into a ridge and pushing each side’s middle crease inside, so it comes to a point underneath. Your diamond sparkles.',
      },
      paper(0, 0),
      pyramidRays(slope),
      [1, 2, 3, 4, 5].map((k) => pyramidRays((slope * k) / 6, slope)),
    )
    .build();
}
