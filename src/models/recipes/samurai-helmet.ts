import { placeLike, toFlat } from '../../fold/fold';
import { LAYER_GAP } from '../../fold/frames';
import { dist } from '../../fold/geometry2d';
import type { BendGoal } from '../../fold/ops';
import { paper, Recipe, table } from '../../fold/recipe';
import { inside } from '../../fold/select';
import type { FoldFrame, Vec2, Vec3 } from '../../fold/types';
import { lattice, openCup } from './cup';

/** The kabuto, a samurai helmet. Folded flat, then opened at the bottom and stood on its brim, as the pirate hat is. */
export function samuraiHelmet() {
  // Turned to a diamond, the sheet's corners sit this far from the centre:
  // TL on the left, TR at the top, BR on the right, BL at the bottom.
  const r = Math.SQRT1_2;
  const TL: Vec2 = [-0.5, -0.5];
  const TR: Vec2 = [0.5, -0.5];
  const BR: Vec2 = [0.5, 0.5];
  const BL: Vec2 = [-0.5, 0.5];
  // Each horn is the tip of a corner flap: the part of the sheet near that corner.
  const near = (corner: Vec2) => (centre: Vec2) => dist(centre, corner) < 0.3;
  // A horn swings 45° out from straight up, about the middle of the helmet's base.
  const base = r / 2;
  const tilt = Math.PI / 8;

  const helmet = new Recipe({ id: 'samurai-helmet', title: 'Samurai helmet', sheet: { size: [1, 1], front: '#3b5bd9', back: '#f6f3ec' } })
    .rotate(45, { title: 'Turn it to a diamond', text: 'Turn the square so a corner points towards you.' })
    .crease(paper(...TL), paper(...BR), { title: 'Crease down the middle', text: 'Fold the left corner over to the right corner and unfold, to mark the middle.' })
    .onto(paper(...TR), paper(...BL), { title: 'Fold in half', text: 'Bring the top corner down to the bottom corner, making a triangle.' })
    .onto(paper(...TL), table(0, r), { title: 'Fold the left corner down', text: 'Bring the left corner down to the bottom point.' })
    .onto(paper(...BR), table(0, r), { title: 'Fold the right corner down', text: 'Bring the right corner down to match. Now it’s a diamond.' })
    .along(table(-1, base), table(1, base), table(0, r), {
      title: 'Fold the flaps up',
      text: 'Fold the two loose bottom points up to the top point.',
      layers: 2,
    })
    .along(table(0, base), table(-Math.sin(tilt), base - Math.cos(tilt)), table(0, 0.02), {
      title: 'Fold out the left horn',
      text: 'Fold the left point out at an angle from the middle of the bottom edge.',
      only: near(TL),
    })
    .along(table(0, base), table(Math.sin(tilt), base - Math.cos(tilt)), table(0, 0.02), {
      title: 'Fold out the right horn',
      text: 'Match the right point to the left one.',
      only: near(BR),
    })
    .along(table(-1, 0.7 * r), table(1, 0.7 * r), table(0, r), {
      title: 'Fold the front point up',
      text: 'Fold the top layer of the bottom point up, so its tip goes a little past the base of the horns.',
      layers: 1,
    })
    .along(table(-1, base), table(1, base), table(0, 0.4 * r), {
      title: 'Fold the tip back down',
      text: 'Fold the tip back down along the base of the horns, making a small lip.',
      layers: 1,
      only: near(TR),
    })
    .along(table(-1, base), table(1, base), table(0, r), {
      title: 'Fold up again',
      text: 'Fold the band up along the bottom of the helmet, lip and all, making the brim.',
      layers: 3,
    })
    .turnOver('Turn it over.')
    // The back point, folded as the front one was: up past the base of the horns, its tip back down, then the band
    // up for the back of the brim.
    .along(table(-1, 0.7 * r), table(1, 0.7 * r), table(0, r), {
      title: 'Fold the back point up',
      text: 'Fold the last bottom point up in the same way, so its tip goes a little past the base of the horns.',
      layers: 1,
    })
    .along(table(-1, base), table(1, base), table(0, 0.4 * r), {
      title: 'Fold the tip back down',
      text: 'Fold its tip back down along the base of the horns.',
      layers: 1,
      only: near(BL),
    })
    .along(table(-1, base), table(1, base), table(0, r), {
      title: 'Fold up again',
      text: 'Fold the band up along the bottom, lip and all, for the back of the brim.',
      layers: 3,
    })
    .turnOver('Turn it back over.');

  // Opened at the bottom, the front and back walls bow apart into a mouth and the helmet stands on its brim, as the
  // pirate hat does.
  return helmet
    .bend(
      { title: 'Open it and stand it up', text: 'Open the bottom, pushing the front and back apart, and stand the helmet on its brim. Done!' },
      { flex: () => true, anchor: [0, 0], goals: opening(helmet.current), mesh: 0.07, stages: STAGES, free: true },
    )
    .build();
}

/** How far the helmet's sides turn in at the brim as it opens, and the frames it opens through. */
const SQUEEZE = (8 * Math.PI) / 180;
const STAGES = 10;

/**
 * Guides taking the flat helmet open and standing it on its brim: the cup's opening (`openCup`) turned upside down,
 * closed at the top point and open along the brim, as the pirate hat's, the walls split between the layers of the two
 * halves of the sheet (either side of the first fold). The horns stick out past the helmet's sides, so their points
 * carry on from the side's edge along the wall.
 */
function opening(frame: FoldFrame): BendGoal[] {
  const faces = toFlat(frame);
  const corners = faces.flatMap((f) => f.world);
  const brim = Math.max(...corners.map(([, z]) => z));
  const top = Math.min(...corners.map(([, z]) => z));
  const rim = Math.max(...corners.filter((q) => Math.abs(q[1] - brim) < 1e-9).map(([x]) => Math.abs(x)));
  const height = brim - top;
  const open = (k: number) => openCup({ bottom: 0, rim, height }, SQUEEZE * (k / STAGES) ** 2);
  const stages = Array.from({ length: STAGES }, (_, k) => open(k + 1));
  const halfWidth = (v: number) => (rim * v) / height;
  const along = (shape: (x: number, v: number) => Vec3, x: number, v: number): Vec3 => {
    const w = halfWidth(v);
    if (Math.abs(x) <= w) return shape(x, v);
    const s = Math.sign(x);
    const edge = shape(s * w, v);
    const before = shape(s * (w - 1e-4), v);
    const t = edge.map((c, i) => c - before[i]);
    const len = Math.hypot(...t) || 1;
    return edge.map((c, i) => c + (t[i] / len) * (Math.abs(x) - w)) as Vec3;
  };
  const wall = (q: Vec2) => faces.find((f) => inside(f.paper, q))!.layer;
  const pocket = (wall([0.2, -0.2]) + wall([-0.2, 0.2])) / 2;
  const round6 = (x: number) => Math.round(x * 1e6) / 1e6 || 0;
  const rimUp = stages[STAGES - 1](rim, height)[2];
  return faces.flatMap((f) => {
    const side = f.layer < pocket ? -1 : 1;
    const out = (f.layer - pocket) * LAYER_GAP;
    const place = placeLike(f);
    return lattice(f.paper).map((q): BendGoal => {
      const [x, z] = place(q);
      const path = stages.map((shape, k): Vec3 => {
        const [across, depth, up] = along(shape, x, z - top);
        const turn = ((Math.PI / 2) * (k + 1)) / STAGES;
        const [dy, dz] = [side * depth + out, up - rimUp];
        return [across, pocket * LAYER_GAP + dy * Math.cos(turn) - dz * Math.sin(turn), brim + dy * Math.sin(turn) + dz * Math.cos(turn)].map(round6) as Vec3;
      });
      return { guide: { paper: q.map(round6) as Vec2 }, path };
    });
  });
}
