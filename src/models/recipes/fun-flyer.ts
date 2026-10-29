import { paper, Recipe, table } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';
import { foldWings } from './paper-plane';
import { moved } from './waterbomb-base';

/**
 * The fun flyer, a long-winged dart with a little point sticking out in front of its nose: a water bomb base at
 * the top of the sheet, its front corners folded up into a diamond, then the top folded down behind them so
 * their tips stick out, and wings folded from the nose to the tail. From a sheet of US letter paper, held
 * upright (8.5 : 11).
 */
export function funFlyer() {
  // US letter is 8.5 : 11; 0.77 : 1 is near enough, and exact in a .fold file.
  const w = 0.77;
  const h = 1;
  const [l, r, top, bottom] = [-w / 2, w / 2, -h / 2, h / 2];
  // The square at the top of the sheet: its middle, where the diagonals cross, and its bottom edge.
  const mid = top + w / 2;
  const base = top + w;
  // Collapsed, the square is a triangle with its point at the middle and its bottom edge along the square's.
  // Folding the point down to halfway down it creases a quarter of the way down.
  const quarter = mid + (base - mid) / 4;

  const plane = new Recipe({
    id: 'fun-flyer',
    title: 'Fun flyer',
    sheet: { size: [w, h], front: '#f6f3ec', back: '#e76f51' },
  })
    .crease(paper(l, top), table(r, base), {
      title: 'Fold the top-left corner across',
      text: 'Bring the top-left corner down to the right edge, so the top edge lies along it.',
    })
    .crease(paper(r, top), table(l, base), {
      title: 'Fold the top-right corner across',
      text: 'The same the other way: the top edge along the left edge. The creases cross in an X.',
    })
    .crease(paper(0, top), table(0, base), {
      title: 'Fold the top down',
      text: 'Fold the top edge down so it lines up with the ends of the X. The fold runs through the middle of the X.',
    })
    .collapse(
      {
        title: 'Collapse the top into a triangle',
        text: 'Push the sides of the top square in along the middle fold, so the top folds down into a triangle on the sheet.',
      },
      [
        { through: [table(l, top), table(r, base)], kind: 'valley' },
        { through: [table(r, top), table(l, base)], kind: 'valley' },
        { through: [table(l, mid), table(r, mid)], kind: 'mountain' },
      ],
      paper(0, bottom - 0.1),
    );

  // The triangle's bottom corners, top flap only, fold up to its point. Their tips become the nose.
  const corners: ((c: Vec2) => boolean)[] = [];
  for (const s of [-1, 1]) {
    corners.push(
      moved(plane, () =>
        plane.onto(table(s * (w / 2), base), table(0, mid), {
          title: s < 0 ? 'Fold the left corner up' : 'Fold the right corner up',
          text: s < 0 ? 'Fold the bottom left corner of the top flap up to the top point.' : 'And the bottom right corner. It’s a diamond.',
          layers: 2,
        }),
      ),
    );
  }
  const nose = (c: Vec2) => corners.some((corner) => corner(c));

  plane.turnOver().along(table(-1, quarter), table(1, quarter), table(0, mid + 0.01), {
    title: 'Fold the point down',
    text: 'Fold the triangle’s point down to halfway down it. The tips of the corners you folded up stay where they are, sticking out above the fold.',
    only: (c) => !nose(c),
  });

  // In half behind and on its side, as the other planes; the tips stick out in front of the nose.
  const right = plane.lying(([x]) => x > 0);
  plane
    .along(table(0, -1), table(0, 1), table(-0.1, 0), {
      title: 'Fold in half behind',
      text: 'Mountain-fold along the centre crease, so the folds stay on the outside.',
      kind: 'mountain',
    })
    .rotate(90, { title: 'Turn it on its side', text: 'Point the nose to the left, with the long folded edge at the bottom.' });
  // The wings fold down along a line from just above the tips at the nose, slanting a little further from the
  // keel towards the tail.
  return foldWings(
    plane,
    (base - mid) / 4,
    'Fold the top layers down along a line from just above the little point to the back edge, slanting a little further from the bottom towards the back.',
    right,
    (c) => !right(c),
    {
      tail: 0.15,
      flyText: 'Turn the plane over, so it stands on its keel with its wings level on top, and the little point sticking out in front. It’s ready to fly!',
    },
  );
}
