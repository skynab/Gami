import { Recipe, table, type ShapeBend } from '../../fold/recipe';
import type { Sheet, Vec2, Vec3 } from '../../fold/types';

/** Three colours, a pair of cards each: one pair makes the top and bottom, one the left and right, one the front and back. */
const COLOURS: [string, string][] = [
  ['#e5534b', '#f3aaa5'],
  ['#f2c94c', '#f9e6a8'],
  ['#5b8def', '#b3cbf6'],
];

/**
 * The business card cube, traditional: two cards laid across each other, each one's ends folded round the
 * other, make two units, a square with a flap at either end. Six units, their flaps opened square, make a cube,
 * each flap lying over the outside of the next face, so every edge is held by one flap. No glue.
 */
export function businessCardCube() {
  // Card `n` has sheet coordinates around (10n, 0), its long side across. The first lies apart; the rest in a pile.
  const sheets: (Sheet & { at?: Vec2 })[] = Array.from({ length: 6 }, (_, n) => ({
    size: [1.75, 1] as Vec2,
    front: COLOURS[n >> 1][0],
    back: COLOURS[n >> 1][1],
    origin: [10 * n, 0] as Vec2,
    at: (n ? [0, -1.6] : [0, 0]) as Vec2,
  }));
  const r = new Recipe({ id: 'business-card-cube', title: 'Business card cube', sheets, card: 'finished' });
  const card = (n: number) => ([u]: Vec2) => Math.abs(u - 10 * n) < 5;

  // A unit: the middle square of a card, 1 across, its ends folded over as flaps `f` wide.
  const f = 0.375;
  r.move({ title: 'Cross two cards', text: 'Lay a second card across the middle of the first, so the two make a plus sign.' }, card(1), { to: table(0, 0), degrees: 90 })
    .together({ title: 'Fold the top card’s ends behind', text: 'Fold the ends of the top card down behind the bottom card, sharply along its edges.' }, (q) => {
      for (const s of [-1, 1]) q.along(table(-1, s * 0.5), table(1, s * 0.5), table(0, s * 0.8), { title: '', kind: 'mountain', only: card(1) });
    })
    .together({ title: 'Fold the bottom card’s ends over', text: 'Fold the ends of the bottom card up over the top card, along its edges.' }, (q) => {
      for (const s of [-1, 1]) q.along(table(s * 0.5, -1), table(s * 0.5, 1), table(s * 0.8, 0), { title: '', only: card(0) });
    })
    .move({ title: 'Pull them apart', text: 'Slide the cards apart and turn the second one over. Each is a unit: a square with a flap folded over at either end.' }, card(1), { to: table(1.5, 0), flip: true });

  // Units lie in two rows. Even cards have their flaps at their left and right; odd ones at the top and bottom.
  const at: Vec2[] = [[0, 0], [1.5, 0], [-1.5, 0], [-1.5, 1.4], [0, 1.4], [1.5, 1.4]];
  r.together({ title: 'Make two more pairs', text: 'Fold four more cards the same way, two at a time: six units in all, two of each colour.' }, (q) => {
    q.copy({ title: '' }, 0, [2, 4], [at[2], at[4]]).copy({ title: '' }, 1, [3, 5], [at[3], at[5]]);
  });

  // Opening a unit's flaps square: each turns up by 90° about the edge of the square it's folded over. A flap is
  // the paper of a card's ends lying, now, on its side of the unit's middle.
  const flaps = at.map(([x, z], n) =>
    [-1, 1].map((s) => {
      const end = ([u]: Vec2) => Math.abs(u - 10 * n) > 0.5 && card(n)([u, 0]);
      const side = r.lying(([px, pz]) => (n % 2 === 0 ? s * (px - x) : s * (pz - z)) > 0);
      return (c: Vec2) => end(c) && side(c);
    }),
  );
  const open = (n: number): ShapeBend[] =>
    [-1, 1].map((s, k) => {
      const [x, z] = at[n];
      return n % 2 === 0
        ? { through: [table(x + s * 0.5, z - 1), table(x + s * 0.5, z + 1)], moving: table(x + s * (0.5 - f / 2), z), degrees: 90, only: flaps[n][k] }
        : { through: [table(x - 1, z + s * 0.5), table(x + 1, z + s * 0.5)], moving: table(x, z + s * (0.5 - f / 2)), degrees: 90, only: flaps[n][k] };
    });

  // The cube, 1 across, its middle `C`, just clear of the table. Each unit goes on a face with its flaps inside,
  // reaching over the outside of the faces beside it along `along`: top and bottom over the left and right, the
  // left and right over the front and back, the front and back over the top and bottom. Each face sits a
  // paper's thickness in from the flaps over it.
  const C: Vec3 = [0, 0.51, 0.7];
  const inset = 0.004;
  const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const faces: { n: number; out: Vec3; along: Vec3 }[] = [
    { n: 0, out: [0, -1, 0], along: [1, 0, 0] },
    { n: 1, out: [0, 1, 0], along: [1, 0, 0] },
    { n: 2, out: [1, 0, 0], along: [0, 0, 1] },
    { n: 3, out: [-1, 0, 0], along: [0, 0, 1] },
    { n: 4, out: [0, 0, 1], along: [0, 1, 0] },
    { n: 5, out: [0, 0, -1], along: [0, 1, 0] },
  ];
  const onCube = (n: number) => {
    const { out, along } = faces.find((g) => g.n === n)!;
    const up: Vec3 = [-out[0], -out[1], -out[2]];
    // The table's +x goes along the flaps for an even card; for an odd one, its flaps run along z.
    const x = n % 2 === 0 ? along : cross(up, along);
    const to = C.map((c, i) => c + out[i] * (0.5 - inset)) as Vec3;
    return { sheet: n, bends: open(n), pose: { from: table(...at[n]), to, x, up } };
  };

  return r
    .assemble({ title: 'Open the flaps', text: 'Open every flap out square, standing straight up from its unit.' }, [0, 1, 2, 3, 4, 5].map((n) => ({ sheet: n, bends: open(n) })))
    .assemble({ title: 'Start the cube', text: 'Hold a red unit flaps up for the bottom. Stand the blue units on it, front and back, their lower flaps tucked under the bottom.' }, [onCube(0), onCube(4), onCube(5)])
    .assemble({ title: 'Add the sides', text: 'Slide the yellow units in at the left and right, inside the bottom’s flaps, their own flaps over the blue faces.' }, [onCube(2), onCube(3)])
    .assemble({ title: 'Put the lid on', text: 'Push the last red unit down on top, its flaps over the yellow faces and under the blue units’ upper flaps. Done!' }, [onCube(1)])
    .build();
}
