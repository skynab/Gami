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

  leafyStem(r, stem, 10);

  // Stand the stem up straight, and put the blossom on top.
  r.move({ title: 'Stand the stem up', text: 'Turn it so the stem is upright and the leaf leans out.' }, stem, { degrees: -45 });
  const h = 0.75;
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

/**
 * The flat tulip's stem with a leaf, from a square 1.5 across whose sheet origin is (`o`, 0), turned to a diamond:
 * narrowed into a long kite, folded in half both ways, then the stem pulled out of the leaf. Shared with the
 * sunflower.
 */
export function leafyStem(r: Recipe, stem: (c: Vec2) => boolean, o: number) {
  for (const fold of leafyStemFolds(r, stem, o)) fold.make();
}

/**
 * `leafyStem`'s folds one by one, each with its title and text, for a square `2h` across (1.5 by default), to fold
 * several stems side by side: `make` folds it as a step of its own, or within a `together` with another stem's (but
 * one `unfold` opens every stem's last fold at once). Each works out where to fold when it's made, so they must be
 * made in order.
 */
export function leafyStemFolds(r: Recipe, stem: (c: Vec2) => boolean, o: number, h = 0.75): { title: string; text: string; make: () => void; unfold?: boolean }[] {
  const d = Math.SQRT1_2;
  let sx = 0;
  let sz = 0;
  let B: Vec2 = [0, 0];
  let V: Vec2 = [0, 0];
  let reach = 0;
  // The kite's side corners, a tan 22.5° of the way along the upper edges from the old side corners.
  const t = Math.tan(Math.PI / 8);
  const step = (title: string, text: string, make: (title: string, text: string) => void) => ({ title, text, make: () => make(title, text) });
  return [
    // The crease, as `crease` makes it: folded, then opened (`unfold`: several stems' creases open in one step).
    step('Crease the stem square', 'Fold the green square’s left corner to its right corner, then unfold.', (title, text) => {
      [sx, sz] = r.where(paper(o, 0));
      B = [sx, sz + 2 * h * d];
      r.onto(paper(o - h, -h), paper(o + h, h), { title, text, only: stem });
    }),
    { ...step('Unfold', 'Open it back up, leaving a crease.', (title, text) => r.unfold({ title, text })), unfold: true },
    step('Fold the lower edges in', 'Fold the lower left edge to the centre crease…', (title, text) => {
      r.onto(paper(o - h, -h), table(sx, B[1] - 2 * h), { title, text, only: stem });
    }),
    step('Fold the lower edges in', '…and the lower right edge. A kite.', (title, text) => {
      r.onto(paper(o + h, h), table(sx, B[1] - 2 * h), { title, text, only: stem });
      V = r.where(paper(o - h + 2 * h * t, -h));
      reach = Math.hypot(V[0] - B[0], V[1] - B[1]);
    }),
    step('Narrow it again', 'Fold the lower edges to the centre again…', (title, text) => {
      r.onto(table(...V), table(sx, B[1] - reach), { title, text, only: stem });
    }),
    step('Narrow it again', '…on both sides. The bottom is a long thin point.', (title, text) => {
      r.onto(table(2 * sx - V[0], V[1]), table(sx, B[1] - reach), { title, text, only: stem });
    }),
    step('Fold the bottom up', 'Fold the bottom point up to the top point.', (title, text) => {
      r.along(table(sx - 1, sz), table(sx + 1, sz), table(...B), { title, text, only: stem });
    }),
    step('Fold in half', 'Fold the left half over onto the right.', (title, text) => {
      r.along(table(sx, sz - 2), table(sx, sz + 2), table(sx - 0.1, sz - 0.4), { title, text, only: stem });
    }),
    // The stem is inside now; pull it out about the bottom so it leans 45° to the right of the leaf.
    step('Pull out the stem', 'Pull the thin inner point out and up, away from the leaf, and press it flat at the bottom.', (title, text) => {
      const lean = (22.5 * Math.PI) / 180;
      r.collapse(
        { title, text, kind: 'reverse' },
        [{ through: [table(sx, sz), table(sx + Math.sin(lean), sz - Math.cos(lean))], kind: 'inside', only: stem }],
        paper(o + (0.3 / 0.75) * h, (-0.7 / 0.75) * h),
      );
    }),
  ];
}
