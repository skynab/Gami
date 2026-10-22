import { paper, Recipe, table } from '../../fold/recipe';
import { finishPlane } from './paper-plane';

/**
 * The navy plane, a jet-shaped dart for speed: the dart's nose folded down and folded again into a wide
 * triangle, the back corners tucked in behind to the middle, and the sides folded in to a slim delta wing. From
 * a sheet of US letter paper, held sideways (11 : 8.5).
 */
export function navyPlane() {
  const w = 1;
  // US letter is 11 : 8.5; 1 : 0.77 is near enough, and exact in a .fold file.
  const h = 0.77;
  const [l, r, top, bottom] = [-w / 2, w / 2, -h / 2, h / 2];
  // A top corner folded to the centre line lands this far down from the top edge.
  const corner = top + w / 2;
  // The point folded down to there leaves a flat top this far down.
  const flat = (top + corner) / 2;

  const plane = new Recipe({
    id: 'navy-plane',
    title: 'Navy plane',
    sheet: { size: [w, h], front: '#f6f3ec', back: '#3d5a80' },
  })
    .crease(paper(l, 0), paper(r, 0), {
      title: 'Fold in half',
      text: 'With the paper sideways, bring the left edge over to the right edge and crease down the middle.',
    })
    .onto(paper(l, top), table(0, corner), {
      title: 'Fold the top-left corner to the middle',
      text: 'Line the top edge up with the centre crease.',
    })
    .onto(paper(r, top), table(0, corner), {
      title: 'Fold the top-right corner to the middle',
      text: 'The corners meet on the centre crease in a wide point.',
    })
    .onto(paper(0, top), table(0, corner), {
      title: 'Fold the point down',
      text: 'Bring the point down to the bottom of the triangle, leaving a flat top. (On A4 paper, fold it only halfway down.)',
    })
    .along(table(0, flat), table(1, flat + 1), table(w / 3, flat + 0.05), {
      title: 'Fold the right corner down',
      text: 'Fold from the middle of the top edge, so the right half of the top lies along the centre crease.',
    })
    .along(table(0, flat), table(-1, flat + 1), table(-w / 3, flat + 0.05), {
      title: 'Fold the left corner down',
      text: 'Match the right side. The plane is now a wide triangle.',
    })
    .turnOver()
    .along(table(w / 4, -1), table(w / 4, 1), table((3 * w) / 8, bottom - 0.02), {
      title: 'Fold the right corner in',
      text: 'Fold straight up and down, halfway between the middle and the right corner, so the corner meets the middle of the bottom edge.',
    })
    .along(table(-w / 4, -1), table(-w / 4, 1), table((-3 * w) / 8, bottom - 0.02), {
      title: 'Fold the left corner in',
      text: 'Match the right side. The two corners meet at the middle.',
    })
    .along(table(0, flat), table(w / 4, bottom), table(w / 4 - 0.01, flat + 0.15), {
      title: 'Fold the right side in',
      text: 'Fold from the nose down to the bottom right corner, making the right edge one straight line.',
    })
    .along(table(0, flat), table(-w / 4, bottom), table(-w / 4 + 0.01, flat + 0.15), {
      title: 'Fold the left side in',
      text: 'Match the right side, for a slim triangle.',
    });
  return finishPlane(plane, 0.05, 'Fold the top layers down along a line close to the bottom, for a narrow body and wide wings.');
}
