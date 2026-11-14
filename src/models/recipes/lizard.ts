import { toFlat } from '../../fold/fold';
import { paper, Recipe, table } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';
import { narrowedSide } from './turtle';
import { waterbombBase } from './waterbomb-base';

/**
 * A lizard seen from above, Gami's own, from two squares: the body a water bomb base narrowed on each side with its
 * loose points folded out as legs, as the turtle's flippers but narrower and steeper, its top point the head; and a
 * long thin tail from a smaller square folded into a narrow kite, slipped under the body.
 */
export function lizard() {
  // Half the tail square's side.
  const a = 0.28;
  const r = new Recipe({
    id: 'lizard',
    title: 'Lizard',
    sheets: [
      { size: [1, 1], front: '#4f9a3c', back: '#b9de7a', origin: [0, 0], at: [0, 0] },
      { size: [2 * a, 2 * a], front: '#4f9a3c', back: '#b9de7a', origin: [10, 0], at: [1.1, 0] },
    ],
  });
  const body = ([u]: Vec2) => u < 5;
  const tail = ([u]: Vec2) => u > 5;
  waterbombBase(r, body);
  narrowedSide(r, 20, 'back leg', ', low down', body);
  r.move({ title: 'Turn over', text: 'Turn the body over, left to right.' }, body, { flip: true, to: table(0, -0.25) });
  narrowedSide(r, 65, 'front leg', ', reaching forwards', body);

  // The tail: a diamond creased down the middle, narrowed twice into a long thin point.
  r.move({ title: 'Start the tail', text: 'Turn the small square over, light side up, with a corner pointing towards you.' }, tail, { degrees: 45, flip: true });
  const [tx, tz] = r.where(paper(10, 0));
  const d = a * Math.SQRT2;
  const [top, bottom] = [table(tx, tz - d), table(tx, tz + d)];
  r.crease(table(tx - d, tz), table(tx + d, tz), { title: 'Crease the tail down the middle', text: 'Fold its left corner to its right corner, then unfold.', only: tail });
  r.together({ title: 'Fold a kite', text: 'Fold the lower edges to the middle crease, making a kite.' }, (q) => {
    for (const k of [-1, 1]) q.edgeOnto([bottom, table(tx + k * d, tz)], [bottom, top], { title: '', only: tail });
  });
  // The kite's side corners, where its folds from the bottom, 22.5° off the middle, meet the upper edges.
  const [sn, cs] = [Math.sin(Math.PI / 8), Math.cos(Math.PI / 8)];
  const t = (2 * d) / (sn + cs);
  r.together({ title: 'Narrow it again', text: 'Fold the new lower edges to the middle again. The bottom is a long thin point: the tail.' }, (q) => {
    for (const k of [-1, 1]) q.edgeOnto([bottom, table(tx + k * t * sn, tz + d - t * cs)], [bottom, top], { title: '', only: tail });
  });

  // The tail slips under the body, its widest part (the kite's side corners) under the back legs.
  const tailPts = toFlat(r.current)
    .filter((f) => tail(f.paper[0]))
    .flatMap((f) => f.world);
  const mid = (Math.min(...tailPts.map((p) => p[1])) + Math.max(...tailPts.map((p) => p[1]))) / 2;
  const widest = tz + d - t * cs;
  r.move({ title: 'Add the tail', text: 'Slip the tail’s wide end under the body, as far as the back legs.' }, tail, {
    to: table(0, mid + (-0.15 - widest)),
    under: true,
  });

  const ring = (x: number, z: number, rad: number, n: number): Vec2[] => Array.from({ length: n }, (_, i) => [x + rad * Math.cos((i / n) * 2 * Math.PI), z + rad * Math.sin((i / n) * 2 * Math.PI)]);
  return r
    .draw({ title: 'Draw the eyes', text: 'Draw two eyes on the head. Your lizard is ready to scurry off!' }, [
      { fill: ring(-0.022, -0.43, 0.01, 10) },
      { fill: ring(0.022, -0.43, 0.01, 10) },
    ])
    .build();
}
