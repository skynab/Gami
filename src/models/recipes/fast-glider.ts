import { paper, Recipe, table } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';
import { foldWings } from './paper-plane';

/** The doubled front edge's depth: about 2.5 cm (1 inch) on US letter (2.8 cm, so the nose stands out as Fold'N Fly's does). */
export const HEM = 0.1;
/** The body under the wings: about 3.2 cm (1 1/4 inch). */
export const BODY = 0.115;

/**
 * The fast glider, a plane with its wings and tailplane apart, after Fold'N Fly's Fast Glider (design #48): the corners
 * folded to the middle, the point down to their bottom and the new top's corners folded in, pointed again; the point folded right down and back
 * up, leaving a doubled front edge with the nose standing out of it; folded in half, then a notch cut out of the back
 * through every layer, so the back is narrower than the front: folding the wings out makes a main wing, a narrow
 * waist and a smaller tailplane. From US letter paper held upright (8.5 : 11).
 */
export function fastGlider() {
  // US letter is 8.5 : 11; 0.77 : 1 is near enough, and exact in a .fold file.
  const w = 0.77;
  const h = 1;
  const [l, r, top, bottom] = [-w / 2, w / 2, -h / 2, h / 2];
  const corner = top + w / 2;
  // The point folded down to the corners' bottom: its fold, halfway.
  const blunt = (top + corner) / 2;
  // The flat top's corners folded in: its halves turn down onto the middle, on 45° lines from its middle.
  const half = (corner - top) / 2;

  const plane = new Recipe({ id: 'fast-glider', title: 'Fast glider', card: 'angled', sheet: { size: [w, h], front: '#d94a4a', back: '#f6f3ec' } })
    .crease(paper(l, 0), paper(r, 0), { title: 'Fold in half lengthwise', text: 'Bring the left edge over to the right edge and crease down the middle.' })
    .onto(paper(l, top), table(0, corner), { title: 'Fold the top-left corner to the middle', text: 'Line the top edge up with the centre crease.' })
    .onto(paper(r, top), table(0, corner), { title: 'Fold the top-right corner to the middle', text: 'The two corners meet on the centre crease, making a point at the top.' })
    .onto(table(0, top), table(0, corner), { title: 'Fold the point down', text: 'Fold the point down to the bottom of the corner flaps, leaving a flat top.' })
    .onto(table(-half, blunt), table(0, blunt + half), { title: 'Fold the top left in', text: 'Fold the left half of the flat top down onto the centre crease, on a line from the middle of the top.' })
    .onto(table(half, blunt), table(0, blunt + half), { title: 'Fold the top right in', text: 'Match it on the right. The top comes to a point again.' });
  // The point down to the bottom edge, then back up, so a strip `HEM` deep stays doubled along the new top edge.
  const nose = Math.min(...plane.current.vertices_coords.map((p) => p[2]));
  const front = (nose + bottom) / 2;
  const point = plane.lying(([, z]) => z < front);
  plane
    .onto(table(0, nose), table(0, bottom), { title: 'Fold the point down to the bottom', text: 'Fold the whole point down so its tip meets the bottom edge.' })
    .along(table(-1, front + HEM), table(1, front + HEM), table(0, bottom), {
      title: 'Fold the point back up',
      text: 'Fold the point back up along a line about 2.5 cm (1 inch) below the top edge, so it sticks up above it.',
      only: point,
    });
  // Each half of the plane, before it folds in half.
  const right = plane.lying(([x]) => x > 0);
  const left = (c: Vec2) => !right(c);
  plane.along(table(0, -1), table(0, 1), table(-0.1, 0), {
    title: 'Fold in half behind',
    text: 'Mountain-fold along the centre crease, so the folds stay on the outside.',
    kind: 'mountain',
  });
  // Folded in half: the keel at x = 0, the open edges `H` out, the front edge at `front`. The notch: in from the
  // open edges to 0.43 H, a little under halfway back; out on a slant to 0.71 H; then straight to the back.
  const H = w / 2;
  const L = bottom - front;
  const a: Vec2 = [0.43 * H, front + 0.43 * L];
  const c: Vec2 = [0.71 * H, front + 0.69 * L];
  const cutText = (text: string) => ({ title: 'Cut out the notch', text });
  plane
    .cut(table(H + 0.01, a[1]), table(...a), cutText('With scissors, cut through all the layers straight in from the open edges, a little under halfway back, to under halfway to the fold.'))
    .cut(table(...a), table(...c), cutText('Then cut on a slant towards the back and out a little.'))
    .cut(table(...c), table(c[0], bottom + 0.01), {
      ...cutText('Then cut straight back to the back edge, and throw the corner away. The back is now narrower than the front.'),
      away: table(0.9 * H, bottom - 0.02),
    })
    .rotate(90, { title: 'Turn it on its side', text: 'Point the nose to the left, with the long folded edge at the bottom.' });
  return foldWings(plane, BODY, 'Fold the wing down along a line about 3.2 cm (1 1/4 inch) above the bottom. The tailplane folds down with it.', right, left, {
    flyText: 'Turn the plane over, so it stands on its keel with the main wing in front and the tailplane behind. Give it a smooth throw and it glides a long way.',
  });
}
