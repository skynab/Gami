import { Recipe, table } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';
import { masuBends, masuFolds, type MasuBend } from './masu-box';

/**
 * A cute whale, Orikata's own, after the look of OrigamiOK's (a blocky whale that's a box when turned over): the
 * traditional masu box, as `masu-box` folds it, worn open side down. The eyes are drawn on the outside of the side
 * walls while the paper's still flat. The top end locks into the box as usual, for the head. The bottom end's flap
 * is folded under while the paper's flat, so it rises up the outside of its end wall with the walls, and its point,
 * past the wall, turns out beyond the floor as the tail. Then the box is turned over onto its rim.
 *
 * The flap is folded under first because a chained `shape` turns a flap folded flat the way its layers lie: opened
 * out, it can only go over its wall into the box, as `lock` takes it. And its point turns out in the walls' own step,
 * listed before them, because the first bend whose line and test a crease matches is the one it takes: the end
 * wall's would hold it flat under the floor. Until the box is turned over, the tail points down below it.
 */
export function cuteWhale() {
  const r = new Recipe({ id: 'cute-whale', title: 'Cute whale', card: 'finished', sheet: { size: [1, 1], front: '#f6f3ec', back: '#3f7cc0' } });
  // A hairline short of the middle, as the masu box: see `masuBox`.
  const e = masuFolds(r, 0.003, [
    'Fold the bottom left corner to the middle, where the creases cross.',
    'And the bottom right corner.',
    'And the top right corner.',
    'And the top left corner. It’s a smaller square.',
  ]);
  const h = e / 2;

  // The eyes, on the side walls' outsides, which face down until the walls rise: near the head end (the top), a
  // third of the way down from the floor's edge, which is the top of the whale once it's turned over.
  const eyeX = h + (e - h) * 0.35;
  const eyeZ = -h * 0.45;
  // A whale's long mouth, below each eye: from near the head end back past the eye, curving up at its end.
  const smile: Vec2[] = Array.from({ length: 7 }, (_, k) => {
    const f = k / 6;
    return [h + (e - h) * (0.68 - 0.18 * f * f), -h * (0.92 - 0.8 * f)];
  });
  const round = (c: Vec2, radius: number): Vec2[] => Array.from({ length: 12 }, (_, k) => [c[0] + radius * Math.cos((k * Math.PI) / 6), c[1] + radius * Math.sin((k * Math.PI) / 6)]);
  r.turnOver('Turn the paper over.')
    .draw({ title: 'Draw a face', text: 'Draw an eye and a long smile on each side strip, near the top end. They’ll be on the whale’s sides.' }, [
      { fill: round([-eyeX, eyeZ], 0.024) },
      { fill: round([eyeX, eyeZ], 0.024) },
      ...[-1, 1].map((s) => ({ line: smile.map(([x, z]): Vec2 => [s * x, z]) })),
    ])
    .turnOver('Turn it back over.');

  // The box's bends, worked out on the paper as it lies now; then the bottom flap is folded under, behind its edge.
  // Raised, the bottom end wall then carries it up its outside, and its point, past the wall, lies under the floor.
  const { walls, lock, bend, floor } = masuBends(r, h, e);
  const t = 1;
  const flap = r.lying(([, z]) => t * z > e);
  r.along(table(-1, t * e), table(1, t * e), table(0, t * (e + 0.1)), {
    title: 'Fold the bottom flap under',
    text: 'Fold the bottom flap, with its corners, behind, along the bottom edge.',
    kind: 'mountain',
    only: flap,
  });
  // The flap's point, past the end wall (beyond 2e − h on the flap as it lay open), turned out from under the floor
  // about the floor's edge, to lean back 30° from straight out: at 90° it would lie flat under the floor.
  const flick = -30;
  const tail: MasuBend[] = [bend([-1, t * h], [1, t * h], [0, t * (h / 2)], flick, (x, z) => Math.abs(x) < h && t * z > e)];
  const height = e - h;
  return r
    .shape(
      {
        title: 'Raise the walls',
        text: 'Hold the paper up. Stand the side walls up, and push each corner in so it folds flat against the end wall. The end walls stand up too, the bottom one with its flap behind it: the flap’s point sticks out below the box, leaning back. That’s the tail.',
      },
      [...tail, ...walls],
      { chained: floor },
    )
    .shape({ title: 'Lock the top end', text: 'Fold the top flap over the end wall into the box, so its point lies on the floor and holds the corners in.' }, lock(-1))
    .assemble({ title: 'Turn it over', text: 'Turn the box over onto its rim: the whale’s tail rises behind it. Turned back, it’s a box. Done!' }, [
      { only: () => true, pose: { from: table(0, 0), to: [0, height, 0], x: [1, 0, 0], up: [0, -1, 0] } },
    ])
    .build();
}
