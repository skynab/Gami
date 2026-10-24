import { paper, Recipe, table } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';

/**
 * The traditional letter envelope, following the order of folds at origami.me/paper-envelope, from a landscape
 * A4 sheet: creased into quarters, the sides folded in with their top corners swivelled down, the bottom folded
 * up and tucked under them, and the top flap folded down into the pocket.
 */
export function envelope() {
  // The sheet lies landscape: its edges at x = ±hw and z = ±½, top at z = −½.
  const hw = Math.SQRT2 / 2;
  // The narrow strip along the bottom, folded up first: origami.me sets it by eye.
  const strip = 1 / 12;
  const r = new Recipe({ id: 'envelope', title: 'Envelope', sheet: { size: [Math.SQRT2, 1], front: '#f6f3ec', back: '#d9825b' } })
    .crease(paper(-hw, 0), paper(hw, 0), { title: 'Fold in half', text: 'Inside colour up, fold in half side to side, and unfold.' })
    .crease(paper(0, -0.5), paper(0, 0.5), { title: 'Fold in half the other way', text: 'And top to bottom, and unfold.' })
    .crease(paper(-hw, 0), paper(0, 0), { title: 'Crease the left side', text: 'Fold the left edge to the middle crease, and unfold.' })
    .crease(paper(hw, 0), paper(0, 0), { title: 'Crease the right side', text: 'And the right edge, and unfold.' })
    .crease(paper(0, 0.5), paper(0, 0.5 - 2 * strip), { title: 'Crease a strip at the bottom', text: 'Fold a narrow strip up along the bottom edge, and unfold.' })
    .crease(paper(0, -0.5), paper(0, 0), { title: 'Crease the top', text: 'Fold the top edge down to the middle crease, and unfold.' });
  side(r, -1);
  side(r, 1);

  const q = hw / 2;
  // The bottom, folded up first along the strip's crease, then up again to the shoulders' inner corners (where
  // the swivelled corners meet the middle column, q − ½ down from the top): its fold lies halfway between.
  const bottom = 0.5 - strip;
  const corner = q - 0.5;
  const fold = (bottom + corner) / 2;
  r.along(table(-1, bottom), table(1, bottom), table(0, 0.49), { title: 'Fold the strip up', text: 'Fold the bottom edge up along the narrow crease.' })
    .crease(table(0, bottom), table(0, corner), { title: 'Crease the bottom', text: 'Fold the bottom edge up to the inner corners of the slanted flaps at the top, and unfold.' });
  // Then up again on that crease. origami.me tucks it under the swivelled corners; here each corner is hinged
  // along its slanted crease, right across where the bottom's edge would go, so the bottom lies over them.
  r.along(table(-1, fold), table(1, fold), table(0, 0.45), { title: 'Fold the bottom up', text: 'Fold the bottom up on that crease again.' });
  // The top flap folds down along the top crease into the pocket the bottom makes: under the bottom's front layer.
  const front = r.lying(([, z]) => z > corner && z < fold);
  r.collapse(
    { title: 'Tuck the top in', text: 'Fold the top flap down along its crease and tuck it into the pocket. Your envelope is ready.' },
    [{ through: [table(-1, -0.25), table(1, -0.25)], kind: 'valley' }],
    paper(0, 0.3),
    (c) => c[1] > fold && front(c),
  );
  return r.build();
}

/**
 * One side (s = −1 left, 1 right), as origami.me's steps 5–9: a 45° crease through where the side crease meets
 * the top crease, the top corner folded to the top crease, the side folded in, and its inner top corner swivelled
 * out, flattened along that 45° crease.
 */
export function side(r: Recipe, s: number) {
  const hw = Math.SQRT2 / 2;
  const q = hw / 2;
  // Where the side crease meets the top crease, and the 45° crease through it to the top edge.
  const X: [number, number] = [s * q, -0.25];
  const top: [number, number] = [s * (q - 0.25), -0.5];
  r.along(table(...X), table(...top), table(s * (hw - 0.02), -0.49), {
    title: 'Crease the top corner',
    text: 'Fold the top corner down on a line through where the side crease meets the top crease, and unfold.',
  })
    .unfold()
    .onto(paper(s * hw, -0.5), table(s * (hw - 0.25), -0.25), { title: 'Fold the corner down', text: 'Fold the top corner down to the top crease.' })
    .along(table(s * q, -1), table(s * q, 1), table(s * (hw - 0.05), 0.3), { title: 'Fold the side in', text: 'Fold the side in along its crease.' });
  // The swivel and flattening in one move (crease kinds found by search): above the top crease the side's fold
  // opens out, the sheet folds down along the 45° crease, and the side's inner top corner swings out along the
  // mirror image of that crease on the side flap, its top folding behind along the top crease.
  const flap = ([u]: Vec2) => s * u > q;
  const above = r.lying(([, z]) => z < -0.25);
  r.collapse(
    { title: 'Swivel the corner out', text: 'Swing the side’s inner top corner out and down, and flatten the top along the crease from before.' },
    [
      { through: [table(s * q, -1), table(s * q, 1)], kind: 'flat', only: above },
      { through: [table(...X), table(...top)], kind: 'valley', only: (c) => !flap(c) },
      { through: [table(...X), table(0, q - 0.25)], kind: 'valley', only: flap },
      { through: [table(...X), table(0, -0.25)], kind: 'mountain', only: flap },
    ],
    paper(-s * 0.4, 0.3),
  );
  return r;
}
