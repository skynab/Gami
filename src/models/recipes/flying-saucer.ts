import { paper, Recipe, table } from '../../fold/recipe';
import { finishPlane } from './paper-plane';

/**
 * The flying saucer, Gami's own floater: the top folded down to the middle for a thick, blunt front edge, its
 * corners turned in, and the back corners folded behind and rounded off, so from above it's nearly round. A
 * short body and broad wings let it float slowly round in wide circles. After the look of Fold'N Fly's UFO,
 * folded differently and without scissors. From a sheet of US letter paper, held upright (8.5 : 11).
 */
export function flyingSaucer() {
  // US letter is 8.5 : 11; 0.77 : 1 is near enough, and exact in a .fold file.
  const w = 0.77;
  const h = 1;
  const [l, r, top, bottom] = [-w / 2, w / 2, -h / 2, h / 2];
  // The top edge folds down to the middle, so the front edge is a quarter of the way down.
  const front = top / 2;
  // How far along the edges each corner fold starts: the front ones, the back ones, and the small folds that
  // round off the back ones' new corners.
  const [nose, tail, round] = [0.1, 0.2, 0.06];
  const slant = round / Math.SQRT2;

  const plane = new Recipe({
    id: 'flying-saucer',
    title: 'Flying saucer',
    sheet: { size: [w, h], front: '#f6f3ec', back: '#4d908e' },
  })
    .crease(paper(l, 0), paper(r, 0), {
      title: 'Fold in half lengthwise',
      text: 'Bring the left edge over to the right edge and crease down the middle.',
    })
    .onto(paper(0, top), table(0, 0), {
      title: 'Fold the top down to the middle',
      text: 'Fold the top edge down so it lies across the middle of the sheet.',
    });
  for (const s of [-1, 1]) {
    plane.along(table(s * (r - nose), front), table(s * r, front + nose), table(s * (r - 0.01), front + 0.01), {
      title: s < 0 ? 'Fold the top-left corner in' : 'Fold the top-right corner in',
      text: s < 0 ? 'Fold a small triangle off the top-left corner, through both layers.' : 'And the same at the top right.',
    });
  }
  for (const s of [-1, 1]) {
    plane.along(table(s * (r - tail), bottom), table(s * r, bottom - tail), table(s * (r - 0.01), bottom - 0.01), {
      title: s < 0 ? 'Fold the bottom-left corner behind' : 'Fold the bottom-right corner behind',
      text: s < 0 ? 'Fold a bigger triangle off the bottom-left corner, behind.' : 'And the same at the bottom right.',
      kind: 'mountain',
    });
  }
  // Each back corner fold leaves two blunt corners; a small fold behind takes each off, rounding the back.
  for (const s of [-1, 1]) {
    plane.together(
      {
        title: s < 0 ? 'Round off the bottom left' : 'Round off the bottom right',
        text: s < 0 ? 'Fold the two blunt corners at the bottom left behind, just a little, to round the back.' : 'And the two at the bottom right.',
      },
      (p) =>
        p
          .along(table(s * r, bottom - tail - round), table(s * (r - slant), bottom - tail + slant), table(s * (r - 0.005), bottom - tail), {
            title: 'Round off the side corner',
            kind: 'mountain',
          })
          .along(table(s * (r - tail - round), bottom), table(s * (r - tail + slant), bottom - slant), table(s * (r - tail), bottom - 0.005), {
            title: 'Round off the bottom corner',
            kind: 'mountain',
          }),
    );
  }
  return finishPlane(plane, 0.06, 'Fold the top layers down along a line close to the bottom, for a short body and broad wings.', {
    flyText: 'Turn the plane over, so it stands on its keel with its wings level on top. Throw it gently: it floats round in wide circles.',
  });
}
