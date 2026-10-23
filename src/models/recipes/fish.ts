import { sideOf, lineThrough } from '../../fold/geometry2d';
import { Recipe, table } from '../../fold/recipe';
import { locate } from '../../fold/select';
import type { Vec2 } from '../../fold/types';

/**
 * The traditional very easy fish, following the order of folds at origami.me/fish: a square folded in half
 * into a triangle, the top layer's point folded up past the long edge (the back fin), the lower point folded
 * up and back down in a pleat (the belly fins), the left corner pleated up and over (the tail), then turned
 * over and the head folded down.
 *
 * origami.me gives no reference points for most of these folds, so Gami picks its own, noted below.
 */
export function fish() {
  // Folded in half, the triangle's long edge runs along z = 0 from (−h, 0) to (h, 0), its point at (0, h).
  const h = Math.SQRT1_2;
  // The back fin: the top layer's point folds up on the line z = c, two fifths of the way down.
  const c = 0.4 * h;
  // Where that line meets the left edge: every fold after it pivots here.
  const P: Vec2 = [c - h, c];
  const from = (deg: number, length: number): Vec2 => {
    const a = (deg * Math.PI) / 180;
    return [P[0] + length * Math.cos(a), P[1] + length * Math.sin(a)];
  };
  // Angles below the line z = c, from P, clockwise on the table (z points towards you).
  // The belly: the lower left edge onto that line folds about the line halfway, 22.5° down…
  const half = 22.5;
  // …and the flap comes back down on a line 15° down, so it sticks out below as a pair of fins.
  const back = 15;

  const r = new Recipe({ id: 'fish', title: 'Fish', sheet: { size: [1, 1], front: '#f6f3ec', back: '#2f8fbf' } })
    .rotate(45, { title: 'Start as a diamond', text: 'Start white side up, with a corner pointing towards you.' })
    .onto(table(0, -h), table(0, h), {
      title: 'Fold in half',
      text: 'Fold the top corner down onto the bottom corner, making a triangle.',
    })
    .onto(table(0, h), table(0, 2 * c - h), {
      title: 'Fold the top point up',
      text: 'Fold the bottom point of the top layer up, so it pokes out a little above the long edge.',
      layers: 1,
    });
  // The flap the next fold makes is the paper below its crease, found on the sheet while it's still in place.
  const [s1, s2] = [r.sheetAt(from(half, 0.05)), r.sheetAt(from(half, 0.3))].map((a) => ('paper' in a ? a.paper : a.table));
  const below = r.sheetAt([0, h - 0.02]);
  const sB = 'paper' in below ? below.paper : below.table;
  const side = (p: Vec2) => (s2[0] - s1[0]) * (p[1] - s1[1]) - (s2[1] - s1[1]) * (p[0] - s1[0]);
  const flap = (centre: Vec2) => Math.sign(side(centre)) === Math.sign(side(sB));

  r.edgeOnto([table(...P), table(0, h)], [table(...P), table(-P[0], c)], {
    title: 'Fold the lower edge up',
    text: 'Fold the lower left edge up onto the crease you just made.',
  })
    .along(table(...P), table(...from(back, 0.3)), table(...from(back / 2, 0.2)), {
      title: 'Fold the flap back down',
      text: 'Fold most of that flap back down again, a little above its crease, so it sticks out underneath.',
      only: flap,
    });

  // The tail: the left corner folds to the right about a line through P, standing straight up…
  const up: Vec2 = [P[0] - 0.3 * Math.sin(Math.PI / 8), P[1] - 0.3 * Math.cos(Math.PI / 8)];
  // (its paper is what lies left of that line now, through both layers)
  const flat = r.build().steps.at(-1)!.frame;
  const crease = lineThrough(P, up);
  const leftSide = sideOf(crease, [-h, 0]);
  const tail = (centre: Vec2) => Math.sign(sideOf(crease, locate(flat, centre))) === Math.sign(leftSide);
  r.along(table(...P), table(...up), table(-h + 0.02, 0.01), {
    title: 'Fold the left corner up',
    text: 'Fold the left corner over to the right so it points straight up. This makes the tail.',
  });
  // …then its tip folds back over to the left, about a line from where it crosses the long edge.
  const edge: Vec2 = [P[0] - P[1] * Math.tan(Math.PI / 8), 0];
  const tip: Vec2 = [P[0], P[1] - 0.4];
  r.along(table(...edge), table(P[0], (P[1] + tip[1]) / 2), table(tip[0], tip[1] + 0.02), {
    title: 'Fold the tail’s tip to the left',
    text: 'Fold the top of the tail back over to the left. How far sets the size of the tail.',
    only: tail,
  })
    .turnOver('Turn the fish over from left to right.');

  // The head: the top left corner (the right corner before turning over) down onto the lowest point.
  const now = r.build().steps.at(-1)!.frame.vertices_coords;
  const low = now.reduce((a, b) => (b[2] > a[2] ? b : a));
  const lowest: Vec2 = [low[0], low[2]];
  return r
    .onto(table(-h, 0), table(...lowest), {
      title: 'Fold the head down',
      text: 'Fold the top left corner down onto the bottom corner. That’s the head, and your fish is done!',
    })
    .build();
}
