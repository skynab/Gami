import type { CreaseKind } from './collapse';
import { FoldError, placeLike, toFlat, unplaceLike, type FlatFace } from './fold';
import { roundCoord } from './fold-format';
import { add, cross, dist, dot, frontUp, joinedSegment, lineThrough, normalize, overlapArea, scale, sideOf, split, sub, type Line } from './geometry2d';
import { applyOp, atOf, select, type At, type Faces, type Op } from './ops';
import { centre, inside } from './select';
import type { FoldFrame, OrigamiModel, Vec2 } from './types';

/**
 * Fold presets: the named compound folds (pleat, crimp, squash, petal, rabbit ear, swivel, open sink) worked out
 * from the few points a person would pick on the paper as it lies on the table. Each comes back as an ordinary
 * collapse, so it replays when an earlier step changes and opens in the Studio's Collapse to adjust a crease.
 * Which paper each crease folds is found from the stack: a face's rank (how many faces lie over it), which faces
 * are joined along a folded edge, and which way up each face's paper lies.
 */

export type PresetKind = 'pleat' | 'crimp' | 'squash' | 'petal' | 'rabbitEar' | 'swivel' | 'sink';
export const PRESETS: PresetKind[] = ['pleat', 'crimp', 'squash', 'petal', 'rabbitEar', 'swivel', 'sink'];

/** How many points each preset is picked with. */
export const PRESET_PICKS: Record<PresetKind, number> = { pleat: 4, crimp: 4, squash: 2, petal: 1, rabbitEar: 3, swivel: 3, sink: 2 };

/**
 * Picks, all points on the table:
 * - pleat: two points along the valley crease, then two along the mountain one (`flip`: the other way round);
 * - crimp: two along the inside reverse crease, then two along the outside one (`flip`: the other way round);
 * - squash: the flap's corner where its hinge and its folded edge meet, then a point on the line that folded edge
 *   is pressed down onto;
 * - petal: the free corner of the flap to lift;
 * - rabbit ear: the corner that stands up, then the other two corners, the paper by the first of them staying put
 *   (`flip`: the flap lies down the other way);
 * - swivel: the pivot, a point along the flap's hinge (the folded edge it swings on), then where that point swings
 *   to; the paper the flap swings across folds into a pleat (`flip`: the paper under the hinge swings instead of
 *   the flap on top);
 * - sink (an open sink): the tip of the point, then a point on the line it sinks to, square across the point from
 *   the tip (`flip`: sunk from underneath, where that differs).
 * `only` limits a pleat, crimp, swivel or sink to some of the paper, as the Studio's sheet and face picks do.
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
  // Each candidate in turn, the first that folds flat (and passes `check`): the kinds that depend on the layers
  // aren't known in advance.
  const first = (candidates: CollapseOp[], check?: (made: FoldFrame) => PresetError | null): CollapseOp => {
    let error: unknown;
    for (const c of preset.flip ? [...candidates].reverse() : candidates) {
      try {
        const failed = check?.(applyOp(model, c).frame);
        if (!failed) return c;
        error ??= failed;
      } catch (e) {
        if (!(e instanceof FoldError)) throw e;
        error ??= e;
      }
    }
    throw error;
  };
  // The paper `only` allows, if anything limits it.
  const allowed = preset.only ? select(preset.only, { frame, sheets: model.sheets }) : () => true;
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
    case 'swivel':
      // Creases that cross no paper but the flap leave everything where it was: that's no swivel.
      return first(swivel(frame, picks[0], picks[1], picks[2], allowed), (made) =>
        made.vertices_coords.length === frame.vertices_coords.length ? new PresetError('There’s no paper for the flap to swing across that way.') : null,
      );
    case 'sink':
      return first(sink(frame, picks[0], picks[1], allowed));
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

/**
 * A swivel fold: a flap swings round flat about `pivot`, the end of its hinge, until the hinge's point at
 * `hingeAt` lies towards `to`. The paper it swings across folds into a pleat, as `Recipe.swivel` makes it: a new
 * crease where the hinge ends up, and a gusset halfway back to the old hinge, folded the other way. The flap keeps
 * its hinge and isn't creased. The paper beyond the new hinge stays put. Which paper is the flap: the faces on top
 * at the hinge and all joined to them other than across it (or, later in the list, the faces underneath).
 */
function swivel(frame: FoldFrame, pivot: Vec2, hingeAt: Vec2, to: Vec2, allowed: (paper: Vec2[]) => boolean): CollapseOp[] {
  const len = dist(pivot, hingeAt);
  if (len < TOL || dist(pivot, to) < TOL) throw new PresetError('Pick the pivot, a point along the flap’s folded edge, then where that point should swing to.');
  const h = normalize(sub(hingeAt, pivot));
  const t = normalize(sub(to, pivot));
  const turn = cross(h, t);
  if (Math.abs(turn) < 1e-6) throw new PresetError('Pick where the folded edge swings to off the line it’s on now.');
  const s = stack(frame);
  const hinge = lineThrough(pivot, hingeAt);
  // The hinge: folds joining two faces along its line, the face on top first.
  const folds: [Face, Face][] = [];
  for (const f of s) {
    for (const g of s) {
      if (f.layer <= g.layer || frontUp(f.world, f.paper) === frontUp(g.world, g.paper)) continue;
      if (joins([f], [g], frame.cuts).some((j) => onLine(j.world, hinge))) folds.push([f, g]);
    }
  }
  if (!folds.length) throw new PresetError('There’s no flap hinged there. Pick the pivot at the end of a folded edge, then a point along it.');
  // The flap: joined to its side of the hinge without crossing it. If that reaches the other side, it isn't free.
  const flapFrom = (start: Face[], other: Face[]) => {
    const flap = connectedOff(start, s, hinge, frame.cuts);
    return flap.some((f) => other.includes(f)) ? null : flap;
  };
  const flaps = [flapFrom(folds.map(([f]) => f), folds.map(([, g]) => g)), flapFrom(folds.map(([, g]) => g), folds.map(([f]) => f))];
  // The gusset halves the swing; the paper beyond the new hinge, turning on past `to`, stays put.
  const gusset = normalize(add(h, t));
  const sense = Math.sign(turn);
  const beyond = (Math.PI - Math.acos(Math.max(-1, Math.min(1, dot(h, t)))) / 2) / 2;
  const out: CollapseOp[] = [];
  for (const flap of flaps) {
    if (!flap) continue;
    const pleated = s.filter((f) => !flap.includes(f) && allowed(f.paper));
    const anchor = stillAlong(pleated, pivot, rotate(t, sense * beyond), len);
    if (!pleated.length || !anchor) continue;
    for (const [hingeKind, gussetKind] of [
      ['valley', 'mountain'],
      ['mountain', 'valley'],
    ] as const) {
      out.push({
        op: 'collapse',
        creases: [
          { line: through(frame, pivot, add(pivot, scale(t, len))), kind: hingeKind, only: outlines(pleated) },
          { line: through(frame, pivot, add(pivot, scale(gusset, len))), kind: gussetKind, only: outlines(pleated) },
        ],
        anchor: { paper: anchor },
      });
    }
  }
  if (!out.length) throw new PresetError('There’s no paper for the flap to swing across that way.');
  return out;
}

/**
 * An open sink: the point at `tip` pushed in along the line through `at` square across it, the paper beyond the
 * line turning inside out into the point's own inside, as when a point is opened out flat, its tip pressed in and
 * closed up again. Every layer of the point folds along the line, each into the inside of the point: down under
 * the faces lying the way the top one does (a mountain fold), up over the others (a valley fold), so the tip's
 * layers tuck into the pockets between the point's layers rather than all to one side. On a point of two layers
 * it's an inside reverse fold. A closed sink, the layers re-stacked inside a point that can't open, can't be made.
 */
function sink(frame: FoldFrame, tip: Vec2, at: Vec2, allowed: (paper: Vec2[]) => boolean): CollapseOp[] {
  if (dist(tip, at) < TOL) throw new PresetError('Pick the tip of the point, then a point further in for it to sink to.');
  const d = normalize(sub(at, tip));
  const line: Line = { p: at, d: [-d[1], d[0]] };
  const tipSide = Math.sign(sideOf(line, tip));
  const s = stack(frame).filter((f) => allowed(f.paper));
  const near = s.filter((f) => f.world.some((p) => sideOf(line, p) * tipSide > 1e-7));
  const start = near.filter((f) => f.world.some((p) => dist(p, tip) < 1e-6));
  if (!start.length) throw new PresetError('There’s no point there to sink. Pick the tip of a point.');
  const point = connected(start, near);
  // The point's faces the line crosses; or, where the point was creased along the line first (as a sink usually
  // is), the faces either side of that crease, joined along it.
  let crossing = point.filter((f) => f.world.some((p) => sideOf(line, p) * tipSide < -1e-7));
  if (!crossing.length) {
    const all = stack(frame).filter((f) => allowed(f.paper));
    const pairs = point.flatMap((f) => all.filter((g) => !point.includes(g) && joins([f], [g], frame.cuts).some((j) => onLine(j.world, line))).map((g) => [f, g]));
    crossing = [...new Set(pairs.flat())];
  }
  if (!crossing.length) throw new PresetError('Pick a point on the paper for the tip to sink to.');
  // The point's inside is the same side of the paper all round it: under the face on top, or (sunk from
  // underneath) over the face at the bottom. Faces lying the way that face does fold to the same side of
  // themselves, the others to the other side.
  const ends: [Vec2, Vec2] = [add(at, scale(line.d, -dist(tip, at))), add(at, scale(line.d, dist(tip, at)))];
  const anchor = bodyPaper(stack(frame), line, -tipSide);
  const sunkFrom = (face: Face, below: boolean): CollapseOp => {
    const up = frontUp(face.world, face.paper);
    const alike = crossing.filter((f) => frontUp(f.world, f.paper) === up);
    const other = crossing.filter((f) => !alike.includes(f));
    const [mountain, valley] = below ? [other, alike] : [alike, other];
    return {
      op: 'collapse',
      creases: [
        ...(mountain.length ? [{ line: through(frame, ...ends), kind: 'mountain' as const, only: outlines(mountain) }] : []),
        ...(valley.length ? [{ line: through(frame, ...ends), kind: 'valley' as const, only: outlines(valley) }] : []),
      ],
      anchor,
    };
  };
  const fromTop = sunkFrom(crossing.reduce((a, b) => (b.rank < a.rank ? b : a)), false);
  const fromBottom = sunkFrom(crossing.reduce((a, b) => (b.rank > a.rank ? b : a)), true);
  return JSON.stringify(fromTop) === JSON.stringify(fromBottom) ? [fromTop] : [fromTop, fromBottom];
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

/** Faces of `among` reachable from `start` across edges they share, other than edges on `line`. */
function connectedOff(start: Face[], among: Face[], line: Line, cuts?: [Vec2, Vec2][]): Face[] {
  const found = new Set(start);
  const queue = [...start];
  while (queue.length) {
    const f = queue.shift()!;
    for (const g of among) if (!found.has(g) && joins([f], [g], cuts).some((j) => !onLine(j.world, line))) (found.add(g), queue.push(g));
  }
  return [...found];
}

/**
 * A point of the sheet on one of `faces`, found out from `from` along `dir` (at distances scaled by `len`): paper
 * that stays put, as the sheet there (not whatever lies over it).
 */
function stillAlong(faces: Face[], from: Vec2, dir: Vec2, len: number): Vec2 | null {
  for (const k of [0.5, 0.25, 0.75, 1, 1.5, 2, 3]) {
    const spot = add(from, scale(dir, k * len));
    const face = faces.find((f) => inside(f.world, spot));
    if (face) return unplaceLike(face)(spot).map(roundCoord) as Vec2;
  }
  return null;
}

/** A point of the sheet on the side `side` of `line`: on the biggest stretch of a face there. */
function bodyPaper(faces: Face[], line: Line, side: number): CollapseOp['anchor'] {
  const parts = faces.map((f) => (side > 0 ? split(f, line).pos : split(f, line).neg)).filter((p) => p !== null);
  if (!parts.length) return { auto: true };
  const area = (p: { paper: Vec2[] }) => Math.abs(p.paper.reduce((s, q, i) => s + cross(q, p.paper[(i + 1) % p.paper.length]), 0));
  const biggest = parts.reduce((x, y) => (area(y) > area(x) ? y : x));
  return { paper: centre(biggest.paper).map(roundCoord) as Vec2 };
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
/** `v` turned by `angle` radians, the way that takes the x axis towards the z axis. */
const rotate = (v: Vec2, angle: number): Vec2 => [v[0] * Math.cos(angle) - v[1] * Math.sin(angle), v[0] * Math.sin(angle) + v[1] * Math.cos(angle)];

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
