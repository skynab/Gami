import { Recipe, table } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';
import { waterbombBase } from './waterbomb-base';

/**
 * A bat with its wings raised, seen from the front, Gami's own: a water bomb base with its bottom corners folded
 * up and out into wings either side of the top point, which is the head.
 */
export function bat() {
  // The base, point up: its point at (0, −½), its bottom edge along z = 0 from −½ to ½. Each wing folds up about
  // a hinge rising out from `root` along the bottom edge at `rise`, so it stands up at twice that.
  const root = 0.04;
  const rise = (25 * Math.PI) / 180;
  const r = waterbombBase(new Recipe({ id: 'bat', title: 'Bat', sheet: { size: [1, 1], front: '#5b5fb3', back: '#b7b9ec' } }));
  r.together({ title: 'Fold up the wings', text: 'Fold each bottom corner up and out, from just beside the middle, so the wings rise.' }, (q) => {
    for (const s of [-1, 1]) q.along(table(s * root, 0), table(s * (root + Math.cos(rise)), -Math.sin(rise)), table(s * 0.5, 0), { title: '' });
  });
  // Two eyes on the head, just below its point.
  const eye = (x: number): Vec2[] => Array.from({ length: 10 }, (_, i) => [x + 0.014 * Math.cos((i / 10) * 2 * Math.PI), -0.36 + 0.014 * Math.sin((i / 10) * 2 * Math.PI)]);
  return r.draw({ title: 'Draw the eyes', text: 'Draw two eyes on the head. Your bat is ready to fly!' }, [{ fill: eye(-0.035) }, { fill: eye(0.035) }]).build();
}
