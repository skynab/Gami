import { paper, Recipe, table } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';

/**
 * The jumping frog, from a rectangle twice as long as it is wide (as origami.me/jumping-frog folds it):
 * a waterbomb base at the top makes the head and front legs, another upside down at the bottom the back
 * legs, and a pleat across the body the spring. Press down on its back and let go to make it jump.
 */
/** Whether a point is inside a convex polygon (or on its edge). */
function inside(poly: Vec2[], p: Vec2): boolean {
  const s = poly.map((a, i) => {
    const b = poly[(i + 1) % poly.length];
    return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  });
  return s.every((x) => x >= -1e-9) || s.every((x) => x <= 1e-9);
}

export function jumpingFrog() {
  const w = 0.5;
  const top = -0.5;
  // The top of the card is a w × w square: its diagonals cross at `centre`, and its bottom edge is `base`.
  const base = top + w;
  const centre = top + w / 2;
  const quarter = w / 4;
  // The back legs: an upside-down waterbomb at the bottom of the strip. The strip is `2 * quarter` wide, so
  // the bottom `2 * quarter` of it is a square; `legs` runs across its middle.
  const legs = 0.5 - quarter;

  const r = new Recipe({ id: 'jumping-frog', title: 'Jumping frog', sheet: { size: [w, 1], front: '#f6f3ec', back: '#3f9b4f' } })
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
      .onto(table(w / 2, base), table(0, centre), { title: 'Fold up the other front leg', text: 'Match it on the right.', layers: 2 });
  // Each front leg as pieces of the sheet: the two layers just folded up, over the middle of its half of the head.
  const frontLegs = [-1, 1].map((side) => {
    const spot: Vec2 = [(side * w) / 12, (2 * centre + base) / 3];
    const [a, b] = r.stackAt(spot);
    return r.pieces((c) => [a, b].some((p) => Math.hypot(p[0] - c[0], p[1] - c[1]) < 1e-9));
  });
  r
      .along(table(-quarter, -1), table(-quarter, 1), table(-w / 2 + 0.01, 0.3), {
        title: 'Fold the left side in',
        text: 'Fold the left edge of the card in to the middle. It tucks under the front legs.',
      })
      .along(table(quarter, -1), table(quarter, 1), table(w / 2 - 0.01, 0.3), { title: 'Fold the right side in', text: 'And the right edge.' });

  const beforeLegs = r.mark();
  r      .along(table(-1, legs), table(1, legs), table(0, 0.5), {
        title: 'Fold the bottom up',
        text: 'Fold the bottom edge up, a quarter of the card’s width.',
      })
      // Each crease runs from a top corner of the flap to the middle of its fold.
      .along(table(-quarter, legs - quarter), table(0, legs), table(-quarter + 0.01, legs - 0.01), {
        title: 'Crease a corner',
        text: 'Fold the flap’s bottom left corner up along the line from its top left corner to the middle of the fold, and unfold.',
      })
      .unfold({ title: 'Unfold', text: 'Open it, leaving the crease.' })
      .along(table(quarter, legs - quarter), table(0, legs), table(quarter - 0.01, legs - 0.01), {
        title: 'Crease the other corner',
        text: 'The same on the right.',
      })
      .unfold({ title: 'Unfold', text: 'Open the corner and the bottom flap out again, leaving the creases.', to: beforeLegs });

  // The bottom square collapses like the head, upside down: the fold across its middle and its diagonals (the
  // corner creases, in every layer) make a waterbomb base, the sides folding in and the bottom edge coming up.
  r.collapse(
    {
      title: 'Push the bottom up',
      text: 'Push the sides of the bottom square in along the creases, bringing the bottom edge up to the fold. It collapses into a small triangle, like the head.',
    },
    [
      { through: [table(-1, legs), table(1, legs)], kind: 'mountain' },
      { through: [table(-quarter, 0.5), table(quarter, legs - quarter)], kind: 'valley' },
      { through: [table(quarter, 0.5), table(-quarter, legs - quarter)], kind: 'valley' },
    ],
    paper(0, -0.4),
  );

  // The back legs, like the front ones: the small triangle's top corners fold down to its point.
  const hip = legs - quarter;
  // The legs are the bottom half of the square (on the sheet), which the push brought up on top.
  const flaps = ([, v]: Vec2) => v > legs;
  // The spring: a zig-zag pleat across the middle of the body, between the head and the back legs.
  const fold1 = (base + hip) / 2;
  const fold2 = fold1 - (hip - base) / 4;
  return r
    .onto(table(-quarter, hip), table(0, legs), {
      title: 'Fold down a back leg',
      text: 'Fold the small triangle’s top left corner down to its bottom point.',
      only: flaps,
    })
    .onto(table(quarter, hip), table(0, legs), { title: 'Fold down the other back leg', text: 'Match it on the right.', only: flaps })
    // Each front leg's tip (at the head's point) folds back out, about the leg's inner corner, to point
    // forward at 45°: past the sides of the body, which is narrower than the head now.
    .together({ title: 'Fold the front legs out', text: 'Fold the tip of each front leg out, so it points forwards and outwards.' }, (r) => {
      for (const side of [-1, 1]) {
        const turn = Math.PI / 8;
        const leg = frontLegs[(side + 1) / 2];
        r.along(table(0, base), table(side * Math.sin(turn) * w, base - Math.cos(turn) * w), table(0, centre), {
          title: '',
          only: (c) => leg.some((poly) => inside(poly, c)),
        });
      }
    })
    .along(table(-1, fold1), table(1, fold1), table(0, legs), {
      title: 'Fold the back end up',
      text: 'Fold the back half up across the middle of the body.',
    })
    .along(table(-1, fold2), table(1, fold2), table(0, fold2 - 0.01), {
      title: 'Fold half of it back down',
      text: 'Fold the top part back down again, making a zig-zag pleat. This is the spring.',
      only: ([, v]) => v > fold1,
    })
    .turnOver('Turn the frog over. Press down on its back, slide your finger off, and it jumps!')
    .build();
}
