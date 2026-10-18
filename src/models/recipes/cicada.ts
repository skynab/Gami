import { dist } from '../../fold/geometry2d';
import { paper, Recipe, table } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';

/**
 * The cicada (semi), a traditional Japanese model: a triangle, its corners folded up into a diamond and then
 * down into wings, two bands at the head, and the sides folded behind.
 */
export function cicada() {
  // Turned to a diamond, the sheet's corners sit this far from the centre:
  // TL on the left, TR at the top, BR on the right (and the fourth at the bottom).
  const r = Math.SQRT1_2;
  const TL: Vec2 = [-0.5, -0.5];
  const TR: Vec2 = [0.5, -0.5];
  const BR: Vec2 = [0.5, 0.5];
  // A side corner's flap: the part of the sheet near that corner, both layers of it.
  const flap = (corner: Vec2) => (centre: Vec2) => dist(centre, corner) < 0.45;
  // Folded in half along the TL–BR diagonal, the half that folded up (BL's) and the half under it (TR's).
  const upper = ([u, v]: Vec2) => v > u;
  const lower = ([u, v]: Vec2) => u > v;
  // Folded in half with the fold along the bottom, then the side corners up: a diamond from (0, -r) at the top
  // to (0, 0) at the bottom, its sides at x = ±r/2.
  const middle = -r / 2;

  return new Recipe({ id: 'cicada', title: 'Cicada', sheet: { size: [1, 1], front: '#f6f3ec', back: '#6a9a3a' } })
    .rotate(45, { title: 'Turn it to a diamond', text: 'Start white side up, and turn the square so a corner points towards you.' })
    .onto(paper(-0.5, 0.5), paper(...TR), { title: 'Fold in half', text: 'Fold the bottom corner up to the top corner, making a triangle.' })
    .onto(paper(...TL), table(0, -r), { title: 'Fold the left corner up', text: 'Bring the left corner up to the top point.' })
    .onto(paper(...BR), table(0, -r), { title: 'Fold the right corner up', text: 'Bring the right corner up to match. Now it’s a diamond.' })
    .along(table(-1, middle), table(1, middle), table(0, -r), {
      title: 'Fold the flaps down',
      text: 'Fold the two flaps you just made back down, so their points meet the bottom point.',
      only: (c) => flap(TL)(c) || flap(BR)(c),
    })
    .along(table(0, middle), table(-0.16, -0.04), table(0, -0.01), {
      title: 'Fold out the left wing',
      text: 'Fold the left flap’s point down and out at an angle, from the middle of the top edge.',
      only: flap(TL),
    })
    .along(table(0, middle), table(0.16, -0.04), table(0, -0.01), {
      title: 'Fold out the right wing',
      text: 'Match it with the right flap.',
      only: flap(BR),
    })
    .along(table(-1, -r + 0.13), table(1, -r + 0.13), table(0, -r + 0.01), {
      title: 'Fold the top layer down',
      text: 'Fold the top layer of the top point down, about a fifth of the way.',
      only: upper,
    })
    .along(table(-1, -r + 0.09), table(1, -r + 0.09), table(0, -r + 0.01), {
      title: 'Fold the next layer down',
      text: 'Fold the next layer down too, a little higher, so a band of the first shows below it.',
      only: lower,
    })
    .together({ title: 'Fold the sides behind', text: 'Fold both sides behind, from beside the head down past the wings, so the body narrows. Done!' }, (recipe) => {
      for (const side of [-1, 1]) {
        recipe.along(table(side * 0.17, -r + 0.12), table(side * 0.3, -0.26), table(side, middle), { title: '', kind: 'mountain' });
      }
    })
    .build();
}
