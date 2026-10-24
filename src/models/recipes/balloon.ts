import { Recipe } from '../../fold/recipe';
import { tuckedSide, waterbombBase } from './waterbomb-base';

/**
 * The traditional paper balloon: the water bomb's folds, then blown up through the hole at the bottom, as Kids Web
 * Japan's balloon ends. The blowing up is a bend: air pushes the paper out (see docs/bending-plan.md). It doesn't
 * yet reach the rounded cube a real one makes, and puffs into a pillow instead.
 */
export function balloon() {
  const r = waterbombBase(new Recipe({ id: 'balloon', title: 'Balloon', card: 'finished', sheet: { size: [1, 1], front: '#4caf50', back: '#f6f3ec' } }));
  tuckedSide(r);
  r.turnOver('Turn it over, and do the same on this side.');
  tuckedSide(r);
  // Held by a corner tucked inside, in the middle of the stack, so it puffs out both ways.
  return r
    .bend(
      { title: 'Blow it up', text: 'Blow gently into the hole at the bottom, and the balloon puffs up. Done!' },
      { flex: () => true, anchor: [-0.4167, 0.4583], goals: [], mesh: 0.07, inflate: 0.012 },
    )
    .build();
}
