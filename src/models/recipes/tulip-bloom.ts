import { paper, Recipe, table } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';
import { cornersUp, moved, waterbombBase } from './waterbomb-base';

/**
 * The traditional 3D tulip blossom: a water bomb base, its bottom corners folded up to the top on both sides, the
 * side corners overlapped and one tucked into the other, then blown up through the hole at the bottom, as
 * OrigamiOK's tulip does. Blowing up is a bend, as in the balloon (see docs/bending-plan.md); like the balloon, it
 * puffs into a rounded bud rather than a cup, so the petals aren't peeled down.
 */
export function tulipBloom() {
  const r = waterbombBase(new Recipe({ id: 'tulip-bloom', title: 'Tulip in 3D', sheet: { size: [1, 1], front: '#e8578a', back: '#f6f3ec' } }));
  // The paper of each side's left half: a quarter of the sheet.
  wrapped(r, ([u, v]) => u > 0 && v < 0);
  r.turnOver('Turn it over, and do the same on this side.');
  wrapped(r, ([u, v]) => u < 0 && v > 0);
  // Held, as the balloon is, by a corner tucked inside. Wrapped narrower than the balloon, it's blown up harder
  // (`inflate`), until it's about as thick as it is wide.
  return r
    .bend(
      { title: 'Blow it up', text: 'Blow gently into the hole at the bottom, and the blossom puffs up. Done!' },
      { flex: () => true, anchor: [-0.4167, 0.4583], goals: [], mesh: 0.07, inflate: 0.06 },
    )
    .build();
}

/**
 * One side of the blossom: corners up into a diamond, then its side corners overlapped across the middle, the left
 * one tucked into the pocket of the right. `left` picks the paper of the diamond's left half (by faces' centres on the
 * sheet).
 */
function wrapped(r: Recipe, left: (c: Vec2) => boolean) {
  cornersUp(r);
  // The diamond's side corners are at x = ±¼; each folds on a line a third of the way out from the middle.
  const third = 0.25 / 3;
  const right = moved(r, () =>
    r.along(table(third, -1), table(third, 1), table(0.2, -0.25), {
      title: 'Fold the right corner over',
      text: 'Fold the diamond’s right corner over to the left, past the middle.',
      layers: 4,
    }),
  );
  r.collapse(
    { title: 'Tuck the left corner in', text: 'Fold the left corner over to the right, and tuck it into the pocket of the right one.', kind: 'fold' },
    [{ through: [table(-third, -1), table(-third, 1)], kind: 'valley', only: (c) => left(c) && !right(c) }],
    paper(0, 0.3),
    right,
  );
}
