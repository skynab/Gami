import { Recipe, table } from '../../fold/recipe';
import { cornersUp, T, tuckedSide, waterbombBase } from './waterbomb-base';

/**
 * The traditional balloon rabbit, following the order of folds at origami.me/balloon-rabbit: a water bomb on
 * one side; on the other, the corners folded up and in but the loose top points folded out as ears instead of
 * being tucked away. Blown up through the hole at the bottom, it puffs into a round rabbit.
 */
export function balloonRabbit() {
  const r = waterbombBase(new Recipe({ id: 'balloon-rabbit', title: 'Balloon rabbit', sheet: { size: [1, 1], front: '#f0a3b5', back: '#f6f3ec' } }));
  tuckedSide(r);
  r.turnOver('Turn it over.');
  const corner = cornersUp(r);
  for (const s of [-1, 1]) {
    r.along(table(s * 0.125, -1), table(s * 0.125, 1), table(s * 0.25, -0.25), {
      title: s < 0 ? 'Fold the left corner in' : 'Fold the right corner in',
      text: s < 0 ? 'Fold the diamond’s left corner in to the middle.' : 'And the right corner.',
      layers: 4,
    });
  }
  // The ears: each loose top point tilts out to its side by 30°, folded about the line through P (on the middle
  // line, below the point) that bisects straight up and the ear's new direction.
  const P = -0.25;
  const tilt = (15 * Math.PI) / 180;
  for (const s of [-1, 1]) {
    r.along(table(0, P), table(s * Math.sin(tilt) * 0.3, P - Math.cos(tilt) * 0.3), T, {
      title: s < 0 ? 'Fold out an ear' : 'Fold out the other ear',
      text:
        s < 0
          ? 'Fold the loose point at the top left out a little to the side, for an ear.'
          : 'And the other one. Blow gently into the hole at the bottom to puff up the rabbit, then open out the ears. Done!',
      only: corner[s],
    });
  }
  return r.build();
}
