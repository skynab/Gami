import { toFlat } from '../../fold/fold';
import { paper, Recipe, table, type ShapeBend } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';
import { birdBase } from './bird-base';

/**
 * The traditional flapping bird, following the order of folds at origami.me/bird: a bird base, its two lower
 * points pulled out sideways between the wings for the neck and tail, and the head reverse-folded. Then, in 3D, its
 * wings spread into a V and the bird stood up on its body. Hold the bottom of the neck and pull the tail, and the
 * wings flap.
 */
export function flappingBird() {
  const r = new Recipe({ id: 'flapping-bird', title: 'Flapping bird', sheet: { size: [1, 1], front: '#d65db1', back: '#f6f3ec' } });
  const { up, front, back } = birdBase(r);

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
  r.collapse(
    { title: 'Make the head', text: 'Push the tip of the neck down between its layers for the head.', kind: 'reverse' },
    [{ through: [table(...base), table(base[0] + line[0], base[1] + line[1])], kind: 'inside', only: neckOut }],
    paper(-0.3, 0.3),
  );

  // The wings are the front and back flaps. Low down they hold the neck's and tail's paper between them, joined
  // along their edges, so rigid paper can only spread them from just above the highest of it: each tips `spread`
  // away from the body's plane, opposite ways, into a V. Then the bird is stood up on its body.
  const flat = r.current;
  const inner = toFlat(flat).filter((f) => {
    const [u, v] = f.paper.reduce(([a, b], p) => [a + p[0], b + p[1]], [0, 0]);
    return Math.sign(u) === Math.sign(v);
  });
  const hinge = Math.min(...inner.flatMap((f) => f.world.map((p) => p[1]))) - 0.01;
  // The wings' middle, across: where the tip of the triangle they make is.
  const tips = toFlat(flat).flatMap((f) => f.world);
  const top = tips.reduce((a, p) => (p[1] < a[1] ? p : a));
  const spread = 50;
  const wings: ShapeBend[] = [
    { through: [table(-2, hinge), table(2, hinge)], moving: table(top[0], hinge - 0.1), degrees: spread, only: front },
    { through: [table(-2, hinge), table(2, hinge)], moving: table(top[0], hinge - 0.1), degrees: -spread, only: back },
  ];
  const lowest = Math.max(...flat.vertices_coords.map((p) => p[2]));
  return r
    .assemble({ title: 'Spread the wings', text: 'Lift the wings apart into a V and stand the bird on its body. Hold the base of the neck and pull the tail gently: the wings flap!' }, [
      { only: () => true, bends: wings, pose: { from: table(top[0], hinge), to: [0, lowest - hinge + 0.003, 0], x: [1, 0, 0], up: [0, 0, 1] } },
    ])
    .build();
}
