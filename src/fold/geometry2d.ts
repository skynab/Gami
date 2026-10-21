import type { Vec2 } from './types';

/** 2D helpers for flat paper. World points are (x, z) on the table; paper points are (u, v) on the sheet. */

export const EPS = 1e-9;

export const sub = (a: Vec2, b: Vec2): Vec2 => [a[0] - b[0], a[1] - b[1]];
export const add = (a: Vec2, b: Vec2): Vec2 => [a[0] + b[0], a[1] + b[1]];
export const scale = (a: Vec2, k: number): Vec2 => [a[0] * k, a[1] * k];
export const dot = (a: Vec2, b: Vec2) => a[0] * b[0] + a[1] * b[1];
export const cross = (a: Vec2, b: Vec2) => a[0] * b[1] - a[1] * b[0];
export const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
export const dist = (a: Vec2, b: Vec2) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function normalize(a: Vec2): Vec2 {
  const len = Math.hypot(a[0], a[1]);
  return [a[0] / len, a[1] / len];
}

/** Twice-signed area: positive when the corners go anticlockwise in (first, second) axes. */
export function signedArea(poly: Vec2[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) a += cross(poly[i], poly[(i + 1) % poly.length]);
  return a / 2;
}

/** Whether a flat face shows its front (coloured) side from above: its corners go the same way round as on the sheet. */
export function frontUp(world: Vec2[], paper: Vec2[]): boolean {
  return Math.sign(signedArea(world)) === Math.sign(signedArea(paper));
}

/** A straight line through `p` along unit direction `d`. */
export interface Line {
  p: Vec2;
  d: Vec2;
}

export function lineThrough(a: Vec2, b: Vec2): Line {
  return { p: a, d: normalize(sub(b, a)) };
}

/** The crease that lays `a` exactly onto `b`, oriented so `a` is on its positive side. */
export function lineOnto(a: Vec2, b: Vec2): Line {
  const mid = lerp(a, b, 0.5);
  const ab = normalize(sub(b, a));
  // Perpendicular to ab, turned so cross(d, a − mid) > 0.
  const d: Vec2 = [ab[1], -ab[0]];
  return cross(d, sub(a, mid)) > 0 ? { p: mid, d } : { p: mid, d: scale(d, -1) };
}

/**
 * The crease that lays the edge from `a1` to `a2` along the line from `b1` to `b2`, `a1`'s end going the way
 * of `b1`'s (the angle bisector, or the line midway between parallel edges), oriented so the edge is on its
 * positive side. Null if the edges are on one line already.
 */
export function lineEdgeOnto(a1: Vec2, a2: Vec2, b1: Vec2, b2: Vec2): Line | null {
  const u = normalize(sub(a2, a1));
  const v = normalize(sub(b2, b1));
  const parallel = Math.abs(cross(u, v)) < 1e-9;
  let line: Line;
  if (parallel) {
    // Midway between the two lines, along them.
    const off = cross(u, sub(b1, a1));
    if (Math.abs(off) < 1e-9) return null;
    line = { p: add(a1, scale([-u[1], u[0]], off / 2)), d: u };
  } else {
    // Through where the lines meet, along the direction that reflects u onto v.
    const t = cross(sub(b1, a1), v) / cross(u, v);
    const sum = add(u, v);
    const d: Vec2 = Math.hypot(...sum) < 1e-9 ? [-u[1], u[0]] : normalize(sum);
    line = { p: add(a1, scale(u, t)), d };
  }
  // The edge's side moves: its far end from the crease decides, as an edge can start on the crease.
  const end = Math.abs(sideOf(line, a1)) > Math.abs(sideOf(line, a2)) ? a1 : a2;
  return sideOf(line, end) > 0 ? line : flipLine(line);
}

export const flipLine = (l: Line): Line => ({ p: l.p, d: scale(l.d, -1) });

/** Which side of the line a point is on: positive to the left of its direction. */
export const sideOf = (l: Line, x: Vec2) => cross(l.d, sub(x, l.p));

export function reflect(l: Line, x: Vec2): Vec2 {
  const w = sub(x, l.p);
  return add(l.p, sub(scale(l.d, 2 * dot(w, l.d)), w));
}

/** A polygon with each corner known both on the table and on the sheet. */
export interface Piece {
  world: Vec2[];
  paper: Vec2[];
}

const ON_LINE = 1e-7;

/**
 * Cuts a convex polygon along a line. Returns the parts on the positive and negative sides
 * (either can be null). Corners keep their order, so the paper's winding is unchanged.
 */
export function split(piece: Piece, l: Line): { pos: Piece | null; neg: Piece | null } {
  const pos: Piece = { world: [], paper: [] };
  const neg: Piece = { world: [], paper: [] };
  const n = piece.world.length;
  const s = piece.world.map((x) => {
    const v = sideOf(l, x);
    return Math.abs(v) < ON_LINE ? 0 : v;
  });
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    if (s[i] >= 0) push(pos, piece.world[i], piece.paper[i]);
    if (s[i] <= 0) push(neg, piece.world[i], piece.paper[i]);
    if ((s[i] > 0 && s[j] < 0) || (s[i] < 0 && s[j] > 0)) {
      const t = s[i] / (s[i] - s[j]);
      const w = lerp(piece.world[i], piece.world[j], t);
      const p = lerp(piece.paper[i], piece.paper[j], t);
      push(pos, w, p);
      push(neg, w, p);
    }
  }
  const keep = (q: Piece) => (q.world.length >= 3 && Math.abs(signedArea(q.world)) > 1e-9 ? q : null);
  return { pos: keep(pos), neg: keep(neg) };
}

function push(q: Piece, w: Vec2, p: Vec2) {
  q.world.push(w);
  q.paper.push(p);
}

/** Area shared by two convex polygons (Sutherland–Hodgman clipping). */
export function overlapArea(a: Vec2[], b: Vec2[]): number {
  let out = signedArea(a) < 0 ? [...a].reverse() : a;
  const clip = signedArea(b) < 0 ? [...b].reverse() : b;
  for (let i = 0; i < clip.length && out.length; i++) {
    const c0 = clip[i];
    const c1 = clip[(i + 1) % clip.length];
    const edge = sub(c1, c0);
    const inside = (x: Vec2) => cross(edge, sub(x, c0)) >= -EPS;
    const input = out;
    out = [];
    for (let k = 0; k < input.length; k++) {
      const cur = input[k];
      const prev = input[(k + input.length - 1) % input.length];
      const curIn = inside(cur);
      const prevIn = inside(prev);
      if (curIn !== prevIn) {
        const sp = cross(edge, sub(prev, c0));
        const sc = cross(edge, sub(cur, c0));
        out.push(lerp(prev, cur, sp / (sp - sc)));
      }
      if (curIn) out.push(cur);
    }
  }
  return out.length >= 3 ? Math.abs(signedArea(out)) : 0;
}

/** Whether two segments lie along the same line and share more than a point. */
export function segmentsOverlap(a0: Vec2, a1: Vec2, b0: Vec2, b1: Vec2, tol = 1e-7): boolean {
  const d = sub(a1, a0);
  const len = Math.hypot(d[0], d[1]);
  if (len < tol) return false;
  const u = scale(d, 1 / len);
  if (Math.abs(cross(u, sub(b0, a0))) > tol || Math.abs(cross(u, sub(b1, a0))) > tol) return false;
  const t0 = dot(sub(b0, a0), u);
  const t1 = dot(sub(b1, a0), u);
  return Math.min(len, Math.max(t0, t1)) - Math.max(0, Math.min(t0, t1)) > tol;
}

/** The stretch of edge two polygons share (in the coordinates given), or null if they only touch at a point. */
export function sharedSegment(p: Vec2[], q: Vec2[]): [Vec2, Vec2] | null {
  for (let i = 0; i < p.length; i++) {
    const a0 = p[i];
    const a1 = p[(i + 1) % p.length];
    const d = sub(a1, a0);
    const len = Math.hypot(d[0], d[1]);
    const u: Vec2 = [d[0] / len, d[1] / len];
    for (let j = 0; j < q.length; j++) {
      const b0 = q[j];
      const b1 = q[(j + 1) % q.length];
      const off0 = u[0] * (b0[1] - a0[1]) - u[1] * (b0[0] - a0[0]);
      const off1 = u[0] * (b1[1] - a0[1]) - u[1] * (b1[0] - a0[0]);
      if (Math.abs(off0) > 1e-7 || Math.abs(off1) > 1e-7) continue;
      const t0 = dot(sub(b0, a0), u);
      const t1 = dot(sub(b1, a0), u);
      const lo = Math.max(0, Math.min(t0, t1));
      const hi = Math.min(len, Math.max(t0, t1));
      if (hi - lo > 1e-7) return [[a0[0] + u[0] * lo, a0[1] + u[1] * lo], [a0[0] + u[0] * hi, a0[1] + u[1] * hi]];
    }
  }
  return null;
}

/** A cut through the paper: a segment on the sheet. Paper either side of it isn't joined there. */
export type Cut = [Vec2, Vec2];

/**
 * Whether paper meeting along the segment a–b on the sheet is joined there: some of it isn't covered by cuts
 * lying along the same line. A partly cut edge stays joined through the rest.
 */
export function joinedAlong(a: Vec2, b: Vec2, cuts: Cut[] | undefined, tol = 1e-7): boolean {
  if (!cuts?.length) return true;
  const d = sub(b, a);
  const len = Math.hypot(d[0], d[1]);
  if (len < tol) return false;
  const u = scale(d, 1 / len);
  const covered: [number, number][] = [];
  for (const [c0, c1] of cuts) {
    if (Math.abs(cross(u, sub(c0, a))) > tol || Math.abs(cross(u, sub(c1, a))) > tol) continue;
    const t0 = dot(sub(c0, a), u);
    const t1 = dot(sub(c1, a), u);
    covered.push([Math.max(0, Math.min(t0, t1)), Math.min(len, Math.max(t0, t1))]);
  }
  covered.sort((p, q) => p[0] - q[0]);
  let reach = 0;
  for (const [lo, hi] of covered) {
    if (lo > reach + tol) return true;
    reach = Math.max(reach, hi);
  }
  return reach < len - tol;
}

/** The stretch two faces share on the sheet, if they're joined along it (see `sharedSegment` and `joinedAlong`). */
export function joinedSegment(p: Vec2[], q: Vec2[], cuts: Cut[] | undefined): [Vec2, Vec2] | null {
  const shared = sharedSegment(p, q);
  return shared && joinedAlong(shared[0], shared[1], cuts) ? shared : null;
}
