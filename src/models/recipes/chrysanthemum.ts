import { paper, Recipe, table, type At, type ShapeBend } from '../../fold/recipe';
import type { Sheet, Vec2, Vec3 } from '../../fold/types';
import { cornerCreases } from './windmill';

/** Three colours, two units each: opposite sides of the ball match. */
const COLOURS: [string, string][] = [
  ['#e5534b', '#f3aaa5'],
  ['#f2c94c', '#f9e6a8'],
  ['#a66bd6', '#d6bdec'],
];

/**
 * A chrysanthemum kusudama, Gami's own: after the look of the traditional one (origami.me's kusudama
 * chrysanthemum), whose petals' folds its text leaves unsaid. Each unit is a windmill base, a square half as wide
 * as the paper with four arms whirling round it; six units go on the sides of a cube, glued where their squares'
 * corners meet, each one's arms opened out as petals.
 */
export function chrysanthemum() {
  // Square `n` has sheet coordinates around (10n, 0). The first lies apart; the rest in a pile.
  const sheets: (Sheet & { at?: Vec2 })[] = Array.from({ length: 6 }, (_, n) => ({
    size: [1, 1] as Vec2,
    // The strong colour on the back, the side the windmill base shows.
    front: COLOURS[n >> 1][1],
    back: COLOURS[n >> 1][0],
    origin: [10 * n, 0] as Vec2,
    at: (n ? [0, -1.6] : [0, 0]) as Vec2,
  }));
  const r = new Recipe({ id: 'chrysanthemum', title: 'Chrysanthemum kusudama', sheets, card: 'finished' });
  const square = (n: number) => ([u]: Vec2) => Math.abs(u - 10 * n) < 5;
  const first = square(0);

  // The windmill base, as the pinwheel folds it (see ./windmill), on the first square only.
  r.crease(paper(-0.5, 0), paper(0.5, 0), { title: 'Fold in half', text: 'Fold a square in half side to side, then unfold.', only: first })
    .crease(paper(0, -0.5), paper(0, 0.5), { title: 'Fold in half the other way', text: 'And top to bottom, then unfold.', only: first })
    .together({ title: 'Fold the sides in', text: 'Fold the left and right edges to the middle crease.' }, (q) => {
      q.onto(paper(-0.5, 0), paper(0, 0), { title: '', only: first }).onto(paper(0.5, 0), paper(0, 0), { title: '', only: first });
    })
    .crease(paper(0, -0.5), paper(0, 0), { title: 'Fold the top to the middle', text: 'Fold the top edge to the middle, then unfold.', only: first })
    .crease(paper(0, 0.5), paper(0, 0), { title: 'Fold the bottom to the middle', text: 'And the bottom edge, then unfold.', only: first });
  const squash = (end: -1 | 1, left: 'side' | 'end', right: 'side' | 'end', step: { title: string; text: string }) =>
    r.collapse(
      { ...step, kind: 'fold' },
      [...cornerCreases(-1, end, left), ...cornerCreases(1, end, right)].map((c) => ({
        through: c.through.map(([u, v]) => paper(u, v)) as [At, At],
        kind: c.kind,
        only: (p: Vec2) => first(p) && c.only(p),
      })),
      paper(0, -end * 0.1),
    );
  squash(-1, 'side', 'end', {
    title: 'Squash the top',
    text: 'Fold the top edge down to the middle, pulling the top left corner out to the side and the top right corner up. Flatten them into triangles.',
  });
  squash(1, 'end', 'side', {
    title: 'Squash the bottom',
    text: 'The same at the bottom, the other way round. That’s one unit: a square with four arms whirling round it.',
  });

  // The other five, folded the same way, laid out in two rows.
  const at: Vec2[] = [[0, 0], [1.2, 0], [-1.2, 0], [-1.2, 1.2], [0, 1.2], [1.2, 1.2]];
  const others = [1, 2, 3, 4, 5];
  r.copy({ title: 'Fold five more', text: 'Fold five more squares the same way: six units, two of each colour.' }, 0, others, others.map((n) => at[n]));

  // Each unit's arms, hinged on half a side of its square each: the left one from (−¼, 0) to (−¼, −¼) about the
  // unit's middle, the others the same turned round by quarter turns. An arm is the paper beyond that side, now.
  const turn = ([x, z]: Vec2, k: number): Vec2 => (k ? turn([-z, x], k - 1) : [x, z]);
  const arms = at.map(([cx, cz], n) =>
    [0, 1, 2, 3].map((k) => {
      const [dx, dz] = turn([-1, 0], k);
      const beyond = r.lying(([x, z]) => (x - cx) * dx + (z - cz) * dz > 0.25 + 1e-6);
      return (c: Vec2) => square(n)(c) && beyond(c);
    }),
  );
  const PETAL = 50;
  const petals = (n: number): ShapeBend[] =>
    [0, 1, 2, 3].map((k) => {
      const [cx, cz] = at[n];
      const t = (p: Vec2): At => {
        const [x, z] = turn(p, k);
        return table(cx + x, cz + z);
      };
      return { through: [t([-0.25, 0]), t([-0.25, -0.25])], moving: t([-0.33, -0.08]), degrees: PETAL, only: arms[n][k] };
    });

  // The ball: a cube half a square across, each unit's square on a side, facing out, its petals rising out from it.
  // It stands on the bottom unit's petals.
  const C: Vec3 = [0, 0.25 + 0.25 * Math.sin((PETAL * Math.PI) / 180) + 0.01, 1.4];
  const faces: { n: number; out: Vec3; along: Vec3 }[] = [
    { n: 0, out: [0, -1, 0], along: [1, 0, 0] },
    { n: 1, out: [0, 1, 0], along: [1, 0, 0] },
    { n: 2, out: [1, 0, 0], along: [0, 0, 1] },
    { n: 3, out: [-1, 0, 0], along: [0, 0, 1] },
    { n: 4, out: [0, 0, 1], along: [0, 1, 0] },
    { n: 5, out: [0, 0, -1], along: [0, 1, 0] },
  ];
  const onBall = (n: number) => {
    const { out, along } = faces.find((g) => g.n === n)!;
    return { sheet: n, bends: petals(n), pose: { from: table(...at[n]), to: C.map((c, i) => c + out[i] * 0.25) as Vec3, x: along, up: out } };
  };
  return r
    .assemble({ title: 'Open the petals', text: 'Lift each unit’s four arms up from its square, so they stand out like petals.' }, [0, 1, 2, 3, 4, 5].map((n) => ({ sheet: n, bends: petals(n) })))
    .assemble({ glue: true, title: 'Start the ball', text: 'Hold a red unit petals down for the bottom. Glue a yellow unit to it at each side, square corners to square corners, petals out.' }, [onBall(0), onBall(2), onBall(3)])
    .assemble({ glue: true, title: 'Add the purple units', text: 'Glue the purple units in at the front and back, their square corners to the corners beside them.' }, [onBall(4), onBall(5)])
    .assemble({ glue: true, title: 'Close the ball', text: 'Glue the last red unit on top. Done!' }, [onBall(1)])
    .build();
}
