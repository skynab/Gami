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
 *
 * One constraint at a time finds where paper buckles and curls, which solving them all at once (linearised) can't
 * see from flat paper. But each pass carries a correction only a few triangles further, so now and then everything
 * is also solved together (`together`), and each stage ends by setting every edge's length at once (`keepLengths`).
 */

export interface BendProblem {
  /** Where the points start. */
  points: Vec3[];
  triangles: Tri[];
  /** The paper as it lies unbent, for edge lengths and fold angles at rest. Leave out to use `points`. */
  rest?: Vec3[];
  /**
   * Each point on the sheet, for edge lengths at rest in place of `rest`'s: where the points start can be a little
   * off the paper's shape (folds wrapped round the layers inside them), and the paper keeps the sheet's.
   */
  sheet?: [number, number][];
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
  /** A height no point goes below (the table). Leave out for none. */
  floor?: number;
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
/** The last pass on edge lengths stops once every edge is within this share of its length, or after this many passes. */
const SETTLED = 1e-4;
const POLISH = 2400;
/** The same at the end of each stage but the last, whose frames are only passed through. */
const STAGE_SETTLED = 2e-3;
const STAGE_POLISH = 800;
/**
 * Solving constraints together (`together`): the least compliance any has (exact ones included, as flat paper has
 * more edges than ways to move in its plane, so they aren't all independent), and how far each solve goes.
 */
const DAMPING = 1e-5;
/** The same, setting edge lengths alone (`keepLengths`), where nothing else needs to outweigh. */
const LENGTH_DAMPING = 1e-4;
const CG_ITERATIONS = 200;
/** How far a point may move in one solve, as a share of the shortest edge, or of the paper's size. */
const REACH = 0.25;
const REACH_SHEET = 0.015;
/** How often, in iterations, everything is solved together. */
const SUBSTEP = 20;
/** How often, in iterations, to look again for points near other paper. */
const SEARCH_EVERY = 10;
const AXES: Vec3[] = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

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
  const { floor } = problem;
  /** Points under the floor back up onto it, as layers are kept apart. */
  const ground = () => {
    if (floor === undefined) return;
    for (let v = 0; v < p.length; v++) if (w[v] && p[v][1] < floor) p[v][1] = floor;
  };

  // Pinned points don't move (inverse mass 0); the rest move freely.
  const w = p.map(() => 1);
  for (const v of problem.pinned ?? []) w[v] = 0;
  // Setting edge lengths all at once keeps the goals' points where they've been taken too.
  const held = [...w];
  for (const g of problem.goals ?? []) held[g.vertex] = 0;

  const sheet = problem.sheet;
  const lengths = edges.map(([a, b]) => (sheet ? Math.hypot(sheet[b][0] - sheet[a][0], sheet[b][1] - sheet[a][1]) : len(sub(rest[b], rest[a]))));
  // How far a point may move in one step of solving everything together: a share of the paper's size, or of the
  // shortest edge if that's more. Not of the shortest edge alone: finer meshes would then move too little to keep
  // up, and a crease turning a flap would get only part of the way (half of a right angle, at a twentieth of the
  // sheet).
  const extent = Math.max(...[0, 1, 2].map((i) => Math.max(...rest.map((q) => q[i])) - Math.min(...rest.map((q) => q[i]))));
  const reach = Math.max(REACH * Math.min(...lengths), REACH_SHEET * extent);
  const hingeKey = (a: number, b: number) => (a < b ? `${a},${b}` : `${b},${a}`);
  const creaseOf = new Map((problem.creases ?? []).map((c) => [hingeKey(...c.edge), c]));
  const holdOf = new Map((problem.hinges ?? []).map((h) => [hingeKey(...h.edge), h.compliance]));
  const restAngles = hinges.map((h) => hingeAngle(rest, h));
  const startAngles = hinges.map((h) => hingeAngle(p, h));
  const goalStarts = (problem.goals ?? []).map((g) => [...p[g.vertex]] as Vec3);

  /** Moves the points by one constraint's correction (as XPBD does, one at a time); returns the new multiplier. */
  const project = (ids: number[], grads: Vec3[], c: number, lambda: number, compliance: number, mass = w): number => {
    let denom = compliance;
    for (let k = 0; k < ids.length; k++) denom += mass[ids[k]] * dot(grads[k], grads[k]);
    if (denom < 1e-18) return lambda;
    const dl = (-c - compliance * lambda) / denom;
    for (let k = 0; k < ids.length; k++) {
      const q = p[ids[k]];
      const m = mass[ids[k]] * dl;
      q[0] += m * grads[k][0];
      q[1] += m * grads[k][1];
      q[2] += m * grads[k][2];
    }
    return lambda + dl;
  };

  const strainNow = () => Math.max(0, ...edges.map(([a, b], k) => Math.abs(len(sub(p[b], p[a])) - lengths[k]) / lengths[k]));
  /**
   * Edges set right one at a time, with layers kept apart and off the table, until every edge is within `settled`
   * of its length or `passes` are done: setting them all at once moves paper into other paper, and pushing it back
   * out stretches it again.
   */
  const settle = (passes: number, settled: number, mass = w) => {
    const lEnd = edges.map(() => 0);
    for (let it = 0; it < passes && strainNow() > settled; it++) {
      edges.forEach(([a, b], k) => {
        const d = sub(p[b], p[a]);
        const dl = len(d);
        if (dl < 1e-12) return;
        const n = scale(d, 1 / dl);
        lEnd[k] = project([a, b], [scale(n, -1), n], dl - lengths[k], lEnd[k], 0, mass);
      });
      if (it % SEARCH_EVERY === 0) findPairs();
      for (const pair of pairs) separate(p, w, problem.triangles, pair);
      ground();
    }
  };

  const frames: Vec3[][] = [];
  let pairs: Pair[] = [];
  // The side of each triangle a point was first seen on, kept for good: a point pushed through stays wrong side
  // otherwise, as the next search would take where it ended up as where it belongs.
  const sides = new Map<number, number>();
  const findPairs = () => (pairs = thickness > 0 ? nearPairs(p, problem.triangles, thickness, sides) : []);
  if (sheet) {
    // Paper starting a little off the sheet's shape takes it back before anything moves, so the first frame
    // doesn't move it as well; the creases and goals start from there.
    settle(STAGE_POLISH, STAGE_SETTLED);
    hinges.forEach((h, k) => (startAngles[k] = hingeAngle(p, h)));
    (problem.goals ?? []).forEach((g, k) => (goalStarts[k] = [...p[g.vertex]] as Vec3));
  }
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
      for (const pair of pairs) separate(p, w, problem.triangles, pair);
      ground();
      // Now and then, a step solving everything together carries corrections right across the paper, as a crease
      // turning a whole flap: one at a time, they reach only a few triangles further each pass.
      if ((it + 1) % SUBSTEP === 0) {
        const rows = new Rows(DAMPING);
        edges.forEach(([a, b], k) => {
          const d = sub(p[b], p[a]);
          const dl = len(d);
          if (dl > 1e-12) rows.add([a, b], [scale(d, -1 / dl), scale(d, 1 / dl)], dl - lengths[k], stretch);
        });
        hinges.forEach((h, k) => rows.add([h.a, h.b, h.c, h.d], hingeGradient(p, h), wrap(hingeAngle(p, h) - targets[k].angle), targets[k].compliance));
        (problem.goals ?? []).forEach((g, k) => {
          for (let i = 0; i < 3; i++) rows.add([g.vertex], [AXES[i]], p[g.vertex][i] - goalAt[k][i], g.compliance ?? DEFAULTS.goal);
        });
        together(p, w, rows, reach);
        for (const pair of pairs) separate(p, w, problem.triangles, pair);
        ground();
      }
    }
    // Each stage's paper is kept as a frame, so it mustn't look stretched. Setting its lengths may let the goals'
    // points give a little (holding them, flat paper can't lift to meet them), but not at the last stage.
    if (stretch === 0) {
      keepLengths(p, s === stages ? held : w, edges, lengths, 5, 1e-3);
      for (const pair of pairs) separate(p, w, problem.triangles, pair);
      ground();
      if (s < stages) settle(STAGE_POLISH, STAGE_SETTLED, held);
    }
    frames.push(p.map((q) => [...q] as Vec3));
  }

  // A last pass on the edges alone, so every triangle keeps its shape as closely as it can: all of them at once,
  // then one at a time with layers kept apart, until they settle.
  keepLengths(p, held, edges, lengths, 10, SETTLED / 10);
  settle(POLISH, SETTLED);
  frames[frames.length - 1] = p.map((q) => [...q] as Vec3);
  const strain = strainNow();
  return { frames, strain };
}

/**
 * Brings every edge to its length at once, moving the points as little as it can (Goldenthal et al., "Efficient
 * simulation of inextensible cloth", 2007): a few steps of solving them together (`together`).
 */
function keepLengths(p: Vec3[], w: number[], edges: [number, number][], lengths: number[], steps: number, settled: number) {
  for (let step = 0; step < steps; step++) {
    const rows = new Rows(LENGTH_DAMPING);
    let worst = 0;
    edges.forEach(([a, b], k) => {
      // (|d|² − L²) / 2L: about the change in length, and smooth through it.
      const d = sub(p[b], p[a]);
      const c = (dot(d, d) - lengths[k] * lengths[k]) / (2 * lengths[k]);
      worst = Math.max(worst, Math.abs(c) / lengths[k]);
      rows.add([a, b], [scale(d, -1 / lengths[k]), scale(d, 1 / lengths[k])], c, 0);
    });
    if (worst <= settled) return;
    together(p, w, rows);
  }
}

/** Constraints for solving together: each one's points, its gradient at each, its value, and its compliance. */
class Rows {
  /** The least compliance a constraint is given. */
  constructor(private floor: number) {}
  start: number[] = [0];
  ids: number[] = [];
  grads: number[] = [];
  c: number[] = [];
  alpha: number[] = [];
  add(ids: number[], grads: Vec3[], c: number, compliance: number) {
    for (let k = 0; k < ids.length; k++) {
      this.ids.push(ids[k]);
      this.grads.push(grads[k][0], grads[k][1], grads[k][2]);
    }
    this.start.push(this.ids.length);
    this.c.push(c);
    this.alpha.push(Math.max(compliance, this.floor));
  }
}

/**
 * One step towards every constraint at once, moving the points as little as it can: (J W Jᵀ + α) Δλ = −C, solved by
 * conjugate gradients, then each point moved by W Jᵀ Δλ. Repeated, this settles where Σ C² / α is least: exact
 * constraints met, and softer ones (bending) giving way first. Nudging one constraint at a time instead carries a
 * correction only a few triangles further each pass, so turning a whole flap by its crease, or straightening a long
 * strip, takes many passes; this takes a handful. (For edges alone, see Goldenthal et al., "Efficient simulation
 * of inextensible cloth", 2007.)
 */
function together(p: Vec3[], w: number[], rows: Rows, reach = Infinity) {
  const m = rows.c.length;
  const n = p.length;
  const { start, ids, grads, alpha } = rows;
  const g = new Float64Array(3 * n);
  // The points moved by corrections x: each by its share of the constraints on it, into g.
  const moves = (x: Float64Array) => {
    g.fill(0);
    for (let r = 0; r < m; r++) {
      for (let j = start[r]; j < start[r + 1]; j++) {
        const v = ids[j];
        const k = x[r] * w[v];
        g[3 * v] += k * grads[3 * j];
        g[3 * v + 1] += k * grads[3 * j + 1];
        g[3 * v + 2] += k * grads[3 * j + 2];
      }
    }
  };
  // Each constraint scaled by its own stiffness (Jacobi preconditioning): a fold angle's gradient is hundreds of
  // times an edge's, and unscaled, the first iterations would see to the fold angles and leave the edges stretched.
  const diag = new Float64Array(m);
  for (let r = 0; r < m; r++) {
    let d = alpha[r];
    for (let j = start[r]; j < start[r + 1]; j++) d += w[ids[j]] * (grads[3 * j] ** 2 + grads[3 * j + 1] ** 2 + grads[3 * j + 2] ** 2);
    diag[r] = d;
  }
  const lambda = new Float64Array(m);
  const res = Float64Array.from(rows.c, (c) => -c);
  const z = res.map((x, r) => x / diag[r]);
  const dir = Float64Array.from(z);
  const ad = new Float64Array(m);
  let rr = 0;
  for (let r = 0; r < m; r++) rr += res[r] * z[r];
  // Only as closely as this step needs: the next one tidies up.
  const stop = rr * 1e-8;
  for (let it = 0; it < CG_ITERATIONS && rr > stop; it++) {
    moves(dir);
    let dAd = 0;
    for (let r = 0; r < m; r++) {
      let x = alpha[r] * dir[r];
      for (let j = start[r]; j < start[r + 1]; j++) {
        const v = ids[j];
        x += g[3 * v] * grads[3 * j] + g[3 * v + 1] * grads[3 * j + 1] + g[3 * v + 2] * grads[3 * j + 2];
      }
      ad[r] = x;
      dAd += dir[r] * x;
    }
    const step = rr / dAd;
    let next = 0;
    for (let r = 0; r < m; r++) {
      lambda[r] += step * dir[r];
      res[r] -= step * ad[r];
      z[r] = res[r] / diag[r];
      next += res[r] * z[r];
    }
    for (let r = 0; r < m; r++) dir[r] = z[r] + (next / rr) * dir[r];
    rr = next;
  }
  moves(lambda);
  // Far from where they're met, the constraints' gradients say little about where that is: no point goes further
  // than `reach` in one step.
  let far = 0;
  for (let v = 0; v < n; v++) far = Math.max(far, Math.hypot(g[3 * v], g[3 * v + 1], g[3 * v + 2]));
  const k = far > reach ? reach / far : 1;
  for (let v = 0; v < n; v++) for (let i = 0; i < 3; i++) p[v][i] += k * g[3 * v + i];
}

/** A point near a triangle it isn't part of, and which side of it the point is on. */
interface Pair {
  v: number;
  t: number;
  side: number;
  /**
   * How far apart they're kept: the layers' gap, or less if they were first seen closer (a point by a fold, where
   * the mesh can't round the paper off), so they aren't pushed further apart than the paper there can go.
   */
  gap: number;
}

/**
 * Points close to triangles of other paper, as they may be before the next search: within a few gaps of the triangle's plane,
 * over the triangle or nearly (they slide between searches). Each keeps the side it was first seen on (in `sides`). Plain search for now; a spatial hash
 * when meshes grow.
 */
function nearPairs(p: Vec3[], triangles: Tri[], thickness: number, sides: Map<number, number>): Pair[] {
  const out: Pair[] = [];
  const reach = 4 * thickness;
  // Points by cell of a grid about a triangle's size, so each triangle looks only at the points near it. A point
  // that counts lies within its triangle's box grown by the reach (by √2 of it, beyond a corner).
  const cell = Math.max(2 * reach, ...triangles.slice(0, 64).map((tri) => Math.max(...[0, 1, 2].map((i) => Math.abs(p[tri[0]][i] - p[tri[1]][i]) + Math.abs(p[tri[1]][i] - p[tri[2]][i])))));
  const index = (x: number) => Math.floor(x / cell);
  const key = (i: number, j: number, k: number) => `${i},${j},${k}`;
  const grid = new Map<string, number[]>();
  p.forEach((q, v) => {
    const at = key(index(q[0]), index(q[1]), index(q[2]));
    const list = grid.get(at);
    if (list) list.push(v);
    else grid.set(at, [v]);
  });
  const grow = 1.5 * reach;
  triangles.forEach((tri, t) => {
    const [a, b, c] = tri.map((i) => p[i]);
    const n = cross(sub(b, a), sub(c, a));
    const nl = len(n);
    if (nl < 1e-15) return;
    const u = scale(n, 1 / nl);
    const min = [0, 1, 2].map((i) => Math.min(a[i], b[i], c[i]) - grow);
    const max = [0, 1, 2].map((i) => Math.max(a[i], b[i], c[i]) + grow);
    const lo = min.map(index);
    const hi = max.map(index);
    // Cell by cell, in a fixed order (each point is in one), so the same paper finds the same pairs in turn.
    for (let i = lo[0]; i <= hi[0]; i++)
      for (let j = lo[1]; j <= hi[1]; j++)
        for (let k = lo[2]; k <= hi[2]; k++)
          for (const v of grid.get(key(i, j, k)) ?? []) {
            if (v === tri[0] || v === tri[1] || v === tri[2]) continue;
            const q = p[v];
            // In the triangle's box first: a cell holds points well away from it too.
            if (q[0] < min[0] || q[0] > max[0] || q[1] < min[1] || q[1] > max[1] || q[2] < min[2] || q[2] > max[2]) continue;
            const d = (q[0] - a[0]) * u[0] + (q[1] - a[1]) * u[1] + (q[2] - a[2]) * u[2];
            if (Math.abs(d) > reach || !over(q, a, b, c, u, reach)) continue;
            const id = v * triangles.length + t;
            // Kept as the side it's on times the gap it keeps.
            let seen = sides.get(id);
            if (seen === undefined) sides.set(id, (seen = (d >= 0 ? 1 : -1) * Math.min(thickness, Math.max(Math.abs(d), thickness / 4))));
            out.push({ v, t, side: Math.sign(seen), gap: Math.abs(seen) });
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

/** Keeps a point at least its gap (Pair.gap) from a triangle, on the side it started on, moving both apart. */
function separate(p: Vec3[], w: number[], triangles: Tri[], { v, t, side, gap: keep }: Pair) {
  // Run for every pair near each other, every iteration, and nearly all are already a gap apart: so in plain
  // numbers, and how far apart they are first.
  const tri = triangles[t];
  const [a, b, c] = [p[tri[0]], p[tri[1]], p[tri[2]]];
  const [e1x, e1y, e1z] = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const [e2x, e2y, e2z] = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  let [nx, ny, nz] = [e1y * e2z - e1z * e2y, e1z * e2x - e1x * e2z, e1x * e2y - e1y * e2x];
  const nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
  if (nl < 1e-15) return;
  [nx, ny, nz] = [(nx * side) / nl, (ny * side) / nl, (nz * side) / nl];
  const q = p[v];
  const gap = (q[0] - a[0]) * nx + (q[1] - a[1]) * ny + (q[2] - a[2]) * nz - keep;
  if (gap >= 0) return;
  const u: Vec3 = [nx, ny, nz];
  if (!over(q, a, b, c, u)) return;
  // The point moves out along the normal; the triangle's corners move the other way, sharing it equally.
  const denom = w[v] + (w[tri[0]] + w[tri[1]] + w[tri[2]]) / 9;
  if (denom < 1e-18) return;
  const dl = -gap / denom;
  q[0] += w[v] * dl * nx;
  q[1] += w[v] * dl * ny;
  q[2] += w[v] * dl * nz;
  for (const i of tri) {
    const m = (-w[i] * dl) / 3;
    p[i][0] += m * nx;
    p[i][1] += m * ny;
    p[i][2] += m * nz;
  }
}
