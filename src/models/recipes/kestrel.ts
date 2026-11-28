import { paper, Recipe, table } from '../../fold/recipe';
import { foldWings } from './paper-plane';

/** The wingtips' strips, turned up: how wide, and how far up (degrees). */
export const TIP = 0.06;
export const TIP_UP = 80;

/**
 * The kestrel, Orikata's own: a broad glider with swept wings and their tips turned up, after the look of Fold'N Fly's
 * Fast Hawk (design #21), which is likely Keith Laux's, but folded its own way: on a sheet held sideways, the
 * corners folded to the middle, the point folded down to make a blunt, thick nose and that nose's corners folded in
 * again for a short point; folded in half, the wings folded along a line deeper at the back, so they sweep back; then
 * the tips turned up. From US letter paper held sideways (11 : 8.5).
 */
export function kestrel() {
  const w = 1;
  const h = 0.77;
  const [l, r, top] = [-w / 2, w / 2, -h / 2];
  // The corners folded to the middle meet in a point; it folds down to their bottom, and the flat top's corners fold
  // in on 45° lines from its middle, pointed again.
  const corner = top + w / 2;
  const blunt = (top + corner) / 2;
  const half = (corner - top) / 2;

  const plane = new Recipe({ id: 'kestrel', title: 'Kestrel', card: 'angled', sheet: { size: [w, h], front: '#8a5a3c', back: '#f6f3ec' } })
    .crease(paper(0, top), paper(0, -top), { title: 'Fold in half', text: 'With the paper sideways, bring the left edge over to the right edge, crease down the middle and open it again.' })
    .onto(paper(l, top), table(0, corner), { title: 'Fold the top-left corner to the middle', text: 'Line the top edge up with the centre crease.' })
    .onto(paper(r, top), table(0, corner), { title: 'Fold the top-right corner to the middle', text: 'The two corners meet on the centre crease, making a point at the top.' })
    .onto(table(0, top), table(0, corner), { title: 'Fold the point down', text: 'Fold the point down to the bottom of the corner flaps, leaving a flat top.' })
    .onto(table(-half, blunt), table(0, blunt + half), { title: 'Fold the top left in', text: 'Fold the left half of the flat top down onto the centre crease, on a line from the middle of the top.' })
    .onto(table(half, blunt), table(0, blunt + half), { title: 'Fold the top right in', text: 'Match it on the right. The top comes to a point again.' });
  const right = plane.lying(([x]) => x > 0);
  plane
    .along(table(0, -1), table(0, 1), table(-0.1, 0), { title: 'Fold in half behind', text: 'Mountain-fold along the centre crease, so the folds stay on the outside.', kind: 'mountain' })
    .rotate(90, { title: 'Turn it on its side', text: 'Point the nose to the left, with the long folded edge at the bottom.' });
  let tips: { line: number; tip: number } | undefined;
  return foldWings(
    plane,
    0.03,
    'Fold the top layers down along a line from the nose to the back, a little deeper at the back, so the wings sweep back.',
    right,
    (c) => !right(c),
    {
      tail: 0.1,
      beforeOpen(p) {
        // With both wings down their tips reach past the keel: a strip of each, parallel to the body.
        const tip = Math.max(...p.current.vertices_coords.map((q) => q[2]));
        tips = { line: tip - TIP, tip };
      },
      afterOpen(p, wings) {
        const { line, tip } = tips!;
        // Bent opposite ways here, both turn up in flight.
        p.shape({ title: 'Turn the wingtips up', text: 'Fold a strip at the tip of each wing straight up, parallel to the body.' }, [
          { through: [table(-1, line), table(1, line)], moving: table(0.1, tip - 0.01), degrees: -TIP_UP, only: wings.firstWing },
          { through: [table(-1, line), table(1, line)], moving: table(0.1, tip - 0.01), degrees: TIP_UP, only: wings.secondWing },
        ]);
      },
      flyText: 'Turn the plane over, so it stands on its keel with its wingtips up. Give the wings a slight upward V and throw it gently: it glides a long way.',
    },
  );
}
