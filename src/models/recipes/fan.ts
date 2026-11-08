import { placeLike, toFlat } from '../../fold/fold';
import { facePositions } from '../../fold/frames';
import { signedArea } from '../../fold/geometry2d';
import type { BendGoal } from '../../fold/ops';
import { paper, Recipe, table } from '../../fold/recipe';
import type { FoldFrame, Vec2, Vec3 } from '../../fold/types';

/**
 * The traditional fan, following the order of folds at origami.me/fan: a sheet held sideways creased into
 * sixteen strips (halves, quarters and eighths from the front, sixteenths from the back), pleated from the back
 * with the strip on the left left out as a flap, folded in half, the flap's corners folded in and the flap tucked
 * between the two middle layers to lock the halves together, then the pleats spread out into a half circle.
 */
export function fan() {
  // A sheet shaped like A4, held sideways (1.4 : 1, exact in a .fold file).
  const w = 1.4;
  const h = 1;
  const [l, top, bottom] = [-w / 2, -h / 2, h / 2];
  const strip = w / 16;
  // The line between strip k and strip k + 1 (k from 1 to 15) on the table, counted from the left.
  const x = (k: number) => l + k * strip;
  const across = (k: number): [ReturnType<typeof table>, ReturnType<typeof table>] => [table(x(k), -1), table(x(k), 1)];

  const r = new Recipe({ id: 'fan', title: 'Fan', sheet: { size: [w, h], front: '#d94f70', back: '#f6f3ec' } });
  r.crease(paper(l, 0), paper(-l, 0), {
    title: 'Fold in half',
    text: 'With the paper sideways, fold the left edge over to the right edge, and unfold.',
  });
  // Each crease folds a strip's edge onto the crease that's to be its middle, then unfolds.
  const creases = (title: string, text: string, pairs: [number, number][]) =>
    r.together({ title, text }, (q) => {
      for (const [from, onto] of pairs) q.crease(paper(x(from), 0), paper(x(onto), 0), { title });
    });
  creases('Fold the sides to the middle', 'Fold each side edge to the middle crease, and unfold.', [
    [0, 8],
    [16, 8],
  ]);
  creases('Fold the right quarters in half', 'Fold each of the two right quarters in half, edge to crease, and unfold.', [
    [16, 12],
    [8, 12],
  ]);
  creases('Fold the left quarters in half', 'The same with the two left quarters.', [
    [0, 4],
    [8, 4],
  ]);
  r.turnOver('Turn the paper over.');
  creases(
    'Fold each strip in half',
    'Now fold each of the eight strips in half and unfold, so the paper is creased into sixteen strips, front and back in turn.',
    // Each eighth-wide strip folded edge to edge, creasing it down its middle. Turned over, the sheet's edges have
    // swapped sides, but the strips lie as they did.
    [0, 2, 4, 6, 8, 10, 12, 14].map((k): [number, number] => [k, k + 2]),
  );

  // The pleats, from this side, as origami.me collapses them: every crease but the first folds, the second strip
  // staying put and the rest going under it in turn, so the strip next to the flap ends up on top. Folded in half
  // next, that strip's halves are the middle of the stack, which the flap can lock together; on the outside, the
  // flap would hold the whole stack shut, and the fan couldn't open.
  r.collapse(
    { title: 'Pleat it', text: 'Keeping this side up, fold the paper back and forth along the creases into a narrow stack, leaving the strip on the left open as a flap.' },
    Array.from({ length: 14 }, (_, i) => i + 2).map((k) => ({ through: across(k), kind: k % 2 ? ('valley' as const) : ('mountain' as const) })),
    // The second strip from the left, on the sheet turned over.
    paper(-(x(1) + strip / 2), 0),
  );

  // Folded in half, bottom to top: the pleats and the flap all together.
  r.along(table(-1, 0), table(1, 0), table(x(1), bottom - 0.05), {
    title: 'Fold it in half',
    text: 'Fold the bottom half of the stack up onto the top half, flap and all.',
  });
  // The flap's two outer corners fold in onto its hinge, at 45°, through both its layers, which holds them
  // together, and so the two middle layers they hang from: the halves of the fan are locked at its middle.
  // (origami.me then closes the flap towards the middle. Its layers hang from the two middle layers, so folded
  // over either face it would wrap one half of the stack and hold it shut; it stays out, as a tab.)
  const flap = ([u]: Vec2) => u > -x(1);
  r.along(table(x(0), top + strip), table(x(1), top), table(x(0) + 0.01, top + 0.01), {
    title: 'Fold in the top corner',
    text: 'Fold the flap’s top outer corner in at a slant, through both layers, so its top edge lies along the flap’s inner edge.',
    only: flap,
  }).along(table(x(0), -strip), table(x(1), 0), table(x(0) + 0.01, -0.01), {
    title: 'Fold in the bottom corner',
    text: 'And the bottom outer corner, the same way. The flap now holds the two halves of the fan together.',
    only: flap,
  });

  // Spread, the fan opens like a book about the fold at its bottom, its pages fanned evenly over a half circle.
  // Paper bends to do it, so the shape is worked out beforehand (`spread`) and the paper guided there. Not in the
  // gallery yet: played, slivers in the mesh stretch by 13% (docs/bending-plan.md, step 6).
  return r.bend(
    { title: 'Spread it', text: 'Hold the bottom and open the two halves out into a half circle. Done!' },
    { flex: () => true, anchor: [0, -0.25], goals: spread(r.current, { pinch: (x(1) + x(2)) / 2, width: strip }), mesh: MESH, stages: STAGES },
  );
}

const STAGES = 16;
/** The longest edge of a triangle of the bending paper, on the sheet. */
const MESH = 0.15;
/** Guide points on the sheet: a triangular lattice this far apart, kept this far inside each face. */
const SPACING = 0.05;
const MARGIN = 0.008;

/**
 * Guides taking the folded fan open, given where its stack lies (`pinch`: the middle of the stack across, on the
 * table, its fold at z = 0, its free ends towards −z) and the strips' width.
 *
 * Opened, the pages are the half strips, hinged at the fold like a book's (its spine along x), the bottom half of
 * the stack fanning up from the table on one side, the top half swinging over onto the other, the two middle
 * layers (the strip next to the flap, locked together by it) standing up between them with the flap. Between its
 * creases each page is a ruled surface: at the spine its creases are a strip's width apart across it, as they lie
 * folded; out along the page, the creases fan apart round the half circle and draw in across it to keep the page
 * as wide, so each page twists a little, which the paper takes by bending (under half a percent).
 */
function spread(frame: FoldFrame, { pinch, width }: { pinch: number; width: number }): BendGoal[] {
  const faces = toFlat(frame);
  const heights = facePositions(frame).map((pts) => pts.reduce((sum, q) => sum + q[1], 0) / pts.length);
  const pleats = faces.filter((f) => f.world.every(([x]) => Math.abs(x - pinch) < width / 2 + 1e-9));
  const middle = (Math.min(...pleats.map((f) => heights[faces.indexOf(f)])) + Math.max(...pleats.map((f) => heights[faces.indexOf(f)]))) / 2;
  // On the sheet: the strips' edges are at u = −0.7 + i·width; the outermost (i = 0) ends on the table, and each
  // crease further in stands up by a share of a quarter turn, the 14th (the middle strip's) upright.
  const left = -8 * width;
  const quarter = 14;
  const round6 = (x: number) => Math.round(x * 1e6) / 1e6 || 0;

  return faces.flatMap((f, n) => {
    const centre = f.paper.reduce((s, q): Vec2 => [s[0] + q[0] / f.paper.length, s[1] + q[1] / f.paper.length], [0, 0]);
    const half = centre[1] < 0 ? 0 : 1;
    const strip = Math.floor((centre[0] - left) / width);
    const place = placeLike(f);
    const lift = strip >= quarter ? 0 : heights[n] - middle;
    return lattice(f.paper).map((q): BendGoal => {
      const [x, z] = place(q);
      const path = Array.from({ length: STAGES }, (_, k): Vec3 => {
        const s = (k + 1) / STAGES;
        // The page's turn about the spine at a crease, for this half.
        const turn = (i: number) => {
          const up = (Math.min(i, quarter) / quarter) * (Math.PI / 2);
          return s * (half ? Math.PI - up : up);
        };
        const r = -z;
        // How far apart neighbouring creases' far ends are round the arc, at this distance out, and so how far
        // in across the page they draw to keep it a strip wide.
        const chord = 2 * r * Math.sin((s * Math.PI) / 2 / quarter / 2);
        const across = (i: number) => (i % 2 ? -1 : 1) * Math.sqrt(Math.max(0, width * width - chord * chord)) / 2;
        const at = (a: number, theta: number): Vec3 => [pinch + a, middle + lift * Math.cos(theta) + r * Math.sin(theta), lift * Math.sin(theta) - r * Math.cos(theta)];
        if (strip >= quarter) {
          // The middle strip and the flap: upright, flat, moved across with the middle strip's inner crease.
          const theta = turn(quarter);
          return at(x - pinch + across(quarter) - width / 2, theta).map(round6) as Vec3;
        }
        // A page: how far across it the point is, between its creases (at edges `strip` and `strip + 1`).
        const [i, j] = [strip, strip + 1];
        const t = (x - pinch - (i % 2 ? -1 : 1) * (width / 2)) / ((j % 2 ? -1 : 1) * (width / 2) - (i % 2 ? -1 : 1) * (width / 2));
        const [a, b] = [at(across(i), turn(i)), at(across(j), turn(j))];
        return a.map((c, d) => round6(c + t * (b[d] - c))) as Vec3;
      });
      return { guide: { paper: q.map(round6) as Vec2 }, path };
    });
  });
}

/** Points of a triangular lattice on the sheet inside a convex face, all at least `MARGIN` in from its edges. */
function lattice(poly: Vec2[]): Vec2[] {
  const turn = Math.sign(signedArea(poly));
  const within = (q: Vec2) =>
    poly.every((a, i) => {
      const b = poly[(i + 1) % poly.length];
      return (turn * ((b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]))) / Math.hypot(b[0] - a[0], b[1] - a[1]) >= MARGIN;
    });
  const us = poly.map((q) => q[0]);
  const vs = poly.map((q) => q[1]);
  const row = SPACING * (Math.sqrt(3) / 2);
  const out: Vec2[] = [];
  for (let j = Math.floor(Math.min(...vs) / row); j <= Math.ceil(Math.max(...vs) / row); j++) {
    for (let i = Math.floor(Math.min(...us) / SPACING) - 1; i <= Math.ceil(Math.max(...us) / SPACING); i++) {
      const q: Vec2 = [(i + (Math.abs(j) % 2) / 2) * SPACING, j * row];
      if (within(q)) out.push(q);
    }
  }
  return out;
}
