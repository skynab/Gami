import { paper, Recipe, type At } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';
import { fishBase } from './fish-base';

/**
 * The traditional whale, following the order of folds at origami.me/whale: a fish base, its top point folded
 * behind for a blunt head, the sides narrowed, folded in half, the fish base's two flaps folded down as fins
 * and the tail turned up by a reverse fold.
 */
export function whale() {
  const r = new Recipe({ id: 'whale', title: 'Whale', sheet: { size: [1, 1], front: '#f6f3ec', back: '#3f7cc0' } });
  const { h, k, sheet, onDiamond, T } = fishBase(r);

  // The flaps' tips, where the sheet's side corners went.
  const tip = r.where(paper(...sheet(-h, 0)));
  r.along(T(-1, (tip[1] - h) / 2), T(1, (tip[1] - h) / 2), T(0, -h), {
    title: 'Fold the top point behind',
    text: 'Fold the top point back behind, level with the tips of the two flaps.',
    kind: 'mountain',
  }).turnOver('Turn it over.');

  // The narrow sides: straightened by folding the side corners in a little.
  const narrow = k - 0.05;
  r.along(T(-narrow, -1), T(-narrow, 1), T(-k, 0), { title: 'Fold the left corner in', text: 'Fold the left corner in a little, to straighten the side.' })
    .along(T(narrow, -1), T(narrow, 1), T(k, 0), { title: 'Fold the right corner in', text: 'And the right corner.' })
    .along(T(0, -1), T(0, 1), T(0.1, 0), { title: 'Fold in half', text: 'Fold the right half over onto the left.' })
    .rotate(90, { title: 'Turn it', text: 'Turn it a quarter turn, so the blunt end points left.' });

  // The tail: the thin end, turned up round the outside of the back (the folded edge along the top).
  const xs = r.current.vertices_coords.map((p) => p[0]);
  const zs = r.current.vertices_coords.map((p) => p[2]);
  const [right, back] = [Math.max(...xs), Math.min(...zs)];
  const at = right - 0.24;
  r.collapse(
    { title: 'Turn the tail up', text: 'Open the thin end a little and turn it up round the outside, for the tail.', kind: 'reverse' },
    [{ through: [T(at, back), T(at - 0.1, back + 0.1)], kind: 'outside' }],
    paper(0, 0),
  );
  // The fins: the fish base's two flaps lie flat on the sides, one each side, joined to the body along their
  // crease from P (where the kite creases meet) to the sheet's outer edge. No flat fold can swing them below the
  // belly as origami.me's diagrams show without tearing, so they're bent out from the sides instead.
  const d = (h - k) / 2;
  const fins = [-1, 1].map((s) => ({
    through: [paper(...sheet(s * k, 0)), paper(...sheet(s * (k + d), -d))] as [At, At],
    moving: paper(...sheet(s * h, 0)),
    degrees: 35,
    only: (c: Vec2) => {
      const [x0, z] = onDiamond(c);
      const x = s * x0;
      return x > k - 1e-9 && z > -(x - k) - 1e-9;
    },
  }));
  r.shape({ title: 'Open the fins', text: 'Lift the two flaps out from the sides, for the fins. Your whale is done!' }, fins);
  return r.build();
}
