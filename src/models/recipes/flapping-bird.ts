import { paper, Recipe, table } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';
import { birdBase } from './bird-base';

/**
 * The traditional flapping bird, following the order of folds at origami.me/bird: a bird base, its two lower
 * points pulled out sideways between the wings for the neck and tail, and the head reverse-folded. Hold the
 * bottom of the neck and pull the tail, and the wings flap.
 */
export function flappingBird() {
  const r = new Recipe({ id: 'flapping-bird', title: 'Flapping bird', sheet: { size: [1, 1], front: '#d65db1', back: '#f6f3ec' } });
  const { up } = birdBase(r);

  // Neck and tail: each lower point swings up and out between the wings, to 45° above level. The fold line
  // bisects straight down and that direction.
  const A = Math.PI / 4;
  const root = up(0.4);
  const out = (dir: 1 | -1): Vec2 => [root[0] + dir * Math.cos(A), root[1] + 1 - Math.sin(A)];
  const leg = (su: number) => ([u, v]: Vec2) => Math.sign(u) === su && Math.sign(v) === su;
  r.collapse(
    {
      title: 'Pull out the tail',
      text: 'Hold the body, and pull the left lower point out and up between the wings. Flatten it at an angle. This is the tail.',
      kind: 'reverse',
    },
    [{ through: [table(...root), table(...out(-1))], kind: 'inside', only: leg(1) }],
    paper(-0.3, 0.3),
  ).collapse(
    { title: 'Pull out the neck', text: 'The same with the right point, for the neck.', kind: 'reverse' },
    [{ through: [table(...root), table(...out(1))], kind: 'inside', only: leg(-1) }],
    paper(-0.3, 0.3),
  );

  // The head: the neck's tip, the sheet's corner (−½, −½), turned down between its layers. The neck's layers are
  // the long triangles of that quarter running out to the tip, whose centres lie within 0.36 of the corner.
  const neckOut = (c: Vec2) => leg(-1)(c) && Math.hypot(c[0] + 0.5, c[1] + 0.5) < 0.36;
  const tip = r.where(paper(-0.5, -0.5));
  const neck: Vec2 = [Math.cos(A), -Math.sin(A)];
  const base: Vec2 = [tip[0] - neck[0] * 0.08, tip[1] - neck[1] * 0.08];
  const down: Vec2 = [0.45, 0.89];
  const line: Vec2 = [neck[0] + down[0], neck[1] + down[1]];
  return r
    .collapse(
      {
        title: 'Make the head',
        text: 'Push the tip of the neck down between its layers for the head. Hold the base of the neck and pull the tail gently: the wings flap!',
        kind: 'reverse',
      },
      [{ through: [table(...base), table(base[0] + line[0], base[1] + line[1])], kind: 'inside', only: neckOut }],
      paper(-0.3, 0.3),
    )
    .build();
}
