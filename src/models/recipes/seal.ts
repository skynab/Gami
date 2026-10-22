import { paper, Recipe, table, type At } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';
import { fishBase } from './fish-base';

/**
 * The traditional seal, after origami.me/seal: a fish base folded in half and turned on its side, the front
 * point reverse-folded up for the neck, the fish base's flaps turned forward as flippers, the tail turned up and
 * the head turned forward, each by a reverse fold.
 */
export function seal() {
  const r = new Recipe({ id: 'seal', title: 'Seal', sheet: { size: [1, 1], front: '#f6f3ec', back: '#8a7a5c' } });
  const { h, k, sheet, onDiamond } = fishBase(r);
  r.along(table(0, -1), table(0, 1), table(-0.1, 0), { title: 'Fold in half', text: 'Fold the left half over onto the right.' });
  r.rotate(90, { title: 'Turn it', text: 'Turn it a quarter turn, so the flaps point to the left.' });
  // Lying on its side now: the fold along the bottom (z = spine), the head end on the left, the tail on the
  // right. Each reverse fold swings a point up between the layers about the line bisecting where it points
  // and where it should, through a point on the bottom fold.
  const spine = r.where(paper(0, 0))[1];
  const swing = (root: number, from: Vec2, to: Vec2): [Vec2, Vec2] => {
    const bis: Vec2 = [from[0] + to[0], from[1] + to[1]];
    return [[root, spine], [root + bis[0], spine + bis[1]]];
  };
  const dir = (deg: number): Vec2 => [Math.cos((deg * Math.PI) / 180), -Math.sin((deg * Math.PI) / 180)];
  const neck = swing(-0.12, [-1, 0], dir(110));
  r.collapse(
    { title: 'Raise the neck', text: 'Open the left point a little and push it up between the layers, for the neck.', kind: 'reverse' },
    [{ through: [table(...neck[0]), table(...neck[1])], kind: 'inside' }],
    paper(...sheet(0, h * 0.6)),
  );
  const tail = swing(0.55, [1, 0], dir(40));
  r.collapse(
    { title: 'Turn the tail up', text: 'Push the right point up between the layers, for the tail.', kind: 'reverse' },
    [{ through: [table(...tail[0]), table(...tail[1])], kind: 'inside' }],
    paper(...sheet(0, -h * 0.2)),
  );
  // The head: the neck's tip turned forward and down, between its layers.
  const nose = sheet(0, -h);
  const tip = r.where(paper(...nose));
  const up = dir(110);
  const hb: Vec2 = [tip[0] - up[0] * 0.1, tip[1] - up[1] * 0.1];
  const fwd = dir(200);
  r.collapse(
    { title: 'Turn the head', text: 'Push the tip of the neck forward between its layers, for the head.', kind: 'reverse' },
    [{ through: [table(...hb), table(hb[0] + up[0] + fwd[0], hb[1] + up[1] + fwd[1])], kind: 'inside', only: (c) => Math.hypot(c[0] - nose[0], c[1] - nose[1]) < 0.4 }],
    paper(...sheet(0, h * 0.6)),
  );
  // The flippers: the fish base's flaps lie one on each side, joined to the body along their crease from P
  // (where the kite creases meet) to the sheet's edge. No flat fold swings them below the chest without
  // tearing rigid paper, so they're bent out from the sides, as the whale's fins are.
  const d = (h - k) / 2;
  r.shape({ title: 'Open the flippers', text: 'Lift the two flaps out from the sides, for the flippers. Your seal is done!' },
    [-1, 1].map((s) => ({
      through: [paper(...sheet(s * k, 0)), paper(...sheet(s * (k + d), -d))] as [At, At],
      moving: paper(...sheet(s * h, 0)),
      degrees: 60,
      only: (c: Vec2) => {
        const [x0, z] = onDiamond(c);
        const x = s * x0;
        return x > k - 1e-9 && z > -(x - k) - 1e-9;
      },
    })),
  );
  return r.build();
}
