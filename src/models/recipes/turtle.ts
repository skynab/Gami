import { Recipe, table } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';
import { onTop } from './face';
import { cornersUp, T, waterbombBase } from './waterbomb-base';

/**
 * A turtle seen from above, Gami's own: a water bomb base narrowed on each side as the water bomb is (corners up,
 * corners in) into a tall six-sided shell, the loose points at the top then folded down and out as flippers rather
 * than tucked away: the back side's low down, the front side's high up. The base's top point is the head.
 */
export function turtle() {
  const r = waterbombBase(new Recipe({ id: 'turtle', title: 'Turtle', sheet: { size: [1, 1], front: '#5f9e4a', back: '#c9e3a4' } }));
  narrowedSide(r, 30, 'back flipper', ', low down');
  r.turnOver('Turn the paper over.');
  narrowedSide(r, 55, 'front flipper');
  // Eyes near the head's point, and the shell's plates: a hexagon in the middle with a spoke from each corner.
  const ring = (x: number, z: number, rad: number, n: number, turn = 0): Vec2[] =>
    Array.from({ length: n }, (_, i) => [x + rad * Math.cos(turn + (i / n) * 2 * Math.PI), z + rad * Math.sin(turn + (i / n) * 2 * Math.PI)]);
  const hex = ring(0, -0.12, 0.045, 6);
  const spokes = ring(0, -0.12, 0.085, 6).map((p, i): Vec2[] => [hex[i], p]);
  return r
    .draw({ title: 'Draw the eyes and shell', text: 'Draw two eyes on the head, and a pattern of plates on the shell. Done!' }, [
      { fill: ring(-0.022, -0.42, 0.01, 10) },
      { fill: ring(0.022, -0.42, 0.01, 10) },
      ...[[...hex, hex[0]], ...spokes].flatMap((line) => onTop(r, line)).map((line) => ({ line })),
    ])
    .build();
}

/**
 * One side of a water bomb base, point up, narrowed as the water bomb's is and given two legs, shared by the turtle
 * and the lizard: corners up into a diamond, the diamond's corners in to the middle so it narrows, then the loose
 * points at the top folded down and out about where the side flaps' top edges meet the middle, (0, −¼). `slope` is
 * the fold's angle below level: the steeper, the higher the leg comes out. `name` names the legs, and `where` is
 * added to the first leg's text to say where it comes out. `only` keeps the folds to one sheet of several.
 */
export function narrowedSide(r: Recipe, slope: number, name: string, where = '', only?: (c: Vec2) => boolean) {
  const corner = cornersUp(r, only);
  for (const s of [-1, 1]) {
    r.along(table(s * 0.125, -1), table(s * 0.125, 1), table(s * 0.25, -0.25), {
      title: s < 0 ? 'Fold the left corner in' : 'Fold the right corner in',
      text: s < 0 ? 'Fold the diamond’s left corner in to the middle.' : 'And the right corner.',
      layers: 4,
      only,
    });
  }
  for (const s of [-1, 1]) {
    r.along(table(0, -0.25), table(s * 0.125, -0.25 - 0.125 * Math.tan((slope * Math.PI) / 180)), T, {
      title: s < 0 ? `Fold out a ${name}` : `Fold out the other ${name}`,
      text: s < 0 ? `Fold the loose point at the top left down and out, so its tip sticks out past the side${where}.` : 'And the one at the top right.',
      only: corner[s],
    });
  }
}
