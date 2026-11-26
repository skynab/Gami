import { paper, Recipe, table } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';
import { diamond, frogBase, pageOf } from './frog-base';

/** How far down from the top the shoulders are cut. */
export const SHOULDER = 0.16;
/**
 * Where the first legs turn out, down the middle from the top, and how much lower each later pair turns out; each
 * pair's angle above level, last the claws.
 */
export const ROOT = 0.4;
export const DROP = 0.015;
export const FAN = [0, 15, 30, 45];
/** How far along each leg the knee is, and how far the claws' and legs' tips turn there (degrees). */
export const KNEE = 0.18;
export const CLAW = 70;
export const LEG = 50;

/**
 * The traditional crab, following the order of folds at origami.me/crab: the frog base; its long lower point cut up
 * the middle, so each of the sheet's four corners (a quarter folded in half along the middle) parts into two flaps;
 * every flap narrowed; two short cuts at the shoulders and the top folded down between them for the shell; then the
 * flaps turned out in pairs, each lower down and steeper than the last, for six legs and two claws, all bent at the knee, and turned
 * over. origami.me cuts each corner on its own, between page turns, tucks the top under the top layer and turns
 * each later pair out behind the last; here the middle is cut through every layer at once, the top lies over the
 * front, and each pair turns out over the last (behind, it swings through the flaps still to come).
 */
export function crab() {
  const r = new Recipe({ id: 'crab', title: 'Crab', sheet: { size: [1, 1], front: '#d4533b', back: '#f7e3d6' } });
  frogBase(r);
  const { T, left, bottom } = diamond(r);
  // The middle cut runs from the bottom point up to the frog base's widest points.
  const waist = left[1];
  r.cut(table(T[0], bottom[1] + 0.01), table(T[0], waist), {
    title: 'Cut up the middle',
    text: 'With scissors, cut the long lower point up the middle, through all the layers, as far as the widest part. Each corner of the paper parts into two thin flaps.',
  });

  // Narrowing: the top flap's lower outer edge on each side folds to the middle line, from the bottom point. Each
  // flap is a page: half of a quarter of the sheet.
  // The middle line moves when the paper turns over lopsided, so each step finds it afresh.
  const widest = (2 - Math.SQRT2) / 4;
  const narrow = (title: string, text: string) => {
    const { T, bottom } = diamond(r);
    const topPage = (side: -1 | 1) => pageOf(r.stackAt([T[0] + side * 0.01, T[1] + 0.55])[0]);
    const [lp, rp] = [topPage(-1), topPage(1)];
    const B = table(...bottom);
    const w = T[1] + 0.5 - widest;
    return r.together({ title, text, kind: 'fold' }, (q) => {
      q.edgeOnto([B, table(T[0] - widest, w)], [B, table(...T)], { title: '', only: lp });
      q.edgeOnto([B, table(T[0] + widest, w)], [B, table(...T)], { title: '', only: rp });
    });
  };
  /** Turns the top two flaps on the right over to the left, as pages. */
  const turnTwo = (title: string, text: string) => {
    const { T } = diamond(r);
    const pages: ((c: Vec2) => boolean)[] = [];
    for (const c of r.stackAt([T[0] + 0.01, T[1] + 0.3])) if (!pages.some((p) => p(c)) && pages.length < 2) pages.push(pageOf(c));
    return r.along(table(T[0], -2), table(T[0], 2), table(T[0] + 0.1, T[1] + 0.35), { title, text, only: (c) => pages.some((p) => p(c)) });
  };
  narrow('Narrow the flaps', 'Fold the lower edges of the top layer in to the middle line.');
  r.turnOver('Turn over.');
  narrow('Narrow this side', 'The same on this side.');
  turnTwo('Turn two pages', 'Turn the top two flaps on the right over to the left.');
  narrow('Narrow again', 'Fold these lower edges in to the middle line too.');
  r.turnOver('Turn over.');
  turnTwo('Turn two pages', 'Turn the top two flaps on the right over to the left here too.');
  narrow('Narrow the last flaps', 'And fold in the last two lower edges.');

  // The shell: two short cuts slanting in and down from the sides of the top part, then the top folded down on the
  // level line through their inner ends. The bits beside the cuts stay up as eyes.
  {
    const { T } = diamond(r);
    const half = (z: number) => widest * ((z - T[1]) / (0.5 - widest));
    const [zc, zl] = [T[1] + SHOULDER, T[1] + SHOULDER + 0.03];
    const inner = 0.03;
    const cutLine = (s: -1 | 1) => {
      const edge: Vec2 = [T[0] + s * half(zc), zc];
      const end: Vec2 = [T[0] + s * inner, zl];
      return { edge, end, start: [edge[0] + (edge[0] - end[0]) * 0.2, edge[1] + (edge[1] - end[1]) * 0.2] as Vec2 };
    };
    const [cl, cr] = [cutLine(-1), cutLine(1)];
    r.together({ title: 'Cut the shoulders', text: 'With scissors, make a short cut in from each side of the top part, slanting a little down, through all the layers.' }, (q) => {
      q.cut(table(...cl.start), table(...cl.end), { title: '' }).cut(table(...cr.start), table(...cr.end), { title: '' });
    });
    // Above both cuts' lines: the top, but not the bits between the cuts and the fold.
    const below = (c: { edge: Vec2; end: Vec2 }, [x, z]: Vec2) => z > c.end[1] + ((x - c.end[0]) * (c.edge[1] - c.end[1])) / (c.edge[0] - c.end[0]);
    const top = r.lying((p) => !below(cl, p) && !below(cr, p) && p[1] < zl);
    r.along(table(-2, zl), table(2, zl), table(T[0], T[1] + 0.02), {
      title: 'Fold the top down',
      text: 'Fold the top point down between the cuts, on a level line through their ends, over the front. The bits beside the cuts stay up as eyes.',
      only: top,
    });
  }

  // The legs: the top flap each side turned out on a line from the middle, `ROOT` down, a pair at a time, each pair
  // over the last and steeper, fanning out: `FAN` gives each pair's angle above level. The last pair is the claws.
  // Measured up from the bottom point (the sheet's corners), as the top has been folded down. Each pair turns out
  // `DROP` lower than the last, so it swings up clear of the bases of those already out rather than through them
  // (0.0075 deep, 26 November 2026, all from one point); the third pair one side at a time, as the two sides of a
  // pair overlap a little at the middle and would otherwise pass through each other there (0.0035).
  const foot = r.where(paper(0.5, 0.5));
  const first: Vec2 = [foot[0], foot[1] - Math.SQRT1_2 + ROOT];
  const rad = (d: number) => (d * Math.PI) / 180;
  const legs: { page: (c: Vec2) => boolean; dir: Vec2; root: Vec2 }[] = [];
  const titles = [
    [['Turn out the first legs', 'Fold the top flap on each side out to the side, on a line slanting down from the middle. They stick out nearly level.']],
    [['Turn out the next legs', 'Fold the next flap on each side out over the first pair, from a little lower down and a little steeper, so they fan out above it.']],
    [
      ['Turn out a third leg', 'The same with the third flap on the left, a little lower and steeper again.'],
      ['And the other', 'And the third flap on the right.'],
    ],
    [['Turn out the claws', 'And the last pair, lower again and steepest of all: these are the claws.']],
  ];
  FAN.forEach((deg, k) => {
    const root: Vec2 = [first[0], first[1] + k * DROP];
    const pair = ([-1, 1] as const).map((s) => {
      const page = pageOf(r.stackAt([root[0] + s * 0.01, root[1] + 0.1])[0]);
      const dir: Vec2 = [s * Math.cos(rad(deg)), -Math.sin(rad(deg))];
      // The flap's paper on the leg's side of the fold line, before it turns out: its leg, not its part in the body.
      const along: Vec2 = [dir[0], dir[1] + 1];
      const side = (x: number, z: number) => along[0] * (z - root[1]) - along[1] * (x - root[0]);
      const legSide = Math.sign(side(root[0], root[1] + 0.1));
      const lying = r.lying(([x, z]) => side(x, z) * legSide > 0);
      return { s, page, dir, leg: (c: Vec2) => page(c) && lying(c) };
    });
    const groups = titles[k].length > 1 ? pair.map((p) => [p]) : [pair];
    groups.forEach((group, g) => r.together({ title: titles[k][g][0], text: titles[k][g][1] }, (q) => {
      for (const { page, dir } of group) {
        // The line through the root halfway between pointing down and pointing `dir`.
        const along: Vec2 = [dir[0], dir[1] + 1];
        q.along(table(...root), table(root[0] + along[0], root[1] + along[1]), table(root[0], root[1] + 0.1), {
          title: '',
          kind: 'valley',
          only: page,
        });
      }
    }));
    legs.push(...pair.map(({ leg, dir }) => ({ page: leg, dir, root })));
  });
  // The knees: each leg bent `KNEE` out from the root, the claws' tips in towards the middle, the legs' down and out.
  const bend = (leg: { page: (c: Vec2) => boolean; dir: Vec2; root: Vec2 }, turn: number) => {
    const { root } = leg;
    const k: Vec2 = [root[0] + leg.dir[0] * KNEE, root[1] + leg.dir[1] * KNEE];
    const c = Math.cos(rad(turn));
    const sn = Math.sin(rad(turn));
    const to: Vec2 = [leg.dir[0] * c - leg.dir[1] * sn, leg.dir[0] * sn + leg.dir[1] * c];
    const line: Vec2 = [leg.dir[0] + to[0], leg.dir[1] + to[1]];
    return { k, line, tip: table(k[0] + leg.dir[0] * 0.05, k[1] + leg.dir[1] * 0.05) };
  };
  const claws = legs.slice(-2);
  r.together({ title: 'Bend the claws', text: 'Fold the tip of each claw in towards the middle, about halfway along.' }, (q) => {
    for (const leg of claws) {
      // Towards the middle: the left claw's tip turns clockwise (as seen), the right one's anticlockwise.
      const { k, line, tip } = bend(leg, leg.dir[0] < 0 ? CLAW : -CLAW);
      q.along(table(...k), table(k[0] + line[0], k[1] + line[1]), tip, { title: '', only: leg.page });
    }
  });
  r.together({ title: 'Bend the legs', text: 'Fold the tip of each leg down and out, about halfway along.' }, (q) => {
    for (const leg of legs.slice(0, -2)) {
      const { k, line, tip } = bend(leg, leg.dir[0] < 0 ? -LEG : LEG);
      q.along(table(...k), table(k[0] + line[0], k[1] + line[1]), tip, { title: '', only: leg.page });
    }
  });
  r.turnOver('Turn the crab over. It’s finished!');
  return r.build();
}
