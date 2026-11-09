// Experiments on the balloon's cube (src/models/recipes/balloon-cube.ts, where its geometry and guides are): other
// ways for the end triangles on the sides to take their shape. By MODE: `bulge` (the gallery's), they bulge out; or
// `kink`, each half folds from its corner to a point P on its middle line, which keeps the paper exact but moves that
// fold across it as the balloon opens; or `roll`, the same fold rounded over ROLL degrees either side of it (each half
// a cone at its corner). Run by balloon-cube-run.ts; FREE_ENDS (=all) leaves the side end triangles (or both ends)
// unguided, CORE_ONLY guides the plus alone, TIPS=0 drops the guides at T and the hole; ROLL_DEBUG prints each roll's
// angles. See docs/bending-plan.md, step 7, the paper balloon.
import { bary, bulge, CUBE_EDGES, CUBE_ENDS, cubeGuides as guidesFor, onCube as cubeMap, type EndShape } from '../src/models/recipes/balloon-cube';
import type { FoldFrame, Vec2, Vec3 } from '../src/fold/types';

export { CUBE_EDGES, CUBE_ENDS };
export const STAGES = +(process.env.STAGES ?? 12);
const SPACING = +(process.env.SPACING ?? 0.04);
const E = 0.125;
const MODE = process.env.MODE ?? 'bulge';
/** Leaves the end triangles on the sides unguided, for the solver to find. */
const FREE_ENDS = !!process.env.FREE_ENDS;
const sideEnd = ([u, v]: Vec2) => Math.abs(v) < Math.abs(u) && (Math.abs(u) < E || Math.abs(u) > 3 * E);
const anyEnd = ([u, v]: Vec2) => (Math.abs(u) <= E && Math.abs(v) <= E) || Math.abs(u) > 3 * E || Math.abs(v) > 3 * E;

type V = Vec3;
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V, k: number): V => [a[0] * k, a[1] * k, a[2] * k];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: V): V => mul(a, 1 / (Math.hypot(...a) || 1));
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * The end triangles on the sides folded: the tip and the middle are nearer in 3D than on the sheet, so the line
 * between them can't stay straight: it folds out at a point P a share t along it, each half folding from its corner
 * to P.
 */
const kinked: EndShape = ({ q, theta, top, tip, corner, middle, pt, pc, pm, outward }) => {
  const { at: bend, t } = kink(theta, top);
  const pp: Vec2 = [pt[0] + t * (pm[0] - pt[0]), pt[1] + t * (pm[1] - pt[1])];
  // Which of the two pieces q is in: the one by the tip, or the one by the middle.
  const [wt, wc, wp] = bary(q, pt, pc, pp);
  if (wt >= -1e-9) {
    return { at: add(add(mul(tip, wt), mul(corner, wc)), mul(bend, wp)), out: outward(unit(cross(sub(corner, tip), sub(bend, tip)))) };
  }
  const [vp, vc, vm] = bary(q, pp, pc, pm);
  return { at: add(add(mul(bend, vp), mul(corner, vc)), mul(middle, vm)), out: outward(unit(cross(sub(corner, bend), sub(middle, bend)))) };
};

/**
 * As `kinked`, but the fold from the corner to P rolled over a wedge of the paper either side of it: round the
 * corner, the paper's directions turn steadily rather than all at once, so the half is a cone with its point at the
 * corner, and the fold moves across the paper as a bend the mesh can follow.
 */
const rolling: EndShape = ({ q, theta, top, front, corner, pc, pm, outward }) => {
  const turn = rolled(theta, top, front);
  const rel: Vec2 = [q[0] - pc[0], q[1] - pc[1]];
  const rho = Math.hypot(rel[0], rel[1]);
  const toMiddle: Vec2 = [pm[0] - pc[0], pm[1] - pc[1]];
  const beta = rho < 1e-12 ? 0 : Math.acos(Math.max(-1, Math.min(1, (rel[0] * toMiddle[0] + rel[1] * toMiddle[1]) / (rho * E))));
  const dir = turn(beta);
  const next = turn(Math.min(beta + 1e-4, Math.PI / 4));
  const prev = turn(Math.max(beta - 1e-4, 0));
  return { at: add(corner, mul(dir, rho)), out: outward(unit(cross(dir, sub(next, prev)))) };
};

const END: EndShape = MODE === 'kink' ? kinked : MODE === 'roll' ? rolling : bulge;

/** Where each point of the flat water bomb (`frame`) goes on the cube at θ, by the face of the frame it's on. */
export const onCube = (frame: FoldFrame) => cubeMap(frame, END);

/** Guides taking the flat water bomb (`frame`) to the cube, by the switches above. */
export const cubeGuides = (frame: FoldFrame) =>
  guidesFor(frame, {
    stages: STAGES,
    spacing: SPACING,
    end: END,
    tips: process.env.TIPS !== '0',
    skip: (onPlus, core) => (FREE_ENDS && (process.env.FREE_ENDS === 'all' ? anyEnd(onPlus) : sideEnd(onPlus))) || (!!process.env.CORE_ONLY && !core),
  });

/**
 * Where the line from an end's tip to the middle of the gusset's edge folds, for the left side at θ: the point P, a
 * share t of the way along, that keeps both pieces of each half their shapes on the sheet. It's level with the tip
 * and in line with the middle, halfway between front and back: P − corner = ⅛(cos θ, sin θ, ∓cos θ), as long as the
 * sheet's ⅛√(1 + (1 − t)²) when t = 1 − cos θ.
 */
function kink(theta: number, top: boolean): { at: V; t: number } {
  const c = Math.cos(theta);
  return { at: [-E + E * c, E * Math.sin(theta), top ? -3 * E - E * c : -E + E * c], t: 1 - c };
}

/** How far either side of the fold, as an angle round the corner, the roll spreads. */
const ROLL = (+(process.env.ROLL ?? 10) * Math.PI) / 180;
const rolls = new Map<string, (beta: number) => V>();

/**
 * The directions out from an end half's corner at θ, by the angle β round the corner on the sheet (0 towards the
 * middle of the gusset's edge, ¼π towards the tip): a path on the unit sphere as long as the sheet's angle, so the
 * half is a cone and keeps its shape. It runs along a great circle (flat paper), turns steadily within ROLL either
 * side of where `kink` folds sharply, then runs along another to the tip. Rounded, a fold that sharp cuts the
 * corner, so how far it turns, and which way it sets off from the middle of the gusset's edge (the half turning on
 * that edge), are found so it still ends at the tip.
 */
function rolled(theta: number, top: boolean, front: boolean): (beta: number) => V {
  const key = `${theta} ${top} ${front}`;
  const known = rolls.get(key);
  if (known) return known;
  const s = Math.sin(theta);
  const c = Math.cos(theta);
  const d = 2 * E * s;
  const zEdge = top ? -3 * E : -E;
  const corner: V = [-E, front ? 0 : d, zEdge];
  const a = unit(sub([-E + E * c, E * s, zEdge], corner));
  const b = unit(sub(kink(theta, top).at, corner));
  const tipDir = unit(sub([0, E * s, top ? -3 * E - E * c : -E + E * c], corner));
  const angle = (x: V, y: V) => Math.acos(Math.max(-1, Math.min(1, dot(x, y))));
  const spin = (x: V, axis: V, w: number): V => {
    const [cw, sw] = [Math.cos(w), Math.sin(w)];
    return add(add(mul(x, cw), mul(cross(axis, x), sw)), mul(axis, dot(axis, x) * (1 - cw)));
  };
  const all = Math.PI / 4;
  const at = Math.min(all, angle(a, b));
  const half = Math.min(ROLL, at, all - at);
  // The sharp fold: great circles through a and b, and b and the tip (where one isn't defined, b at an end, the
  // other), and how far the path turns between them at b.
  const plane = (x: V, y: V) => (angle(x, y) > 1e-9 ? unit(cross(x, y)) : null);
  const first = plane(a, b) ?? plane(b, tipDir)!;
  const second = plane(b, tipDir) ?? first;
  const sharp = Math.atan2(dot(cross(cross(first, b), cross(second, b)), b), dot(cross(first, b), cross(second, b)));
  const N = 720;
  const ds = all / N;
  // By ROLL_FIX: `set off` solves for the way it sets off and how far it turns; `place` keeps the way it sets off
  // and solves for where the turn is and how far.
  const byPlace = process.env.ROLL_FIX === 'place';
  const trace = (p0: number, gamma: number): V[] => {
    const [psi, centre] = byPlace ? [0, at + p0] : [p0, at];
    const out: V[] = [a];
    let r = a;
    let tau = spin(cross(first, a), a, psi);
    for (let k = 0; k < N; k++) {
      const [lo, hi] = [k * ds, (k + 1) * ds];
      // The share of this step within the turn (all of it, at its place, for a sharp one).
      const turning = half > 1e-9 ? Math.max(0, Math.min(hi, centre + half) - Math.max(lo, centre - half)) / (2 * half) : lo <= centre && centre < hi ? 1 : 0;
      const r2 = add(mul(r, Math.cos(ds)), mul(tau, Math.sin(ds)));
      let t2 = sub(mul(tau, Math.cos(ds)), mul(r, Math.sin(ds)));
      if (turning) t2 = spin(t2, r2, gamma * turning);
      r = unit(r2);
      tau = unit(sub(t2, mul(r, dot(t2, r))));
      out.push(r);
    }
    return out;
  };
  // Newton on where it ends, in the plane square to the tip's direction.
  const e1 = unit(cross(tipDir, Math.abs(tipDir[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]));
  const e2 = cross(tipDir, e1);
  const miss = (x: number[]) => {
    const end = trace(x[0], x[1])[N];
    return [dot(end, e1), dot(end, e2)];
  };
  let x = [0, sharp];
  for (let i = 0; i < 12 && half > 1e-9; i++) {
    const m = miss(x);
    if (Math.hypot(m[0], m[1]) < 1e-10) break;
    const h = 1e-6;
    const [ja, jb] = [0, 1].map((j) => {
      const y = [...x];
      y[j] += h;
      const n = miss(y);
      return [(n[0] - m[0]) / h, (n[1] - m[1]) / h];
    });
    const det = ja[0] * jb[1] - jb[0] * ja[1];
    if (Math.abs(det) < 1e-14) break;
    x = [x[0] - (m[0] * jb[1] - jb[0] * m[1]) / det, x[1] - (ja[0] * m[1] - m[0] * ja[1]) / det];
  }
  const path = trace(x[0], x[1]);
  if (process.env.ROLL_DEBUG) {
    const end = path[N];
    console.log('roll', theta.toFixed(3), top, front, 'fold at', ((at * 180) / Math.PI).toFixed(1), 'half', ((half * 180) / Math.PI).toFixed(1), 'sharp', ((sharp * 180) / Math.PI).toFixed(1), 'turn', ((x[1] * 180) / Math.PI).toFixed(1), 'set off', ((x[0] * 180) / Math.PI).toFixed(2), 'miss', ((angle(end, tipDir) * 180) / Math.PI).toFixed(4));
  }
  const turn = (beta: number): V => {
    const y = Math.max(0, Math.min(N, beta / ds));
    const i = Math.min(N - 1, Math.floor(y));
    return unit(add(mul(path[i], 1 - (y - i)), mul(path[i + 1], y - i)));
  };
  rolls.set(key, turn);
  return turn;
}
