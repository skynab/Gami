import { paper, Recipe, table } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';
import { frogBase } from './frog-base';

/**
 * The traditional frog, following the order of folds at origami.me/traditional-frog: the frog base, its lower
 * edges narrowed on all four sides, the four legs reverse-folded out, bent at the knees and feet, and the
 * head's tip folded behind.
 *
 * The frog base is in ./frog-base. Each leg is one of the sheet's corners: the quarter of the sheet around it,
 * folded in half along its diagonal.
 */
export function frog() {
  const r = new Recipe({ id: 'frog', title: 'Frog', sheet: { size: [1, 1], front: '#5fae5a', back: '#eef6e8' } });
  const { quarter } = frogBase(r);

  // Narrowing: on each side the top layer's lower edges fold to the centre line, from the bottom point. The
  // edges run from the bottom point up to the frog base's widest points, a sixth of the way across.
  const widest = (2 - Math.SQRT2) / 4;
  const narrow = (step: { title: string; text: string }) => {
    const T = r.where(paper(0, 0));
    const B = table(T[0], T[1] + Math.SQRT1_2);
    const top = (x: number) => {
      const [u, v] = r.stackAt([T[0] + x * 0.02, T[1] + 0.6])[0];
      // The half of a quarter the top face is in.
      return ([a, b]: Vec2) => Math.sign(a) === Math.sign(u) && Math.sign(b) === Math.sign(v) && Math.abs(a) > Math.abs(b) === Math.abs(u) > Math.abs(v);
    };
    const [left, right] = [top(-1), top(1)];
    return r.together({ ...step, kind: 'fold' }, (r) => {
      r.edgeOnto([B, table(T[0] - widest, T[1] + Math.SQRT1_2 / 2)], [B, table(...T)], { title: '', only: left });
      r.edgeOnto([B, table(T[0] + widest, T[1] + Math.SQRT1_2 / 2)], [B, table(...T)], { title: '', only: right });
    });
  };
  /** Turns the quarter `only` picks out over the centre line from right to left, like a page. */
  const page = (only: (c: Vec2) => boolean, step: { title: string; text: string }) => {
    const T = r.where(paper(0, 0));
    return r.along(table(T[0], -2), table(T[0], 2), table(T[0] + 0.1, T[1] + 0.5), { ...step, only });
  };
  narrow({ title: 'Narrow the bottom', text: 'Fold the lower edges of the top layer in to the centre line.' });
  r.turnOver('Turn over.');
  narrow({ title: 'Narrow this side', text: 'The same on this side.' });
  page(quarter(-1, -1), { title: 'Turn a page', text: 'Turn the top flap on the right over to the left.' });
  narrow({ title: 'Narrow again', text: 'Fold these lower edges in to the centre line too.' });
  r.turnOver('Turn over.');
  page(quarter(1, 1), { title: 'Turn a page', text: 'Turn the top right flap over to the left.' });
  narrow({ title: 'Narrow the last edges', text: 'And fold in the last two lower edges.' });

  // A reverse fold through `at` (from the sheet's centre T, on the table) turns the paper `only` picks out from
  // pointing `from` to pointing `to`, given as angles from straight up, clockwise. Its line bisects the two.
  const dir = (a: number): Vec2 => [Math.sin((a * Math.PI) / 180), -Math.cos((a * Math.PI) / 180)];
  const reverse = (
    [su, sv]: [number, number],
    at: Vec2,
    [from, to]: [number, number],
    only: (c: Vec2) => boolean,
    step: { title: string; text: string },
  ) => {
    const T = r.where(paper(0, 0));
    const p: Vec2 = [T[0] + at[0], T[1] + at[1]];
    const [f, g] = [dir(from), dir(to)];
    return r.collapse(
      { ...step, kind: 'reverse' },
      [{ through: [table(...p), table(p[0] + f[0] + g[0], p[1] + f[1] + g[1])], kind: 'inside', only }],
      paper(-su * 0.1, -sv * 0.1),
    );
  };
  /** A point `d` along a leg from `root` (straight below T), pointing at angle `a`. */
  const along = (root: number, a: number, d: number): Vec2 => [dir(a)[0] * d, root + dir(a)[1] * d];

  // Front legs (the top two quarters) turn up and a little out from just below the waist; back legs out
  // sideways from lower down.
  const front = { root: Math.SQRT1_2 / 2, angle: 20, knee: 0.16 };
  const back = { root: 0.4, angle: 75, knee: 0.15 };
  const frontLegs: [number, number][] = [[1, 1], [1, -1]];
  const backLegs: [number, number][] = [[-1, 1], [-1, -1]];
  const side = (q: [number, number], legs: [number, number][]) => (q === legs[0] ? -1 : 1);
  /**
   * The paper of quarter `q` lying along the leg from `a` to the corner, on the table (`a` from T): faces whose
   * middles are within a leg's width of that line. The body's paper lies elsewhere, so only the leg folds.
   */
  const onLeg = (q: [number, number], a: Vec2) => {
    const T = r.where(paper(0, 0));
    const p: Vec2 = [T[0] + a[0], T[1] + a[1]];
    const tip = r.where(paper(q[0] / 2, q[1] / 2));
    const d: Vec2 = [tip[0] - p[0], tip[1] - p[1]];
    const len2 = d[0] * d[0] + d[1] * d[1];
    return (c: Vec2) => {
      if (!quarter(...q)(c)) return false;
      const w = r.where(paper(...c));
      const k = Math.max(0, Math.min(1, ((w[0] - p[0]) * d[0] + (w[1] - p[1]) * d[1]) / len2));
      return Math.hypot(w[0] - p[0] - d[0] * k, w[1] - p[1] - d[1] * k) < 0.04;
    };
  };
  const lift = (legs: [number, number][], l: typeof front, steps: { title: string; text: string }[]) =>
    legs.forEach((q, i) => reverse(q, [0, l.root], [180, side(q, legs) * l.angle], quarter(...q), steps[i]));

  lift(frontLegs, front, [
    { title: 'Lift a front leg', text: 'Open the front left flap a little and reverse-fold its lower point up between its layers, so it points up beside the head.' },
    { title: 'Lift the other front leg', text: 'The same with the front right flap.' },
  ]);
  lift(backLegs, back, [
    { title: 'Turn out a back leg', text: 'Reverse-fold the back left point out to the side, a little lower down.' },
    { title: 'Turn out the other back leg', text: 'And the back right point.' },
  ]);

  // Knees: the front legs bend out level, the back legs down.
  const knee = (q: [number, number], l: typeof front, legs: [number, number][], to: number, step: { title: string; text: string }) => {
    const s = side(q, legs);
    // The leg: its quarter's paper within the leg's length of the corner, on the sheet.
    const leg = ([u, v]: Vec2) => quarter(...q)([u, v]) && Math.hypot(u - q[0] / 2, v - q[1] / 2) < Math.SQRT1_2 - l.root + 0.01;
    reverse(q, along(l.root, s * l.angle, l.knee), [s * l.angle, s * to], leg, step);
  };
  knee(frontLegs[0], front, frontLegs, 90, { title: 'Bend a front leg', text: 'Reverse-fold the front left leg out sideways, halfway along.' });
  knee(frontLegs[1], front, frontLegs, 90, { title: 'Bend the other front leg', text: 'The same on the right.' });
  knee(backLegs[0], back, backLegs, 165, { title: 'Bend a back leg', text: 'Reverse-fold the back left leg down, about halfway along.' });
  knee(backLegs[1], back, backLegs, 165, { title: 'Bend the other back leg', text: 'And the back right leg.' });

  // Feet: the last bit of each leg, bent up at the front and out at the back.
  const foot = 0.05;
  const feet = (q: [number, number], l: typeof front, legs: [number, number][], [from, to]: [number, number], step: { title: string; text: string }) => {
    const s = side(q, legs);
    const k = along(l.root, s * l.angle, l.knee);
    const rest = Math.SQRT1_2 - l.root - l.knee - foot;
    const lower = onLeg(q, [k[0] + dir(s * from)[0] * 0.02, k[1] + dir(s * from)[1] * 0.02]);
    reverse(q, [k[0] + dir(s * from)[0] * rest, k[1] + dir(s * from)[1] * rest], [s * from, s * to], lower, step);
  };
  feet(frontLegs[0], front, frontLegs, [90, 30], { title: 'Shape a front foot', text: 'Reverse-fold the tip of the front left leg up to make a foot.' });
  feet(frontLegs[1], front, frontLegs, [90, 30], { title: 'Shape the other front foot', text: 'And the front right foot.' });
  feet(backLegs[0], back, backLegs, [165, 110], { title: 'Shape a back foot', text: 'Reverse-fold the tip of the back left leg out to the side.' });
  feet(backLegs[1], back, backLegs, [165, 110], { title: 'Shape the other back foot', text: 'And the back right foot.' });

  // The head: its tip, the sheet's centre, folds behind. Nothing else reaches up that far.
  const T = r.where(paper(0, 0));
  const head = 0.06;
  r.along(table(T[0] - 1, T[1] + head), table(T[0] + 1, T[1] + head), table(T[0], T[1] + 0.01), {
    title: 'Fold the head',
    text: 'Fold the tip of the head down behind. Your frog is finished.',
    kind: 'mountain',
  });
  return r.build();
}
