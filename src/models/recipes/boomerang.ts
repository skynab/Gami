import { paper, Recipe, table } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';

/**
 * The paper boomerang, after Fold'N Fly #56: half a sheet of letter paper, its long edges folded to the middle
 * and the strip folded in half, turned into an L, with the corners of both tips folded behind. Fold'N Fly turns the L
 * by twisting the open strip until its sides stand up as walls, then folding the walls down into each other's
 * pockets; rigid paper can't twist, so here the strip is folded in half first and turned with a single 45° fold,
 * which gives the same L. Fold'N Fly tucks the tips' corners in between the layers; reverse-folding a corner four
 * layers thick moves them all as one, so here they fold behind, which gives the same pointed tips.
 */
export function boomerang() {
  // Half a sheet of US letter, 8.5 : 5.5. 0.65 is near enough, and exact in a .fold file.
  const h = 0.65;
  // The strip's width once its edges are at the middle and it's folded in half.
  const w = h / 4;

  const r = new Recipe({ id: 'boomerang', title: 'Boomerang', sheet: { size: [1, h], front: '#f6f3ec', back: '#3f8fc9' } })
    .crease(paper(0, -h / 2), paper(0, h / 2), {
      title: 'Fold in half lengthwise',
      text: 'Start with half a sheet of letter paper, cut across the middle, white side up and long side across. Fold the top edge down to the bottom edge, and unfold.',
    })
    .onto(paper(0, -h / 2), table(0, 0), { title: 'Fold the top edge to the middle', text: 'Bring the top edge down to the centre crease.' })
    .onto(paper(0, h / 2), table(0, 0), { title: 'Fold the bottom edge to the middle', text: 'And the bottom edge up to meet it.' })
    .onto(table(0, -h / 4), table(0, h / 4), {
      title: 'Fold the strip in half',
      text: 'Fold the top half down onto the bottom half, along the centre crease, so the edges you folded are inside.',
    })
    // The left half turns down on a 45° line across the middle of the strip, making an L.
    .along(table(-w / 2, w), table(w / 2, 0), table(-0.4, w / 2), {
      title: 'Fold it into an L',
      text: 'Fold the left half of the strip down at 45°, on a line across the middle, so it points straight down. Press the corner flat.',
    });

  // The tips: each corner folded behind to the middle of the tip's end. The right arm's tip is the sheet's right
  // end, lying across the table; the bottom arm's is its left end, the L's 45° fold having turned it to point down.
  const L = r.where(paper(-0.5, 0))[1];
  // Each arm's paper, by the end of the sheet it's on: a corner's fold, carried on, would cross the other arm's tip.
  const arm = (end: 1 | -1) => ([u]: Vec2) => end * u > 0;
  const corners: [1 | -1, Vec2, Vec2, Vec2, string, string][] = [
    [1, [0.5 - w / 2, 0], [0.5, w / 2], [0.5, 0], 'Fold a corner behind', 'Fold the top corner of the right-hand tip behind, so its edge meets the middle of the tip.'],
    [1, [0.5, w / 2], [0.5 - w / 2, w], [0.5, w], 'And the other', 'Fold the bottom corner behind the same way. The tip comes to a point.'],
    [-1, [w / 2, L - w / 2], [0, L], [w / 2, L], 'The other tip', 'Do the same at the bottom tip: fold its right corner behind.'],
    [-1, [0, L], [-w / 2, L - w / 2], [-w / 2, L], 'And its other corner', 'And the left corner. Press the boomerang flat, and check it lies flat on the table.'],
  ];
  for (const [end, a, b, corner, title, text] of corners) {
    r.along(table(...a), table(...b), table(...corner), { title, text, kind: 'mountain', only: arm(end) });
  }
  // The 45° fold at the corner is all that holds the L, and it springs open in flight: a strip of tape across it,
  // square to the fold, holds both arms together.
  const across = (d: number) => table(d * Math.SQRT1_2, w / 2 + d * Math.SQRT1_2);
  r.tape(across(-0.09), across(0.09), {
    title: 'Tape the corner',
    text: 'Stick a short piece of tape across the corner of the L, so the fold can’t spring open when you throw it.',
    width: 0.07,
  });
  return r.build();
}
