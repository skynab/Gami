import { paper, Recipe, table } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';
import { birdBase } from './bird-base';

/**
 * The traditional standing crow, following the order of folds at origami.me/crow: a bird base, one flap
 * folded down for the tail, the two legs reverse-folded out as feet, then folded in half with the head
 * reverse-folded at the top.
 */
export function crow() {
  const r = new Recipe({ id: 'crow', title: 'Crow', sheet: { size: [1, 1], front: '#2f3540', back: '#f6f3ec' } });
  const { B, P, up, front, back } = birdBase(r);

  // The legs: the two thin points at the bottom, each the sheet's other two quarters.
  const legs: [(c: Vec2) => boolean][] = [[([u, v]) => u > 0 && v > 0], [([u, v]) => u < 0 && v < 0]];
  // The legs lie one on the other. Both feet turn out at once, one to each side, from a little way up the legs,
  // by reverse folds on the lines bisecting straight down and straight out.
  const root = up(0.16);
  r.collapse(
    { title: 'Make the feet', text: 'Push the point of each leg up between its layers so one sticks out to the left and one to the right, for the feet.', kind: 'reverse' },
    legs.map(([leg], i) => {
      const side = i === 0 ? 1 : -1;
      return { through: [table(...root), table(root[0] + side, root[1] + 1)], kind: 'inside' as const, only: leg };
    }),
    paper(0.3, -0.3),
  );

  // The flap facing us (the back flap, petal-folded second) folds down at its widest point, where it joins the
  // body: on the sheet, the part of its quarter more than 0.207 from the centre along the diagonal.
  r.along(table(-2, P[1]), table(2, P[1]), paper(-0.5, 0.5), {
    title: 'Fold the top flap down',
    text: 'Fold the top flap down at the widest point, so its tip points to the bottom.',
    only: (c) => back(c) && (c[1] - c[0]) / Math.SQRT2 > Math.SQRT1_2 - 0.5 + 1e-6,
  }).turnOver('Turn it over.');

  r.along(table(B[0], -2), table(B[0], 2), table(B[0] + 0.1, P[1]), { title: 'Fold in half', text: 'Fold the right half over onto the left.' });

  // The head: the top point, the front flap's tip, turned forwards and a little down between its layers.
  const tip = r.where(paper(0.5, -0.5));
  const base: Vec2 = [tip[0], tip[1] + 0.17];
  const toward = norm([-1, 0.35]);
  const line = norm([toward[0], toward[1] - 1]);
  r.collapse(
    { title: 'Make the head', text: 'Push the top point down between its layers so it points forwards, for the head and beak. Your crow is done!', kind: 'reverse' },
    [{ through: [table(...base), table(base[0] + line[0], base[1] + line[1])], kind: 'inside', only: front }],
    paper(-0.3, 0.3),
  );
  return r.build();
}

function norm(v: Vec2): Vec2 {
  const l = Math.hypot(v[0], v[1]);
  return [v[0] / l, v[1] / l];
}
