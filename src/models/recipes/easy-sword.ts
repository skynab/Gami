import { Recipe, table } from '../../fold/recipe';
import { moved } from './waterbomb-base';

/**
 * An easy sword, Gami's own, after the look of OrigamiOK's, from one square: a kite narrowed again for the long
 * blade and its short end narrowed too, then that end folded up over the blade and most of it back down, leaving a
 * band across for the crossguard and a point below for the handle, its long tip folded behind.
 */
export function easySword() {
  const h = Math.SQRT1_2;
  const r = new Recipe({ id: 'easy-sword', title: 'Easy sword', sheet: { size: [1, 1], front: '#2d3f8a', back: '#b9c2d6' } })
    .rotate(45, { title: 'Start as a diamond', text: 'Start dark side up, with a corner pointing towards you.' })
    .crease(table(-h, 0), table(h, 0), { title: 'Crease down the middle', text: 'Fold the left corner to the right corner, and unfold.' });
  const [top, bottom] = [table(0, -h), table(0, h)];
  r.together({ title: 'Fold a kite', text: 'Fold the upper edges to the middle crease, making a kite with a long point at the top.' }, (q) => {
    for (const s of [-1, 1]) q.edgeOnto([top, table(s * h, 0)], [top, bottom], { title: '' });
  });
  // The kite's side corners, where those folds' edges ended.
  const corner = (s: number) => table(s * (Math.SQRT2 - 1) * h * Math.SQRT2, h * (Math.SQRT2 - 1));
  r.together({ title: 'Narrow the blade', text: 'Fold the long upper edges to the middle again: a long, narrow blade.' }, (q) => {
    for (const s of [-1, 1]) q.edgeOnto([top, corner(s)], [top, bottom], { title: '' });
  });
  r.together({ title: 'Narrow the end', text: 'Fold the short lower edges to the middle too.' }, (q) => {
    for (const s of [-1, 1]) q.edgeOnto([bottom, corner(s)], [bottom, top], { title: '' });
  });
  // The end below the widest corners, at z = `shoulder`, folds up over the blade, then most of it folds back down
  // `guard` higher: the doubled band left is the crossguard, the point hanging below it the handle, its tip
  // folded behind a long way so it's short.
  const shoulder = r.current.vertices_coords.reduce((a, p) => (p[0] > a[0] ? p : a))[2];
  const guard = 0.07;
  const end = moved(r, () =>
    r.along(table(-1, shoulder), table(1, shoulder), bottom, { title: 'Fold the end up', text: 'Fold the end up over the blade, along its widest corners.' }),
  );
  const hilt = moved(r, () =>
    r.along(table(-1, shoulder - guard), table(1, shoulder - guard), table(0, shoulder - 2 * guard), {
      title: 'Fold it back down',
      text: 'Fold it back down a little above that fold, so a narrow band is left across the sword: the crossguard. The point below is the handle.',
      only: end,
    }),
  );
  const tip = Math.max(...r.current.vertices_coords.map((p) => p[2]));
  r.along(table(-1, tip - 0.22), table(1, tip - 0.22), table(0, tip), {
    title: 'Shorten the handle',
    text: 'Fold the handle’s long tip up behind, so the handle is short with a flat end. Your sword is ready.',
    kind: 'mountain',
    only: hilt,
  });
  return r.build();
}
