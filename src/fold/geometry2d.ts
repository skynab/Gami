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
