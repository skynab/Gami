import type { CreaseKind } from './collapse';
import { FoldError, placeLike, toFlat, type FlatFace } from './fold';
import { roundCoord } from './fold-format';
import { add, cross, dist, dot, joinedSegment, lineThrough, normalize, overlapArea, scale, sideOf, sub, type Line } from './geometry2d';
import { applyOp, atOf, type At, type Faces, type Op } from './ops';
import { centre, inside } from './select';
import type { FoldFrame, OrigamiModel, Vec2 } from './types';

/**
 * Fold presets: the named compound folds (pleat, crimp, squash, petal, rabbit ear) worked out from the few points
 * a person would pick on the paper as it lies on the table. Each comes back as an ordinary collapse, so it replays
 * when an earlier step changes and opens in the Studio's Collapse to adjust a crease. Which paper each crease
 * folds is found from the stack: a face's rank (how many faces lie over it), and which faces are joined along a
 * folded edge.
 */

export type PresetKind = 'pleat' | 'crimp' | 'squash' | 'petal' | 'rabbitEar';
export const PRESETS: PresetKind[] = ['pleat', 'crimp', 'squash', 'petal', 'rabbitEar'];

/** How many points each preset is picked with. */
export const PRESET_PICKS: Record<PresetKind, number> = { pleat: 4, crimp: 4, squash: 2, petal: 1, rabbitEar: 3 };

/**
 * Picks, all points on the table:
 * - pleat: two points along the valley crease, then two along the mountain one (`flip`: the other way round);
 * - crimp: two along the inside reverse crease, then two along the outside one (`flip`: the other way round);
 * - squash: the flap's corner where its hinge and its folded edge meet, then a point on the line that folded edge
 *   is pressed down onto;
 * - petal: the free corner of the flap to lift;
 * - rabbit ear: the corner that stands up, then the other two corners, the paper by the first of them staying put
 *   (`flip`: the flap lies down the other way).
 * `only` limits a pleat or crimp to some of the paper, as the Studio's sheet and face picks do.
 */
export interface Preset {
  kind: PresetKind;
  picks: Vec2[];
  flip?: boolean;
  only?: Faces;
}

export class PresetError extends FoldError {}

type CollapseOp = Extract<Op, { op: 'collapse' }>;
type CollapseCrease = CollapseOp['creases'][number];

const TOL = 1e-6;

/** The collapse a preset makes on the paper of `model` (its last step, or its start). */
export function presetOp(model: OrigamiModel, preset: Preset): CollapseOp {
  const frame = model.steps.at(-1)?.frame ?? model.start;
  const { kind, picks } = preset;
  if (picks.length < PRESET_PICKS[kind]) throw new PresetError('Not enough points picked yet.');
  // Each candidate in turn, the first that folds flat: the kinds that depend on the layers aren't known in advance.
  const first = (candidates: CollapseOp[]): CollapseOp => {
    let error: unknown;
    for (const c of preset.flip ? [...candidates].reverse() : candidates) {
      try {
        applyOp(model, c);
        return c;
      } catch (e) {
        if (!(e instanceof FoldError)) throw e;
        error ??= e;
      }
    }
    throw error;
  };
  switch (kind) {
    case 'pleat':
    case 'crimp':
      return pair(frame, preset);
    case 'squash':
      return first(squash(frame, picks[0], picks[1]));
    case 'petal':
      return first(petal(frame, picks[0]));
    case 'rabbitEar':
      return first(rabbitEar(frame, picks[0], picks[1], picks[2]));
  }
}

/** Two creases side by side: a pleat (valley and mountain) or a crimp (inside and outside reverse folds). */
function pair(frame: FoldFrame, { kind, picks, flip, only }: Preset): CollapseOp {
  const kinds: [CreaseKind, CreaseKind] = kind === 'pleat' ? ['valley', 'mountain'] : ['inside', 'outside'];
  const [a, b] = flip ? [kinds[1], kinds[0]] : kinds;
  if (dist(picks[0], picks[1]) < TOL || dist(picks[2], picks[3]) < TOL) throw new PresetError('Each crease needs two different points.');
  return {
    op: 'collapse',
    creases: [
      { line: through(frame, picks[0], picks[1]), kind: a, ...(only && { only }) },
      { line: through(frame, picks[2], picks[3]), kind: b, ...(only && { only }) },
    ],
    anchor: { auto: true },
  };
}

/**
 * A squash fold of the two layers on top at `corner`: the top one is joined along a folded edge (the hinge) to the
 * paper it was folded over from, and to the one under it along another (the flap's folded edge). The hinge opens
 * out flat for the top layer, the flap's folded edge opens out, and both layers fold along the line from `corner`
 * through `to`, opposite ways, so the flap spreads evenly either side of it.
 */
function squash(frame: FoldFrame, corner: Vec2, to: Vec2): CollapseOp[] {
  const s = stack(frame);
  const at = (f: Face) => f.world.some((p) => dist(p, corner) < 1e-6);
  const tops = s.filter((f) => f.rank === 0 && at(f));
  const seconds = s.filter((f) => f.rank === 1 && at(f));
  const noFlap = () => new PresetError('There’s no flap to squash there. Pick the corner of a flap where its folded edges meet.');
  // The flap's folded edge joins the top layer to the one under it, and runs from the corner.
  const spine = joins(tops, seconds).find((j) => onLineFrom(j.world, corner));
  if (!spine) throw noFlap();
  // The hinge joins the top layer to other paper, also from the corner.
  const hinge = joins(tops, s.filter((f) => !seconds.includes(f) && !tops.includes(f))).find((j) => onLineFrom(j.world, corner));
  if (!hinge) throw noFlap();
  const hingeLine = lineFrom(corner, hinge.world);
  const side = Math.sign(sideOf(hingeLine, far(corner, spine.world)));
  if (Math.sign(sideOf(hingeLine, to)) !== side || dist(corner, to) < TOL) throw new PresetError('Pick a point on the flap for its folded edge to land on.');
  // The flap: the two layers on top on the folded edge's side of the hinge.
  const flapSide = (f: Face) => Math.sign(sideOf(hingeLine, centre(f.world))) === side;
  const top = s.filter((f) => f.rank === 0 && flapSide(f));
  const under = s.filter((f) => f.rank === 1 && flapSide(f));
  // The top layer opens away from the paper it's hinged to, and only there.
  const hinged = [...top, ...s.filter((g) => !top.includes(g) && joins(top, [g]).some((j) => onLine(j.world, hingeLine)))];
  const anchor = stillPaper(s, [...top, ...under]);
  return (
    [
      ['mountain', 'valley'],
      ['valley', 'mountain'],
    ] as const
  ).map(([upper, lower]) => ({
    op: 'collapse',
    creases: [
      { line: through(frame, corner, far(corner, hinge.world)), kind: 'flat', only: outlines(hinged) },
      { line: through(frame, corner, far(corner, spine.world)), kind: 'flat', only: outlines([...top, ...under]) },
      { line: through(frame, corner, to), kind: upper, only: outlines(top) },
      { line: through(frame, corner, to), kind: lower, only: outlines(under) },
    ],
    anchor,
  }));
}

/**
 * A petal fold of the flap on top at `corner`, its free corner: the flap's layer lifts along the line between
 * its kite creases' tops, while its sides fold in to the middle line along the kite creases (each halving the
 * angle between a side and the middle line) and the layer beneath folds the other way to follow. The seams
 * joining the flap to the layer beneath, below the kite creases, open out flat.
 */
function petal(frame: FoldFrame, corner: Vec2): CollapseOp[] {
  const s = stack(frame);
  const start = s.filter((f) => f.rank === 0 && f.world.some((p) => dist(p, corner) < 1e-6));
  if (!start.length) throw new PresetError('There’s no flap there. Pick the free corner of the flap on top.');
  // The flap: the top layer's paper joined to the corner without crossing a fold.
  const flap = connected(start, s.filter((f) => f.rank === 0));
  const outline = flap.flatMap((f) => f.world);
  const tip = outline.reduce((a, b) => (dist(b, corner) > dist(a, corner) ? b : a));
  const middle = lineThrough(corner, tip);
  const sideCorner = (sign: number) => {
    const out = outline.filter((p) => Math.sign(sideOf(middle, p)) === sign);
    return out.length ? out.reduce((a, b) => (Math.abs(sideOf(middle, b)) > Math.abs(sideOf(middle, a)) ? b : a)) : null;
  };
  const left = sideCorner(1);
  const right = sideCorner(-1);
  if (!left || !right) throw new PresetError('That flap has no sides to fold in. Pick the free corner of a diamond-shaped flap.');
  // Each kite crease halves the angle at the corner, and runs to the edge from the side corner to the tip.
  const kiteTop = (side: Vec2): Vec2 | null => {
    const d = normalize(add(normalize(sub(side, corner)), normalize(sub(tip, corner))));
    return meet(corner, d, side, tip);
  };
  const k1 = kiteTop(left);
  const k2 = kiteTop(right);
  if (!k1 || !k2) throw new PresetError('That flap can’t be petal-folded.');
  const lift = lineThrough(k1, k2);
  const below = (f: Face) => Math.sign(sideOf(lift, centre(f.world))) === Math.sign(sideOf(lift, corner));
  const inFlap = (f: Face) => inside(hull(outline), centre(f.world));
  const beneath = s.filter((f) => f.rank === 1 && inFlap(f));
  const seams = [...flap, ...beneath].filter(below);
  const anchor = stillPaper(s, [...flap, ...beneath]);
  const op: CollapseOp = {
    op: 'collapse',
    creases: [
      { line: through(frame, k1, k2), kind: 'valley', only: outlines(flap) },
      { line: through(frame, corner, k1), kind: 'mountain', only: outlines(flap) },
      { line: through(frame, corner, k2), kind: 'mountain', only: outlines(flap) },
      { line: through(frame, corner, k1), kind: 'valley', only: outlines(beneath) },
      { line: through(frame, corner, k2), kind: 'valley', only: outlines(beneath) },
      { line: through(frame, tip, left), kind: 'flat', only: outlines(seams) },
      { line: through(frame, tip, right), kind: 'flat', only: outlines(seams) },
    ],
    anchor,
  };
  return [op];
}

/**
 * A rabbit ear on the triangle `corner`, `a`, `b`: the two sides from `corner` fold in to the side a–b along the
 * lines halving the triangle's corners at a and b, which meet inside it; the corner between them stands up as a
 * thin flap and lies down to one side, along the line from where they meet to the corner and on to the side a–b.
 * The paper by `a` stays put.
 */
function rabbitEar(frame: FoldFrame, corner: Vec2, a: Vec2, b: Vec2): CollapseOp[] {
  const tri = [corner, a, b];
  if (Math.abs(cross(sub(a, corner), sub(b, corner))) < 1e-6) throw new PresetError('Pick three corners of a triangle.');
  // Where the halving lines meet: the triangle's incentre.
  const [la, lb, lc] = [dist(a, b), dist(corner, b), dist(corner, a)];
  const centreIn = scale(add(add(scale(corner, la), scale(a, lb)), scale(b, lc)), 1 / (la + lb + lc));
  const ab = normalize(sub(b, a));
  const foot = add(a, scale(ab, dot(sub(centreIn, a), ab)));
  const s = stack(frame).filter((f) => inside(tri, centre(f.world)));
  if (!s.length) throw new PresetError('There’s no paper in that triangle.');
  // Each crease runs out from the middle point; it folds only the paper between the creases either side of its
  // own stretch of line, so a face bordering two creases takes both, and none takes the line's other half.
  const rays = [corner, a, b, foot].map((p) => Math.atan2(p[1] - centreIn[1], p[0] - centreIn[0]));
  const sector = (i: number) => {
    const sorted = [...rays].sort((x, y) => x - y);
    const k = sorted.indexOf(rays[i]);
    const gap = (from: number, to: number) => (((to - from) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const lo = sorted[(k + sorted.length - 1) % sorted.length];
    const hi = lo + gap(lo, sorted[(k + 1) % sorted.length]);
    return (f: Face) => {
      const c = centre(f.world);
      const angle = Math.atan2(c[1] - centreIn[1], c[0] - centreIn[0]);
      return gap(lo, angle) > 1e-9 && gap(lo, angle) < hi - lo - 1e-9;
    };
  };
  const faces = (i: number) => outlines(s.filter(sector(i)));
  // Between a's crease and the side a–b, clear of every crease: the paper there stays put.
  const anchor: CollapseOp['anchor'] = { paper: paperAt(frame, scale(add(add(a, centreIn), foot), 1 / 3)) };
  return (
    [
      ['valley', 'mountain'],
      ['mountain', 'valley'],
    ] as const
  ).map(([up, down]) => ({
    op: 'collapse',
    creases: [
      { line: through(frame, a, centreIn), kind: 'valley', only: faces(1) },
      { line: through(frame, b, centreIn), kind: 'valley', only: faces(2) },
      { line: through(frame, corner, centreIn), kind: up, only: faces(0) },
      { line: through(frame, centreIn, foot), kind: down, only: faces(3) },
    ],
    anchor,
  }));
}

// ——— The stack ———

interface Face extends FlatFace {
  /** How many faces lie over this one. */
  rank: number;
}

function stack(frame: FoldFrame): Face[] {
  const faces = toFlat(frame);
  return faces.map((f) => ({ ...f, rank: faces.filter((g) => g.layer > f.layer && overlapArea(f.world, g.world) > 1e-7).length }));
}

/** Where faces of `from` are joined to faces of `to` along a fold: on the sheet, and on the table. */
function joins(from: Face[], to: Face[], cuts?: [Vec2, Vec2][]): { paper: [Vec2, Vec2]; world: [Vec2, Vec2] }[] {
  const out: { paper: [Vec2, Vec2]; world: [Vec2, Vec2] }[] = [];
  for (const f of from) {
    for (const g of to) {
      if (f === g) continue;
      const shared = joinedSegment(f.paper, g.paper, cuts);
      if (!shared) continue;
      const place = placeLike(f);
      out.push({ paper: shared, world: [place(shared[0]), place(shared[1])] });
    }
  }
  return out;
}

/** Faces of `among` reachable from `start` across edges they share. */
function connected(start: Face[], among: Face[]): Face[] {
  const found = new Set(start);
  const queue = [...start];
  while (queue.length) {
    const f = queue.shift()!;
    for (const g of among) if (!found.has(g) && joins([f], [g]).length) (found.add(g), queue.push(g));
  }
  return [...found];
}

/** A point of the sheet on the biggest face that isn't in `moving`: paper that stays put. */
function stillPaper(faces: Face[], moving: Face[]): CollapseOp['anchor'] {
  const rest = faces.filter((f) => !moving.includes(f));
  if (!rest.length) return { auto: true };
  const area = (f: Face) => Math.abs(f.paper.reduce((s, p, i) => s + cross(p, f.paper[(i + 1) % f.paper.length]), 0));
  const biggest = rest.reduce((x, y) => (area(y) > area(x) ? y : x));
  return { paper: centre(biggest.paper).map(roundCoord) as Vec2 };
}

/** Faces as the outlines on the sheet an operation picks them by. */
const outlines = (faces: Face[]): Faces => ({ inPaper: faces.map((f) => f.paper.map((p) => p.map(roundCoord) as Vec2)) });

// ——— Geometry ———

const onLine = (seg: [Vec2, Vec2], l: Line) => Math.abs(sideOf(l, seg[0])) < 1e-6 && Math.abs(sideOf(l, seg[1])) < 1e-6;
/** Whether a segment runs out from `p`. */
const onLineFrom = (seg: [Vec2, Vec2], p: Vec2) => dist(seg[0], p) < 1e-6 || dist(seg[1], p) < 1e-6;
/** The end of a segment farther from `p`. */
const far = (p: Vec2, seg: [Vec2, Vec2]) => (dist(seg[0], p) > dist(seg[1], p) ? seg[0] : seg[1]);
const lineFrom = (p: Vec2, seg: [Vec2, Vec2]) => lineThrough(p, far(p, seg));

/** Where the ray from `p` along `d` meets the segment a–b, if it does. */
function meet(p: Vec2, d: Vec2, a: Vec2, b: Vec2): Vec2 | null {
  const e = sub(b, a);
  const den = cross(d, e);
  if (Math.abs(den) < 1e-12) return null;
  const t = cross(sub(a, p), e) / den;
  const u = cross(sub(a, p), d) / den;
  return t > 0 && u > -1e-9 && u < 1 + 1e-9 ? add(p, scale(d, t)) : null;
}

/** The convex hull of some points. */
function hull(points: Vec2[]): Vec2[] {
  const ps = [...points].sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const half = (list: Vec2[]) => {
    const out: Vec2[] = [];
    for (const p of list) {
      while (out.length >= 2 && cross(sub(out.at(-1)!, out.at(-2)!), sub(p, out.at(-2)!)) <= 1e-12) out.pop();
      out.push(p);
    }
    return out.slice(0, -1);
  };
  return [...half(ps), ...half([...ps].reverse())];
}

/** A crease line through two points, each kept as the point of the sheet there so it follows the paper. */
function through(frame: FoldFrame, p: Vec2, q: Vec2): CollapseCrease['line'] {
  return { through: [atOf(frame, p), atOf(frame, q)] as [At, At] };
}

function paperAt(frame: FoldFrame, spot: Vec2): Vec2 {
  const at = atOf(frame, spot);
  if (!('paper' in at)) throw new PresetError('There’s no paper there.');
  return at.paper;
}
