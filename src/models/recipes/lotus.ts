import { Recipe, table, type ShapeBend } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';

/**
 * The traditional lotus, simplified: the corners folded to the middle three times, as OrigamiOK does, then the last
 * round's corners lifted back out from the middle as four pointed petals, curling outwards. OrigamiOK also folds the
 * corners in once on the back, then pulls each layer of flaps out from underneath, so the back folds hold them and
 * they curl into three rings of petals. Rigid paper can't stretch round those folds, so Gami leaves them out.
 */
export function lotus() {
  const r = new Recipe({ id: 'lotus', title: 'Lotus', card: 'finished', sheet: { size: [1, 1], front: '#3f9a4a', back: '#f2a7c3' } });
  // Each round folds the four corners of the square to the middle, leaving a square half the size, turned 45°.
  const round = (corners: Vec2[], step: { title: string; text: string }) =>
    r.together(step, (q) => {
      for (const c of corners) q.onto(table(...c), table(0, 0), { title: step.title });
    });
  const square = (s: number): Vec2[] => [[-s, -s], [s, -s], [s, s], [-s, s]];
  const diamond = (s: number): Vec2[] => [[0, -s], [s, 0], [0, s], [-s, 0]];

  round(square(0.5), { title: 'Fold the corners to the middle', text: 'Start green side up. Fold all four corners to the middle.' });
  round(diamond(0.5), { title: 'And again', text: 'Fold the four new corners to the middle.' });
  // The paper each corner of this last round folds in: what it lifts back out as a petal.
  const sign = Math.sign;
  const corners = square(0.25).map(([x, z]) => r.lying(([a, b]) => a * sign(x) + b * sign(z) > 0.25));
  round(square(0.25), { title: 'And once more', text: 'Fold the corners to the middle a third time, and crease hard.' });

  // Each corner's flaps open about the edge they were folded on, their tips rising from the middle and curling out.
  const petal = ([x, z]: Vec2, k: number): ShapeBend => ({
    through: [table(x / 2 + z / 2, z / 2 - x / 2), table(x / 2 - z / 2, z / 2 + x / 2)],
    moving: table(x * 0.1, z * 0.1),
    degrees: 100,
    segments: 4,
    only: corners[k],
  });
  return r
    .shape({ title: 'Open the petals', text: 'Lift each corner’s flaps from the middle and curl them outwards, into four petals. Your lotus is done!' }, square(0.25).map(petal))
    .build();
}
