import { paper, Recipe, table } from '../../fold/recipe';

/**
 * The jumping frog, from a 3 × 5 card: a waterbomb base at the top makes the head and front legs,
 * and a pleat at the back makes the spring. Press down on its back and let go to make it jump.
 */
export function jumpingFrog() {
  const w = 0.6;
  const top = -0.5;
  // The top of the card is a w × w square: its diagonals cross at `centre`, and its bottom edge is `base`.
  const base = top + w;
  const centre = top + w / 2;
  const quarter = w / 4;

  return (
    new Recipe({ id: 'jumping-frog', title: 'Jumping frog', sheet: { size: [w, 1], front: '#f6f3ec', back: '#3f9b4f' } })
      .crease(paper(w / 2, top), table(-w / 2, base), {
        title: 'Fold a top corner across',
        text: 'Bring the top-right corner down to the left edge, making a diagonal crease across the top square. Unfold.',
      })
      .crease(paper(-w / 2, top), table(w / 2, base), {
        title: 'Fold the other corner across',
        text: 'Do the same with the top-left corner. The creases make an X.',
      })
      .crease(paper(0, top), table(0, base), {
        title: 'Fold the top down',
        text: 'Fold the top edge down to the bottom of the X, so the crease runs through its middle. Unfold.',
      })
      .collapse(
        {
          title: 'Collapse into a triangle',
          text: 'Push the sides in along the horizontal crease and bring the top down flat. The top becomes a triangle: a waterbomb base.',
        },
        [
          { through: [table(0, centre), table(-w / 2, top)], kind: 'valley' },
          { through: [table(0, centre), table(w / 2, top)], kind: 'valley' },
          { through: [table(-w / 2, centre), table(w / 2, centre)], kind: 'mountain' },
        ],
        paper(0, 0.4),
      )
      .onto(table(-w / 2, base), table(0, centre), {
        title: 'Fold up a front leg',
        text: 'Fold the triangle’s bottom-left corner up to its top point.',
        layers: 2,
      })
      .onto(table(w / 2, base), table(0, centre), { title: 'Fold up the other front leg', text: 'Match it on the right.', layers: 2 })
      .along(table(-quarter, -1), table(-quarter, 1), table(-w / 2 + 0.01, 0.3), {
        title: 'Fold the left side in',
        text: 'Fold the left edge of the card in to the middle. It tucks under the front legs.',
      })
      .along(table(quarter, -1), table(quarter, 1), table(w / 2 - 0.01, 0.3), { title: 'Fold the right side in', text: 'And the right edge.' })
      .onto(table(0, 0.5), table(0, base), {
        title: 'Fold the bottom up',
        text: 'Bring the bottom edge up to the base of the triangle. This makes the back legs.',
      })
      // The spring: fold the body up over the head, then fold half of it back down.
      .along(table(-1, base), table(1, base), table(0, base + 0.1), {
        title: 'Fold the body up',
        text: 'Fold the whole bottom part up along the base of the triangle.',
      })
      .along(table(-1, base - 0.1), table(1, base - 0.1), table(0, base - 0.15), {
        title: 'Fold half of it back down',
        text: 'Fold the top half back down again, making a zig-zag pleat. This is the spring.',
        only: ([, v]) => v > base,
      })
      .turnOver('Turn the frog over. Press down on its back, slide your finger off, and it jumps!')
      .build()
  );
}
