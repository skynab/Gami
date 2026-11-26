import { placeLike, toFlat } from '../../fold/fold';
import { inside } from '../../fold/select';
import { Recipe, table } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';
import { moved } from './waterbomb-base';

/** How far down from the tip the knot's top edge is, and how tall the knot is. */
export const KNOT_AT = 0.42;
export const KNOT = 0.09;
/** The stripes: how far apart, how wide, and how steeply they slope, in degrees. */
export const STRIPE_GAP = 0.09;
export const STRIPE = 0.03;
export const STRIPE_SLOPE = 30;

/** The part of convex `poly` on the side of the line through `a` along `d` that `keep` says, by its sign. */
function clip(poly: Vec2[], a: Vec2, d: Vec2, keep: 1 | -1): Vec2[] {
  const side = (p: Vec2) => keep * (d[0] * (p[1] - a[1]) - d[1] * (p[0] - a[0]));
  const out: Vec2[] = [];
  poly.forEach((p, i) => {
    const q = poly[(i + 1) % poly.length];
    const [sp, sq] = [side(p), side(q)];
    if (sp >= 0) out.push(p);
    if ((sp >= 0) !== (sq >= 0)) out.push([p[0] + (sp / (sp - sq)) * (q[0] - p[0]), p[1] + (sp / (sp - sq)) * (q[1] - p[1])]);
  });
  return out;
}

/**
 * A necktie, Gami's own (origami.me credits one as traditional, but every necktie in Gilad's database has a named
 * designer), from one square: a kite, its long point narrowed for the
 * part round the neck, turned over; the point folded down and back up for the knot, and its tip folded away
 * behind. The kite's short end is the tie's wide blade. Stripes are drawn with a pen before the knot is folded, on
 * the tie below it only, so the knot shows plain paper.
 */
export function necktie() {
  const h = Math.SQRT1_2;
  const r = new Recipe({ id: 'necktie', title: 'Necktie', sheet: { size: [1, 1], front: '#efe9dc', back: '#8fb8de' } })
    .rotate(45, { title: 'Start as a diamond', text: 'Start with the plain side up and a corner pointing towards you.' })
    .crease(table(-h, 0), table(h, 0), { title: 'Crease down the middle', text: 'Fold the left corner to the right corner, and unfold.' });
  const [top, bottom] = [table(0, -h), table(0, h)];
  r.together({ title: 'Fold a kite', text: 'Fold the upper edges to the middle crease, making a kite with a long point at the top.' }, (q) => {
    for (const s of [-1, 1]) q.edgeOnto([top, table(s * h, 0)], [top, bottom], { title: '' });
  });
  // The kite's side corners, where those folds' edges ended.
  const corner = (s: number) => table(s * (Math.SQRT2 - 1) * h * Math.SQRT2, h * (Math.SQRT2 - 1));
  r.together({ title: 'Narrow the top', text: 'Fold the long upper edges to the middle again, so the top is narrow: the part that goes round the neck.' }, (q) => {
    for (const s of [-1, 1]) q.edgeOnto([top, corner(s)], [top, bottom], { title: '' });
  });
  r.turnOver('Turn the paper over, left to right.');

  const tip = Math.min(...r.current.vertices_coords.map((p) => p[2]));
  const knotTop = tip + KNOT_AT;
  // Stripes across the tie, below where the knot will be: slanted bands, each cut to the faces of the sheet's
  // unfolded middle, which lies on top everywhere now (the kite's flaps are behind).
  const a = (STRIPE_SLOPE * Math.PI) / 180;
  const along: Vec2 = [Math.cos(a), Math.sin(a)];
  const faces = toFlat(r.current);
  const blade = faces.find((f) => inside(f.world, [0.01, h - 0.05]))!;
  const place = placeLike(blade);
  const middle = faces.filter((f) => f.paper.every((p, i) => Math.hypot(place(p)[0] - f.world[i][0], place(p)[1] - f.world[i][1]) < 1e-9));
  const below = knotTop + KNOT + 0.01;
  const stripes = Array.from({ length: 30 }, (_, i) => below + 0.02 + i * STRIPE_GAP)
    .flatMap((z) => middle.map((f) => clip(clip(clip(f.world, [0, z], along, 1), [0, z + STRIPE], along, -1), [0, below], [1, 0], 1)))
    .filter((poly) => poly.length >= 3);
  r.draw({ title: 'Draw stripes', text: 'Draw stripes slanting across the tie, but not on the top third, where the knot will be.' }, stripes.map((fill) => ({ fill })));

  // The knot: the point folded down across the tie, then back up a little lower, leaving a doubled band.
  const down = moved(r, () =>
    r.along(table(-1, knotTop), table(1, knotTop), table(0, tip), { title: 'Fold the point down', text: 'Fold the long point down over the tie, about a third of the way down.' }),
  );
  const up = moved(r, () =>
    r.along(table(-1, knotTop + KNOT), table(1, knotTop + KNOT), table(0, knotTop + 2 * KNOT), {
      title: 'Fold it back up',
      text: 'Fold it back up a little below that fold, leaving a band across: the knot.',
      only: down,
    }),
  );
  const end = Math.min(...r.current.vertices_coords.map((p) => p[2]));
  r.along(table(-1, knotTop), table(1, knotTop), table(0, end), {
    title: 'Fold the tip behind',
    text: 'Fold the tip that sticks up above the knot behind, along the knot’s top edge. Your tie is done.',
    kind: 'mountain',
    only: up,
  });
  return r.build();
}
