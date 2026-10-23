import type { Vec3 } from '../types';
import { topology, type Hinge, type Tri } from './mesh';

/**
 * Working out how paper bends (see docs/bending-plan.md): a mesh of small rigid triangles moved by
 * position-based dynamics (XPBD) towards its goals. It's solved quasi-statically: no speeds or masses, just
 * constraints nudged into place a fixed number of times, so the same problem gives the same paper every time.
 *
 * Each constraint C(p) = 0 (or ≥ 0) moves the points it involves along its gradient by
 * Δλ = (−C − α̃λ) / (Σ w|∇C|² + α̃), where α̃ is its compliance (0 for exact, larger for softer) and λ its
 * accumulated multiplier.
 */

export interface BendProblem {
  /** Where the points start. */
  points: Vec3[];
  triangles: Tri[];
  /** The paper as it lies unbent, for edge lengths and fold angles at rest. Leave out to use `points`. */
  rest?: Vec3[];
  /** Points held where they start. */
  pinned?: number[];
  /** Points taken from where they start to `to`, a share more each stage. */
  goals?: { vertex: number; to: Vec3; compliance?: number }[];
  /** Hinges (by their edge's two points) taken from their rest angle to `degrees`, a share more each stage. */
  creases?: { edge: [number, number]; degrees: number; compliance?: number }[];
  /** Hinges (by their edge's two points) held at their rest angle with their own compliance, in place of `compliance.bend`. */
  hinges?: { edge: [number, number]; compliance: number }[];
  /** Compliance of edge lengths (0: exact) and of bending at hinges with no crease goal. */
  compliance?: { stretch?: number; bend?: number };
  /** The gap layers keep between them. Leave out for no collisions. */
  thickness?: number;
  /** How many stages the goals ramp over, each kept as a frame, and the iterations in each. */
  stages?: number;
  iterations?: number;
}

export interface BendResult {
  /** The points after each stage; the last is the result. */
  frames: Vec3[][];
  /** The largest change in an edge's length, as a share of its length at rest. */
  strain: number;
}

const DEFAULTS = { stretch: 0, bend: 1e-2, goal: 0, crease: 0, stages: 12, iterations: 120 };
/** The last pass on edge lengths stops once every edge is within this share of its length, or after 20 times the iterations. */
const SETTLED = 1e-4;
/** Damping and iterations for solving all edge lengths at once (`keepLengths`). */
const DAMPING = 1e-4;
const CG_ITERATIONS = 200;
/** How often, in iterations, to look again for points near other paper. */
const SEARCH_EVERY = 10;

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const len = (a: Vec3) => Math.sqrt(dot(a, a));

/**
 * A hinge's fold angle: 0 lying flat, turning towards ±π as it folds right over (positive when the paper on
 * either side turns towards the side the triangles' normals point away from).
 */
export function hingeAngle(p: Vec3[], h: Hinge): number {
  const e = sub(p[h.b], p[h.a]);
  const nA = cross(e, sub(p[h.c], p[h.a]));
  const nB = cross(sub(p[h.d], p[h.a]), e);
  return Math.atan2(dot(cross(nA, nB), e) / len(e), dot(nA, nB));
}

/** The gradient of `hingeAngle` with respect to the hinge's four points, in the order a, b, c, d. */
export function hingeGradient(p: Vec3[], h: Hinge): [Vec3, Vec3, Vec3, Vec3] {
  const e = sub(p[h.b], p[h.a]);
  const el = len(e);
  const nA = cross(e, sub(p[h.c], p[h.a]));
  const nB = cross(sub(p[h.d], p[h.a]), e);
  // Each opposite corner moves the angle by its distance from the edge, along its triangle's normal.
  const gc = scale(nA, -el / dot(nA, nA));
  const gd = scale(nB, -el / dot(nB, nB));
  // The ends of the edge share the rest so nothing turns or moves the whole (the gradients sum to nothing).
  const sc = dot(sub(p[h.c], p[h.a]), e) / (el * el);
  const sd = dot(sub(p[h.d], p[h.a]), e) / (el * el);
  const gb: Vec3 = [-(sc * gc[0] + sd * gd[0]), -(sc * gc[1] + sd * gd[1]), -(sc * gc[2] + sd * gd[2])];
  const ga: Vec3 = [-(gc[0] + gd[0] + gb[0]), -(gc[1] + gd[1] + gb[1]), -(gc[2] + gd[2] + gb[2])];
  return [ga, gb, gc, gd];
}

/** An angle brought into (−π, π]. */
const wrap = (x: number) => x - 2 * Math.PI * Math.round(x / (2 * Math.PI));

export function solve(problem: BendProblem): BendResult {
  const p: Vec3[] = problem.points.map((q) => [...q] as Vec3);
  const rest = problem.rest ?? problem.points;
  const { edges, hinges } = topology(problem.triangles);
  const stretch = problem.compliance?.stretch ?? DEFAULTS.stretch;
  const bend = problem.compliance?.bend ?? DEFAULTS.bend;
  const stages = problem.stages ?? DEFAULTS.stages;
  const iterations = problem.iterations ?? DEFAULTS.iterations;
  const thickness = problem.thickness ?? 0;

  // Pinned points don't move (inverse mass 0); the rest move freely.
  const w = p.map(() => 1);
  for (const v of problem.pinned ?? []) w[v] = 0;
  // Setting edge lengths all at once keeps the goals' points where they've been taken too.
  const held = [...w];
  for (const g of problem.goals ?? []) held[g.vertex] = 0;

  const lengths = edges.map(([a, b]) => len(sub(rest[b], rest[a])));
  const hingeKey = (a: number, b: number) => (a < b ? `${a},${b}` : `${b},${a}`);
  const creaseOf = new Map((problem.creases ?? []).map((c) => [hingeKey(...c.edge), c]));
  const holdOf = new Map((problem.hinges ?? []).map((h) => [hingeKey(...h.edge), h.compliance]));
  const restAngles = hinges.map((h) => hingeAngle(rest, h));
  const startAngles = hinges.map((h) => hingeAngle(p, h));
  const goalStarts = (problem.goals ?? []).map((g) => [...p[g.vertex]] as Vec3);

  /** Moves the points by one constraint's correction; returns the new multiplier. */
  const project = (ids: number[], grads: Vec3[], c: number, lambda: number, compliance: number): number => {
    let denom = compliance;
    for (let k = 0; k < ids.length; k++) denom += w[ids[k]] * dot(grads[k], grads[k]);
    if (denom < 1e-18) return lambda;
    const dl = (-c - compliance * lambda) / denom;
    for (let k = 0; k < ids.length; k++) {
      const q = p[ids[k]];
      const m = w[ids[k]] * dl;
      q[0] += m * grads[k][0];
      q[1] += m * grads[k][1];
      q[2] += m * grads[k][2];
    }
    return lambda + dl;
  };

  const frames: Vec3[][] = [];
  let pairs: Pair[] = [];
  // The side of each triangle a point was first seen on, kept for good: a point pushed through stays wrong side
  // otherwise, as the next search would take where it ended up as where it belongs.
  const sides = new Map<string, number>();
  const findPairs = () => (pairs = thickness > 0 ? nearPairs(p, problem.triangles, thickness, sides) : []);
  for (let s = 1; s <= stages; s++) {
    const share = s / stages;
    const goalAt = (problem.goals ?? []).map((g, k): Vec3 => {
      const a = goalStarts[k];
      return [a[0] + (g.to[0] - a[0]) * share, a[1] + (g.to[1] - a[1]) * share, a[2] + (g.to[2] - a[2]) * share];
    });
    const targets = hinges.map((h, k) => {
      const crease = creaseOf.get(hingeKey(h.a, h.b));
      if (!crease) return { angle: restAngles[k], compliance: holdOf.get(hingeKey(h.a, h.b)) ?? bend };
      const goal = (crease.degrees * Math.PI) / 180;
      return { angle: startAngles[k] + wrap(goal - startAngles[k]) * share, compliance: crease.compliance ?? DEFAULTS.crease };
    });

    const lEdge = edges.map(() => 0);
    const lHinge = hinges.map(() => 0);
    const lGoal = goalAt.map(() => 0);
    for (let it = 0; it < iterations; it++) {
      // Points slide over the paper beneath them, onto triangles they weren't near before: look again now and then.
      if (it % SEARCH_EVERY === 0) findPairs();
      edges.forEach(([a, b], k) => {
        const d = sub(p[b], p[a]);
        const dl = len(d);
        if (dl < 1e-12) return;
        const n = scale(d, 1 / dl);
        lEdge[k] = project([a, b], [scale(n, -1), n], dl - lengths[k], lEdge[k], stretch);
      });
      hinges.forEach((h, k) => {
        const c = wrap(hingeAngle(p, h) - targets[k].angle);
        lHinge[k] = project([h.a, h.b, h.c, h.d], hingeGradient(p, h), c, lHinge[k], targets[k].compliance);
      });
      // Goals last but for layers keeping apart: the lengths they upset are set right at the end of the stage.
      (problem.goals ?? []).forEach((g, k) => {
        const d = sub(p[g.vertex], goalAt[k]);
        const dl = len(d);
        if (dl > 1e-12) lGoal[k] = project([g.vertex], [scale(d, 1 / dl)], dl, lGoal[k], g.compliance ?? DEFAULTS.goal);
      });
      for (const pair of pairs) separate(p, w, problem.triangles, pair, thickness);
    }
    // Each stage's paper is kept as a frame, so it mustn't look stretched.
    if (stretch === 0) {
      keepLengths(p, held, edges, lengths, 3, 1e-3);
      for (const pair of pairs) separate(p, w, problem.triangles, pair, thickness);
    }
    frames.push(p.map((q) => [...q] as Vec3));
  }

  // A last pass on the edges alone, so every triangle keeps its shape as closely as it can: all of them at once,
  // then one at a time with layers kept apart, until they settle.
  keepLengths(p, held, edges, lengths, 10, SETTLED / 10);
  const lEnd = edges.map(() => 0);
  const strainNow = () => Math.max(0, ...edges.map(([a, b], k) => Math.abs(len(sub(p[b], p[a])) - lengths[k]) / lengths[k]));
  for (let it = 0; it < 20 * iterations && strainNow() > SETTLED; it++) {
    edges.forEach(([a, b], k) => {
      const d = sub(p[b], p[a]);
      const dl = len(d);
      if (dl < 1e-12) return;
      const n = scale(d, 1 / dl);
      lEnd[k] = project([a, b], [scale(n, -1), n], dl - lengths[k], lEnd[k], 0);
    });
    // Layers still keep apart while the edges settle.
    if (it % SEARCH_EVERY === 0) findPairs();
    for (const pair of pairs) separate(p, w, problem.triangles, pair, thickness);
  }
  frames[frames.length - 1] = p.map((q) => [...q] as Vec3);
  const strain = strainNow();
  return { frames, strain };
}

/**
 * Brings every edge to its length at once, moving the points as little as it can (Goldenthal et al., "Efficient
 * simulation of inextensible cloth", 2007): a few Newton steps, each solving for every edge's correction together
 * by conjugate gradients. Corrections nudged along one edge at a time take many passes to cross a large mesh;
 * this takes a handful.
 *
 * Flat paper has more edges than ways to move within its plane, so the edges' corrections aren't all independent:
 * the solve is damped, and stops after a fixed number of iterations, each step only closing most of the gap.
 */
function keepLengths(p: Vec3[], w: number[], edges: [number, number][], lengths: number[], steps: number, settled: number) {
  const m = edges.length;
  const n = p.length;
  const dirs = new Float64Array(3 * m);
  const c = new Float64Array(m);
  const g = new Float64Array(3 * n);
  const lambda = new Float64Array(m);
  const res = new Float64Array(m);
  const dir = new Float64Array(m);
  const ad = new Float64Array(m);
  // Moving the points by the edges' corrections: each point by its share of the edges at it, into g.
  const moves = (x: Float64Array) => {
    g.fill(0);
    for (let k = 0; k < m; k++) {
      const [a, b] = edges[k];
      for (let i = 0; i < 3; i++) {
        g[3 * b + i] += x[k] * dirs[3 * k + i] * w[b];
        g[3 * a + i] -= x[k] * dirs[3 * k + i] * w[a];
      }
    }
  };
  for (let step = 0; step < steps; step++) {
    // Each edge's constraint (|d|² − L²) / 2L, about its change in length, and its direction scaled by 1 / L.
    let worst = 0;
    for (let k = 0; k < m; k++) {
      const [a, b] = edges[k];
      const d = sub(p[b], p[a]);
      for (let i = 0; i < 3; i++) dirs[3 * k + i] = d[i] / lengths[k];
      c[k] = (dot(d, d) - lengths[k] * lengths[k]) / (2 * lengths[k]);
      worst = Math.max(worst, Math.abs(c[k]) / lengths[k]);
    }
    if (worst <= settled) return;
    // Solve (J W Jᵀ) λ = C for the corrections, only as closely as this step needs: the next step tidies up.
    lambda.fill(0);
    res.set(c);
    dir.set(c);
    let rr = 0;
    for (let k = 0; k < m; k++) rr += res[k] * res[k];
    const stop = rr * 1e-8;
    for (let it = 0; it < CG_ITERATIONS && rr > stop; it++) {
      moves(dir);
      let dAd = 0;
      for (let k = 0; k < m; k++) {
        const [a, b] = edges[k];
        let x = DAMPING * dir[k];
        for (let i = 0; i < 3; i++) x += (g[3 * b + i] - g[3 * a + i]) * dirs[3 * k + i];
        ad[k] = x;
        dAd += dir[k] * x;
      }
      const alpha = rr / dAd;
      let next = 0;
      for (let k = 0; k < m; k++) {
        lambda[k] += alpha * dir[k];
        res[k] -= alpha * ad[k];
        next += res[k] * res[k];
      }
      for (let k = 0; k < m; k++) dir[k] = res[k] + (next / rr) * dir[k];
      rr = next;
    }
    moves(lambda);
    for (let v = 0; v < n; v++) for (let i = 0; i < 3; i++) p[v][i] -= g[3 * v + i];
  }
}

/** A point near a triangle it isn't part of, and which side of it the point is on. */
interface Pair {
  v: number;
  t: number;
  side: number;
}

/**
 * Points close to triangles of other paper, as they may be before the next search: within a few gaps of the triangle's plane,
 * over the triangle or nearly (they slide between searches). Each keeps the side it was first seen on (in `sides`). Plain search for now; a spatial hash
 * when meshes grow.
 */
function nearPairs(p: Vec3[], triangles: Tri[], thickness: number, sides: Map<string, number>): Pair[] {
  const out: Pair[] = [];
  const reach = 4 * thickness;
  triangles.forEach((tri, t) => {
    const [a, b, c] = tri.map((i) => p[i]);
    const n = cross(sub(b, a), sub(c, a));
    const nl = len(n);
    if (nl < 1e-15) return;
    const u = scale(n, 1 / nl);
    for (let v = 0; v < p.length; v++) {
      if (v === tri[0] || v === tri[1] || v === tri[2]) continue;
      const d = dot(sub(p[v], a), u);
      if (Math.abs(d) > reach || !over(p[v], a, b, c, u, reach)) continue;
      const key = `${v},${t}`;
      if (!sides.has(key)) sides.set(key, d >= 0 ? 1 : -1);
      out.push({ v, t, side: sides.get(key)! });
    }
  });
  return out;
}

/**
 * Whether a point lies over a triangle (its foot on the triangle's plane is inside it), or within `margin` of its
 * edges.
 */
function over(q: Vec3, a: Vec3, b: Vec3, c: Vec3, u: Vec3, margin = 0): boolean {
  // The foot's distance inside each edge (negative outside).
  const s1 = dot(cross(sub(b, a), sub(q, a)), u) / len(sub(b, a));
  const s2 = dot(cross(sub(c, b), sub(q, b)), u) / len(sub(c, b));
  const s3 = dot(cross(sub(a, c), sub(q, c)), u) / len(sub(a, c));
  // A point right over an edge or corner counts for every triangle there, whatever rounding says.
  const m = margin + 1e-12;
  return (s1 >= -m && s2 >= -m && s3 >= -m) || (s1 <= m && s2 <= m && s3 <= m);
}

/** Keeps a point at least the gap from a triangle, on the side it started on, moving both apart. */
function separate(p: Vec3[], w: number[], triangles: Tri[], { v, t, side }: Pair, thickness: number) {
  const tri = triangles[t];
  const [a, b, c] = tri.map((i) => p[i]);
  const n = cross(sub(b, a), sub(c, a));
  const nl = len(n);
  if (nl < 1e-15) return;
  const u = scale(n, side / nl);
  if (!over(p[v], a, b, c, u)) return;
  const gap = dot(sub(p[v], a), u) - thickness;
  if (gap >= 0) return;
  // The point moves out along the normal; the triangle's corners move the other way, sharing it equally.
  const ids = [v, ...tri];
  const grads: Vec3[] = [u, scale(u, -1 / 3), scale(u, -1 / 3), scale(u, -1 / 3)];
  let denom = 0;
  for (let k = 0; k < 4; k++) denom += w[ids[k]] * dot(grads[k], grads[k]);
  if (denom < 1e-18) return;
  const dl = -gap / denom;
  for (let k = 0; k < 4; k++) {
    const q = p[ids[k]];
    const m = w[ids[k]] * dl;
    q[0] += m * grads[k][0];
    q[1] += m * grads[k][1];
    q[2] += m * grads[k][2];
  }
}
