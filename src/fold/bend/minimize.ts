import type { Vec3 } from '../types';
import type { Hinge, Tri } from './mesh';

/**
 * A stage of bending paper as one energy brought to its least (see docs/bending-plan.md, "Improving the solver"):
 * the paper's edges keeping their lengths, its hinges bending as little as they can, its guides and goals pulling
 * it where it's to go, and it keeping clear of other layers and the table, all at once. Solving the constraints one
 * at a time instead, with lengths set at the end on their own, leaves the paper wherever the last of them put it;
 * this finds the balance between them.
 *
 * Newton's method, each step solved by conjugate gradients with each point's own 3 × 3 block as preconditioner, and
 * a line search so every step lowers the energy. The edges' lengths are exact, by an augmented Lagrangian: each
 * edge a stiff spring whose rest is moved, round by round, by how far it was off (its multiplier), until it isn't.
 * So the springs needn't be so stiff that the steps can't be solved.
 */

/** What the energy is made of, for points `p` (those with `w` 0 stay put). */
export interface Energy {
  edges: [number, number][];
  lengths: number[];
  /** Each edge's spring, per unit of its strain squared and its length (so the energy is about the area's). */
  stretch: number;
  hinges: Hinge[];
  /** Each hinge's angle to keep, and how stiffly (energy per radian squared). */
  angles: number[];
  stiffness: number[];
  /** Places on the paper (corners `ids`, weighted) pulled towards `to`, per unit of distance squared. */
  guides: { ids: number[]; weights: number[]; to: Vec3 }[];
  guide: number;
  /** Points pulled to places, stiffly. */
  goals: { vertex: number; to: Vec3 }[];
  goal: number;
  triangles: Tri[];
  /** Points to keep a gap from a triangle, on a side of it (see solver.ts): looked for again each step. */
  contacts?: () => { v: number; t: number; side: number; gap: number }[];
  contact: number;
  /** A height no point goes below, and how stiffly. */
  floor?: number;
}

/** How a minimisation went: the rounds of the edges' multipliers, Newton steps, and the strain it ended at. */
export interface Minimized {
  rounds: number;
  steps: number;
  strain: number;
}

/**
 * Layers lie a gap apart in a stack, so the least squeeze would bring thousands of contacts in at once, and each
 * coming and going breaks the steps; they're kept only this share of their gap apart, and what goes further is put
 * right at the end of the stage (solver.ts's \`settleLayers\`).
 */
const SLACK = 0.5;
/** A step lowering the energy by less than this share of it ends the round. */
const LEVEL = 1e-4;
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: Vec3) => Math.sqrt(dot(a, a));
const wrap = (x: number) => Math.atan2(Math.sin(x), Math.cos(x));

/** A hinge's fold angle (as solver.ts's `hingeAngle`). */
function angleOf(p: Vec3[], h: Hinge): number {
  const e = sub(p[h.b], p[h.a]);
  const nA = cross(e, sub(p[h.c], p[h.a]));
  const nB = cross(sub(p[h.d], p[h.a]), e);
  return Math.atan2(dot(cross(nA, nB), e) / len(e), dot(nA, nB));
}

/** Its gradient for the hinge's four points, a, b, c, d (as solver.ts's `hingeGradient`). */
function angleGradient(p: Vec3[], h: Hinge): Vec3[] {
  const e = sub(p[h.b], p[h.a]);
  const el = len(e);
  const nA = cross(e, sub(p[h.c], p[h.a]));
  const nB = cross(sub(p[h.d], p[h.a]), e);
  const gc = nA.map((x) => (-x * el) / dot(nA, nA)) as Vec3;
  const gd = nB.map((x) => (-x * el) / dot(nB, nB)) as Vec3;
  const sc = dot(sub(p[h.c], p[h.a]), e) / (el * el);
  const sd = dot(sub(p[h.d], p[h.a]), e) / (el * el);
  const gb: Vec3 = [-(sc * gc[0] + sd * gd[0]), -(sc * gc[1] + sd * gd[1]), -(sc * gc[2] + sd * gd[2])];
  const ga: Vec3 = [-(gc[0] + gd[0] + gb[0]), -(gc[1] + gd[1] + gb[1]), -(gc[2] + gd[2] + gb[2])];
  return [ga, gb, gc, gd];
}

/** A contact as it is now: the point's distance out from the triangle (along `n`, its side), and where its foot is. */
function contactNow(p: Vec3[], tri: Tri, v: number, side: number): { d: number; n: Vec3; foot: [number, number, number] } | null {
  const [a, b, c] = tri.map((i) => p[i]);
  const m = cross(sub(b, a), sub(c, a));
  const ml = len(m);
  if (ml < 1e-15) return null;
  const n = m.map((x) => (x * side) / ml) as Vec3;
  const q = p[v];
  const d = dot(sub(q, a), n);
  // The foot's barycentric weights, from the areas it makes with each edge.
  const f = sub(q, n.map((x) => x * d) as Vec3);
  const wa = dot(cross(sub(b, f), sub(c, f)), m) / (ml * ml);
  const wb = dot(cross(sub(c, f), sub(a, f)), m) / (ml * ml);
  const wc = 1 - wa - wb;
  if (Math.min(wa, wb, wc) < -0.05) return null;
  return { d, n, foot: [wa, wb, wc] };
}

/**
 * Brings `p` to the energy's least, moving only points with `w` > 0, for at most `rounds` rounds of the edges'
 * multipliers (`multipliers`, kept by the caller from one stage to the next) of at most `steps` Newton steps each,
 * stopping once every edge is within `settled` of its length and a round barely moves the paper.
 */
export function minimize(
  p: Vec3[],
  w: number[],
  energy: Energy,
  multipliers: Float64Array,
  { rounds = 8, steps = 12, settled = 1e-4 }: { rounds?: number; steps?: number; settled?: number } = {},
): Minimized {
  const n = p.length;
  const { edges, lengths, stretch, hinges, angles, stiffness, guides, guide, goals, goal, triangles, contact, floor } = energy;
  const spring = edges.map((_, k) => stretch * lengths[k]);
  // Points next to a triangle (on an edge with one of its corners): across a fold lying flat they're almost on it,
  // and that's the fold, not paper touching paper.
  const next = p.map(() => new Set<number>());
  for (const [a, b] of edges) {
    next[a].add(b);
    next[b].add(a);
  }
  const beside = (v: number, t: number) => triangles[t].some((c) => c === v || next[c].has(v));
  let used = 0;
  let round = 0;
  const strainNow = () => Math.max(0, ...edges.map(([a, b], k) => Math.abs(len(sub(p[b], p[a])) - lengths[k]) / lengths[k]));

  for (; round < rounds; round++) {
    let moved = 0;
    for (let step = 0; step < steps; step++) {
      used++;
      const pairs = (energy.contacts?.() ?? []).filter((pair) => !beside(pair.v, pair.t));
      // Everything the step needs, at where the paper is now: each term's residual and its gradients.
      const grad = new Float64Array(3 * n);
      const diag = new Float64Array(9 * n);
      const addDiag = (v: number, g: Vec3, k: number) => {
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) diag[9 * v + 3 * i + j] += k * g[i] * g[j];
      };
      const edgeDir = edges.map(([a, b], k) => {
        const d = sub(p[b], p[a]);
        const dl = len(d) || 1e-12;
        const u = d.map((x) => x / dl) as Vec3;
        // Strain, offset by the multiplier: the spring's rest moved by how far it was off before.
        const c = (dl - lengths[k]) / lengths[k] + multipliers[k] / spring[k];
        const s = spring[k] / lengths[k];
        for (let i = 0; i < 3; i++) {
          grad[3 * b + i] += s * c * u[i] * 1;
          grad[3 * a + i] -= s * c * u[i];
        }
        const k2 = spring[k] / (lengths[k] * lengths[k]);
        addDiag(a, u, k2);
        addDiag(b, u, k2);
        return { u, k2 };
      });
      const hingeGrad = hinges.map((h, k) => {
        if (!stiffness[k]) return null;
        const g = angleGradient(p, h);
        const r = wrap(angleOf(p, h) - angles[k]);
        [h.a, h.b, h.c, h.d].forEach((v, i) => {
          for (let c = 0; c < 3; c++) grad[3 * v + c] += stiffness[k] * r * g[i][c];
          addDiag(v, g[i], stiffness[k]);
        });
        return g;
      });
      guides.forEach(({ ids, weights, to }) => {
        const at: Vec3 = [0, 0, 0];
        ids.forEach((v, i) => {
          for (let c = 0; c < 3; c++) at[c] += weights[i] * p[v][c];
        });
        ids.forEach((v, i) => {
          for (let c = 0; c < 3; c++) {
            grad[3 * v + c] += guide * weights[i] * (at[c] - to[c]);
            diag[9 * v + 4 * c] += guide * weights[i] * weights[i];
          }
        });
      });
      for (const { vertex: v, to } of goals) {
        for (let c = 0; c < 3; c++) {
          grad[3 * v + c] += goal * (p[v][c] - to[c]);
          diag[9 * v + 4 * c] += goal;
        }
      }
      const touching = pairs.flatMap((pair) => {
        const now = contactNow(p, triangles[pair.t], pair.v, pair.side);
        const keep = SLACK * pair.gap;
        if (!now || now.d >= keep) return [];
        const ids = [pair.v, ...triangles[pair.t]];
        const coef = [1, -now.foot[0], -now.foot[1], -now.foot[2]];
        const r = now.d - keep;
        ids.forEach((v, i) => {
          for (let c = 0; c < 3; c++) grad[3 * v + c] += contact * r * coef[i] * now.n[c];
          addDiag(v, now.n.map((x) => x * coef[i]) as Vec3, contact);
        });
        return [{ ids, coef, n: now.n }];
      });
      const below = floor === undefined ? [] : p.flatMap((q, v) => (w[v] && q[1] < floor ? [v] : []));
      for (const v of below) {
        grad[3 * v + 1] += contact * (p[v][1] - floor!);
        diag[9 * v + 4] += contact;
      }
      for (let v = 0; v < n; v++) if (!w[v]) for (let c = 0; c < 3; c++) grad[3 * v + c] = 0;

      // The Gauss–Newton Hessian times x, without making it.
      const times = (x: Float64Array, out: Float64Array) => {
        out.fill(0);
        edges.forEach(([a, b], k) => {
          const { u, k2 } = edgeDir[k];
          const j = k2 * (u[0] * (x[3 * b] - x[3 * a]) + u[1] * (x[3 * b + 1] - x[3 * a + 1]) + u[2] * (x[3 * b + 2] - x[3 * a + 2]));
          for (let i = 0; i < 3; i++) {
            out[3 * b + i] += j * u[i];
            out[3 * a + i] -= j * u[i];
          }
        });
        hinges.forEach((h, k) => {
          const g = hingeGrad[k];
          if (!g) return;
          const ids = [h.a, h.b, h.c, h.d];
          let j = 0;
          ids.forEach((v, i) => (j += g[i][0] * x[3 * v] + g[i][1] * x[3 * v + 1] + g[i][2] * x[3 * v + 2]));
          j *= stiffness[k];
          ids.forEach((v, i) => {
            for (let c = 0; c < 3; c++) out[3 * v + c] += j * g[i][c];
          });
        });
        guides.forEach(({ ids, weights }) => {
          for (let c = 0; c < 3; c++) {
            let j = 0;
            ids.forEach((v, i) => (j += weights[i] * x[3 * v + c]));
            ids.forEach((v, i) => (out[3 * v + c] += guide * weights[i] * j));
          }
        });
        for (const { vertex: v } of goals) for (let c = 0; c < 3; c++) out[3 * v + c] += goal * x[3 * v + c];
        for (const { ids, coef, n: nn } of touching) {
          let j = 0;
          ids.forEach((v, i) => (j += coef[i] * (nn[0] * x[3 * v] + nn[1] * x[3 * v + 1] + nn[2] * x[3 * v + 2])));
          ids.forEach((v, i) => {
            for (let c = 0; c < 3; c++) out[3 * v + c] += contact * coef[i] * j * nn[c];
          });
        }
        for (const v of below) out[3 * v + 1] += contact * x[3 * v + 1];
        for (let v = 0; v < n; v++) {
          if (!w[v]) out[3 * v] = out[3 * v + 1] = out[3 * v + 2] = 0;
          // A little of each point's own block, so a part held by nothing (paper that can turn freely) still solves.
          else for (let c = 0; c < 3; c++) out[3 * v + c] += 1e-6 * (diag[9 * v] + diag[9 * v + 4] + diag[9 * v + 8] + 1e-9) * x[3 * v + c];
        }
      };
      // Each point's block, inverted, as the preconditioner.
      const inverse = new Float64Array(9 * n);
      for (let v = 0; v < n; v++) {
        const m = Array.from(diag.subarray(9 * v, 9 * v + 9));
        const eps = 1e-6 * (m[0] + m[4] + m[8]) + 1e-12;
        m[0] += eps;
        m[4] += eps;
        m[8] += eps;
        const det = m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);
        const inv = [
          m[4] * m[8] - m[5] * m[7], m[2] * m[7] - m[1] * m[8], m[1] * m[5] - m[2] * m[4],
          m[5] * m[6] - m[3] * m[8], m[0] * m[8] - m[2] * m[6], m[2] * m[3] - m[0] * m[5],
          m[3] * m[7] - m[4] * m[6], m[1] * m[6] - m[0] * m[7], m[0] * m[4] - m[1] * m[3],
        ];
        for (let i = 0; i < 9; i++) inverse[9 * v + i] = w[v] ? inv[i] / det : 0;
      }
      const precondition = (r: Float64Array, z: Float64Array) => {
        for (let v = 0; v < n; v++)
          for (let i = 0; i < 3; i++) z[3 * v + i] = inverse[9 * v + 3 * i] * r[3 * v] + inverse[9 * v + 3 * i + 1] * r[3 * v + 1] + inverse[9 * v + 3 * i + 2] * r[3 * v + 2];
      };
      // Conjugate gradients for the step: H Δ = −grad.
      const delta = new Float64Array(3 * n);
      const r = grad.map((x) => -x);
      const z = new Float64Array(3 * n);
      precondition(r, z);
      const d = Float64Array.from(z);
      const hd = new Float64Array(3 * n);
      let rz = r.reduce((s, x, i) => s + x * z[i], 0);
      // Only as closely as a step of Newton's needs (the next step corrects it).
      const stop = rz * 1e-6;
      for (let it = 0; it < 200 && rz > stop; it++) {
        times(d, hd);
        const dhd = d.reduce((s, x, i) => s + x * hd[i], 0);
        if (dhd <= 0) break;
        const a = rz / dhd;
        for (let i = 0; i < 3 * n; i++) {
          delta[i] += a * d[i];
          r[i] -= a * hd[i];
        }
        precondition(r, z);
        const next = r.reduce((s, x, i) => s + x * z[i], 0);
        for (let i = 0; i < 3 * n; i++) d[i] = z[i] + (next / rz) * d[i];
        rz = next;
      }

      // A line search on the energy itself, so the step lowers it: whole, else halved until it does.
      const value = () => {
        let e = 0;
        edges.forEach(([a, b], k) => {
          const c = (len(sub(p[b], p[a])) - lengths[k]) / lengths[k] + multipliers[k] / spring[k];
          e += (spring[k] / 2) * c * c;
        });
        hinges.forEach((h, k) => {
          if (stiffness[k]) e += (stiffness[k] / 2) * wrap(angleOf(p, h) - angles[k]) ** 2;
        });
        for (const { ids, weights, to } of guides) {
          for (let c = 0; c < 3; c++) {
            let at = -to[c];
            ids.forEach((v, i) => (at += weights[i] * p[v][c]));
            e += (guide / 2) * at * at;
          }
        }
        for (const { vertex: v, to } of goals) e += (goal / 2) * dot(sub(p[v], to), sub(p[v], to));
        for (const pair of pairs) {
          const now = contactNow(p, triangles[pair.t], pair.v, pair.side);
          if (now && now.d < SLACK * pair.gap) e += (contact / 2) * (now.d - SLACK * pair.gap) ** 2;
        }
        if (floor !== undefined) for (let v = 0; v < n; v++) if (w[v] && p[v][1] < floor) e += (contact / 2) * (p[v][1] - floor) ** 2;
        return e;
      };
      const start = p.map((q) => [...q] as Vec3);
      const before = value();
      let scale = 1;
      let after = Infinity;
      for (let tries = 0; tries < 12; tries++) {
        for (let v = 0; v < n; v++) for (let c = 0; c < 3; c++) p[v][c] = start[v][c] + scale * delta[3 * v + c];
        after = value();
        if (after <= before) break;
        scale /= 2;
      }
      if (after > before) {
        for (let v = 0; v < n; v++) p[v] = start[v];
        break;
      }
      let far = 0;
      for (let v = 0; v < n; v++) far = Math.max(far, scale * Math.hypot(delta[3 * v], delta[3 * v + 1], delta[3 * v + 2]));
      const settling = before - after < LEVEL * before;
      moved = Math.max(moved, far);
      // Done once a step barely lowers the energy: the rest is the edges' (the next round), or nothing.
      if (far < 1e-7 || settling) break;
    }
    // The springs' rests moved by how far each edge is off.
    edges.forEach(([a, b], k) => (multipliers[k] += spring[k] * ((len(sub(p[b], p[a])) - lengths[k]) / lengths[k])));
    if (strainNow() <= settled) {
      round++;
      break;
    }
  }
  return { rounds: round, steps: used, strain: strainNow() };
}
