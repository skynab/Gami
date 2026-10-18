import { locate, paper, Recipe, table, type At } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';

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
  const fold: [At, At] = [table(-1, wingLine), table(1, wingLine)];
  // Each wing: the part of its half of the sheet beyond the line, before it folds down.
  const wingOf = (half: (c: Vec2) => boolean) => {
    const before = plane.current;
    return (c: Vec2) => half(c) && locate(before, c)[1] < wingLine;
  };
  const firstWing = wingOf(([u]) => u > 0);
  plane.along(...fold, table(0, wingLine - 0.1), {
    title: 'Fold the wing down',
    text: 'Fold the top layers down so the wing’s edge meets the bottom of the plane.',
    only: ([u]) => u > 0,
  });
  plane.turnOver();
  const secondWing = wingOf(([u]) => u < 0);
  return plane
    .along(...fold, table(0, wingLine - 0.1), {
      title: 'Fold the other wing to match',
      text: 'Line it up with the first wing.',
      only: ([u]) => u < 0,
    })
    // The first wing, underneath, stays on the table; the body stands up off it, and the other wing swings
    // right over to lie out flat on the far side: the plane upside down, its keel pointing up.
    .shape({ title: 'Open the wings', text: 'Open both wings out flat on either side of the body, at right angles to it.' }, [
      { through: fold, moving: table(0, keel), degrees: 90, only: (c) => !firstWing(c) },
      { through: fold, moving: table(0, keel), degrees: 90, only: secondWing },
    ])
    .turnOver('Turn the plane over, so it stands on its keel with its wings level on top. It’s ready to fly!')
    .build();
}
