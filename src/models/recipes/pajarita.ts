import type { CreaseKind } from '../../fold/collapse';
import { toFlat, unplaceLike } from '../../fold/fold';
import { locate, paper, Recipe, table, type At } from '../../fold/recipe';
import { inside } from '../../fold/select';
import type { Vec2 } from '../../fold/types';
import { moved } from './waterbomb-base';
import { cornerCreases, type Crease } from './windmill';

/**
 * The pajarita, the traditional little bird of Spain, following the order of folds at origami.me/pajarita: a
 * square with its corners folded to the middle, turned over and creased the same way again, then opened right out;
 * then, like the windmill base on the whole sheet (see ./windmill), its sides swivelled out one corner at a time,
 * one corner folded behind, and the coloured square folded over for the head.
 */
export function pajarita() {
  const r = new Recipe({ id: 'pajarita', title: 'Pajarita (little bird)', sheet: { size: [1, 1], front: '#f6f3ec', back: '#e8a33d' } })
    .crease(paper(-0.5, -0.5), paper(0.5, 0.5), { title: 'Fold in half diagonally', text: 'White side up, fold corner to corner, and unfold.' })
    .crease(paper(0.5, -0.5), paper(-0.5, 0.5), { title: 'Fold the other diagonal', text: 'And the other way, and unfold.' });
  const corners: ((c: Vec2) => boolean)[] = [];
  for (const [u, v, title, text] of [
    [-0.5, 0.5, 'Fold a corner to the middle', 'Fold the bottom left corner to the middle, where the creases cross.'],
    [0.5, 0.5, 'Fold the next corner in', 'And the bottom right corner.'],
    [0.5, -0.5, 'Fold the next corner in', 'And the top right corner.'],
    [-0.5, -0.5, 'Fold the last corner in', 'And the top left corner. It’s a smaller square.'],
  ] as const) {
    corners.push(moved(r, () => r.onto(paper(u, v), paper(0, 0), { title, text })));
  }
  r.turnOver('Turn it over.');
  // The smaller square, as a diamond: its corners at the sheet's edge middles, ±h along the table's axes.
  const h = 0.5;
  const creased = r.mark();
  r.together({ title: 'Fold the corners to the middle', text: 'Fold each corner of the square to the middle.' }, (q) => {
    for (const [x, z] of [
      [0, h],
      [h, 0],
      [0, -h],
      [-h, 0],
    ] as const) {
      q.onto(table(x, z), table(0, 0), { title: 'Fold' });
    }
  }).unfold({ title: 'Unfold', text: 'Unfold them again, leaving the creases.', to: creased });
  // The four corners underneath open back out: the whole sheet again, coloured side up, creased all over.
  r.together({ title: 'Open the corners', text: 'Unfold the four corners from underneath, so the whole sheet lies open, coloured side up.' }, (q) => {
    [[-0.5, 0.5], [0.5, 0.5], [0.5, -0.5], [-0.5, -0.5]].forEach(([u, v], i) => {
      // Each corner's flap swings back out over its hinge, between the middles of the edges either side of it.
      q.along(paper(u, 0), paper(0, v), paper(u * 0.8, v * 0.8), { title: 'Open', only: corners[i] });
    });
  });
  // From here it's folded like the windmill base on the whole sheet, one corner at a time (see ./windmill). Its
  // creases are given by where they lie on the sheet as it is now (turned over, so not where they are on the sheet
  // itself): `toWindmill` and `fromWindmill` go between the two.
  const square = r.current;
  const toWindmill = (c: Vec2): Vec2 => locate(square, c);
  const fromWindmill = (spot: Vec2): At => {
    const face = toFlat(square).find((f) => inside(f.world, spot))!;
    return paper(...unplaceLike(face)(spot));
  };
  const onSquare = (c: Crease) => ({
    through: c.through.map(fromWindmill) as [At, At],
    kind: c.kind,
    only: (p: Vec2) => c.only(toWindmill(p)),
  });
  const plain = (through: [Vec2, Vec2], kind: CreaseKind, only: (c: Vec2) => boolean) => onSquare({ through, kind, only });

  r.onto(table(0.5, 0), table(0, 0), { title: 'Fold the right edge to the middle', text: 'Fold the right edge in to the middle crease.' });
  r.collapse(
    {
      title: 'Swivel the bottom right',
      text: 'Lift the bottom of the folded flap and swing its corner out to the right, as the bottom edge folds up to the middle crease. Flatten it into a triangle.',
    },
    [
      ...cornerCreases(1, 1, 'side').map(onSquare),
      // On the left, where nothing is folded in yet, the bottom edge just folds up.
      plain([[-0.5, 0.25], [0, 0.25]], 'valley', ([u]) => u < 1e-9),
    ],
    fromWindmill([-0.1, -0.1]),
  );
  r.along(table(-0.5, 0), table(0, -0.5), table(-0.45, -0.45), {
    title: 'Fold the top left corner behind',
    text: 'Mountain-fold the top left corner behind, along the crease from the middle of the left edge to the middle of the top.',
    kind: 'mountain',
  });
  // The bottom left: the left quarter folds in over the middle while the band's left end (folded up already, unlike
  // the windmill's order) opens out under it and pinches into a point, down past the bottom: the windmill's corner
  // pulled out along the sheet, its creases given here on the table as they lie now.
  const T = table;
  const eps = 1e-9;
  const at = (test: (w: Vec2) => boolean) => (c: Vec2) => test(toWindmill(c));
  r.collapse(
    {
      title: 'Swivel the bottom left',
      text: 'Fold the left edge in to the middle crease, letting the bottom left corner swing down into a point below the bottom edge. Flatten it.',
    },
    [
      { through: [T(-0.25, -1), T(-0.25, 1)], kind: 'valley', only: at(([, v]) => v < 0.25 + eps) },
      { through: [T(-1, 0.25), T(1, 0.25)], kind: 'flat', only: at(([u, v]) => u < -0.25 + eps && v > -eps) },
      { through: [T(-0.25, 0.25), T(-0.5, 0)], kind: 'mountain', only: at(([u, v]) => u < -0.25 + eps && v > 0.25 - eps) },
      { through: [T(-0.25, 0.25), T(0, 0)], kind: 'valley', only: at(([u, v]) => u > -0.25 - eps && u < eps && v > 0.25 - eps) },
    ],
    fromWindmill([0.2, -0.2]),
  );
  // The top right, like the bottom right: the flap's top swings its corner out to the right as its top edge
  // folds down to the middle crease.
  r.collapse(
    {
      title: 'Swivel the top right',
      text: 'Lift the top of the right flap, push its top right corner in and swing it out to the right, as the top edge folds down to the middle crease. Flatten it.',
    },
    [
      ...cornerCreases(1, -1, 'side').map(onSquare),
      // What's left of the top left (its corner is behind) folds down with it, along the same line.
      { through: [T(-1, -0.25), T(1, -0.25)], kind: 'valley', only: at(([u]) => u < eps) },
    ],
    fromWindmill([-0.1, 0.1]),
  );
  r.turnOver('Turn it over.');
  // Folded in half along the diagonal of the square, through the coloured square's diagonal: the coloured square
  // folds in half with it, into the head.
  r.along(T(0.5, -0.25), T(0, 0.25), T(0.1, -0.1), {
    title: 'Fold in half',
    text: 'Fold the top left corner down to the bottom right corner, along the diagonal. The coloured square folds in half on top, into the head. Your pajarita is finished.',
  });
  return r.build();
}
