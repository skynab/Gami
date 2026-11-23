import { Recipe, table } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';
import { moved } from './waterbomb-base';

/** The tail's pleat: where the tail first folds up, and how far below that it folds back down. */
export const PLEAT_AT = 0.3;
export const PLEAT = 0.06;
/** The beak: how far down the fold from the top point it turns, and by how much (degrees from straight up, forwards). */
export const BEAK = 0.18;
export const BEAK_TURN = 150;

/**
 * A parrot, Gami's own (Gilad's database lists a traditional parrot, from Peter Saydak's book, but this doesn't
 * follow it or origami.me's, whose head is squashed out from the kite's flaps), from one square: a kite with its long
 * point pleated for the tail, folded in half with the coloured side out, and its short point pushed forward and down
 * between its layers for a hooked beak. The fold is the chest, the kite's side corner the shoulder.
 */
export function parrot() {
  const h = Math.SQRT1_2;
  const r = new Recipe({ id: 'parrot', title: 'Parrot', sheet: { size: [1, 1], front: '#f4efe2', back: '#3c9a4e' } })
    .rotate(45, { title: 'Start as a diamond', text: 'Start with the plain side up and a corner pointing towards you.' })
    .crease(table(-h, 0), table(h, 0), { title: 'Crease down the middle', text: 'Fold the left corner to the right corner, and unfold.' });
  const [top, bottom] = [table(0, -h), table(0, h)];
  r.together({ title: 'Fold a kite', text: 'Fold the lower edges to the middle crease, making a kite with a long point at the bottom.' }, (q) => {
    for (const s of [-1, 1]) q.edgeOnto([bottom, table(s * h, 0)], [bottom, top], { title: '' });
  });
  // The tail's pleat: the point folded up, then back down a little lower.
  const tail = moved(r, () => r.along(table(-1, PLEAT_AT), table(1, PLEAT_AT), bottom, { title: 'Fold the tail up', text: 'Fold the long point up.' }));
  r.along(table(-1, PLEAT_AT - PLEAT), table(1, PLEAT_AT - PLEAT), table(0, PLEAT_AT - 0.1), {
    title: 'Fold it back down',
    text: 'Fold it back down a little above that fold, leaving a pleat across the tail.',
    only: tail,
  });
  r.along(table(0, -1), table(0, 1), table(0.2, 0), { title: 'Fold in half', text: 'Fold the right half over onto the left, along the middle crease.' });
  // The beak: the top point, at the front of the head on the fold (the chest), pushed forward and down between
  // its layers, by BEAK_TURN from straight up, so it hooks out over the chest.
  const S: Vec2 = [0, -h + BEAK];
  const a = (BEAK_TURN / 2) * (Math.PI / 180);
  r.collapse(
    { title: 'Make the beak', text: 'Push the top point forward and down between its layers, so it hooks out over the chest: the beak. Your parrot is done.', kind: 'reverse' },
    [{ through: [table(...S), table(S[0] + Math.sin(a), S[1] - Math.cos(a))], kind: 'inside' }],
    r.sheetAt([-0.1, 0.2]),
  );
  return r.build();
}
