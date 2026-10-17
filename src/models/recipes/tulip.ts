import { toFlat } from '../../fold/fold';
import { paper, Recipe, table } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';

/**
 * The traditional flat tulip: a blossom from one square and a stem with a leaf from another, put together.
 * The stem's square is half as big again, so the stem is long enough. Both squares start as diamonds: with a
 * sheet turned an eighth of a turn, its corners are top (h, −h), bottom (−h, h), left (−h, −h) and right (h, h),
 * h being half its side, offset by the sheet's origin.
 */
export function tulip() {
  const r = new Recipe({
    id: 'tulip',
    title: 'Tulip',
    sheets: [
      { size: [1, 1], front: '#f6f3ec', back: '#e8578a', origin: [0, 0], at: [-0.8, 0] },
      { size: [1.5, 1.5], front: '#3f9e5a', back: '#6cc07f', origin: [10, 0], at: [1.1, 0] },
    ],
  });
  const blossom = ([u]: Vec2) => u < 5;
  const stem = ([u]: Vec2) => u > 5;
  const d = Math.SQRT1_2;

  r.together({ title: 'Start with two diamonds', text: 'A pink square, white side up, and a bigger green one, each turned so a corner points towards you.' }, (r) => {
    r.move({ title: '' }, blossom, { degrees: 45 }).move({ title: '' }, stem, { degrees: -45 });
  });

  // The blossom: a triangle, then the two bottom corners up as petals.
  const [bx, bz] = r.where(paper(0, 0));
  r.onto(paper(-0.5, 0.5), paper(0.5, -0.5), {
    title: 'Fold the blossom in half',
    text: 'Fold the square’s bottom corner up to the top corner.',
    only: blossom,
  });
  // Each petal folds about the middle of the bottom edge, its corner ending up a little outside the top point.
  const petal = (side: -1 | 1, title: string, text: string) => {
    const tilt = (25 * Math.PI) / 180;
    const tip: Vec2 = [bx + side * d * Math.sin(tilt), bz - d * Math.cos(tilt)];
    return r.onto(table(bx + side * d, bz), table(...tip), { title, text, only: blossom });
  };
  petal(-1, 'Fold up a petal', 'Fold the left corner up, so it points up just to the left of the top point.');
  petal(1, 'Fold up the other petal', 'And the right corner, to match. That’s the blossom.');

  // The stem: narrowed into a long kite, folded in half both ways, then the stem pulled out of the leaf.
  const h = 0.75;
  const [sx, sz] = r.where(paper(10, 0));
  const B: Vec2 = [sx, sz + 2 * h * d];
  r.crease(paper(10 - h, -h), paper(10 + h, h), { title: 'Crease the stem square', text: 'Fold the green square’s left corner to its right corner, then unfold.', only: stem });
  r.onto(paper(10 - h, -h), table(sx, B[1] - 2 * h), { title: 'Fold the lower edges in', text: 'Fold the lower left edge to the centre crease…', only: stem })
    .onto(paper(10 + h, h), table(sx, B[1] - 2 * h), { title: 'Fold the lower edges in', text: '…and the lower right edge. A kite.', only: stem });
  // The kite's side corners, a tan 22.5° of the way along the upper edges from the old side corners.
  const t = Math.tan(Math.PI / 8);
  const V = r.where(paper(10 - h + 2 * h * t, -h));
  const reach = Math.hypot(V[0] - B[0], V[1] - B[1]);
  r.onto(table(...V), table(sx, B[1] - reach), { title: 'Narrow it again', text: 'Fold the lower edges to the centre again…', only: stem }).onto(
    table(2 * sx - V[0], V[1]),
    table(sx, B[1] - reach),
    { title: 'Narrow it again', text: '…on both sides. The bottom is a long thin point.', only: stem },
  );
  r.along(table(sx - 1, sz), table(sx + 1, sz), table(...B), {
    title: 'Fold the bottom up',
    text: 'Fold the bottom point up to the top point.',
    only: stem,
  }).along(table(sx, sz - 2), table(sx, sz + 2), table(sx - 0.1, sz - 0.4), {
    title: 'Fold in half',
    text: 'Fold the left half over onto the right.',
    only: stem,
  });
  // The stem is inside now; pull it out about the bottom so it leans 45° to the right of the leaf.
  const lean = (22.5 * Math.PI) / 180;
  r.collapse(
    { title: 'Pull out the stem', text: 'Pull the thin inner point out and up, away from the leaf, and press it flat at the bottom.', kind: 'reverse' },
    [{ through: [table(sx, sz), table(sx + Math.sin(lean), sz - Math.cos(lean))], kind: 'inside', only: stem }],
    paper(10.3, -0.7),
  );

  // Stand the stem up straight, and put the blossom on top.
  r.move({ title: 'Stand the stem up', text: 'Turn it so the stem is upright and the leaf leans out.' }, stem, { degrees: -45 });
  const tip = r.where(paper(10 - h, h));
  const bottom = r.where(paper(0, 0));
  const pts = toFlat(r.current)
    .filter((f) => blossom(f.paper[0]))
    .flatMap((f) => f.world);
  const cx = (Math.min(...pts.map((p) => p[0])) + Math.max(...pts.map((p) => p[0]))) / 2;
  const cz = (Math.min(...pts.map((p) => p[1])) + Math.max(...pts.map((p) => p[1]))) / 2;
  const sink = 0.08;
  r.move({ title: 'Put the blossom on the stem', text: 'Slide the blossom onto the top of the stem.' }, blossom, {
    to: table(tip[0] + cx - bottom[0], tip[1] + sink + cz - bottom[1]),
  });
  return r.build();
}
