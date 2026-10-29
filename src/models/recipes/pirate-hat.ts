import { paper, Recipe, table } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';
import { halves } from './face';

/**
 * The traditional newspaper hat, as a pirate's: an upright A4 sheet folded in half, its top corners folded down
 * to the middle, a band folded up twice on each side, then a skull and crossbones drawn on.
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
  return r
    .draw({ title: 'Draw a skull and crossbones', text: 'Draw a skull and crossbones on the front. Open the bottom and put it on. Arr!' }, [
      ...halves(skull, cx).map((line) => ({ line })),
      { fill: ring(-0.4, -0.3, 0.25, 0.25, 10) },
      { fill: ring(0.4, -0.3, 0.25, 0.25, 10) },
      { fill: [at(-0.02, 0.1), at(-0.02, 0.3), at(-0.14, 0.3)] },
      { fill: [at(0.02, 0.1), at(0.14, 0.3), at(0.02, 0.3)] },
      ...halves([at(-1.6, 0.6), at(1.6, 2)], cx).map((line) => ({ line })),
      ...halves([at(1.6, 0.6), at(-1.6, 2)], cx).map((line) => ({ line })),
    ])
    .build();
}
