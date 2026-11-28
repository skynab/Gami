import { paper, Recipe, table } from '../../fold/recipe';

/** The front edge's folds: each about 2 cm (3/4 inch) on US letter held sideways. */
export const HEM = 0.07;
/** The wingtips' strips, turned up, and how far up (degrees); the V across the middle (degrees each side). */
export const TIP = 0.08;
export const TIP_UP = 75;
export const DIHEDRAL = 10;

/**
 * The manta, Orikata's own: a flying wing with no tail, wide from front to back, with a heavy front edge and its tips
 * turned up, which floats a long time, after the look of Fold'N Fly's Sky OmniWing (design #60, by OrigamiAirEnforcer,
 * after Mike Kelsey's Proto OmniWing), but folded its own way, with no cutting or tape: a sheet held sideways, its
 * top corners folded in and the top edge folded over three times for weight at the front; creased down the
 * middle and opened into a shallow V; the tips turned up. From US letter paper held sideways (11 : 8.5).
 */
export function manta() {
  const w = 1;
  const h = 0.77;
  const [l, r, top, bottom] = [-w / 2, w / 2, -h / 2, h / 2];
  // The top corners folded in at 45°, far enough to show past the front edge's folds: the tips taper.
  const nip = 0.3;
  const plane = new Recipe({ id: 'manta', title: 'Manta', sheet: { size: [w, h], front: '#2f4858', back: '#f6f3ec' } })
    .crease(paper(0, top), paper(0, bottom), { title: 'Fold in half', text: 'With the paper sideways, bring the left edge over to the right edge, crease down the middle and open it again.' })
    .along(table(l + nip, top), table(l, top + nip), table(l, top), { title: 'Fold in the top-left corner', text: 'Fold the top-left corner down, so its edges meet the top and side about 8 cm (3 inch) from the corner.' })
    .along(table(r - nip, top), table(r, top + nip), table(r, top), { title: 'Fold in the top-right corner', text: 'And the top-right corner, to match.' });
  for (let k = 1; k <= 3; k++) {
    const at = top + k * HEM;
    plane.along(table(-1, at), table(1, at), table(0, top + (k - 1) * HEM), {
      title: k === 1 ? 'Fold over the front edge' : k === 2 ? 'Fold it over again' : 'And once more',
      text: k === 1 ? 'Fold the top edge down about 2 cm (3/4 inch), over the corners.' : k === 2 ? 'Fold the thick edge down again, the same amount.' : 'Fold it down a third time. The weight at the front makes it glide.',
    });
  }
  // The tips: strips at either side, parallel to the middle; the V: each half turned up a little about the middle.
  const xs = plane.current.vertices_coords.map((p) => p[0]);
  const [left, right] = [Math.min(...xs), Math.max(...xs)];
  const mid = (top + bottom) / 2 + 0.1;
  plane
    .shape({ title: 'Turn the wingtips up', text: 'Fold a strip at each side, about 3 cm (1 1/4 inch) wide, straight up, front to back.' }, [
      { through: [table(left + TIP, -1), table(left + TIP, 1)], moving: table(left, mid), degrees: TIP_UP },
      { through: [table(right - TIP, -1), table(right - TIP, 1)], moving: table(right, mid), degrees: TIP_UP },
    ])
    .shape({ title: 'Open it into a V', text: 'Bend the two halves up a little along the middle crease, so the wing makes a shallow V. It’s ready to fly: launch it gently, level, and let it float.' }, [
      { through: [table(0, -1), table(0, 1)], moving: table(left, mid), degrees: DIHEDRAL },
      { through: [table(0, -1), table(0, 1)], moving: table(right, mid), degrees: DIHEDRAL },
    ]);
  return plane.build();
}
