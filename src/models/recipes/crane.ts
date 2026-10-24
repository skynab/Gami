import { locate, paper, Recipe, table } from '../../fold/recipe';
import { birdBase } from './bird-base';
import type { Vec2 } from '../../fold/types';

/**
 * The traditional crane: square base, petal folds into the bird base, narrow the legs, reverse-fold
 * the neck and tail, the head, then the wings down.
 *
 * The bird base is in ./bird-base.
 */
export function crane() {
  const r = new Recipe({ id: 'crane', title: 'Crane', sheet: { size: [1, 1], front: '#d94a6a', back: '#f6f3ec' } });
  const { K, K2, side, up, front, back, innerFront, innerBack } = birdBase(r);

  // Narrow the legs: the lower edges of the front half fold to the centre line, from the bottom point up.
  const reach = Math.hypot(side, 0.5);
  const narrow = (half: (c: Vec2) => boolean, which: string) =>
    r
      .onto(table(...K), table(...up(reach)), {
        title: 'Fold the left edge to the centre',
        text: `Fold the lower left edge of the ${which} layers to the centre line, making the bottom point narrower.`,
        only: half,
      })
      .onto(table(...K2), table(...up(reach)), { title: 'Fold the right edge to the centre', text: 'Match it on the right.', only: half });
  narrow((c) => back(c) || innerBack(c), 'front');
  r.turnOver('Turn the paper over.');
  narrow((c) => front(c) || innerFront(c), 'front');

  // Neck and tail: each thin point swings up and out between the layers. A fold line that bisects straight
  // down and 45° up-and-out sends the point to 45° up-and-out.
  const legLeft = ([u, v]: Vec2) => u > 0 && v > 0;
  const legRight = ([u, v]: Vec2) => u < 0 && v < 0;
  const root = up(0.4);
  const swing = (dir: 1 | -1): Vec2 => [root[0] + dir * Math.SQRT1_2, root[1] + 1 - Math.SQRT1_2];
  r.collapse(
    { title: 'Reverse-fold the neck', text: 'Push the left point up between the layers so it sticks out at an angle. This will be the neck.', kind: 'reverse' },
    [{ through: [table(...root), table(...swing(-1))], kind: 'inside', only: legLeft }],
    paper(-0.3, 0.3),
  ).collapse(
    { title: 'Reverse-fold the tail', text: 'Do the same with the right point to make the tail.', kind: 'reverse' },
    [{ through: [table(...root), table(...swing(1))], kind: 'inside', only: legRight }],
    paper(-0.3, 0.3),
  );

  // The head: a smaller reverse fold near the neck's tip, which is the sheet's corner (½, ½).
  const tip = r.where(paper(0.5, 0.5));
  const neck: Vec2 = [-Math.SQRT1_2, -Math.SQRT1_2];
  const headBase: Vec2 = [tip[0] - neck[0] * 0.12, tip[1] - neck[1] * 0.12];
  const headDir: Vec2 = [-0.86, 0.5];
  const bisect: Vec2 = [neck[0] + headDir[0], neck[1] + headDir[1]];
  r.collapse(
    {
      title: 'Reverse-fold the head',
      text: 'Push the tip of the neck down between its layers to make the head.',
      kind: 'reverse',
    },
    [
      {
        through: [table(...headBase), table(headBase[0] + bisect[0], headBase[1] + bisect[1])],
        kind: 'inside',
        only: ([u, v]) => Math.hypot(u - 0.5, v - 0.5) < 0.3,
      },
    ],
    paper(-0.3, 0.3),
  );

  // The wings fold down level with the top of the body, the sheet's centre. Any lower and the fold would cut
  // through the two small triangles between the wings, which join the front wing to the back one.
  const top = r.where(paper(0, 0))[1];
  const wing = (flap: (c: Vec2) => boolean, tip: Vec2, title: string, text: string) =>
    r.along(table(-2, top), table(2, top), paper(...tip), { title, text, only: flap });
  wing(front, [0.5, -0.5], 'Fold a wing down', 'Fold the front wing down, level with the top of the body.');
  r.turnOver('Turn the crane over.');
  // The back wing: the part of the back flap above the line, before it folds down.
  const beforeWing = r.current;
  const backWing = (c: Vec2) => back(c) && locate(beforeWing, c)[1] < top;
  wing(back, [-0.5, 0.5], 'Fold the other wing down', 'Fold the other wing down to match.');
  // Lying on its side, the crane spreads its wings flat: the top one swings right over, to lie opposite the other.
  return r
    .shape({ title: 'Spread the wings', text: 'Lift the wings out to the sides and gently pull them apart to puff out the body. Done!' }, [
      { through: [table(-2, top), table(2, top)], moving: paper(-0.5, 0.5), degrees: 180, only: backWing },
    ])
    .build();
}
