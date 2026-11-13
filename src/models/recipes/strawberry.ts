import { paper, Recipe, table } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';
import { moved } from './waterbomb-base';

/**
 * A strawberry, Gami's own, flat, from two squares and no glue: the berry a diamond with its top, sides (on a
 * slant) and bottom point folded behind and its corners rounded, seeds drawn on; the leaves a small green square folded as the
 * sunflower's petals are (corners to the middle and back out), an eight-pointed star laid over the berry's top.
 */
export function strawberry() {
  // Half the berry square's side, and half the leaves'.
  const b = 0.5;
  const g = 0.2;
  const r = new Recipe({
    id: 'strawberry',
    title: 'Strawberry',
    sheets: [
      { size: [2 * b, 2 * b], front: '#d9283a', back: '#f6f3ec', origin: [0, 0], at: [-0.5, 0] },
      { size: [2 * g, 2 * g], front: '#6cb84f', back: '#2f7d3a', origin: [10, 0], at: [0.75, -0.3] },
    ],
  });
  const berry = ([u]: Vec2) => u < 5;
  const leaves = ([u]: Vec2) => u > 5;

  r.move({ title: 'Start with a diamond', text: 'Start with the big square red side up, a corner pointing towards you.' }, berry, { degrees: 45 });
  const [bx, bz] = r.where(paper(0, 0));
  const d = b * Math.SQRT2;
  // The berry: the diamond's top folded behind for a flat top, its sides folded behind to narrow it, its bottom
  // point folded behind to blunt it, then the corners left round its sides folded behind to round it.
  // Each side's fold: from `wide` out at the top, leaning in by `lean` for every unit down.
  const wide = 0.44;
  const lean = 0.3;
  // The top fold, level with where the side folds meet the diamond's edges, so nothing pokes out past the corners.
  const flat = bz - (d - wide);
  const tip = bz + d - 0.09;
  r.together({ title: 'Fold the sides behind', text: 'Fold the left and right corners behind on a slant, from a little way in at the top, so the berry narrows towards the bottom.' }, (q) => {
    for (const s of [-1, 1]) q.along(table(bx + s * wide, flat), table(bx + s * (wide - lean), flat + 1), table(bx + s * d, bz), { title: '', kind: 'mountain', only: berry });
  });
  r.along(table(bx - 1, flat), table(bx + 1, flat), table(bx, bz - d), {
    title: 'Fold the top behind',
    text: 'Fold the top point behind, level with where the side folds start.',
    kind: 'mountain',
    only: berry,
  });
  r.along(table(bx - 1, tip), table(bx + 1, tip), table(bx, bz + d), {
    title: 'Blunt the bottom',
    text: 'Fold the bottom point behind, just a little.',
    kind: 'mountain',
    only: berry,
  });
  // The corners now: at the top, where the flat top meets the slanted sides; lower down, where the sides meet the
  // diamond's lower edges (|x| = d − z from the middle).
  const lowZ = (d - wide - lean * (bz - flat)) / (1 - lean);
  const corners2 = (s: number) => {
    const top: Vec2 = [bx + s * wide, flat];
    const low: Vec2 = [bx + s * (wide - lean * (lowZ + bz - flat - bz)), bz + lowZ];
    return { top, low };
  };
  const unit = (x: number, z: number): Vec2 => [x / Math.hypot(x, z), z / Math.hypot(x, z)];
  const cut = 0.07;
  r.together({ title: 'Round the corners', text: 'Fold the four corners round the sides behind, just a little, to round the berry.' }, (q) => {
    for (const s of [-1, 1]) {
      const { top, low } = corners2(s);
      for (const [c, e1, e2] of [
        [top, unit(-s, 0), unit(-s * lean, 1)],
        [low, unit(s * lean, -1), unit(-s, 1)],
      ] as [Vec2, Vec2, Vec2][]) {
        q.along(table(c[0] + cut * e1[0], c[1] + cut * e1[1]), table(c[0] + cut * e2[0], c[1] + cut * e2[1]), table(...c), { title: '', kind: 'mountain', only: berry });
      }
    }
  });

  // The leaves: corners to the middle, then each point folded back out past its edge.
  const [lx, lz] = r.where(paper(10, 0));
  const corners: Vec2[] = [[-g, -g], [g, -g], [g, g], [-g, g]];
  const flaps: ((c: Vec2) => boolean)[] = [];
  r.together({ title: 'Fold the leaves’ corners in', text: 'Turn to the small green square, light side up. Fold all four corners to the middle.' }, (q) => {
    for (const [u, v] of corners) flaps.push(moved(r, () => q.onto(paper(10 + u, v), table(lx, lz), { title: '', only: leaves })));
  });
  const reach = 0.9 * Math.SQRT1_2;
  r.together({ title: 'Fold out the leaves', text: 'Fold each point back out, past the middle of its edge: eight pointed leaves.' }, (q) => {
    corners.forEach(([u, v], i) => q.onto(table(lx, lz), table(lx + u * reach, lz + v * reach), { title: '', only: flaps[i] }));
  });
  r.move({ title: 'Put the leaves on', text: 'Lay the leaves over the top of the berry.' }, leaves, { to: table(bx, flat + 0.01) });

  // Seeds: small dots in staggered rows, inside the berry's edges and off its folds.
  const dot = (x: number, z: number): Vec2[] => Array.from({ length: 6 }, (_, i) => [x + 0.011 * Math.cos((i / 6) * 2 * Math.PI), z + 0.016 * Math.sin((i / 6) * 2 * Math.PI)]);
  const seeds: Vec2[] = [];
  for (let row = 0; row < 6; row++) {
    const z = flat + 0.2 + row * 0.085;
    // How wide the berry is at this height: the slanted sides, then the lower edges in to the bottom.
    const half = Math.min(wide - lean * (z - flat), bz + d - z) - 0.07;
    const step = 0.1;
    if (row % 2) seeds.push([bx, z]);
    for (let x = row % 2 ? step : step / 2; x < half; x += step) seeds.push([bx + x, z], [bx - x, z]);
  }
  return r.draw({ title: 'Draw the seeds', text: 'Draw little seeds all over the berry. Ready to eat!' }, seeds.map((p) => ({ fill: dot(...p) }))).build();
}
