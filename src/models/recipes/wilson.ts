import { paper, Recipe, table } from '../../fold/recipe';
import { finishPlane } from './paper-plane';

/** How far the flaps fold back out, in degrees from the middle: their edges end up twice as far out. */
export const FLARE = 9;

/**
 * The Wilson, a skinny dart whose wings flare out at the back, after Fold'N Fly's Wilson (design #53): the corners and
 * then the edges folded to the middle twice, so the point is long and narrow, then each top flap folded back out along
 * a line a little off the middle, from the nose to the back, so its edge fans out behind. Folded in half, with a body
 * about 1 cm deep. From US letter paper held upright (8.5 : 11).
 */
export function wilson() {
  // US letter is 8.5 : 11; 0.77 : 1 is near enough, and exact in a .fold file.
  const w = 0.77;
  const h = 1;
  const [l, r, top, bottom] = [-w / 2, w / 2, -h / 2, h / 2];
  const t = (deg: number) => Math.tan((deg * Math.PI) / 180);
  // Each pair of folds halves the angle the outer edges make with the middle at the nose: 45°, 22.5°, 11.25°.
  const corner = top + w / 2;
  const second = top + (w / 2) / t(22.5);
  // The third folds' lines run from the nose to the bottom edge, 11.25° off the middle.
  const third = h * t(11.25);

  const plane = new Recipe({ id: 'wilson', title: 'Wilson', sheet: { size: [w, h], front: '#4a90d9', back: '#f6f3ec' } })
    .crease(paper(l, 0), paper(r, 0), { title: 'Fold in half lengthwise', text: 'Bring the left edge over to the right edge and crease down the middle.' })
    .onto(paper(l, top), table(0, corner), { title: 'Fold the top-left corner to the middle', text: 'Line the top edge up with the centre crease.' })
    .onto(paper(r, top), table(0, corner), { title: 'Fold the top-right corner to the middle', text: 'The two corners meet on the centre crease, making a point at the top.' })
    .onto(table(l, corner), table(0, top + Math.hypot(w / 2, w / 2)), { title: 'Fold the left edge to the middle', text: 'Bring the slanted left edge in to the centre crease, making the point sharper.' })
    .onto(table(r, corner), table(0, top + Math.hypot(w / 2, w / 2)), { title: 'Fold the right edge to the middle', text: 'Match the left side. The edges meet along the centre.' });
  // The flaps the third folds make: all the paper outside their lines.
  const outerL = plane.lying(([x, z]) => x < -((z - top) * third) / h);
  const outerR = plane.lying(([x, z]) => x > ((z - top) * third) / h);
  plane
    .onto(table(l, second), table(0, top + Math.hypot(w / 2, second - top)), {
      title: 'Fold the left edge in again',
      text: 'Once more, fold the left edge in to the centre crease. The point gets long and narrow.',
    })
    .onto(table(r, second), table(0, top + Math.hypot(w / 2, second - top)), { title: 'Fold the right edge in again', text: 'And the right edge, to match.' });
  // Each flap back out along a line from the nose, `FLARE` off the middle.
  const out = h * t(FLARE);
  plane
    .along(table(0, top), table(out, bottom), table(0.001, bottom), {
      title: 'Fold the right flap out',
      text: 'Fold the right flap back out along a line from the nose to the back, a little way out from the middle. Its edge fans out at the back.',
      only: outerR,
    })
    .along(table(0, top), table(-out, bottom), table(-0.001, bottom), { title: 'Fold the left flap out', text: 'Fold the left flap out the same way.', only: outerL });
  return finishPlane(plane, 0.036, 'Fold the wing down along a line about 1 cm (3/8 inch) above the bottom, from the nose to the back.', {
    flyText: 'Turn the plane over so it stands on its keel. A staple in the body, near the middle, keeps it shut. It flies fast, and may twist as it goes: bend the backs of the wings a little to steady it.',
  });
}
