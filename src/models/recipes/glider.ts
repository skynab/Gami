import { paper, Recipe, table } from '../../fold/recipe';
import { finishPlane } from './paper-plane';

/**
 * A glider, the traditional flat-nosed plane: the dart's first corner folds, then the point folded down into a
 * blunt nose, with broad wings for slow, long glides. From a sheet shaped like A4 (1 : 1.41).
 */
export function glider() {
  const w = 0.7;
  const h = 1;
  const [l, r, top] = [-w / 2, w / 2, -h / 2];
  // A top corner folded to the centre line lands this far down from the top edge.
  const corner = top + w / 2;

  const plane = new Recipe({
    id: 'glider',
    title: 'Glider',
    sheet: { size: [w, h], front: '#f6f3ec', back: '#3e8ed0' },
  })
    .crease(paper(l, 0), paper(r, 0), {
      title: 'Fold in half lengthwise',
      text: 'Bring the left edge over to the right edge and crease down the middle.',
    })
    .onto(paper(l, top), table(0, corner), {
      title: 'Fold the top-left corner to the middle',
      text: 'Line the top edge up with the centre crease.',
    })
    .onto(paper(r, top), table(0, corner), {
      title: 'Fold the top-right corner to the middle',
      text: 'The two corners meet on the centre crease, making a point at the top.',
    })
    .onto(paper(0, top), table(0, corner), {
      title: 'Fold the point down',
      text: 'Fold the point down to where the corners meet, making a flat nose.',
    });
  return finishPlane(plane, 0.08, 'Fold the top layers down along a line close to the bottom, making a broad wing.');
}
