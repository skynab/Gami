import { locate, paper, Recipe, table } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';

/**
 * The water bomb base and the water bomb's tucked side, shared by the water bomb and the balloon rabbit.
 *
 * The base, point up: its point T at (0, −½), its bottom edge along z = 0 from −½ to ½.
 */
export function waterbombBase(r: Recipe): Recipe {
  return r
    .crease(paper(-0.5, 0), paper(0.5, 0), { title: 'Fold in half', text: 'Colour side up. Fold in half, then unfold.' })
    .crease(paper(0, -0.5), paper(0, 0.5), { title: 'Fold in half the other way', text: 'And the other way. Then turn the paper over.' })
    .crease(paper(-0.5, -0.5), paper(0.5, 0.5), { title: 'Fold in half diagonally', text: 'Corner to corner, then unfold.' })
    .crease(paper(0.5, -0.5), paper(-0.5, 0.5), { title: 'Fold the other diagonal', text: 'Eight creases from the centre.' })
    .collapse(
      {
        title: 'Collapse into a waterbomb base',
        text: 'Push the left and right edges in and down, so the paper folds into a triangle with two flaps on each side.',
      },
      [
        { through: [table(-1, -1), table(1, 1)], kind: 'mountain' },
        { through: [table(-1, 1), table(1, -1)], kind: 'mountain' },
        { through: [table(-1, 0), table(1, 0)], kind: 'valley' },
      ],
      paper(0, -0.3),
    )
    .rotate(180, { title: 'Point up', text: 'Turn the triangle so its point is at the top.' });
}

export const T = table(0, -0.5);

/** Which faces a step moved: compares where the sheet's points were before and after it. */
export function moved(r: Recipe, make: () => void): (c: Vec2) => boolean {
  const before = r.current;
  make();
  const after = r.current;
  return (c: Vec2) => dist(locate(before, c), locate(after, c)) > 1e-6;
}

/** Folds the bottom corners of the top flaps up to T. Returns the paper each corner's fold moved. */
export function cornersUp(r: Recipe): Record<number, (c: Vec2) => boolean> {
  const corner: Record<number, (c: Vec2) => boolean> = {};
  for (const s of [-1, 1]) {
    corner[s] = moved(r, () =>
      r.onto(table(s * 0.5, 0), T, {
        title: s < 0 ? 'Fold the left corner up' : 'Fold the right corner up',
        text: s < 0 ? 'Fold the bottom left corner of the top flap up to the top point.' : 'And the bottom right corner. It’s a diamond.',
        layers: 2,
      }),
    );
  }
  return corner;
}

/**
 * The water bomb's side: corners up, corners in, points down and tucked away. `last` is the text of the final
 * tuck, when this side finishes the model.
 */
export function tuckedSide(r: Recipe, last?: string) {
  const corner = cornersUp(r);
  const flap: Record<number, (c: Vec2) => boolean> = {};
  for (const s of [-1, 1]) {
    flap[s] = moved(r, () =>
      r.along(table(s * 0.125, -1), table(s * 0.125, 1), table(s * 0.25, -0.25), {
        title: s < 0 ? 'Fold the left corner in' : 'Fold the right corner in',
        text: s < 0 ? 'Fold the diamond’s left corner in to the middle.' : 'And the right corner.',
        layers: 4,
      }),
    );
  }
  // The loose top points (the corners folded up first) fold down and out, along the side flaps' top edges.
  for (const s of [-1, 1]) {
    r.along(table(s * 0.125, -0.375), table(0, -0.25), T, {
      title: s < 0 ? 'Fold the left point down' : 'Fold the right point down',
      text: s < 0 ? 'Fold the loose point at the top left down and out.' : 'And the one at the top right.',
      only: corner[s],
    });
  }
  // Each point's tip, past the side flap's edge, tucks into the pocket in that flap.
  for (const s of [-1, 1]) {
    r.collapse(
      {
        title: s < 0 ? 'Tuck in the left point' : 'Tuck in the right point',
        text: last && s > 0 ? last : s < 0 ? 'Tuck the point into the pocket of the flap below it.' : 'And the right point.',
        kind: 'fold',
      },
      [{ through: [table(s * 0.125, -1), table(s * 0.125, 1)], kind: 'mountain', only: corner[s] }],
      paper(0, 0.3),
      (c) => flap[s](c) && !corner[s](c),
    );
  }
}

function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}
