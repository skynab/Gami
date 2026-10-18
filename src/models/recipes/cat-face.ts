import { lineOnto, sideOf } from '../../fold/geometry2d';
import { locate, paper, Recipe, table } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';

/** A cat's face, the traditional first model: a triangle with its corners folded up into pointed ears. */
export function catFace() {
  // Turned to a diamond, the sheet's corners sit this far from the centre; folded bottom to top, it's a
  // triangle with its folded edge along z = 0, its point at (0, −r) and its side corners at (±r, 0).
  const r = Math.SQRT1_2;
  // Where the right ear's tip points: up past the top point, and out a little.
  const ear: Vec2 = [0.24, -r - 0.08];
  const recipe = new Recipe({ id: 'cat-face', title: 'Cat face', sheet: { size: [1, 1], front: '#f6f3ec', back: '#e6a13a' } })
    .rotate(45, { title: 'Turn it to a diamond', text: 'Start white side up, and turn the square so a corner points towards you.' })
    .onto(paper(-0.5, 0.5), paper(0.5, -0.5), { title: 'Fold in half', text: 'Fold the bottom corner up to the top corner, making a triangle.' });
  // The ears: the paper on each side corner's side of the line that folds it up, as it lies now.
  const triangle = recipe.current;
  const side = (corner: Vec2, tip: Vec2) => {
    const line = lineOnto(corner, tip);
    return (c: Vec2) => sideOf(line, locate(triangle, c)) * sideOf(line, corner) > 0;
  };
  const left = side([-r, 0], [-ear[0], ear[1]]);
  const right = side([r, 0], ear);
  return recipe
    .onto(paper(-0.5, -0.5), table(-ear[0], ear[1]), {
      title: 'Fold up an ear',
      text: 'Fold the left corner up, so its point sticks up past the top point and out to the side.',
    })
    .onto(paper(0.5, 0.5), table(...ear), {
      title: 'Fold up the other ear',
      text: 'Fold the right corner up to match.',
    })
    .along(table(-1, -r + 0.2), table(1, -r + 0.2), table(0, -r), {
      title: 'Fold the top behind',
      text: 'Fold the top point down behind, between the ears.',
      kind: 'mountain',
      only: (c) => !left(c) && !right(c),
    })
    .turnOver('Turn it over. Draw on eyes, a nose and whiskers!')
    .build();
}
