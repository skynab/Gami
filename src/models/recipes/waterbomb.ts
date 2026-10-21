import { Recipe } from '../../fold/recipe';
import { tuckedSide, waterbombBase } from './waterbomb-base';

/**
 * The traditional water bomb, following the order of folds at origami.me/waterbomb: a water bomb base, then
 * on each side the bottom corners up to the top, the side corners in to the middle, and the loose top points
 * folded down and tucked into the pockets. Blown up through the hole at the bottom, it puffs into a ball.
 */
export function waterbomb() {
  const r = waterbombBase(new Recipe({ id: 'waterbomb', title: 'Water bomb', sheet: { size: [1, 1], front: '#e5484d', back: '#f6f3ec' } }));
  tuckedSide(r);
  r.turnOver('Turn it over, and do the same on this side.');
  tuckedSide(r, 'And the last one. Now blow gently into the hole at the bottom, and the water bomb puffs up into a ball. Done!');
  return r.build();
}
