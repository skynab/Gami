import { paper, Recipe, table } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';

/** How far past the middle crease each end reaches when it's folded over: they overlap by twice this. */
export const OVERLAP = 0.04;

/**
 * The traditional wallet, following the order of folds at origami.me/wallet, from one square: creased in half
 * and in sixths, the four corners folded to the crease near them and the top and bottom strips folded in over
 * them; turned over and stood up, one end folded up just past the middle and the other folded down and tucked
 * under its side flaps; folded in half like a book, with a pocket each side.
 */
export function wallet() {
  const r = new Recipe({ id: 'wallet', title: 'Wallet', sheet: { size: [1, 1], front: '#f3efe6', back: '#3f7f6e' } }).crease(paper(-0.5, 0), paper(0.5, 0), {
    title: 'Crease down the middle',
    text: 'Start with the plain side up. Fold the left edge to the right edge, and unfold.',
  });
  const open = r.mark();
  r.onto(paper(0, 0.5), paper(0, -0.5), { title: 'Fold in half', text: 'Fold the bottom edge up to the top edge.' })
    .along(table(-1, -1 / 3), table(1, -1 / 3), table(0, -0.49), {
      title: 'Crease a third',
      text: 'Fold the open edges down a third of the way to the fold, through both layers.',
    })
    .unfold({ title: 'Open it out', text: 'Unfold the paper completely: there are creases across near the top and the bottom.', to: open });
  r.together({ title: 'Fold the corners in', text: 'Fold each corner in to the crease across nearest it.' }, (q) => {
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) q.onto(paper(x * 0.5, z * 0.5), table(x / 3, z / 3), { title: '' });
  });
  r.together({ title: 'Fold the edges in', text: 'Fold the top and bottom edges in along their creases, over the corners.' }, (q) => {
    for (const z of [-1, 1]) q.along(table(-1, z / 3), table(1, z / 3), table(0, z * 0.49), { title: '' });
  });
  // The strips just folded in, corners and all: the flaps the far end tucks under.
  const strip = ([, v]: Vec2) => Math.abs(v) > 1 / 3;
  r.turnOver('Turn the paper over.');
  r.rotate(90, { title: 'Turn it round', text: 'Turn it a quarter turn, so the strips run up the sides.' });

  // The bottom folds up to just past the middle, and the top folds down to just past it the other way, tucked
  // under the bottom end's side strips.
  const end = 0.5;
  const fold = (end - OVERLAP) / 2;
  const bottom = r.lying(([, z]) => z > fold);
  r.along(table(-1, fold), table(1, fold), table(0, end - 0.01), {
    title: 'Fold the bottom up',
    text: 'Fold the bottom edge up a little past the middle crease.',
  });
  r.collapse(
    { title: 'Tuck the top in', text: 'Fold the top edge down a little past the middle too, and tuck it under the side flaps of the bottom part.' },
    [{ through: [table(-1, -fold), table(1, -fold)], kind: 'valley' }],
    r.sheetAt([0, 0.1]),
    (c) => strip(c) && bottom(c),
  );
  r.along(table(0, -1), table(0, 1), table(-0.3, 0), {
    title: 'Fold in half',
    text: 'Fold it in half from left to right, like a book. Your wallet has a pocket each side when you open it.',
  });
  return r.build();
}
