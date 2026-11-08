// The water bomb blown up into a cube, worked out face by face, as guides for its bend (docs/bending-plan.md).
//
// Flat, the water bomb is a cube pressed flat. The paper round the sheet's centre, a plus with pointed arms (|u| or
// |v| under ⅛, inside |u| + |v| = ½), covers a cube ¼ across exactly once: the centre square is the end at T (the
// sheet's centre), the four arms its sides, their points the end at the hole (the edge midpoints). Pressed flat, the
// front and back sides lie in the middle of the stack (layers 8 and 15), the left and right sides fold in half
// between them (layers 9 and 14, folded at the middle) and both ends fold up as water bomb bases do. The rest of the
// sheet, the corners, lies against the outside of those faces, a layer or more out. So each point of the flat model
// goes where the face it lies on goes, out from it by as many layers.
//
// Opening: the front and back sides stay flat and part, d = ¼ sin θ apart; the left and right sides open as gussets
// (each half turning about its edge); the end triangles on the front and back turn up about their edges. The end
// triangles on the sides can't follow rigidly (no path between flat and cube keeps every face of the plus flat),
// so, by MODE: `bulge`, they bulge out (stretching them up to about 18% on the way), or `kink`, each half folds from
// its corner to a point P on its middle line, which keeps the paper exact but moves that fold across it as the
// balloon opens. θ runs from 0 (flat) to a quarter turn (the cube). Neither solves smoothly yet: see
// docs/bending-plan.md, step 7, the paper balloon. Run by balloon-cube-run.ts; FREE_ENDS (=all) leaves the side
// end triangles (or both ends) unguided, CORE_ONLY guides the plus alone, TIPS=0 drops the guides at T and the hole.
import { placeLike, toFlat, unplaceLike } from '../src/fold/fold';
import { LAYER_GAP } from '../src/fold/frames';
import { signedArea } from '../src/fold/geometry2d';
import type { BendGoal } from '../src/fold/ops';
import type { FoldFrame, Vec2, Vec3 } from '../src/fold/types';

export const STAGES = +(process.env.STAGES ?? 12);
const SPACING = +(process.env.SPACING ?? 0.04);
const MARGIN = 0.006;
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

/** Barycentric weights of q in the triangle (a, b, c), on the sheet. */
function bary(q: Vec2, a: Vec2, b: Vec2, c: Vec2): [number, number, number] {
  const det = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
  const wb = ((q[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (q[1] - a[1])) / det;
  const wc = ((b[0] - a[0]) * (q[1] - a[1]) - (q[0] - a[0]) * (b[1] - a[1])) / det;
  return [1 - wb - wc, wb, wc];
}

/**
 * Where a point of the plus (on the sheet) is at θ, with the way out of the cube there. The cube's front side lies
 * on the table (y = 0), x across, the end at T towards −z: x ∈ [−⅛, ⅛], z ∈ [−⅜, −⅛], y ∈ [0, d].
 */
export function plus(q: Vec2, theta: number): { at: V; out: V } {
  const [u, v] = q;
  if (Math.abs(u) > Math.abs(v) + 1e-12 && Math.abs(v) <= E + 1e-12) {
    // The left and right sides and their ends, worked out for the left and mirrored.
    if (u > 0) {
      const { at, out } = side([-u, v], theta);
      return { at: [-at[0], at[1], at[2]], out: [-out[0], out[1], out[2]] };
    }
    return side(q, theta);
  }
  const s = Math.sin(theta);
  const c = Math.cos(theta);
  const d = 2 * E * s;
  if (v < 0) {
    if (v >= -E) {
      const r = v + E;
      return { at: [u, r * s, -3 * E - r * c], out: [0, -c, -s] };
    }
    if (v >= -3 * E) return { at: [u, 0, -0.5 - v], out: [0, -1, 0] };
    const r = -3 * E - v;
    return { at: [u, r * s, -E + r * c], out: [0, -c, s] };
  }
  if (v <= E) {
    const r = E - v;
    return { at: [u, d - r * s, -3 * E - r * c], out: [0, c, -s] };
  }
  if (v <= 3 * E) return { at: [u, d, -0.5 + v], out: [0, 1, 0] };
  const r = v - 3 * E;
  return { at: [u, d - r * s, -E + r * c], out: [0, c, s] };
}

/** The left side (u < 0, |v| < |u|): the gusset's halves, and the end triangles at either end. */
function side(q: Vec2, theta: number): { at: V; out: V } {
  const [u, v] = q;
  const s = Math.sin(theta);
  const c = Math.cos(theta);
  const d = 2 * E * s;
  const front = v < 0;
  const w = E - Math.abs(v);
  if (u <= -E && u >= -3 * E) {
    return { at: [-E + w * c, front ? w * s : d - w * s, -0.5 - u], out: front ? [-s, c, 0] : [-s, -c, 0] };
  }
  // An end: T's (u > −⅛) or the hole's (u < −⅜). The triangle T (or H), its corner on the front (or back) and the
  // middle of the gusset's edge, which its two halves meet along.
  const top = u > -E;
  const zEdge = top ? -3 * E : -E;
  const tip: V = [0, E * s, top ? -3 * E - E * c : -E + E * c];
  const corner: V = [-E, front ? 0 : d, zEdge];
  const middle: V = [-E + E * c, E * s, zEdge];
  const [pt, pc, pm]: Vec2[] = top ? [[0, 0], [-E, front ? -E : E], [-E, 0]] : [[-0.5, 0], [-3 * E, front ? -E : E], [-3 * E, 0]];
  const outward = (a: V, f = front) => (dot(a, [0, f ? 1 : -1, top ? -1 : 1]) < 0 ? mul(a, -1) : a);
  if (MODE === 'bulge') {
    // Its two halves can't both stay flat: the line from the tip to the middle is shorter in 3D than on the sheet,
    // so it bulges out by about the sag of an arc that long.
    const other: V = [-E, front ? d : 0, zEdge];
    const [wt, wc, wm] = bary(q, pt, pc, pm);
    const flat = add(add(mul(tip, wt), mul(corner, wc)), mul(middle, wm));
    const n = outward(unit(cross(sub(corner, tip), sub(middle, tip))));
    const m = outward(unit(cross(sub(other, tip), sub(middle, tip))), !front);
    const along = unit(sub(mul(add(tip, middle), 0.5), mul(add(corner, other), 0.5)));
    const bulge = unit(add(add(n, m), mul(along, 0.5)));
    const chord = Math.hypot(...sub(middle, tip));
    const sag = Math.sqrt(Math.max(0, (3 * chord * (E - chord)) / 8));
    return { at: add(flat, mul(bulge, 4 * wt * wm * sag)), out: n };
  }
  // The tip and the middle are nearer in 3D than on the sheet, so the line between them can't stay straight: it
  // folds out at a point P a share t along it, each half folding from its corner to P.
  const { at: bend, t } = kink(theta, top);
  const pp: Vec2 = [pt[0] + t * (pm[0] - pt[0]), pt[1] + t * (pm[1] - pt[1])];
  // Which of the two pieces q is in: the one by the tip, or the one by the middle.
  const [wt, wc, wp] = bary(q, pt, pc, pp);
  if (wt >= -1e-9) {
    return { at: add(add(mul(tip, wt), mul(corner, wc)), mul(bend, wp)), out: outward(unit(cross(sub(corner, tip), sub(bend, tip)))) };
  }
  const [vp, vc, vm] = bary(q, pp, pc, pm);
  return { at: add(add(mul(bend, vp), mul(corner, vc)), mul(middle, vm)), out: outward(unit(cross(sub(corner, bend), sub(middle, bend)))) };
}

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


/**
 * Points close in to a face's corners at the sheet's centre and at the edges' midpoints (T and the hole), which the
 * lattice, kept in from the edges, misses: there the creases meet at 45°, and paper left unguided pops through.
 */
function tips(poly: Vec2[]): Vec2[] {
  const out: Vec2[] = [];
  poly.forEach((p, i) => {
    const atT = Math.hypot(p[0], p[1]) < 1e-9;
    const atH = Math.abs(Math.abs(p[0]) + Math.abs(p[1]) - 0.5) < 1e-9 && Math.min(Math.abs(p[0]), Math.abs(p[1])) < 1e-9;
    if (!atT && !atH) return;
    const [a, b] = [poly[(i + poly.length - 1) % poly.length], poly[(i + 1) % poly.length]];
    const toward = (q: Vec2): Vec2 => {
      const l = Math.hypot(q[0] - p[0], q[1] - p[1]);
      return [(q[0] - p[0]) / l, (q[1] - p[1]) / l];
    };
    const [da, db] = [toward(a), toward(b)];
    const mid: Vec2 = [(da[0] + db[0]) / Math.hypot(da[0] + db[0], da[1] + db[1]), (da[1] + db[1]) / Math.hypot(da[0] + db[0], da[1] + db[1])];
    for (const r of [0.004, 0.012, 0.022, 0.034]) out.push([p[0] + r * mid[0], p[1] + r * mid[1]]);
    for (const d of [da, db]) for (const r of [0.012, 0.024]) out.push([p[0] + r * d[0] + 0.003 * mid[0], p[1] + r * d[1] + 0.003 * mid[1]]);
  });
  return out;
}

/** Points of a triangular lattice on the sheet inside a convex face, all at least `MARGIN` in from its edges. */
function lattice(poly: Vec2[]): Vec2[] {
  const turn = Math.sign(signedArea(poly));
  const within = (q: Vec2) =>
    poly.every((a, i) => {
      const b = poly[(i + 1) % poly.length];
      return (turn * ((b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]))) / Math.hypot(b[0] - a[0], b[1] - a[1]) >= MARGIN;
    });
  const us = poly.map((q) => q[0]);
  const vs = poly.map((q) => q[1]);
  const row = SPACING * (Math.sqrt(3) / 2);
  const out: Vec2[] = [];
  for (let j = Math.floor(Math.min(...vs) / row); j <= Math.ceil(Math.max(...vs) / row); j++) {
    for (let i = Math.floor(Math.min(...us) / SPACING) - 1; i <= Math.ceil(Math.max(...us) / SPACING); i++) {
      const q: Vec2 = [(i + (Math.abs(j) % 2) / 2) * SPACING, j * row];
      if (within(q)) out.push(q);
    }
  }
  // A face too small for the lattice still gets its middle.
  if (!out.length) out.push([us.reduce((a, b) => a + b) / us.length, vs.reduce((a, b) => a + b) / vs.length]);
  return out;
}

const ease = (s: number) => s;

/** Guides taking the flat water bomb (`frame`) to the cube. */
export function cubeGuides(frame: FoldFrame): BendGoal[] {
  const faces = toFlat(frame);
  const layers = frame.faces_layer!;
  const core = faces.map((f) => f.paper.some((q) => Math.hypot(q[0], q[1]) < 1e-9));
  const half = (f: (typeof faces)[number]) => Math.sign(f.world.reduce((s, p) => s + p[0], 0));
  return faces.flatMap((f, n) => {
    // The face of the plus this one lies against, on the same side of the middle: the nearest of its layers.
    const mine = faces.map((_, k) => k).filter((k) => core[k] && half(faces[k]) === half(f));
    const by = (k: number) => Math.abs(layers[k] - layers[n]);
    const under = core[n] ? n : mine.reduce((a, b) => (by(b) < by(a) ? b : a));
    const gap = Math.abs(layers[under] - layers[n]) * LAYER_GAP;
    const place = placeLike(f);
    const back = unplaceLike(faces[under]);
    return [...lattice(f.paper), ...(core[n] && process.env.TIPS !== '0' ? tips(f.paper) : [])].flatMap((q): BendGoal[] => {
      const xz = place(q);
      const onPlus = back(xz);
      if (FREE_ENDS && (process.env.FREE_ENDS === "all" ? anyEnd(onPlus) : sideEnd(onPlus))) return [];
      if (process.env.CORE_ONLY && !core[n]) return [];
      const at = (theta: number) => {
        const p = plus(onPlus, theta);
        return add(p.at, mul(p.out, gap));
      };
      // From where it lies flat, layers and all, eased into the shape as it opens.
      const start = at(0);
      const lying: V = [xz[0], layers[n] * LAYER_GAP, xz[1]];
      const path = Array.from({ length: STAGES }, (_, k): Vec3 => {
        const s = ease((k + 1) / STAGES);
        return add(at((s * Math.PI) / 2), mul(sub(lying, start), 1 - s)).map((x) => Math.round(x * 1e6) / 1e6 || 0) as Vec3;
      });
      return [{ guide: { paper: q.map((x) => Math.round(x * 1e6) / 1e6 || 0) as Vec2 }, path }];
    });
  });
}
