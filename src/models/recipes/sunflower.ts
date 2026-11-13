import { toFlat } from '../../fold/fold';
import { paper, Recipe, table } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';
import { leafyStem } from './tulip';
import { moved } from './waterbomb-base';

/**
 * A sunflower, Gami's own, after the look of OrigamiOK's, from three squares and no glue: petals from a yellow
 * square, its corners folded to the middle and their points folded back out past the edges, an eight-pointed star;
 * a small brown square with its corners folded behind for the middle, its seeds drawn on in a spiral; and the flat
 * tulip's traditional stem with a leaf.
 */
export function sunflower() {
  // The yellow square's side, and half the brown one's.
  const P = 0.7;
  const s = 0.2;
  const r = new Recipe({
    id: 'sunflower',
    title: 'Sunflower',
    sheets: [
      { size: [P, P], front: '#e58a1f', back: '#f7c62f', origin: [0, 0], at: [-0.8, -0.3] },
      { size: [1.5, 1.5], front: '#3f9e5a', back: '#6cc07f', origin: [10, 0], at: [1.2, 0] },
      { size: [2 * s, 2 * s], front: '#6b3d1e', back: '#94643a', origin: [20, 0], at: [-0.8, 0.5] },
    ],
  });
  const petals = ([u]: Vec2) => u < 5;
  const stem = ([u]: Vec2) => u > 5 && u < 15;
  const middle = ([u]: Vec2) => u > 15;

  r.move(
    { title: 'Start with three squares', text: 'A yellow square, orange side up; a bigger green one turned so a corner points towards you; and a small brown one.' },
    stem,
    { degrees: -45 },
  );

  // The petals: corners to the middle, then each point folded back out past the middle of its edge, so the
  // square's corners and the four points make eight petals.
  const [px, pz] = r.where(paper(0, 0));
  const flaps: ((c: Vec2) => boolean)[] = [];
  const corners: Vec2[] = [[-P / 2, -P / 2], [P / 2, -P / 2], [P / 2, P / 2], [-P / 2, P / 2]];
  r.together({ title: 'Fold the corners in', text: 'Fold all four corners of the yellow square to the middle.' }, (q) => {
    for (const [u, v] of corners) flaps.push(moved(r, () => q.onto(paper(u, v), table(px, pz), { title: '', only: petals })));
  });
  // Each point lands nearly as far out from the middle as the square's corners now are.
  const reach = 0.9 * Math.SQRT1_2;
  r.together({ title: 'Fold out the petals', text: 'Fold each point back out, so it sticks out past the middle of its edge.' }, (q) => {
    corners.forEach(([u, v], i) => q.onto(table(px, pz), table(px + u * reach, pz + v * reach), { title: '', only: flaps[i] }));
  });

  // The middle: its corners folded behind, nearly a regular octagon.
  const cut = 0.6 * s;
  r.together({ title: 'Fold the middle’s corners behind', text: 'Fold each corner of the small brown square behind, a little way in, for the middle of the flower.' }, (q) => {
    for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const a = paper(20 + u * (s - cut), v * s);
      const b = paper(20 + u * s, v * (s - cut));
      q.along(a, b, paper(20 + u * s, v * s), { title: '', kind: 'mountain', only: middle });
    }
  });

  leafyStem(r, stem, 10);
  r.move({ title: 'Stand the stem up', text: 'Turn it so the stem is upright and the leaf leans out.' }, stem, { degrees: -45 });

  // The middle on the petals, then the flower on top of the stem.
  r.move({ title: 'Put the middle on', text: 'Lay the brown middle on top of the petals.' }, middle, { to: table(...r.where(paper(0, 0))) });
  const flower = (c: Vec2) => petals(c) || middle(c);
  const tip = r.where(paper(10 - 0.75, 0.75));
  const pts = toFlat(r.current)
    .filter((f) => petals(f.paper[0]))
    .flatMap((f) => f.world);
  const bottom = Math.max(...pts.map((p) => p[1]));
  const cz = r.where(paper(0, 0))[1];
  const sink = 0.06;
  r.move({ title: 'Put the flower on the stem', text: 'Set the flower on top of the stem.' }, flower, { to: table(tip[0], tip[1] + sink - (bottom - cz)) });

  // Seeds in a sunflower's spiral: each a golden angle round from the last, further out as the square root.
  const [mx, mz] = r.where(paper(20, 0));
  const golden = Math.PI * (3 - Math.sqrt(5));
  const dot = (x: number, z: number, rad: number): Vec2[] => Array.from({ length: 6 }, (_, i) => [x + rad * Math.cos((i / 6) * 2 * Math.PI), z + rad * Math.sin((i / 6) * 2 * Math.PI)]);
  const seeds = Array.from({ length: 40 }, (_, k) => {
    const rad = 0.026 * Math.sqrt(k + 0.5);
    return { fill: dot(mx + rad * Math.cos(k * golden), mz + rad * Math.sin(k * golden), 0.009) };
  });
  return r
    .draw({ title: 'Draw the seeds', text: 'Draw dots in a spiral on the middle for the seeds. Your sunflower is in bloom!' }, [
      ...seeds,
    ])
    .build();
}
