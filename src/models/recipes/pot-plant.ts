import { toFlat } from '../../fold/fold';
import { paper, Recipe, table } from '../../fold/recipe';
import type { Vec2, Vec3 } from '../../fold/types';
import { masuBends, masuFolds } from './masu-box';
import { leafyStemFolds } from './tulip';

/**
 * A potted plant, Orikata's own, after the look of OrigamiOK's (leaves standing in a pot) but from five squares and no
 * scissors or glue, all of them traditional parts: three long leaves, each a square narrowed twice into a long kite
 * as the flat tulip's leafy stem starts (`leafyStemFolds`), folded side by side; a small brown
 * square with its corners folded to the middle, for the soil; and the masu box (`masuFolds`, `masuBends`) for the
 * pot. The soil goes in just below the rim and the leaves stand in a fan on it, each on its thin point, its broad
 * end up.
 *
 * Folded on into the tulip's stem and leaf, the stem pulled out, the pot's walls jump into place as their step ends,
 * 2 cm through themselves (the animator's last stretch of the walls' path goes another way with the pulled-out stems
 * on the table); folded in half without pulling it out, it's too squat for a leaf. So the leaves stop at the kite.
 */
export function potPlant() {
  const S = 0.3;
  const soilSize = 0.48;
  const leafSheet = (origin: number, x: number) => ({ size: [2 * S, 2 * S] as Vec2, front: '#2f7d43', back: '#9cc85e', origin: [origin, 0] as Vec2, at: [x, 0] as Vec2 });
  const origins = [20, 30, 40];
  const r = new Recipe({
    id: 'pot-plant',
    title: 'Pot plant',
    card: 'finished',
    sheets: [
      { size: [1, 1], front: '#f6f3ec', back: '#c0643c', origin: [0, 0], at: [0, 0] },
      { size: [soilSize, soilSize], front: '#8a5f3f', back: '#5a3b26', origin: [10, 0], at: [0, 1.15] },
      leafSheet(origins[0], -2.6),
      leafSheet(origins[1], -1.4),
      leafSheet(origins[2], 1.4),
    ],
  });
  const pot = ([u]: Vec2) => u < 5;
  const soil = ([u]: Vec2) => u > 5 && u < 15;
  const leaves = origins.map((o) => ([u]: Vec2) => u > o - 5 && u < o + 5);

  // The leaves, all three at once, each fold made on the three together.
  r.together(
    {
      title: 'Start with three diamonds',
      text: 'Three green squares, each turned so a corner points towards you. Fold them all the same way, side by side: each makes a long leaf.',
    },
    (q) => {
      for (const leaf of leaves) q.move({ title: '' }, leaf, { degrees: 45 });
    },
  );
  // The tulip's stem folds as far as narrowing it twice: a long kite, its bottom a long thin point.
  const folds = leaves.map((leaf, k) => leafyStemFolds(r, leaf, origins[k], S).slice(0, 6));
  const first = { title: 'Crease the leaf squares', text: 'Fold each green square’s left corner to its right corner, then unfold.' };
  folds[0].forEach((fold, i) => {
    // One unfold opens the three creases together.
    if (fold.unfold) return fold.make();
    r.together(i ? { title: fold.title, text: fold.text } : first, () => {
      for (const f of folds) f[i].make();
    });
  });

  // The soil: its corners folded to the middle.
  const s = soilSize / 2;
  r.together({ title: 'Fold the soil', text: 'Lighter side up, fold the small brown square’s corners to the middle.' }, (q) => {
    for (const [u, v] of [
      [-s, -s],
      [s, -s],
      [s, s],
      [-s, s],
    ])
      q.onto(paper(10 + u, v), paper(10, 0), { title: '', only: soil });
  });

  // The pot: the masu box, as `masu-box` folds it, on its own sheet.
  const e = masuFolds(
    r,
    0.003,
    [
      'Fold the bottom left corner to the middle, where the creases cross.',
      'And the bottom right corner.',
      'And the top right corner.',
      'And the top left corner. It’s a smaller square.',
    ],
    pot,
  );
  const h = e / 2;
  const { walls, lock, floor } = masuBends(r, h, e, undefined, pot);
  // Where each leaf's thin point (its lowest corner on the table) and broad end's tip (its highest) lie flat, and the
  // soil's middle, before the pot is shaped.
  const flat = toFlat(r.current);
  const ends = leaves.map((leaf) => {
    const corners = flat.filter((f) => leaf(f.paper[0])).flatMap((f) => f.world);
    const bottom = corners.reduce((a, p) => (p[1] > a[1] ? p : a));
    const tip = corners.reduce((a, p) => (p[1] < a[1] ? p : a));
    return { bottom, tip };
  });
  const soilMiddle = r.where(paper(10, 0));
  r.shape(
    {
      title: 'Raise the walls',
      text: 'Stand the side walls up, and push each corner in so it folds flat against the end wall. The end walls stand up too, with their flaps.',
    },
    walls,
    { chained: floor },
  )
    .shape({ title: 'Lock the top end', text: 'Fold the top flap over the end wall into the box, so its point lies on the floor and holds the corners in.' }, lock(-1))
    .shape({ title: 'Lock the bottom end', text: 'And the bottom flap. That’s the pot.' }, lock(1));

  // The soil, flat, a little below the rim, turned an eighth: folded, it's a diamond on the table.
  const rim = e - h;
  const soilY = rim - 0.03;
  r.assemble({ title: 'Put in the soil', text: 'Push the soil into the pot, folded side up, until it sits a little below the rim.' }, [
    { only: soil, pose: { from: table(...soilMiddle), to: [0, soilY, 0], x: [Math.SQRT1_2, 0, Math.SQRT1_2], up: [0, 1, 0] } },
  ]);

  // The leaves stood on the soil in a fan, all facing the front, one behind another so they can't meet: the middle
  // one upright, the others leaning out to either side.
  const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const facing: Vec3 = [0, 0, 1];
  const fan = [
    { lean: -22, x: -0.05, z: 0.03 },
    { lean: 0, x: 0, z: 0 },
    { lean: 22, x: 0.05, z: -0.03 },
  ];
  const pieces = fan.map(({ lean, x, z }, k) => {
    const { bottom, tip } = ends[k];
    const len = Math.hypot(tip[0] - bottom[0], tip[1] - bottom[1]);
    const [ux, uz] = [(tip[0] - bottom[0]) / len, (tip[1] - bottom[1]) / len];
    const a = (lean * Math.PI) / 180;
    const up: Vec3 = [Math.sin(a), Math.cos(a), 0];
    // The leaf's line on the table goes to `up`, the table's up to `facing`: so the table's +x goes to this.
    const fu = cross(facing, up);
    const xAxis: Vec3 = [ux * up[0] + uz * fu[0], ux * up[1] + uz * fu[1], ux * up[2] + uz * fu[2]];
    return { only: leaves[k], pose: { from: table(...bottom), to: [x, soilY + 0.004, z] as Vec3, x: xAxis, up: facing } };
  });
  return r
    .assemble({ title: 'Plant the leaves', text: 'Stand the three leaves on the soil on their thin points, in a fan: the middle one upright, the others leaning out. Done!' }, pieces)
    .build();
}
