import { locate, paper, Recipe, table, type At } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';
import { moved } from './waterbomb-base';

/**
 * The traditional masu box, following the order of folds at origami.me/box: the corners folded to the middle,
 * the top and bottom creased to the middle and opened out again, the sides creased to the middle, then the
 * side walls raised with the corners pushed in, and each end folded over into the box to lock it.
 */
export function masuBox() {
  return masu({
    id: 'masu-box',
    title: 'Masu box',
    front: '#2f6f8f',
    gap: 0,
    corners: [
      'Fold the bottom left corner to the middle, where the creases cross.',
      'And the bottom right corner.',
      'And the top right corner.',
      'And the top left corner. It’s a smaller square.',
    ],
    done: 'And the bottom flap. Your box is ready.',
  }).build();
}

/**
 * Its lid, as origami.me/box folds it: the same box, but with the corners stopping a little short of the middle,
 * so it comes out a little bigger and slides over the box. It ends open side up, like the box: turned over, its
 * floor's outside lies one layer's thickness from the points folded in on it, too close for the viewer to keep
 * apart.
 */
export function masuLid() {
  return masu({
    id: 'masu-lid',
    title: 'Masu box lid',
    front: '#b8573e',
    // A small gap between each corner and the middle: on a 15 cm sheet, about 3 mm.
    gap: 0.02,
    corners: [
      'Fold the bottom left corner towards the middle, stopping a little short of it.',
      'And the bottom right corner, leaving the same small gap.',
      'And the top right corner.',
      'And the top left corner. The corners leave a small square gap in the middle.',
    ],
    done: 'And the bottom flap. Your lid is ready: turn it over and put it on the box.',
  }).build();
}

/** The box with its corners folded `gap` short of the middle (0 for the box itself). */
function masu({ id, title, front, gap, corners: cornerTexts, done }: { id: string; title: string; front: string; gap: number; corners: [string, string, string, string]; done: string }) {
  const r = new Recipe({ id, title, card: 'finished', sheet: { size: [1, 1], front, back: '#f6f3ec' } })
    .crease(paper(-0.5, 0), paper(0.5, 0), { title: 'Fold in half', text: 'White side up, fold in half side to side, and unfold.' })
    .crease(paper(0, -0.5), paper(0, 0.5), { title: 'Fold in half the other way', text: 'And top to bottom, and unfold.' });
  // Each corner folded in; the paper each fold moved, to open some of them again.
  const corner: Record<string, (c: Vec2) => boolean> = {};
  // Each lands on the diagonal `gap` short of the middle.
  const short = gap * Math.SQRT2;
  for (const [u, v, title, text] of [
    [-0.5, 0.5, 'Fold a corner to the middle', cornerTexts[0]],
    [0.5, 0.5, 'Fold the next corner in', cornerTexts[1]],
    [0.5, -0.5, 'Fold the next corner in', cornerTexts[2]],
    [-0.5, -0.5, 'Fold the last corner in', cornerTexts[3]],
  ] as const) {
    corner[`${u},${v}`] = moved(r, () => r.onto(paper(u, v), paper(u * short, v * short), { title, text }));
  }
  r.rotate(45, { title: 'Turn it', text: 'Turn it so its edges run straight up and down.' });
  // The smaller square's half side: its edges at x and z = ±e, the middle creases to come at ±e/2. Each edge is
  // the crease halfway between a corner, √½ out, and where it lands, `gap` out.
  const e = (Math.SQRT1_2 + gap) / 2;
  r.crease(table(0, -e), table(0, 0), { title: 'Fold the top edge to the middle', text: 'Fold the top edge down to the middle, and unfold.' })
    .crease(table(0, e), table(0, 0), { title: 'Fold the bottom edge to the middle', text: 'And the bottom edge up to the middle, and unfold.' });
  // The flaps along the top and bottom edges (from the sheet's corners at (½, −½) and (−½, ½)) open back out.
  const ends = { top: corner['0.5,-0.5'], bottom: corner['-0.5,0.5'] };
  r.along(table(-1, -e), table(1, -e), table(0, -0.1), { title: 'Open the top flap', text: 'Unfold the top flap, back out past the top edge.', only: ends.top })
    .along(table(-1, e), table(1, e), table(0, 0.1), { title: 'Open the bottom flap', text: 'And the bottom flap.', only: ends.bottom });
  r.crease(table(-e, 0), table(0, 0), { title: 'Fold the left edge to the middle', text: 'Fold the left edge in to the middle, and unfold.' })
    .crease(table(e, 0), table(0, 0), { title: 'Fold the right edge to the middle', text: 'And the right edge, and unfold.' });

  // The box, posed crease by crease from the floor (see `shape`'s `chained`), in three moves as origami.me does:
  // the walls up with the corners pushed in, then each end flap folded over into the box. On the flat paper: the
  // floor is |x|, |z| < h; the side walls are x out to ±e, the end walls z out to ±e; past the end walls are the
  // opened flaps, out to ±2e. Each corner square (between a side wall and an end wall) folds along its diagonal:
  // its half by the end wall turns right over onto the end wall's inside, and its half by the side wall turns in to
  // lie on it. The end flap's outer triangles, joined to the corners, come over onto the flap with them; when the
  // flap folds over the end wall into the box they tuck under it, over the corners, and its point lies on the floor.
  const h = e / 2;
  const flat = r.current;
  const where = (c: Vec2) => locate(flat, c);
  type B = { through: [At, At]; moving: At; degrees: number; only: (c: Vec2) => boolean };
  const bend = (p: Vec2, q: Vec2, left: Vec2, degrees: number, only: (x: number, z: number) => boolean): B => ({
    through: [table(...p), table(...q)],
    moving: table(...left),
    degrees,
    only: (c) => only(...where(c)),
  });
  const walls: B[] = [];
  for (const s of [-1, 1]) {
    walls.push(bend([s * h, -1], [s * h, 1], [s * e, 0], 90, (_, z) => Math.abs(z) < h));
    walls.push(bend([-1, s * h], [1, s * h], [0, s * e], 90, (x) => Math.abs(x) < h));
    for (const t of [-1, 1]) {
      const sx = (x: number) => s * x > h && s * x < e;
      const tz = (z: number) => t * z > h && t * z < e;
      walls.push(
        bend([s * h, -1], [s * h, 1], [s * e, (t * (h + e)) / 2], 180, (_, z) => tz(z)),
        bend([-1, t * h], [1, t * h], [(s * (h + e)) / 2, t * e], 90, (x) => sx(x)),
        bend([s * h, t * h], [s * e, t * e], [s * e, t * (h + 0.01)], 180, (x, z) => sx(x) && tz(z)),
        bend([s * h, -1], [s * h, 1], [s * e, t * (e + 0.05)], 180, (_, z) => t * z > e),
      );
    }
  }
  const lock = (t: number): B[] => [
    bend([-1, t * e], [1, t * e], [0, t * 2 * e], 180, (x) => Math.abs(x) < h),
    bend([-1, t * 3 * h], [1, t * 3 * h], [0, t * 2 * e], -90, (x) => Math.abs(x) < h),
    ...[-1, 1].map((s) => bend([-1, t * e], [1, t * e], [(s * (h + e)) / 2, t * 2 * e], 180, (x) => s * x > h && s * x < e)),
  ];
  const floor = paper(0.05, 0.05);
  r.shape(
    {
      title: 'Raise the walls',
      text: 'Stand the side walls up, and push each corner in so it folds flat against the end wall. The end walls stand up too, with their flaps.',
    },
    walls,
    { chained: floor },
  )
    .shape({ title: 'Lock the top end', text: 'Fold the top flap over the end wall into the box, so its point lies on the floor and holds the corners in.' }, lock(-1))
    .shape({ title: 'Lock the bottom end', text: done }, lock(1));
  return r;
}
