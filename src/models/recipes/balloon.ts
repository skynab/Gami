import { Recipe } from '../../fold/recipe';
import { CUBE_EDGES, CUBE_ENDS, cubeGuides } from './balloon-cube';
import { tuckedSide, waterbombBase } from './waterbomb-base';

/**
 * The traditional paper balloon: the water bomb's folds, then blown up through the hole at the bottom, as Kids Web
 * Japan's balloon ends. The blowing up is a bend (see docs/bending-plan.md): the paper is led face by face into the
 * cube a real one makes (./balloon-cube.ts), folding along the cube's top and bottom edges, and the paper at its
 * ends, where the creases meet at T and the hole, crumples on the way, as it does in your hands.
 */
export function balloon() {
  const r = waterbombBase(new Recipe({ id: 'balloon', title: 'Balloon', card: 'finished', sheet: { size: [1, 1], front: '#4caf50', back: '#f6f3ec' } }));
  tuckedSide(r);
  r.turnOver('Turn it over, and do the same on this side.');
  tuckedSide(r);
  const stages = 16;
  return r
    .bend(
      { title: 'Blow it up', text: 'Blow gently into the hole at the bottom, and the balloon puffs up into a cube. Done!' },
      { flex: () => true, anchor: [0, 0], goals: cubeGuides(r.current, { stages }), mesh: 0.07, lines: CUBE_EDGES, crumple: CUBE_ENDS, stages, free: true },
    )
    .build();
}
