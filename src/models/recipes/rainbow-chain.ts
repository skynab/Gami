import { paper, Recipe } from '../../fold/recipe';
import type { Sheet, Vec2, Vec3 } from '../../fold/types';

const RAINBOW = ['#e5534b', '#f0883e', '#f2c94c', '#57ab5a', '#5b8def', '#6c63c7', '#a66bd6'];
const LINKS = 28;

/**
 * The rainbow chain: the traditional gum wrapper chain, in seven colours, four links of each. Each link is a strip
 * folded to a quarter of its width, its ends folded to the middle and then folded in half: two halves, each with
 * its end folded back along it into a sleeve open at the sides. The next link, turned a quarter turn, slides a
 * half into each sleeve, its own halves either side of the first link's folded ends, so the chain zigzags. The
 * first strip is folded in full; the rest wait in a pile and are folded the same way.
 */
export function rainbowChain() {
  // Strip `n` has sheet coordinates around (10n, 0), its long side across. The first lies apart; the rest in a pile.
  const sheets: (Sheet & { at?: Vec2 })[] = Array.from({ length: LINKS }, (_, n) => ({
    size: [1, 0.4] as Vec2,
    front: RAINBOW[n % RAINBOW.length],
    back: '#f6f3ec',
    origin: [10 * n, 0] as Vec2,
    at: (n ? [0, -0.8] : [0, 0]) as Vec2,
  }));
  const r = new Recipe({ id: 'rainbow-chain', title: 'Rainbow chain', sheets, card: 'finished' });
  const strip = (n: number) => ([u]: Vec2) => Math.abs(u - 10 * n) < 5;
  const first = strip(0);

  // One link, from the first strip: it ends a quarter as long and a quarter as wide.
  r.move({ title: 'Take the first strip', text: 'Take a strip off the pile and turn it over, white side up, long side across.' }, first, { flip: true })
    .crease(paper(0, 0.2), paper(0, -0.2), { title: 'Crease in half lengthwise', text: 'Fold the strip in half lengthwise, long edge to long edge.', only: first })
    .together({ title: 'Fold the long edges to the middle', text: 'Fold both long edges in to meet at the crease.' }, (q) => {
      q.onto(paper(0, 0.2), paper(0, 0), { title: '', only: first }).onto(paper(0, -0.2), paper(0, 0), { title: '', only: first });
    })
    .onto(paper(0, 0.1), paper(0, -0.1), { title: 'Fold in half lengthwise', text: 'Fold it in half along the crease, so the folded edges are inside: a narrow strip, coloured all round.', only: first })
    .crease(paper(0.5, 0), paper(-0.5, 0), { title: 'Crease the middle', text: 'Fold the strip in half end to end, and unfold.', only: first })
    .together({ title: 'Fold the ends to the middle', text: 'Fold both ends in to meet at the middle crease. Each folded end makes a sleeve, open at the sides.' }, (q) => {
      q.onto(paper(0.5, 0), paper(0, 0), { title: '', only: first }).onto(paper(-0.5, 0), paper(0, 0), { title: '', only: first });
    })
    .onto(paper(0.25, 0), paper(-0.25, 0), { title: 'Fold in half', text: 'Fold it in half at the middle, ends inside. That’s one link: two halves, each with a sleeve.', only: first });

  // A link `l` long and `w` wide, from its closed end (the middle fold) to its open end (the folded ends), along its
  // middle (sheet v = −0.05, on the strip's bottom layer). Its upper half is the strip's right half (sheet u > 0);
  // each half's sleeve is between the half and its folded end.
  const at = (n: number, u: number) => r.where(paper(10 * n + u, -0.05));
  const [p0, q0] = [at(0, 0), at(0, 0.25)];
  const l = Math.hypot(q0[0] - p0[0], q0[1] - p0[1]);
  const w = 0.1;

  // The other strips, folded the same way, laid out in rows by colour.
  const others = Array.from({ length: LINKS - 1 }, (_, k) => k + 1);
  r.copy(
    { title: 'Fold the other strips', text: `Fold the other ${LINKS - 1} strips into links the same way.` },
    0,
    others,
    others.map((n): Vec2 => [-1.2 + 0.4 * (n % RAINBOW.length), -1.3 + 0.18 * Math.floor(n / RAINBOW.length)]),
  );

  // Each link slides into the one before it a quarter turn round, at its open end, until its closed end meets the
  // first link's side: its lower half into the lower sleeve, its upper half into the upper one. Turns alternate, so
  // links run across, down, across, down: a zigzag running down to the right.
  const side = (n: number, test: (u: number) => boolean) => ([u]: Vec2) => strip(n)([u, 0]) && test(u - 10 * n);
  const join = (q: Recipe, n: number, step: { title: string; text?: string }) => {
    const [p, e] = [at(n - 1, 0), at(n - 1, 0.25)];
    const dir: Vec2 = [(e[0] - p[0]) / l, (e[1] - p[1]) / l];
    // This link runs across the last one: from across to down (+z), or from down to across (+x).
    const next: Vec2 = n % 2 ? [0, 1] : [1, 0];
    const cross: Vec2 = [e[0] - (w / 2) * dir[0], e[1] - (w / 2) * dir[1]];
    const middle: Vec2 = [cross[0] + ((l - w) / 2) * next[0], cross[1] + ((l - w) / 2) * next[1]];
    // Copies lie as the first link did, across (+x): a link going down is turned a quarter turn clockwise.
    q.move(step, strip(n), {
      to: { table: middle },
      degrees: n % 2 ? -90 : 0,
      into: [
        { part: side(n, (u) => u < 0), under: side(n - 1, (u) => u < -0.25) },
        { part: side(n, (u) => u > 0), under: side(n - 1, (u) => u > 0 && u < 0.25) },
      ],
    });
  };
  join(r, 1, {
    title: 'Join two links',
    text: 'Turn a second link a quarter turn and slide its halves into the first link’s sleeves from the side, one above and one below the folded ends, until it stops.',
  });
  join(r, 2, {
    title: 'Add a third',
    text: 'Slide a third link into the second’s sleeves the same way, turned back the way the first one lies.',
  });
  r.together({ title: 'Keep going', text: 'Add the rest the same way, turning each one a quarter turn from the last.' }, (q) => {
    for (let n = 3; n < LINKS; n++) join(q, n, { title: '' });
  });

  // The bracelet: the chain curled round into a ring standing up, its links' middles on a circle as far round as
  // they are along the chain, so the last link comes round to meet the first. The chain runs along `along` (from the
  // first link's middle towards the last's), `across` the other way on the table. The ring stands facing the front,
  // going round from +x, its middle turning about z.
  const middleOf = (n: number): Vec2 => {
    const [p, e] = [at(n, 0), at(n, 0.25)];
    return [(p[0] + e[0]) / 2, (p[1] + e[1]) / 2];
  };
  const [m0, mLast] = [middleOf(0), middleOf(LINKS - 1)];
  const span = Math.hypot(mLast[0] - m0[0], mLast[1] - m0[1]);
  const along: Vec3 = [(mLast[0] - m0[0]) / span, 0, (mLast[1] - m0[1]) / span];
  const across: Vec3 = [-along[2], 0, along[0]];
  // Each link a step further round; the ring's round is one step longer than the chain, closing the gap.
  const step = span / (LINKS - 1);
  const radius = (LINKS * step) / (2 * Math.PI);
  const centre: Vec3 = [m0[0], radius + 0.03, m0[1]];
  const ring = Array.from({ length: LINKS }, (_, n) => {
    const m = middleOf(n);
    const d: Vec2 = [m[0] - m0[0], m[1] - m0[1]];
    const s = d[0] * along[0] + d[1] * along[2];
    const w = d[0] * across[0] + d[1] * across[2];
    const turn = (2 * Math.PI * s) / (LINKS * step);
    // Round the ring, the chain's way along it, and in towards its middle (where the table's up goes).
    const tangent: Vec3 = [Math.cos(turn), Math.sin(turn), 0];
    const inward: Vec3 = [-Math.sin(turn), Math.cos(turn), 0];
    const to: Vec3 = [centre[0] - radius * inward[0], centre[1] - radius * inward[1], centre[2] + w];
    // Where the table's +x goes: its share along the chain round the ring, and its share across along z.
    const x: Vec3 = [along[0] * tangent[0], along[0] * tangent[1], across[0]];
    return { sheet: n, pose: { from: { table: m }, to, x, up: inward } };
  });
  return r
    .settle({ title: 'Press it flat', text: 'Press the chain flat, so the links lie snug in each other.' })
    .assemble({ title: 'Join the ends', text: 'Curl the chain round and slide the first link into the last one’s sleeves, to wear it as a bracelet.', straight: true }, ring)
    .build();
}
