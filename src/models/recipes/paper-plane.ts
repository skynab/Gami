import { paper, Recipe, table } from '../../fold/recipe';

/** The classic dart, from a sheet shaped like A4 (1 : 1.41). */
export function paperPlane() {
  const w = 0.7;
  const h = 1;
  const [l, r, top] = [-w / 2, w / 2, -h / 2];
  // A top corner folded to the centre line lands this far down from the top edge.
  const corner = top + w / 2;
  // The slanted edge from the first folds, swung onto the centre line, reaches this far down.
  const edge = top + Math.hypot(w / 2, w / 2);

  const plane = new Recipe({
    id: 'paper-plane',
    title: 'Paper plane',
    sheet: { size: [w, h], front: '#e8553f', back: '#f6f3ec' },
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
    .along(table(0, -1), table(0, 1), table(-0.1, 0), {
      title: 'Fold in half behind',
      text: 'Mountain-fold along the centre crease, so the folds stay on the outside.',
      kind: 'mountain',
    })
    .rotate(90, { title: 'Turn it on its side', text: 'Point the nose to the left, with the long folded edge at the bottom.' });

  // On its side, the centre crease runs along the bottom. Each wing folds down along a line parallel to it.
  const keel = Math.max(...plane.current.vertices_coords.map((p) => p[2]));
  const wingLine = keel - 0.13;
  return plane
    .along(table(-1, wingLine), table(1, wingLine), table(0, wingLine - 0.1), {
      title: 'Fold the wing down',
      text: 'Fold the top layers down so the wing’s edge meets the bottom of the plane.',
      only: ([u]) => u > 0,
    })
    .turnOver()
    .along(table(-1, wingLine), table(1, wingLine), table(0, wingLine - 0.1), {
      title: 'Fold the other wing to match',
      text: 'Line it up with the first wing. Open both wings out flat, and it’s ready to fly.',
      only: ([u]) => u < 0,
    })
    .build();
}
