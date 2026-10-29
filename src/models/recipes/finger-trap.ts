import { Recipe, table } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';

/**
 * A finger trap, Gami's own, after the look of OrigamiOK's woven tube but with no cuts: a square with its top and
 * bottom edges folded to the middle, turned over, criss-crossed with a pen for the weave, and curled round across
 * its width into a long, thin tube.
 */
export function fingerTrap() {
  const r = new Recipe({ id: 'finger-trap', title: 'Finger trap', card: 'finished', sheet: { size: [1, 1], front: '#3aa7a0', back: '#f2e3b3' } });
  r.together({ title: 'Fold the edges to the middle', text: 'Start dark side up. Fold the top and bottom edges to the middle.' }, (q) => {
    for (const s of [-1, 1]) q.along(table(-1, s / 4), table(1, s / 4), table(0, s * 0.4), { title: '' });
  });
  r.turnOver('Turn it over: a plain strip.');
  // The weave: lines slanting both ways across the strip, `gap` apart, drawn just inside its edges.
  const gap = 0.1;
  const h = 0.24;
  const lines: { line: Vec2[] }[] = [];
  for (let x = -0.5 - 2 * h; x < 0.5; x += gap) {
    for (const s of [-1, 1]) {
      // From the top edge down to the bottom edge, slanting by 2h across; clipped to the strip's ends.
      let [a, b]: Vec2[] = [[x, -s * h], [x + 2 * h, s * h]];
      const clip = (p: Vec2, q: Vec2, at: number): Vec2 => [at, p[1] + ((q[1] - p[1]) * (at - p[0])) / (q[0] - p[0])];
      if (a[0] < -0.49) a = clip(a, b, -0.49);
      if (b[0] > 0.49) b = clip(a, b, 0.49);
      if (b[0] - a[0] > 0.02) lines.push({ line: [a, b] });
    }
  }
  return r
    .draw({ title: 'Draw the weave', text: 'Draw lines slanting both ways across the strip, criss-crossing, like a woven tube.' }, lines)
    .shape({ title: 'Roll it into a tube', text: 'Roll the strip round across its width into a long, thin tube, the lines outside. Slip a finger in each end and pull!' }, [
      { through: [table(-1, -h), table(1, -h)], moving: table(0, 0.25), degrees: -340, segments: 16 },
    ])
    .build();
}
