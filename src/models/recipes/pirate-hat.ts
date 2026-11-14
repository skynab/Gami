import { placeLike, toFlat } from '../../fold/fold';
import { LAYER_GAP } from '../../fold/frames';
import type { BendGoal } from '../../fold/ops';
import { paper, Recipe, table } from '../../fold/recipe';
import { inside } from '../../fold/select';
import type { FoldFrame, Vec2, Vec3 } from '../../fold/types';
import { lattice, openCup } from './cup';
import { halves } from './face';

/**
 * The traditional newspaper hat, as a pirate's: an upright A4 sheet folded in half, its top corners folded down
 * to the middle, a band folded up twice on each side, then a skull and crossbones drawn on. Then opened at the
 * bottom and stood on its brim, as the cup is opened (see docs/bending-plan.md).
 */
export function pirateHat() {
  // The sheet lies upright, its edges at x = ±½ and z = ±hh. Folded in half it spans z = 0 (the fold, at the top)
  // to z = hh, and its top corners fold down to the middle, meeting at (0, ½): the band is what's left below.
  const hh = Math.SQRT2 / 2;
  const band = 0.5;
  // The band folds up twice: its edge up to the corners, then up again over them, so its outside shows.
  const half = (band + hh) / 2;
  const r = new Recipe({ id: 'pirate-hat', title: 'Pirate hat', sheet: { size: [1, Math.SQRT2], front: '#f3d27a', back: '#e9b949' } })
    .onto(paper(-0.5, -hh), paper(-0.5, hh), {
      title: 'Fold in half',
      text: 'Start with the sheet upright. Fold the top edge down to the bottom edge.',
    })
    .crease(paper(-0.5, hh), paper(0.5, hh), { title: 'Crease down the middle', text: 'Fold it in half side to side, and unfold.' })
    .onto(paper(-0.5, 0), table(0, band), {
      title: 'Fold the left corner down',
      text: 'Fold the top left corner down, so its top edge lies along the middle crease.',
    })
    .onto(paper(0.5, 0), table(0, band), {
      title: 'Fold the right corner down',
      text: 'Fold the top right corner down to match. That leaves a band along the bottom.',
    })
    .along(table(-1, half), table(1, half), table(0, hh - 0.01), {
      title: 'Fold the band in half',
      text: 'Fold the bottom edge of the top layer up to the bottom of the corners.',
      layers: 1,
    })
    .along(table(-1, band), table(1, band), table(0, band + 0.01), {
      title: 'Fold the band up',
      text: 'Fold the band up again, over the corners.',
      layers: 2,
    })
    .turnOver()
    .along(table(-1, half), table(1, half), table(0, hh - 0.01), {
      title: 'Fold the other band in half',
      text: 'Fold this side’s bottom edge up to the bottom of the triangle…',
    })
    .along(table(-1, band), table(1, band), table(0, band + 0.01), {
      title: 'Fold it up',
      text: '…and up again.',
      layers: 2,
    })
    .turnOver();
  // The skull and crossbones, on the front: in the middle of the triangle above the band. The triangle is the two
  // corners folded down, meeting at the middle, so each mark is drawn in halves, one on each.
  const [cx, cz] = [0, 0.16];
  const s = 0.07;
  const at = (x: number, z: number): Vec2 => [cx + x * s, cz + z * s];
  const ring = (x: number, z: number, rx: number, rz: number, n: number): Vec2[] =>
    Array.from({ length: n + 1 }, (_, i) => at(x + rx * Math.cos((i / n) * 2 * Math.PI), z + rz * Math.sin((i / n) * 2 * Math.PI)));
  const skull = ring(0, -0.25, 1, 0.95, 20);
  r.draw({ title: 'Draw a skull and crossbones', text: 'Draw a skull and crossbones on the front.' }, [
      ...halves(skull, cx).map((line) => ({ line })),
      { fill: ring(-0.4, -0.3, 0.25, 0.25, 10) },
      { fill: ring(0.4, -0.3, 0.25, 0.25, 10) },
      { fill: [at(-0.02, 0.1), at(-0.02, 0.3), at(-0.14, 0.3)] },
      { fill: [at(0.02, 0.1), at(0.14, 0.3), at(0.02, 0.3)] },
      ...halves([at(-1.6, 0.6), at(1.6, 2)], cx).map((line) => ({ line })),
      ...halves([at(1.6, 0.6), at(-1.6, 2)], cx).map((line) => ({ line })),
  ]);
  // Opened at the bottom, the front and back bow apart and the hat stands on its brim. Paper bends to do it, so the
  // opening is worked out beforehand and the paper guided there, as the cup's is.
  return r
    .bend(
      { title: 'Open it and stand it up', text: 'Open the bottom, pushing the front and back apart, and stand the hat on its brim. Put it on. Arr!' },
      { flex: () => true, anchor: [0, 0.3], goals: opening(r.current), mesh: 0.07, stages: STAGES, free: true },
    )
    .build();
}

/** How far the hat's sides turn in at the brim as it opens, and the frames it opens through. */
const SQUEEZE = (12 * Math.PI) / 180;
const STAGES = 10;

/**
 * Guides taking the flat hat open and standing it on its brim: the cup's opening (`openCup`) turned upside down,
 * closed at the top point and open along the brim, each face going with the wall on its side of the opening, as far
 * out as its layer is. The hat's sides aren't straight from its point to the brim's corners, as `openCup` takes them
 * (they run out to the band, then straight down it), so paper out past that line carries on from it along the wall.
 * As it opens it turns up about the brim, so the top point rises.
 */
function opening(frame: FoldFrame): BendGoal[] {
  const faces = toFlat(frame);
  const corners = faces.flatMap((f) => f.world);
  // On the table, the brim runs along x at the bottom (largest z), the point at the top.
  const brim = Math.max(...corners.map(([, z]) => z));
  const top = Math.min(...corners.map(([, z]) => z));
  const rim = Math.max(...corners.filter((q) => Math.abs(q[1] - brim) < 1e-9).map(([x]) => Math.abs(x)));
  const height = brim - top;
  const open = (k: number) => openCup({ bottom: 0, rim, height }, SQUEEZE * (k / STAGES) ** 2);
  const stages = Array.from({ length: STAGES }, (_, k) => open(k + 1));
  const halfWidth = (v: number) => (rim * v) / height;
  const along = (shape: (x: number, v: number) => Vec3, x: number, v: number): Vec3 => {
    const w = halfWidth(v);
    if (Math.abs(x) <= w) return shape(x, v);
    const s = Math.sign(x);
    const edge = shape(s * w, v);
    const before = shape(s * (w - 1e-4), v);
    const t = edge.map((c, i) => c - before[i]);
    const len = Math.hypot(...t) || 1;
    return edge.map((c, i) => c + (t[i] / len) * (Math.abs(x) - w)) as Vec3;
  };
  // The opening is between the two walls: the front half of the sheet's and the back half's, each in the middle of
  // the hat under the corner flaps. (Averaging the layers at the brim, as the cup does, would land among the four
  // layers of corner flaps on the front.)
  const wall = (q: Vec2) => faces.find((f) => inside(f.paper, q))!.layer;
  const pocket = (wall([0, -0.3]) + wall([0, 0.3])) / 2;
  const round6 = (x: number) => Math.round(x * 1e6) / 1e6 || 0;
  const rimUp = stages[STAGES - 1](rim, height)[2];
  return faces.flatMap((f) => {
    const side = f.layer < pocket ? -1 : 1;
    const out = (f.layer - pocket) * LAYER_GAP;
    const place = placeLike(f);
    return lattice(f.paper).map((q): BendGoal => {
      const [x, z] = place(q);
      const path = stages.map((shape, k): Vec3 => {
        const [across, depth, up] = along(shape, x, z - top);
        const turn = ((Math.PI / 2) * (k + 1)) / STAGES;
        const [dy, dz] = [side * depth + out, up - rimUp];
        return [across, pocket * LAYER_GAP + dy * Math.cos(turn) - dz * Math.sin(turn), brim + dy * Math.sin(turn) + dz * Math.cos(turn)].map(round6) as Vec3;
      });
      return { guide: { paper: q.map(round6) as Vec2 }, path };
    });
  });
}
