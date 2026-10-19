import { paper, Recipe, table } from '../../fold/recipe';
import { finishPlane } from './paper-plane';

/**
 * The bulldog dart, a traditional variation on the dart: its sharp point folded back behind into a stubby
 * nose that stands up to crash landings. From a sheet shaped like A4 (1 : 1.41).
 */
export function bulldogDart() {
  const w = 0.7;
  const h = 1;
  const [l, r, top] = [-w / 2, w / 2, -h / 2];
  // A top corner folded to the centre line lands this far down from the top edge.
  const corner = top + w / 2;
  // The slanted edge from the first folds, swung onto the centre line, reaches this far down.
  const edge = top + Math.hypot(w / 2, w / 2);
  // How much of the point folds back.
  const nose = 0.2;

  const plane = new Recipe({
    id: 'bulldog-dart',
    title: 'Bulldog dart',
    sheet: { size: [w, h], front: '#f6f3ec', back: '#6b6f7a' },
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
    .onto(paper(l, corner), table(0, edge), {
      title: 'Fold the left edge to the middle',
      text: 'Bring the slanted left edge in to the centre crease, making the point sharper.',
    })
    .onto(paper(r, corner), table(0, edge), {
      title: 'Fold the right edge to the middle',
      text: 'Match the left side. The edges meet along the centre.',
    })
    .along(table(-1, top + nose), table(1, top + nose), table(0, top), {
      title: 'Fold the point behind',
      text: 'Fold the sharp point back behind the plane, making a stubby nose.',
      kind: 'mountain',
    });
  return finishPlane(plane, 0.13, 'Fold the top layers down so the wing’s edge meets the bottom of the plane.');
}
