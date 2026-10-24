import type { CreaseKind } from '../../fold/collapse';
import { paper, table, type At, type Recipe } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';
import { squareBase } from './bird-base';

/**
 * The frog base, folded as origami.me/traditional-frog folds it: a square base, its four flaps squashed, then
 * each squashed flap petal-folded. Crease kinds were found by search.
 *
 * A flap of the square base is half of each of two quarters either side of a middle line of the sheet (its
 * spine, the unit vector `d`). Squashed, it opens along the spine, which lies on the centre line, and each
 * half folds on a line from the centre 22.5° from the spine. Below the squashed (coloured) layer each quarter
 * lies folded along its diagonal.
 *
 * The petal fold lifts the squashed layer: the spine's end, the middle of a sheet edge, rises above the
 * crossways line through the kite creases' tops, while the layer's two lower corners fold in to the centre
 * line, and the white lower edges below fold in along the kite creases. The sheet's corners stay at the bottom.
 */

const t = Math.tan(Math.PI / 8);
type Crease = { through: [At, At]; kind: CreaseKind; only: (c: Vec2) => boolean };
type Step = { title: string; text: string };

/** The two halves of the flap with spine `d`: `side` 1 is the one towards d turned a quarter anticlockwise. */
function flap(d: Vec2) {
  const perp: Vec2 = [-d[1], d[0]];
  const at = (side: number) => (a: number, b: number): Vec2 => [d[0] * a + perp[0] * side * b, d[1] * a + perp[1] * side * b];
  // Along the spine, and out from it on that side.
  const ab = (side: number) => ([u, v]: Vec2) => [u * d[0] + v * d[1], (u * perp[0] + v * perp[1]) * side];
  const half = (side: number) => (c: Vec2) => {
    const [a, b] = ab(side)(c);
    return a > 0 && b > 0 && b < a;
  };
  const quarter = (side: number) => (c: Vec2) => {
    const [a, b] = ab(side)(c);
    return a > 0 && b > 0;
  };
  return { at, ab, half, quarter };
}

/** Squashes the flap with spine `d`, standing on the right of the square base. */
function squash(r: Recipe, d: Vec2, step: Step) {
  const { at, half, quarter } = flap(d);
  const creases: Crease[] = [
    { through: [paper(0, 0), paper(...at(1)(0.5, 0.5 * t))], kind: 'mountain', only: half(1) },
    { through: [paper(0, 0), paper(...at(-1)(0.5, 0.5 * t))], kind: 'valley', only: half(-1) },
    { through: [paper(0, 0), paper(d[0] / 2, d[1] / 2)], kind: 'flat', only: (c) => half(1)(c) || half(-1)(c) },
    { through: [paper(0, 0), paper(...at(1)(0.5, 0.5))], kind: 'valley', only: quarter(1) },
  ];
  return r.collapse({ ...step, kind: 'squash' }, creases, paper(...at(1)(-0.3, 0.05)));
}

/** The kite creases and the petal fold of the squashed flap with spine `d`, which lies on top. */
function petal(r: Recipe, d: Vec2, kites: Step, step: Step) {
  const { at, ab, half } = flap(d);
  const T = r.where(paper(0, 0));
  const B = table(T[0], T[1] + Math.SQRT1_2);
  const middle = table(T[0], T[1] + Math.SQRT1_2 / 2);
  const before = r.mark();
  r.together({ ...kites, kind: 'fold' }, (r) => {
    for (const side of [-1, 1]) r.edgeOnto([B, paper(...at(side)(0.5, 0.5 * t))], [B, middle], { title: '', only: half(side) });
  }).unfold({ title: 'Unfold', text: 'Open them out again, leaving the creases.', to: before });

  // On the sheet, per half: where the squash crease meets the kite crease and the line across.
  const meet = (side: number) => at(side)(0.5 / (1 + t), (0.5 * t) / (1 + t));
  const creases = [-1, 1].flatMap((side): Crease[] => {
    const p = at(side);
    const flipped = (c: Vec2) => half(side)(c) && ab(side)(c)[1] < t * ab(side)(c)[0];
    const white = (c: Vec2) => half(side)(c) && ab(side)(c)[1] > t * ab(side)(c)[0];
    const corner = (c: Vec2) => half(side)(c) && ab(side)(c)[0] + ab(side)(c)[1] > 0.5;
    return [
      // The coloured layer lifts on the line across, its corner folding in on the line to the edge's middle.
      { through: [paper(...p(0.5 / (1 + t), 0)), paper(...meet(side))], kind: 'valley', only: flipped },
      { through: [paper(...meet(side)), paper(...p(0.5, 0))], kind: 'mountain', only: flipped },
      // The white lower edge folds in on the kite crease, and the squash crease below opens out.
      { through: [paper(...p(0.5, 0.5)), paper(...meet(side))], kind: 'valley', only: white },
      { through: [paper(...meet(side)), paper(...p(0.5, 0.5 * t))], kind: 'flat', only: corner },
    ];
  });
  return r.collapse({ ...step, kind: 'petal' }, creases, paper(...at(1)(-0.3, 0.05)));
}

/** The quarter of the sheet (su, sv): the one whose corner is at (su/2, sv/2). */
export const quarter = (su: number, sv: number) => ([u, v]: Vec2) => Math.sign(u) === su && Math.sign(v) === sv;
/** The quarter's half nearer the u = 0 midline (a) or the v = 0 one (b): one page of the frog base each. */
export const halfA = (su: number, sv: number) => (c: Vec2) => quarter(su, sv)(c) && Math.abs(c[0]) < Math.abs(c[1]);
export const halfB = (su: number, sv: number) => (c: Vec2) => quarter(su, sv)(c) && Math.abs(c[0]) > Math.abs(c[1]);

/**
 * Folds the frog base. It's a long diamond: the sheet's centre T at the top, the corners at the bottom point
 * B, an edge's middle at each petal's tip, 0.207 below T. Each quarter of the sheet lies folded along its
 * diagonal, one each side of the centre line on each side of the model.
 */
export function frogBase(r: Recipe) {
  squareBase(r);
  squash(r, [0, -1], {
    title: 'Squash a flap',
    text: 'Lift the right flap upright, open it, and press it flat so its fold lies on the centre line.',
  });
  r.turnOver('Turn the paper over.');
  squash(r, [0, 1], { title: 'Squash the next flap', text: 'Squash the right flap on this side the same way.' });
  pageTurn(r, halfA(1, 1), false, { title: 'Turn a page', text: 'Fold the top layer on the right over to the left, showing another flap.' });
  squash(r, [1, 0], { title: 'Squash the third flap', text: 'Squash it like the others.' });
  r.turnOver('Turn over.');
  pageTurn(r, halfA(-1, -1), false, { title: 'Turn a page', text: 'Fold the top right layer over to the left here too.' });
  squash(r, [-1, 0], { title: 'Squash the last flap', text: 'And squash the last flap.' });

  const kites = { title: 'Crease the lower edges', text: 'Fold the lower edges of the top layer in to the centre line, then unfold.' };
  petal(r, [-1, 0], kites, {
    title: 'Petal fold',
    text: 'Lift the bottom edge of the coloured layer up along the line between the creases’ tops, pushing its sides in to meet at the centre.',
  });
  r.turnOver('Turn over.');
  petal(r, [1, 0], kites, { title: 'Petal fold this side', text: 'Make the same petal fold on this side.' });
  pageTurn(r, quarter(1, -1), false, { title: 'Turn a page', text: 'Turn the top flap on the right over to the left.' });
  petal(r, [0, -1], kites, { title: 'Petal fold the third flap', text: 'Petal fold this flap too.' });
  r.turnOver('Turn over.');
  pageTurn(r, quarter(-1, 1), false, { title: 'Turn a page', text: 'Turn the top right flap over to the left.' });
  petal(r, [0, 1], kites, { title: 'Petal fold the last flap', text: 'And petal fold the last one. This is the frog base.' });

  const T = r.where(paper(0, 0));
  return { T, B: [T[0], T[1] + Math.SQRT1_2] as Vec2, quarter };
}

// ——— Working on the frog base's long diamond (the lily narrows it, as the iris does) ———

/**
 * The long diamond where it lies now, with its top point T (the sheet's centre) up: its side corners and its
 * bottom point.
 */
export function diamond(r: Recipe) {
  const T = r.where(paper(0, 0));
  const w = (2 - Math.SQRT2) / 4;
  return { T, left: [T[0] - w, T[1] + 0.5 - w] as Vec2, right: [T[0] + w, T[1] + 0.5 - w] as Vec2, bottom: [T[0], T[1] + Math.SQRT1_2] as Vec2 };
}

/** The page (half of a quarter of the sheet) a face belongs to, by its centre, as a test for the whole page. */
export const pageOf = ([u, v]: Vec2) => (Math.abs(u) < Math.abs(v) ? halfA : halfB)(Math.sign(u), Math.sign(v));

/** The pages on the left or right of the diamond, top first: what lies just beside the centre line, which every page covers. */
export function pages(r: Recipe, side: 'left' | 'right') {
  const { T } = diamond(r);
  const seen: Vec2[] = [];
  for (const c of r.stackAt([T[0] + (side === 'left' ? -0.01 : 0.01), T[1] + 0.25])) if (!seen.some((s) => pageOf(s)(c))) seen.push(c);
  return seen.map(pageOf);
}

/** Turns the paper picked out by `only` over the centre line, like a page, towards the right or the left. */
export function pageTurn(r: Recipe, only: (c: Vec2) => boolean, toRight: boolean, step: Step) {
  const T = r.where(paper(0, 0));
  const base = r.where(paper(0, 0.5));
  const from: Vec2 = [T[0] + (toRight ? -0.2 : 0.2), (T[1] + base[1]) / 2];
  return r.along(table(...T), table(T[0], base[1]), table(...from), { ...step, only });
}

/** Narrows the top: the top page's outer edge on each side folds to the centre line, from the top point. */
export function narrow(r: Recipe, step: Step) {
  const [leftPage, rightPage] = [pages(r, 'left')[0], pages(r, 'right')[0]];
  return r.together(step, (r) => {
    const { T, left, right, bottom } = diamond(r);
    r.edgeOnto([table(...T), table(...left)], [table(...T), table(...bottom)], { title: '', only: leftPage });
    r.edgeOnto([table(...T), table(...right)], [table(...T), table(...bottom)], { title: '', only: rightPage });
  });
}

/** Turns the top two pages on the right over to the left. */
export function flipTwo(r: Recipe, step: Step) {
  const [a, b] = pages(r, 'right');
  return pageTurn(r, (c) => a(c) || b(c), false, step);
}
