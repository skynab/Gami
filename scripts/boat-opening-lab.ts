// The boat opened from its small diamond, tried as a bend (see docs/bending-plan.md, step 7): a hinged path for
// every face, as guides. The end shape holds together, but the path tangles: the diamond's halves interlock.
import { placeLike, toFlat } from '../src/fold/fold';
import { facePositions } from '../src/fold/frames';
import { signedArea } from '../src/fold/geometry2d';
import type { BendGoal } from '../src/fold/ops';
import { paper, type Recipe } from '../src/fold/recipe';
import type { Vec2, Vec3 } from '../src/fold/types';

export const STAGES = +(process.env.STAGES ?? 12);
const PHI = (+(process.env.PHI ?? 30) * Math.PI) / 180;
const SPACING = +(process.env.SPACING ?? 0.05);
const MARGIN = 0.008;

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: Vec3) => mul(a, 1 / Math.hypot(...a));
/** `p` turned by `angle` about the line from `a` through `b` (right-handed about a → b). */
function rotate(p: Vec3, a: Vec3, b: Vec3, angle: number): Vec3 {
  const k = unit(sub(b, a));
  const v = sub(p, a);
  const [c, s] = [Math.cos(angle), Math.sin(angle)];
  return add(a, add(add(mul(v, c), mul(cross(k, v), s)), mul(k, dot(k, v) * (1 - c))));
}
const clamp = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => x * x * (3 - 2 * x);
const p1 = (s: number) => smooth(clamp(s / 0.45));
const p2 = (s: number) => smooth(clamp((s - 0.3) / 0.5));
// Brims fold down inside once their wall is up.
const b1 = (s: number) => smooth(clamp((s - 0.45) / 0.3));
const b2 = (s: number) => smooth(clamp((s - 0.8) / 0.2));

type Move = (s: number, p: Vec3) => Vec3;
export const debug: any = {};

export function openingGuides(r: Recipe): BendGoal[] {
  const frame = r.current;
  const faces = toFlat(frame);
  const heights = facePositions(frame).map((pts) => pts.reduce((sum, q) => sum + q[1], 0) / pts.length);
  const at = (q: Vec2, f: number): Vec3 => {
    const [x, z] = placeLike(faces[f])(q);
    return [x, heights[f], z];
  };
  const table = (q: Vec2): Vec3 => {
    const [x, z] = r.where(paper(...q));
    return [x, 0, z];
  };
  // The keel, from the bow end to the stern end, and which way is "up" turning about it.
  const [C3, C4, C1] = [table([-0.25, -0.25]), table([0.25, -0.25]), table([0, -0.5])];
  const O = mul(add(C3, C4), 0.5);
  const e = unit(sub(C4, C3));
  const d1 = unit(sub(C1, O));
  const sign = Math.sign(dot(cross(e, d1), [0, 1, 0]));
  const keel = (beta: number): ((p: Vec3) => Vec3) => (p) => rotate(p, O, add(O, e), sign * beta);
  const across = (p: Vec3) => dot(sub(p, O), d1);
  const centre = (f: number): Vec2 => faces[f].paper.reduce((s, q): Vec2 => [s[0] + q[0] / faces[f].paper.length, s[1] + q[1] / faces[f].paper.length], [0, 0]);
  const has = (f: number, q: Vec2) => faces[f].paper.some((p) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-6);

  // Turns about the keel: the sails, quarters and the upper (starboard) wall in the first phase, the lower
  // (port) wall, carrying what's folded inside it, round under the keel in the second.
  const sail = (s: number) => (-Math.PI / 2) * p1(s);
  const starboardWall = (s: number) => (Math.PI / 2 - PHI) * p1(s);
  const portWall = (s: number) => -(1.5 * Math.PI - PHI) * p2(s);
  const insidePort = (s: number) => -1.5 * Math.PI * p2(s);

  // A hinged child: turned about its hinge (flat positions) by `angle(s)`, then moved as its parent.
  const child = (parent: Move, f: number, a: Vec2, b: Vec2, angle: (s: number) => number): Move => {
    const [A, B] = [at(a, f), at(b, f)];
    return (s, p) => parent(s, rotate(p, A, B, angle(s)));
  };
  /** The hinge angle (as a share `phase` of `end`) taking a face's corner `q` to the middle plane at the end. */
  const toMiddle = (parent: Move, f: number, a: Vec2, b: Vec2, q: Vec2): number => {
    const [A, B, Q] = [at(a, f), at(b, f), at(q, f)];
    // Either way round: the smallest turn that puts the corner in the middle plane, above the keel.
    let best = 0;
    let bestErr = Infinity;
    for (let k = -3600; k <= 3600; k++) {
      const ang = (k * Math.PI) / 3600;
      const P = parent(1, rotate(Q, A, B, ang));
      const err = Math.abs(across(P)) + (P[1] < 0.1 ? 1 : 0) + 1e-4 * Math.abs(ang);
      if (err < bestErr) [best, bestErr] = [ang, err];
    }
    return best;
  };
  /** Folding a flap right over (by π), the way that moves it off the face it's on. */
  const over = (f: number, a: Vec2, b: Vec2, inward: (p: Vec3) => boolean, parent: Move): number => {
    const [A, B] = [at(a, f), at(b, f)];
    const c = at(centre(f), f);
    for (const dir of [1, -1]) if (inward(parent(1, rotate(c, A, B, dir * Math.PI)))) return dir * Math.PI;
    return Math.PI;
  };

  const moves = new Map<number, (q: Vec2) => Move>();
  const keelMove = (beta: (s: number) => number): Move => (s, p) => keel(beta(s))(p);
  const portMid = keelMove(portWall);
  const starMid = keelMove(starboardWall);
  const sailMove = keelMove(sail);
  const insideMove = keelMove(insidePort);

  // Port and starboard quarters: wall middles and sail halves (split along the keel lines), end triangles.
  const ends: { f: number; parent: Move; a: Vec2; b: Vec2; tip: Vec2; phase: (s: number) => number }[] = [];
  faces.forEach((_, f) => {
    const [u, v] = centre(f);
    if (Math.abs(v) > 0.5 || Math.abs(v) < Math.abs(u)) return;
    const port = v < 0;
    const w = port ? -v : v; // distance in from the sheet's middle, towards the gunwale
    const mid = port ? portMid : starMid;
    const phase = port ? p2 : p1;
    const g: Vec2 = [0, port ? -0.5 : 0.5];
    if (u - w < -0.5 + 1e-9 && u < 0) ends.push({ f, parent: mid, a: [-0.25, port ? -0.25 : 0.25], b: g, tip: [-0.5, port ? -0.5 : 0.5], phase });
    else if (-u - w < -0.5 + 1e-9 && u > 0) ends.push({ f, parent: mid, a: [0.25, port ? -0.25 : 0.25], b: g, tip: [0.5, port ? -0.5 : 0.5], phase });
    else moves.set(f, ([, qv]) => (Math.abs(qv) >= 0.25 ? mid : sailMove));
  });
  const endMoves = new Map<number, Move>();
  for (const { f, parent, a, b, tip, phase } of ends) {
    const end = toMiddle(parent, f, a, b, tip);
    const m = child(parent, f, a, b, (s) => end * phase(s));
    endMoves.set(f, m);
    moves.set(f, () => m);
  }

  // Left and right quarters: halves either side of the keel line, the flaps folded under the outer halves.
  faces.forEach((_, f) => {
    const [u, v] = centre(f);
    if (Math.abs(u) < Math.abs(v)) return;
    const s0 = Math.sign(u);
    const outerMove = insideMove; // the outer halves lie inside the port wall's folds, and go round with it
    if (Math.abs(u) > 0.3) {
      // A flap: hinged to the outer half of its quarter along (±0.25, ±0.25)–(±0.5, 0), unfolded flat.
      const a: Vec2 = [0.25 * s0, v < 0 ? -0.25 : 0.25];
      const b: Vec2 = [0.5 * s0, 0];
      const ang = over(f, a, b, () => true, outerMove);
      const [A, B] = [at(a, f), at(b, f)];
      const dir = rotate(at(centre(f), f), A, B, 0.05 * Math.sign(ang))[1] < at(centre(f), f)[1] ? 1 : -1;
      moves.set(f, () => child(outerMove, f, a, b, (s) => dir * Math.abs(ang) * p2(s)));
    } else moves.set(f, ([qu]) => (Math.abs(qu) <= 0.25 ? sailMove : outerMove));
  });

  // Brims: folded down over the gunwale inside the walls, the rest of each brim going with them.
  const brims = faces.map((_, f) => f).filter((f) => Math.abs(centre(f)[1]) > 0.5);
  const brimMoves = new Map<number, Move>();
  for (const f of brims) {
    const [, v] = centre(f);
    const port = v < 0;
    const y = port ? -0.5 : 0.5;
    for (const [tipU, g] of [[-0.5, 0], [0.5, 0]] as const) {
      const corner: Vec2 = [tipU, y];
      const mid: Vec2 = [g, y];
      if (!has(f, corner) || !has(f, mid)) continue;
      const endFace = ends.find((x) => x.tip[0] === tipU && Math.sign(x.tip[1]) === Math.sign(y))!;
      const parent = endMoves.get(endFace.f)!;
      const phase = port ? b2 : b1;
      // Fold it whichever way leaves it nearer the middle plane: inside the hull.
      const [A, B] = [at(corner, f), at(mid, f)];
      const c = at(centre(f), f);
      let ang = Math.PI;
      let bestAcross = Infinity;
      for (const dir of [1, -1]) {
        const d = Math.abs(across(parent(1, rotate(c, A, B, dir * Math.PI))));
        if (d < bestAcross) [ang, bestAcross] = [dir * Math.PI, d];
      }
      const m = child(parent, f, corner, mid, (s) => ang * phase(s));
      brimMoves.set(f, m);
      moves.set(f, () => m);
    }
  }
  // The rest of each brim turns on its hinge to the brim face it's joined to, to where it lies folded down
  // inside: each point where its mirror across the gunwale lands on the paper under it.
  const inside = (q: Vec2, f: number): boolean => {
    const poly = faces[f].paper;
    const turn = Math.sign(signedArea(poly));
    return poly.every((a, i) => {
      const b = poly[(i + 1) % poly.length];
      return turn * ((b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0])) >= -1e-9;
    });
  };
  const folded = (q: Vec2): Vec3 | null => {
    const m: Vec2 = [q[0], (q[1] < 0 ? -1 : 1) - q[1]];
    const g = faces.findIndex((_, k) => Math.abs(centre(k)[1]) < 0.5 && inside(m, k));
    return g < 0 ? null : moves.get(g)!(m)(1, at(m, g));
  };
  for (const f of brims) {
    if (brimMoves.has(f)) continue;
    const parent = [...brimMoves.keys()].find((g) => sharesEdge(faces[f].paper, faces[g].paper));
    if (parent === undefined) continue;
    const near = (p: Vec2, q: Vec2) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-6;
    const [a, b] = faces[f].paper.filter((p) => faces[parent].paper.some((q) => near(p, q)));
    const pm = brimMoves.get(parent)!;
    const [A, B] = [at(a, f), at(b, f)];
    const free = faces[f].paper.filter((p) => !near(p, a) && !near(p, b));
    let best = 0;
    let bestErr = Infinity;
    for (let k = -360; k <= 360; k++) {
      const ang = (k * Math.PI) / 360;
      let err = 0;
      for (const q of free) {
        const want = folded(q);
        const got = pm(1, rotate(at(q, f), A, B, ang));
        err += want ? Math.hypot(...sub(got, want)) : 0;
      }
      if (err < bestErr) [best, bestErr] = [ang, err];
    }
    const phase = centre(f)[1] < 0 ? b2 : b1;
    moves.set(f, () => child(pm, f, a, b, (s) => best * phase(s)));
  }

  debug.moves = moves; debug.at = at; debug.faces = faces; debug.across = across;
  const round6 = (x: number) => Math.round(x * 1e6) / 1e6 || 0;
  return faces.flatMap((face, f) => {
    const pick = moves.get(f);
    if (!pick) throw new Error(`no move for face ${f} at ${centre(f)}`);
    return lattice(face.paper).map((q): BendGoal => {
      const m = pick(q);
      const P = at(q, f);
      const path = Array.from({ length: STAGES }, (_, k) => m((k + 1) / STAGES, P).map(round6) as Vec3);
      return { guide: { paper: q.map(round6) as Vec2 }, path };
    });
  });
}

function sharesEdge(a: Vec2[], b: Vec2[]): boolean {
  const near = (p: Vec2, q: Vec2) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-6;
  return a.filter((p) => b.some((q) => near(p, q))).length >= 2;
}

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
  return out;
}
