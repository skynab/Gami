import { placeLike, toFlat } from '../../fold/fold';
import { LAYER_GAP } from '../../fold/frames';
import type { BendGoal } from '../../fold/ops';
import { Recipe, table } from '../../fold/recipe';
import type { Vec2, Vec3 } from '../../fold/types';
import { CUBE_EDGES, CUBE_ENDS, cubeGuides, E, lattice, plus } from './balloon-cube';
import { cornersUp, T, tuckedSide, waterbombBase } from './waterbomb-base';

/**
 * The traditional balloon rabbit, following the order of folds at origami.me/balloon-rabbit: a water bomb on
 * one side; on the other, the corners folded up and in but the loose top points folded out as ears instead of
 * being tucked away. Then blown up through the hole at the bottom, as the balloon is, into a cube standing on
 * end, its ears up (see docs/bending-plan.md).
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
          : 'And the other one.',
      only: corner[s],
    });
  }
  const flap = (c: Vec2) => corner[-1](c) || corner[1](c);
  const stages = 16;
  return r
    .bend(
      { title: 'Blow it up', text: 'Blow gently into the hole at the bottom to puff up the rabbit. Done!' },
      { flex: () => true, anchor: [0, 0], goals: guides(r.current, flap, stages), mesh: 0.07, lines: CUBE_EDGES, crumple: CUBE_ENDS, stages, free: true },
    )
    .build();
}

/**
 * The balloon's guides into the cube, stood up on the hole's end, except for the ears: they lie on the back of the
 * box (the top of the flat stack) and carry on past its top edge, so rather than being wrapped onto the box with
 * the paper under them, each goes up with the back face, rigidly, and so stands up above the box once it's upright.
 */
function guides(frame: Parameters<typeof cubeGuides>[0], flap: (c: Vec2) => boolean, stages: number): BendGoal[] {
  // The water bomb side's points, tucked into its pockets, aren't guided: the cube's guides lead them far from where
  // the paper round them can take them (16 cm behind by the end), so the paper round them carries them instead.
  const tucked = ([u, v]: Vec2) => v < 0 && Math.hypot(Math.abs(u) - 0.5, v + 0.5) < 0.2;
  const body = cubeGuides(frame, { stages, stand: true }).filter((g) => !('guide' in g) || (!flap(g.guide.paper) && !tucked(g.guide.paper)));
  // The back face's middle on the sheet, and where it goes: it only rises, flat, as the box opens.
  const ref: Vec2 = [0, 0.25];
  const lift = (theta: number) => plus(ref, theta).at[1] - plus(ref, 0).at[1];
  // Standing up as cubeGuides' `stand` does: a quarter turn about the line across the box's middle, eased.
  const upright = ([x, y0, z0]: Vec3, s: number): Vec3 => {
    const turn = (Math.PI / 2) * s * s * (3 - 2 * s);
    const [y, z] = [y0 - E, z0 + 0.25];
    return [x, E + y * Math.cos(turn) - z * Math.sin(turn), -0.25 + y * Math.sin(turn) + z * Math.cos(turn)];
  };
  const round = (x: number) => Math.round(x * 1e6) / 1e6 || 0;
  const layers = frame.faces_layer ?? [];
  // Each loose flap, ear and all, lies on the back face, so it goes up with it, rigidly. Down at the hole's end,
  // where it's hinged, the paper under it folds over onto the end, which a rigid flap can't follow: that part is
  // left unguided, carried by the paper round it.
  const hinge = -E - 0.02;
  const loose = toFlat(frame).flatMap((f, n) => {
    const middle: Vec2 = [f.paper.reduce((a, q) => a + q[0], 0) / f.paper.length, f.paper.reduce((a, q) => a + q[1], 0) / f.paper.length];
    if (!flap(middle)) return [];
    const place = placeLike(f);
    return lattice(f.paper, 0.04).flatMap((q): BendGoal[] => {
      const [x, z] = place(q);
      if (z > hinge) return [];
      const path = Array.from({ length: stages }, (_, k): Vec3 => {
        const s = (k + 1) / stages;
        return upright([x, (layers[n] ?? 0) * LAYER_GAP + lift((s * Math.PI) / 2), z], s).map(round) as Vec3;
      });
      return [{ guide: { paper: q.map(round) as Vec2 }, path }];
    });
  });
  return [...body, ...loose];
}
