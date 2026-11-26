import { paper, Recipe, table } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';
import { squareBase, squareBaseFlaps } from './bird-base';

/** How far down from its tip each hoof is folded in. */
export const HOOF = 0.07;
/** How far up the neck from its tip the head is folded out, and its angle below level once the horse stands (degrees). */
export const HEAD_AT = 0.13;
export const HEAD = 20;

/** The point a fold along the line through `a` and `b` takes `p` to. */
function reflect(p: Vec2, a: Vec2, b: Vec2): Vec2 {
  const d: Vec2 = [b[0] - a[0], b[1] - a[1]];
  const len = Math.hypot(...d);
  const u: Vec2 = [d[0] / len, d[1] / len];
  const k = (p[0] - a[0]) * u[0] + (p[1] - a[1]) * u[1];
  const foot: Vec2 = [a[0] + k * u[0], a[1] + k * u[1]];
  return [2 * foot[0] - p[0], 2 * foot[1] - p[1]];
}

/**
 * The traditional horse, following the order of folds at origami.me/horse, from one square: a square base, its front
 * and back creased as for a petal fold and cut up the middle as far as the crease across it; each cut half lifted up
 * on a line from its side corner to the top of the cut, for four legs; the hooves' tips folded in; the sides folded in
 * to the middle on the kite creases, front and back; then the two inner flaps at the bottom: one reverse-folded out level for the tail, the other
 * left standing as the neck with its tip reverse-folded out for the head; turned round so it stands on its legs.
 */
export function horse() {
  const r = new Recipe({ id: 'horse', title: 'Horse', sheet: { size: [1, 1], front: '#9a6440', back: '#f4ead8' } });
  squareBase(r);
  const b = squareBaseFlaps(r);
  const { T, B, P } = b;
  // The square base as a diamond: the closed point T at the top, the loose corners B at the bottom, the side corners
  // either side, and the top of the cut Pc on the middle line, level with the kite flaps' tops.
  const side = (u: number, v: number) => r.where(paper(u, v));
  const [left, right] = [side(0.5, 0), side(0, -0.5)].sort((p, q) => p[0] - q[0]);
  const Pc: Vec2 = [B[0], P[1]];

  // Kite folds, the top folded down over them, all opened out again: the creases the legs and sides fold on.
  const creases = (second: boolean) => {
    const before = r.mark();
    r.onto(table(...left), table(...P), {
      title: 'Fold the left edge to the middle',
      text: second ? 'As before: the lower left edge of the top layer to the middle crease.' : 'Fold the lower left edge of the top layer in to the middle crease.',
      layers: 2,
    })
      .onto(table(...right), table(...P), { title: 'Fold the right edge to the middle', text: 'Then the lower right edge, making a kite.', layers: 2 })
      .along(table(-2, P[1]), table(2, P[1]), table(...T), {
        title: 'Fold the top down',
        text: 'Fold the top triangle down over the kite, along the top edges of its flaps, and crease it hard.',
      })
      .unfold({ title: 'Unfold', text: 'Open the top and the kite flaps back out.', to: before });
  };
  const cut = (only: (c: Vec2) => boolean) =>
    r.cut(table(...B), table(...Pc), {
      title: 'Cut up the middle',
      text: 'With scissors, cut just the top layer along the middle crease, from the bottom corner up to where the crease across meets it.',
      only,
    });

  creases(false);
  cut(b.front);
  r.turnOver('Turn the paper over.');
  creases(true);
  cut(b.back);
  r.turnOver('Turn it back over.');

  // The legs: each cut half of the top layer lifted on the line from its side corner to the top of the cut. Its
  // bottom edges are the sheet's loose edges, so it's joined to nothing below that line.
  const lifted = r.lying((p) => p[1] > Pc[1]);
  // Which paper lies left of the middle, asked afresh after each turn over.
  const onLeft = () => r.lying((p) => p[0] < B[0]);
  const legs = (top: (c: Vec2) => boolean, title: string, text: string) => {
    const leftHalf = onLeft();
    return r.together({ title, text }, (q) => {
      q.along(table(...left), table(...Pc), table(B[0] - 0.02, B[1] - 0.05), { title: '', only: (c) => top(c) && lifted(c) && leftHalf(c) });
      q.along(table(...Pc), table(...right), table(B[0] + 0.02, B[1] - 0.05), { title: '', only: (c) => top(c) && lifted(c) && !leftHalf(c) });
    });
  };
  legs(b.front, 'Lift the front legs', 'Fold each cut half up, on a line from its side corner to the top of the cut. They stand up as two tall points.');
  // The hooves: each leg's tip, where the bottom corner landed, folded in a little, square to the leg.
  const tipL = reflect(B, left, Pc);
  const tipR = reflect(B, Pc, right);
  const hooves = (top: (c: Vec2) => boolean, title: string, text: string) => {
    const leftHalf = onLeft();
    return r.together({ title, text }, (q) => {
      for (const [tip, foot, mine] of [[tipL, left, true], [tipR, right, false]] as [Vec2, Vec2, boolean][]) {
        const d = Math.hypot(foot[0] - tip[0], foot[1] - tip[1]);
        const along: Vec2 = [(foot[0] - tip[0]) / d, (foot[1] - tip[1]) / d];
        const at: Vec2 = [tip[0] + along[0] * HOOF, tip[1] + along[1] * HOOF];
        q.along(table(...at), table(at[0] - along[1], at[1] + along[0]), table(...tip), { title: '', only: (c) => top(c) && leftHalf(c) === mine });
      }
    });
  };
  hooves(b.front, 'Fold in the hooves', 'Fold the tip of each leg in a little, straight across, for the hooves.');
  // The sides in to the middle on the kite creases, which run from the bottom corner to each leg's tip.
  // The top layers there: this side's quarter (its leg and what's left above the cut) and the inner flaps' halves
  // joined to it along the base's top edges.
  const sides = (top: (c: Vec2) => boolean, title: string, text: string) => {
    const leftHalf = onLeft();
    return r.together({ title, text }, (q) => {
      q.along(table(...B), table(...tipL), table(...left), { title: '', only: (c) => top(c) && leftHalf(c) });
      q.along(table(...tipR), table(...B), table(...right), { title: '', only: (c) => top(c) && !leftHalf(c) });
    });
  };
  sides((c) => b.front(c) || b.innerFront(c), 'Fold the sides in', 'Fold the left and right sides in to the middle, on the creases from the bottom corner to each leg’s tip.');

  r.turnOver('Turn the paper over.');
  legs(b.back, 'Lift the back legs', 'Lift this side’s cut halves the same way.');
  hooves(b.back, 'Fold in the hooves', 'Fold in the tips of these legs too.');
  sides((c) => b.back(c) || b.innerBack(c), 'Fold the sides in', 'And fold the sides in to the middle on this side as well.');

  // The tail: the right inner flap's bottom point swung out level, its fold bisecting the middle line and the
  // crease across, so the middle line lands on that crease. The head: the left one, swung up at an angle.
  const rightHalf = r.lying((p) => p[0] > B[0]);
  const leftHalf = onLeft();
  const tailDir: Vec2 = [Math.SQRT1_2, Math.SQRT1_2];
  r.collapse(
    { title: 'Make the tail', text: 'Push the bottom right point out to the right between its layers, so it sticks out level: the tail.', kind: 'reverse' },
    [{ through: [table(...Pc), table(Pc[0] + tailDir[0], Pc[1] + tailDir[1])], kind: 'inside', only: rightHalf }],
    r.sheetAt([B[0] - 0.18, Pc[1] - 0.1]),
  );
  // The head: the left one's tip, `HEAD_AT` up from the bottom corner, its middle line (pointing down) turned to point
  // left and `HEAD` above level, which is below level once the horse is turned round; the rest of the flap stands
  // straight up as the neck.
  const H: Vec2 = [B[0], B[1] - HEAD_AT];
  const tilt = (HEAD * Math.PI) / 180;
  const goal: Vec2 = [-Math.cos(tilt), -Math.sin(tilt)];
  const bis: Vec2 = [goal[0], goal[1] + 1];
  r.collapse(
    { title: 'Make the head', text: 'Push the tip of the bottom left point out to the left between its layers, for the head. The rest of that point is the neck.', kind: 'reverse' },
    [{ through: [table(...H), table(H[0] + bis[0], H[1] + bis[1])], kind: 'inside', only: leftHalf }],
    r.sheetAt([B[0] + 0.18, Pc[1] - 0.1]),
  );
  r.rotate(180, { title: 'Stand it up', text: 'Turn the horse round so it stands on its legs. Done!' });
  return r.build();
}
