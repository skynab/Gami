import { paper, Recipe, table } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';
import { halves } from './face';

/**
 * A frog's head that slips over the corner of a page, Gami's own: the common corner bookmark, its two side flaps
 * folded up to the top, then their points folded out past the sides for eyes.
 */
export function frogBookmark() {
  // Turned to a diamond, the sheet's corners sit this far from the centre:
  // TL on the left, TR at the top, BR on the right, BL at the bottom.
  const h = Math.SQRT1_2;
  const TL: Vec2 = [-0.5, -0.5];
  const TR: Vec2 = [0.5, -0.5];
  const BR: Vec2 = [0.5, 0.5];
  const BL: Vec2 = [-0.5, 0.5];
  // Where each eye's point goes: out past the side of the head, a little above halfway up it.
  const eye: Vec2 = [0.27, -0.5];
  const r = new Recipe({ id: 'frog-bookmark', title: 'Frog bookmark', sheet: { size: [1, 1], front: '#3f8f3a', back: '#8fd16a' } })
    .rotate(45, { title: 'Start as a diamond', text: 'Start dark side up, with a corner pointing towards you.' })
    .onto(paper(...BL), paper(...TR), { title: 'Fold in half', text: 'Fold the bottom corner up to the top corner, making a triangle.' })
    .onto(paper(...BL), table(0, 0), {
      title: 'Fold the top layer down',
      text: 'Fold the top layer’s point down to the middle of the bottom edge. This makes the pocket.',
      layers: 1,
    });
  // The side flaps, by which side of the middle they lie on now.
  const left = r.lying(([x]) => x < -0.001);
  const right = r.lying(([x]) => x > 0.001);
  r.onto(paper(...TL), table(0, -h), { title: 'Fold the left corner up', text: 'Fold the left corner up to the top point.' })
    .onto(paper(...BR), table(0, -h), { title: 'Fold the right corner up', text: 'Fold the right corner up to match: a square.' })
    .onto(paper(...TL), table(-eye[0], eye[1]), {
      title: 'Fold out an eye',
      text: 'Fold the left flap’s point down and out, so it sticks out past the side of the head.',
      only: left,
    })
    .onto(paper(...BR), table(...eye), { title: 'Fold out the other eye', text: 'Fold the right flap’s point out to match.', only: right });
  // A pupil near each eye's point, two nostrils and a wide smile, drawn in halves where the flaps meet.
  const dot = (x: number, z: number, rad: number): Vec2[] =>
    Array.from({ length: 10 }, (_, i) => [x + rad * Math.cos((i / 10) * 2 * Math.PI), z + rad * Math.sin((i / 10) * 2 * Math.PI)]);
  const smile = Array.from({ length: 9 }, (_, i): Vec2 => {
    const x = -0.15 + (0.3 * i) / 8;
    return [x, -0.13 - 0.06 * (x / 0.15) ** 2];
  });
  return r
    .draw({ title: 'Draw a face', text: 'Draw on pupils, nostrils and a big smile. Slip the pocket over the corner of a page.' }, [
      { fill: dot(-eye[0] + 0.08, eye[1] - 0.01, 0.022) },
      { fill: dot(eye[0] - 0.08, eye[1] - 0.01, 0.022) },
      { fill: dot(-0.04, -0.3, 0.012) },
      { fill: dot(0.04, -0.3, 0.012) },
      ...halves(smile, 0).map((line) => ({ line })),
    ])
    .build();
}
