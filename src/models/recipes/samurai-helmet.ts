import { dist } from '../../fold/geometry2d';
import { paper, Recipe, table } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';

/** The kabuto, a samurai helmet. Folded flat, then opened at the bottom to wear (or to hold sweets). */
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

  return new Recipe({ id: 'samurai-helmet', title: 'Samurai helmet', sheet: { size: [1, 1], front: '#3b5bd9', back: '#f6f3ec' } })
    .rotate(45, { title: 'Turn it to a diamond', text: 'Turn the square so a corner points towards you.' })
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
    .along(table(-1, 0.75 * r), table(1, 0.75 * r), table(0, r), {
      title: 'Fold the front point up',
      text: 'Fold the top layer of the bottom point up, halfway to the base of the horns.',
      layers: 1,
    })
    .along(table(-1, base), table(1, base), table(0, r), {
      title: 'Fold up again',
      text: 'Fold the band up along the bottom of the helmet, making the brim.',
      layers: 2,
    })
    .along(table(-1, base), table(1, base), table(0, r), {
      title: 'Fold the back point up behind',
      text: 'Fold the last point up behind the helmet (or tuck it inside). Open the bottom to wear it.',
      kind: 'mountain',
    })
    .build();
}
