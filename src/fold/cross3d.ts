import type { Vec2, Vec3 } from './types';

/** Testing flat polygons in 3D for passing through each other, for checking and steering animations. */

export type Box = [Vec3, Vec3];
const EPS = 1e-6;

export function box(points: Vec3[]): Box {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of points) for (let i = 0; i < 3; i++) (min[i] = Math.min(min[i], p[i])), (max[i] = Math.max(max[i], p[i]));
  return [min, max];
}

export function overlapping([amin, amax]: Box, [bmin, bmax]: Box): boolean {
  for (let i = 0; i < 3; i++) if (amax[i] < bmin[i] - EPS || bmax[i] < amin[i] - EPS) return false;
  return true;
}

/**
 * Two flat convex polygons cross when an edge of one passes through the inside of the other. Returns how far
 * it pokes through (the shorter end of the edge, measured from the other polygon's plane), or 0.
 */
export function crossDepth(a: Vec3[], b: Vec3[]): number {
  return Math.max(edgesThrough(a, b), edgesThrough(b, a));
}

function edgesThrough(edges: Vec3[], face: Vec3[]): number {
  const n = normalOf(face);
  if (!n) return 0;
  let deepest = 0;
  const d = dot(n, face[0]);
  for (let i = 0; i < edges.length; i++) {
    const p = edges[i];
    const q = edges[(i + 1) % edges.length];
    const sp = dot(n, p) - d;
    const sq = dot(n, q) - d;
    // The edge has to go from one side of the face's plane to the other, clearly.
    if (!((sp > EPS && sq < -EPS) || (sp < -EPS && sq > EPS))) continue;
    const t = sp / (sp - sq);
    const hit: Vec3 = [p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1]), p[2] + t * (q[2] - p[2])];
    if (strictlyInside(face, n, hit)) deepest = Math.max(deepest, Math.min(Math.abs(sp), Math.abs(sq)));
  }
  return deepest;
}

/** Inside the polygon, not on (or within a hair of) its edges. */
function strictlyInside(face: Vec3[], n: Vec3, p: Vec3): boolean {
  let sign = 0;
  for (let i = 0; i < face.length; i++) {
    const a = face[i];
    const b = face[(i + 1) % face.length];
    const e = sub(b, a);
    const len = Math.hypot(...e);
    const c = dot(cross(e, sub(p, a)), n) / (len || 1);
    if (Math.abs(c) < 1e-4) return false;
    if (sign && Math.sign(c) !== sign) return false;
    sign = Math.sign(c);
  }
  return true;
}

function normalOf(points: Vec3[]): Vec3 | null {
  let n: Vec3 = [0, 0, 0];
  for (let i = 0; i < points.length; i++) n = add(n, cross(points[i], points[(i + 1) % points.length]));
  const len = Math.hypot(...n);
  return len < 1e-12 ? null : [n[0] / len, n[1] / len, n[2] / len];
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Keys for a face's corners on the sheet: faces sharing one are joined there, and touch without crossing. */
export function cornerKeys(paper: Vec2[]): Set<string> {
  return new Set(paper.map((p) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`));
}
