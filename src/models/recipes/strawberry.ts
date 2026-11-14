import { paper, Recipe, table } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';
import { creased, pyramidRays, SLOPE } from './pyramid';
import { moved } from './waterbomb-base';

/**
 * A strawberry in 3D, Gami's own, from two squares and no glue: the berry a red square creased as the pyramid is,
 * its corners folded in so its rim is rounder, seeds drawn on its red side, then popped point down as the
 * diamond is, red side out; the leaves a green square folded as the sunflower's petals are (corners to the middle
 * and back out), an eight-pointed star set on its rim.
 */
export function strawberry() {
  // Half the leaves' square's side; the berry's is 1.
  const g = 0.3;
  const r = new Recipe({
    id: 'strawberry',
    title: 'Strawberry',
    sheets: [
      { size: [1, 1], front: '#f3a0a8', back: '#d9283a', origin: [0, 0], at: [0, 0] },
      { size: [2 * g, 2 * g], front: '#6cb84f', back: '#2f7d3a', origin: [10, 0], at: [1.1, 0] },
    ],
  });
  const berry = ([u]: Vec2) => u < 5;
  const leaves = ([u]: Vec2) => u > 5;

  // The berry: sixteen creases from the middle, then the corners folded over onto the pink side, which ends up inside.
  creased(r, berry);
  const cut = 0.17;
  r.together({ title: 'Fold the corners in', text: 'Pink side up, fold all four corners over a little way, so the berry’s rim is rounder.' }, (q) => {
    for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      q.along(table(x * (0.5 - cut), z * 0.5), table(x * 0.5, z * (0.5 - cut)), table(x * 0.5, z * 0.5), { title: '', only: berry });
    }
  });
  // Seeds on the four sides, which are the paper either side of each diagonal (a quarter turn's worth between the
  // creases halfway to the middles); the rest tucks inside. Staggered rows out from the middle.
  const dot = (x: number, z: number): Vec2[] => Array.from({ length: 6 }, (_, i) => [x + 0.011 * Math.cos((i / 6) * 2 * Math.PI), z + 0.011 * Math.sin((i / 6) * 2 * Math.PI)]);
  const seeds: Vec2[] = [];
  for (let k = 0; k < 4; k++) {
    const f = Math.PI / 4 + (k * Math.PI) / 2;
    for (const [rad, spread] of [[0.12, [0]], [0.2, [-0.17, 0.17]], [0.28, [-0.24, 0, 0.24]], [0.36, [-0.27, -0.09, 0.09, 0.27]], [0.44, [-0.17, 0.17]]] as [number, number[]][]) {
      for (const a of spread) seeds.push([rad * Math.cos(f + a), rad * Math.sin(f + a)]);
    }
  }
  r.move({ title: 'Turn the berry over', text: 'Turn the berry over, red side up.' }, berry, { flip: true });
  r.draw({ title: 'Draw the seeds', text: 'Draw little seeds on the red side, in rows either side of each diagonal crease.' }, seeds.map((p) => ({ fill: dot(...p) })));
  r.move({ title: 'Turn it back', text: 'Turn the berry back over, pink side up.' }, berry, { flip: true });

  // The leaves: corners to the middle, then each point folded back out past its edge.
  const [lx, lz] = r.where(paper(10, 0));
  const corners: Vec2[] = [[-g, -g], [g, -g], [g, g], [-g, g]];
  const flaps: ((c: Vec2) => boolean)[] = [];
  r.together({ title: 'Fold the leaves’ corners in', text: 'Take the green square, light side up. Fold all four corners to the middle.' }, (q) => {
    for (const [u, v] of corners) flaps.push(moved(r, () => q.onto(paper(10 + u, v), table(lx, lz), { title: '', only: leaves })));
  });
  const reach = 0.9 * Math.SQRT1_2;
  r.together({ title: 'Fold out the leaves', text: 'Fold each point back out, past the middle of its edge: eight pointed leaves.' }, (q) => {
    corners.forEach(([u, v], i) => q.onto(table(lx, lz), table(lx + u * reach, lz + v * reach), { title: '', only: flaps[i] }));
  });

  // The berry pops point down, as the diamond does, red side out; then the leaves go on its rim, turned so their
  // points stick out between its corners.
  const slope = -SLOPE;
  r.popUp(
    {
      title: 'Pop up the berry',
      text: 'Push the berry’s middle down and lift its edges, pinching each diagonal into a ridge and pushing the creases between them inside, so it comes to a point underneath, red side out.',
    },
    paper(0, 0),
    pyramidRays(slope),
    [1, 2, 3, 4, 5].map((k) => pyramidRays((slope * k) / 6, slope)),
    berry,
  );
  const rim = Math.max(...r.current.vertices_coords.map((p) => p[1]));
  const turn = Math.PI / 8;
  return r
    .assemble({ title: 'Put the leaves on', text: 'Set the leaves on top of the berry, their points between its corners. Your strawberry is ripe!' }, [
      { only: leaves, pose: { from: table(lx, lz), to: [0, rim + 0.004, 0], x: [Math.cos(turn), 0, Math.sin(turn)], up: [0, 1, 0] } },
    ])
    .build();
}
