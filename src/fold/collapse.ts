import { FoldError, fromFlat, toFlat, type FlatFace } from './fold';
import { dot, frontUp, overlapArea, sideOf, split, sub, type Line } from './geometry2d';
import { LayerError, solveLayers, type LayerEdge } from './layers';
import type { FoldFrame, Vec2 } from './types';

/**
 * Compound folds: several creases change at once, as in a squash, petal, reverse or sink fold, or
 * collapsing a pre-creased sheet into a base. Positions follow from the creases (walking from an anchor
 * face, reflecting across each folded crease); the stacking comes from the layer solver.
 */

/**
 * - valley / mountain: fold flat, as seen from above before the step (valley brings the faces' upper sides together);
 * - flat: open the crease out flat;
 * - inside / outside: a reverse fold, the moving part going between the layers of its flap, or wrapping round them.
 */
export type CreaseKind = 'valley' | 'mountain' | 'flat' | 'inside' | 'outside';

export interface Crease {
  line: Line;
  kind: CreaseKind;
  /** Only crease faces whose corners on the sheet pass this test. */
  only?: (paper: Vec2[]) => boolean;
}

export interface CollapseOptions {
  creases: Crease[];
  /** A point on the sheet whose face stays where it is. */
  anchor: Vec2;
}

export function collapse(frame: FoldFrame, { creases, anchor }: CollapseOptions): FoldFrame {
  // Cut faces along the new creases (opening a crease out needs no cut).
  let faces: FlatFace[] = toFlat(frame);
  for (const c of creases) {
    if (c.kind === 'flat') continue;
    faces = faces.flatMap((f) => {
      if (c.only && !c.only(f.paper)) return [f];
      const { pos, neg } = split(f, c.line);
      return [pos, neg].filter((p) => p !== null).map((p) => ({ ...p!, layer: f.layer, parent: f.parent }));
    });
  }
  const old = faces.map((f) => fromFace(f.paper, f.world));
  const edges = sharedEdges(faces);

  // Which crease, if any, each edge is on.
  const change = edges.map((e) => {
    const a = apply(old[e.f], e.pa);
    const b = apply(old[e.f], e.pb);
    return creases.find(
      (c) =>
        Math.abs(sideOf(c.line, a)) < 1e-7 &&
        Math.abs(sideOf(c.line, b)) < 1e-7 &&
        (!c.only || (c.only(faces[e.f].paper) && c.only(faces[e.g].paper))),
    );
  });

  // Walk out from the anchor, placing each face from a neighbour already placed.
  const start = faces.findIndex((f) => contains(f.paper, anchor));
  if (start < 0) throw new FoldError('The anchor point isn’t on the paper.');
  const placed: (Affine | null)[] = faces.map(() => null);
  placed[start] = old[start];
  const queue = [start];
  const byFace: number[][] = faces.map(() => []);
  edges.forEach((e, i) => (byFace[e.f].push(i), byFace[e.g].push(i)));
  while (queue.length) {
    const u = queue.shift()!;
    for (const i of byFace[u]) {
      const e = edges[i];
      const w = e.f === u ? e.g : e.f;
      const c = change[i];
      let t: Affine;
      if (!c) t = compose(placed[u]!, compose(invert(old[u]), old[w]));
      else if (c.kind === 'flat') t = placed[u]!;
      else t = compose(reflection(apply(placed[u]!, e.pa), apply(placed[u]!, e.pb)), placed[u]!);
      if (!placed[w]) {
        placed[w] = t;
        queue.push(w);
      } else if (!sameMap(placed[w]!, t, faces[w].paper)) {
        throw new FoldError('Those creases can’t all fold flat at once.');
      }
    }
  }
  const now = faces.map((f, i) => f.paper.map((p) => apply(placed[i] ?? old[i], p)));

  // Faces that moved together keep their order (turned upside down if their move flips them).
  const motion = faces.map((_, i) => compose(placed[i] ?? old[i], invert(old[i])));
  const flipped = motion.map((m) => m.a * m.d - m.b * m.c < 0);
  const group = groupsOf(motion);
  const overlappedBefore = (f: number, g: number) => overlapArea(faces[f].world, faces[g].world) > 1e-7;
  const wasAbove = (f: number, g: number) => faces[f].layer > faces[g].layer;

  // Where reverse folds tuck in: the middle of the flap's stack (the median layer of the faces the crease
  // runs through), which is where its two halves meet.
  const middle = (c: Crease) => {
    const ls = faces
      .filter((f) => (!c.only || c.only(f.paper)) && crossesLine(f.world, c.line))
      .map((f) => f.layer)
      .sort((a, b) => a - b);
    return ls.length ? (ls[(ls.length - 1) >> 1] + ls[ls.length >> 1]) / 2 : 0;
  };
  const middles = new Map(creases.map((c) => [c, middle(c)]));

  const creaseOrder = new Map<number, boolean>();
  const setOrder = (f: number, g: number, fAbove: boolean) => creaseOrder.set(f * faces.length + g, fAbove);
  edges.forEach((e, i) => {
    const c = change[i];
    if (!c || c.kind === 'flat') return;
    if (c.kind === 'valley' || c.kind === 'mountain') {
      // Valley: g lands on the side of f that faced up before the step.
      setOrder(e.g, e.f, (c.kind === 'valley') !== flipped[e.f]);
    } else {
      // Reverse: the face that moved goes to the inner side of the one that stayed (or the outer side).
      const [still, moved] = flipped[e.f] ? [e.g, e.f] : [e.f, e.g];
      const innerIsAbove = faces[still].layer < middles.get(c)!;
      setOrder(moved, still, innerIsAbove === (c.kind === 'inside'));
    }
  });

  const layerEdges: LayerEdge[] = edges.map((e) => ({
    f: e.f,
    g: e.g,
    a: apply(placed[e.f] ?? old[e.f], e.pa),
    b: apply(placed[e.f] ?? old[e.f], e.pb),
    folded: frontUp(now[e.f], faces[e.f].paper) !== frontUp(now[e.g], faces[e.g].paper),
  }));

  let layers: number[];
  try {
    layers = solveLayers(
      now.map((world) => ({ world })),
      layerEdges,
      (f, g) => {
        const k = creaseOrder.get(f * faces.length + g);
        if (k !== undefined) return k;
        const r = creaseOrder.get(g * faces.length + f);
        if (r !== undefined) return !r;
        if (group[f] === group[g] && overlappedBefore(f, g)) return wasAbove(f, g) !== flipped[f];
        return undefined;
      },
      (f, g) => (overlappedBefore(f, g) ? wasAbove(f, g) : group[f] !== group[start]),
    );
  } catch (e) {
    if (e instanceof LayerError) throw new FoldError(e.message);
    throw e;
  }

  return fromFlat(faces.map((f, i) => ({ ...f, world: now[i], layer: layers[i] })));
}

/** Pairs of faces joined along an edge of the sheet, with the shared stretch in sheet coordinates. */
function sharedEdges(faces: FlatFace[]): { f: number; g: number; pa: Vec2; pb: Vec2 }[] {
  const out: { f: number; g: number; pa: Vec2; pb: Vec2 }[] = [];
  for (let f = 0; f < faces.length; f++) {
    for (let g = f + 1; g < faces.length; g++) {
      const shared = sharedSegment(faces[f].paper, faces[g].paper);
      if (shared) out.push({ f, g, pa: shared[0], pb: shared[1] });
    }
  }
  return out;
}

function sharedSegment(p: Vec2[], q: Vec2[]): [Vec2, Vec2] | null {
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

function contains(poly: Vec2[], p: Vec2): boolean {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const e = sub(poly[(i + 1) % poly.length], a);
    const c = e[0] * (p[1] - a[1]) - e[1] * (p[0] - a[0]);
    if (Math.abs(c) < 1e-9) continue;
    if (sign && Math.sign(c) !== sign) return false;
    sign = Math.sign(c);
  }
  return true;
}

function crossesLine(world: Vec2[], line: Line): boolean {
  const s = world.map((x) => sideOf(line, x));
  return Math.min(...s) < -1e-7 && Math.max(...s) > 1e-7;
}

/** Assigns the same number to faces whose moves are the same. */
function groupsOf(motion: Affine[]): number[] {
  const keys: Affine[] = [];
  return motion.map((m) => {
    let i = keys.findIndex((k) => (['a', 'b', 'c', 'd', 'tx', 'ty'] as const).every((p) => Math.abs(k[p] - m[p]) < 1e-6));
    if (i < 0) i = keys.push(m) - 1;
    return i;
  });
}

/** A map from the sheet to the table: (x, z) = (a·u + b·v + tx, c·u + d·v + ty). */
interface Affine {
  a: number;
  b: number;
  c: number;
  d: number;
  tx: number;
  ty: number;
}

const apply = (m: Affine, [u, v]: Vec2): Vec2 => [m.a * u + m.b * v + m.tx, m.c * u + m.d * v + m.ty];

function compose(p: Affine, q: Affine): Affine {
  return {
    a: p.a * q.a + p.b * q.c,
    b: p.a * q.b + p.b * q.d,
    c: p.c * q.a + p.d * q.c,
    d: p.c * q.b + p.d * q.d,
    tx: p.a * q.tx + p.b * q.ty + p.tx,
    ty: p.c * q.tx + p.d * q.ty + p.ty,
  };
}

function invert(m: Affine): Affine {
  const det = m.a * m.d - m.b * m.c;
  const a = m.d / det;
  const b = -m.b / det;
  const c = -m.c / det;
  const d = m.a / det;
  return { a, b, c, d, tx: -(a * m.tx + b * m.ty), ty: -(c * m.tx + d * m.ty) };
}

/** Mirror image across the line through p and q. */
function reflection(p: Vec2, q: Vec2): Affine {
  const dx = q[0] - p[0];
  const dz = q[1] - p[1];
  const len2 = dx * dx + dz * dz;
  const a = (dx * dx - dz * dz) / len2;
  const b = (2 * dx * dz) / len2;
  const m = { a, b, c: b, d: -a, tx: 0, ty: 0 };
  const moved = apply(m, p);
  return { ...m, tx: p[0] - moved[0], ty: p[1] - moved[1] };
}

/** The map placing a face, from its corners on the sheet and on the table. */
function fromFace(paper: Vec2[], world: Vec2[]): Affine {
  let best = [0, 1, 2];
  let area = -1;
  for (let j = 1; j < paper.length; j++) {
    for (let k = j + 1; k < paper.length; k++) {
      const s = Math.abs((paper[j][0] - paper[0][0]) * (paper[k][1] - paper[0][1]) - (paper[j][1] - paper[0][1]) * (paper[k][0] - paper[0][0]));
      if (s > area) [area, best] = [s, [0, j, k]];
    }
  }
  const [q0, q1, q2] = best.map((i) => paper[i]);
  const [w0, w1, w2] = best.map((i) => world[i]);
  const e1 = sub(q1, q0);
  const e2 = sub(q2, q0);
  const det = e1[0] * e2[1] - e1[1] * e2[0];
  const f1 = sub(w1, w0);
  const f2 = sub(w2, w0);
  // Solve [a b; c d] · [e1 e2] = [f1 f2].
  const a = (f1[0] * e2[1] - f2[0] * e1[1]) / det;
  const b = (f2[0] * e1[0] - f1[0] * e2[0]) / det;
  const c = (f1[1] * e2[1] - f2[1] * e1[1]) / det;
  const d = (f2[1] * e1[0] - f1[1] * e2[0]) / det;
  return { a, b, c, d, tx: w0[0] - a * q0[0] - b * q0[1], ty: w0[1] - c * q0[0] - d * q0[1] };
}

function sameMap(p: Affine, q: Affine, paper: Vec2[]): boolean {
  return paper.every((x) => {
    const a = apply(p, x);
    const b = apply(q, x);
    return Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6;
  });
}
