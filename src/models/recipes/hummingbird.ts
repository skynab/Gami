import { toFlat } from '../../fold/fold';
import { paper, Recipe, table, type ShapeBend } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';
import { birdBase } from './bird-base';

/**
 * A hovering hummingbird, Gami's own, after the look of OrigamiOK's: the traditional bird base, its lower points
 * narrowed as the crane's are, then each turned out with an outside reverse fold, wrapped round the outside of the
 * body: one high up, forwards, for a long beak; the other lower, back, for the tail. Both point a little down, and
 * the bird is tilted nose up at the end, so the beak points forwards and the tail down.
 * The wings stay up, as the bird base leaves them, and in 3D spread into a V with the body tilted nose up, so they
 * sweep back over it as a hummingbird's do when it hovers.
 *
 * Outside reverse folds rather than the crane's inside ones: tucked in between the layers, rigid paper passes
 * through about half the stack as the point turns (`GRAZES`, src/models/known-clipping.ts); wrapped round the
 * outside, it passes through nothing.
 */
export function hummingbird() {
  const r = new Recipe({ id: 'hummingbird', title: 'Hummingbird', sheet: { size: [1, 1], front: '#2f9e78', back: '#f6f3ec' } });
  const { K, K2, side, up, front, back, innerFront, innerBack } = birdBase(r);

  // Narrow the lower points, as the crane does: the lower edges of each side to the centre line. (Narrowed a
  // second time, the beak's outside reverse fold passes through 10 to 14 layers as it turns, so once it is.)
  const reach = Math.hypot(side, 0.5);
  const narrow = (half: (c: Vec2) => boolean) =>
    r
      .onto(table(...K), table(...up(reach)), {
        title: 'Fold the left edge to the centre',
        text: 'Fold the lower left edge of the front layers to the centre line, making the bottom point narrower.',
        only: half,
      })
      .onto(table(...K2), table(...up(reach)), { title: 'Fold the right edge to the centre', text: 'Match it on the right.', only: half });
  narrow((c) => back(c) || innerBack(c));
  r.turnOver('Turn the paper over.');
  narrow((c) => front(c) || innerFront(c));

  // The lower points: the left one (the sheet's quarter u > 0, v > 0) the beak, the right one the tail. Each turns
  // out along a line bisecting straight down and where it ends up pointing, `angle` degrees above level.
  const legLeft = ([u, v]: Vec2) => u > 0 && v > 0;
  const legRight = ([u, v]: Vec2) => u < 0 && v < 0;
  const out = (root: Vec2, angle: number, dir: 1 | -1): Vec2 => {
    const a = (angle * Math.PI) / 180;
    return [root[0] + dir * Math.cos(a), root[1] + 1 - Math.sin(a)];
  };
  const beakRoot = up(0.5);
  r.collapse(
    {
      title: 'Outside-reverse-fold the beak',
      text: 'Open the left point a little and wrap it round the outside of the body, so it points forwards and a little down, from high up. This is the beak.',
      kind: 'reverse',
    },
    [{ through: [table(...beakRoot), table(...out(beakRoot, -20, -1))], kind: 'outside', only: legLeft }],
    paper(-0.3, 0.3),
  );
  const tailRoot = up(0.4);
  r.collapse(
    {
      title: 'Outside-reverse-fold the tail',
      text: 'Wrap the right point round the outside the same way, lower down, so it points back and a little down. This is the tail.',
      kind: 'reverse',
    },
    [{ through: [table(...tailRoot), table(...out(tailRoot, -10, 1))], kind: 'outside', only: legRight }],
    paper(-0.3, 0.3),
  );

  // The wings are the front and back flaps, standing up from the body. Lower down they hold the beak's and tail's
  // paper between them, so they spread from just above the highest of it, opposite ways, into a V; and the bird is
  // tilted nose up, so the wings lean back over it.
  const flat = r.current;
  const inner = toFlat(flat).filter((f) => {
    const [u, v] = f.paper.reduce(([p, q], s) => [p + s[0], q + s[1]], [0, 0]);
    return Math.sign(u) === Math.sign(v);
  });
  const hinge = Math.min(...inner.flatMap((f) => f.world.map((p) => p[1]))) - 0.01;
  const top = toFlat(flat)
    .flatMap((f) => f.world)
    .reduce((m, p) => (p[1] < m[1] ? p : m));
  const spread = 30;
  const wings: ShapeBend[] = [
    { through: [table(-2, hinge), table(2, hinge)], moving: table(top[0], hinge - 0.1), degrees: spread, only: front },
    { through: [table(-2, hinge), table(2, hinge)], moving: table(top[0], hinge - 0.1), degrees: -spread, only: back },
  ];
  // Tilted 35° nose up, it rests on the tail's tip: the wings' hinge set high enough that the tip just clears the table.
  const tilt = (35 * Math.PI) / 180;
  return r
    .assemble({ title: 'Spread the wings', text: 'Open the wings a little apart, and tilt the bird nose up, as if it hovers at a flower. Done!' }, [
      { only: () => true, bends: wings, pose: { from: table(top[0], hinge), to: [0, 0.546, 0], x: [Math.cos(tilt), -Math.sin(tilt), 0], up: [0, 0, 1] } },
    ])
    .build();
}
