import { paper, Recipe, table } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';

/**
 * A heart that slips over the corner of a page, Gami's own: the common corner bookmark with its top point folded
 * away behind, so the side flaps' points stand up above it as the heart's two humps.
 */
export function heartBookmark() {
  // Turned to a diamond, the sheet's corners sit this far from the centre:
  // TL on the left, TR at the top, BR on the right, BL at the bottom.
  const h = Math.SQRT1_2;
  const TL: Vec2 = [-0.5, -0.5];
  const TR: Vec2 = [0.5, -0.5];
  const BR: Vec2 = [0.5, 0.5];
  const BL: Vec2 = [-0.5, 0.5];
  // The back layer's point folds behind level with the heart's notch; each hump is a flap's point folded down
  // on a line from the notch out to `hump`.
  const notch = -0.5;
  const hump: Vec2 = [0.15, -0.6];
  // Then the humps' tips and the side corners fold behind, a little, to round the heart.
  const blunt = -0.56;
  const side = h / 2 - 0.035;
  const r = new Recipe({ id: 'heart-bookmark', title: 'Heart bookmark', sheet: { size: [1, 1], front: '#f6f3ec', back: '#e5484d' } })
    .rotate(45, { title: 'Start as a diamond', text: 'Start white side up, with a corner pointing towards you.' })
    .onto(paper(...BL), paper(...TR), { title: 'Fold in half', text: 'Fold the bottom corner up to the top corner, making a triangle.' })
    .onto(paper(...BL), table(0, 0), {
      title: 'Fold the top layer down',
      text: 'Fold the top layer’s point down to the middle of the bottom edge. This makes the pocket.',
      layers: 1,
    })
    .along(table(-1, notch), table(1, notch), table(0, -h), {
      title: 'Fold the top point behind',
      text: 'Fold the top point behind, a little over a quarter of the way down.',
      kind: 'mountain',
    });
  // The side flaps, by which side of the middle they lie on now.
  const left = r.lying(([x]) => x < -0.001);
  const right = r.lying(([x]) => x > 0.001);
  return r
    .onto(paper(...TL), table(0, -h), { title: 'Fold the left corner up', text: 'Fold the left corner up to where the top point was.' })
    .onto(paper(...BR), table(0, -h), { title: 'Fold the right corner up', text: 'Fold the right corner up to match.' })
    .along(table(0, notch), table(-hump[0], hump[1]), table(0, -h), {
      title: 'Fold down a hump',
      text: 'Fold the left flap’s point down in front, from the middle out to the edge, making a notch.',
      only: left,
    })
    .along(table(0, notch), table(...hump), table(0, -h), { title: 'Fold down the other hump', text: 'Fold the right flap’s point down to match.', only: right })
    .along(table(-1, blunt), table(1, blunt), table(-0.1, -h), {
      title: 'Round the humps',
      text: 'Fold the tips of both humps behind, just a little.',
      kind: 'mountain',
    })
    .along(table(-side, -1), table(-side, 1), table(-h / 2, -h / 2), {
      title: 'Round the left side',
      text: 'Fold the left corner behind, just a little.',
      kind: 'mountain',
    })
    .along(table(side, -1), table(side, 1), table(h / 2, -h / 2), {
      title: 'Round the right side',
      text: 'And the right corner. Slip the pocket over the corner of a page.',
      kind: 'mountain',
    })
    .build();
}
