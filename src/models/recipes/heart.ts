import { paper, Recipe, table } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';

/**
 * A simple heart, following origami.me/heart. The bottom corners fold behind to make the point, and those
 * two flaps stay put when the top folds down: they become the two humps.
 */
export function heart() {
  const r = new Recipe({ id: 'heart', title: 'Heart', sheet: { size: [1, 1], front: '#f6f3ec', back: '#e5484d' } })
    .crease(paper(-0.5, 0), paper(0.5, 0), { title: 'Fold in half', text: 'Start white side up. Fold in half side to side, then unfold.' })
    .crease(paper(0, -0.5), paper(0, 0.5), { title: 'Fold in half the other way', text: 'Fold in half top to bottom, then unfold.' })
    .onto(paper(0, 0.5), paper(0, 0), { title: 'Fold the bottom edge up', text: 'Fold the bottom edge up to the middle crease.' })
    .turnOver()
    .onto(table(-0.5, 0.25), table(0, -0.25), {
      title: 'Fold the left corner up',
      text: 'Fold the bottom edge up to the centre crease, making a point.',
    })
    .onto(table(0.5, 0.25), table(0, -0.25), { title: 'Fold the right corner up', text: 'Match it on the right.' })
    .turnOver();

  // The flaps just folded behind, as a test on the sheet: on the main sheet (v ≤ ¼) and on the strip folded
  // up over it (v > ¼), the parts below the two slanted creases.
  const behind = ([u, v]: Vec2) => (v <= 0.25 ? v > 0.25 - Math.abs(u) : v < 0.25 + Math.abs(u));
  const left = (c: Vec2) => behind(c) && c[0] < 0;
  const right = (c: Vec2) => behind(c) && c[0] > 0;

  return r
    .onto(table(-0.5, -0.5), table(0, 0), { title: 'Fold the top left edge down', text: 'Fold the top left edge down to the centre crease.' })
    .onto(table(0.5, -0.5), table(0, 0), { title: 'Fold the top right edge down', text: 'Match it on the right. It’s a diamond now.' })
    .along(table(-1, -0.125), table(1, -0.125), table(0, -0.5), {
      title: 'Fold the top down',
      text: 'Fold the top point down to the bottom point. Leave the white triangles at the sides and the layers behind them where they are.',
      only: (c) => !behind(c),
    })
    .along(table(-0.25, -1), table(-0.25, 1), table(-0.375, -0.125), {
      title: 'Fold the left corner in',
      text: 'Fold the white triangle in, where the white meets the colour.',
    })
    .along(table(0.25, -1), table(0.25, 1), table(0.375, -0.125), { title: 'Fold the right corner in', text: 'And the other one.' })
    .onto(table(-0.25, -0.25), table(-0.125, -0.125), {
      title: 'Fold the top corners down',
      text: 'Fold the outer top corner down to the crease from the big fold.',
      only: left,
    })
    .onto(table(0, -0.25), table(-0.125, -0.125), { title: 'Fold the inner corner down', text: 'Then the inner one, making a point.', only: left })
    .onto(table(0.25, -0.25), table(0.125, -0.125), { title: 'Fold the right corners down', text: 'The same on the right side: the outer corner…', only: right })
    .onto(table(0, -0.25), table(0.125, -0.125), { title: 'Fold the last corner down', text: '…and the inner one. Four corners in all.', only: right })
    .along(table(-1, -0.2), table(1, -0.2), table(-0.125, -0.25), {
      title: 'Round off the top',
      text: 'Fold the two top points down a little. Anywhere looks fine.',
      only: behind,
    })
    .turnOver('Turn it over. Done!')
    .build();
}
