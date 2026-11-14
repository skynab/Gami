import { FoldError, fromFlat, toFlat, type FlatFace } from './fold';
import { frontUp, joinedSegment, overlapArea, sideOf, split, sub, type Cut, type Line } from './geometry2d';
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
 * - inside / outside: a reverse fold, the moving part going between the layers of its flap, or wrapping round them;
 * - split: no fold at all, the paper just divided along the line so its two sides can stack differently, as where
 *   one tucked point lies over a layer and the next goes under it.
 */
export const CREASE_KINDS = ['valley', 'mountain', 'flat', 'inside', 'outside', 'split'] as const;
export type CreaseKind = (typeof CREASE_KINDS)[number];

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
  /**
   * Tucking: the paper that moves must end up underneath these faces wherever they overlap, as when a flap
   * slides into another piece's pocket instead of lying on top of it.
   */
  under?: (paper: Vec2[]) => boolean;
}

export function collapse(frame: FoldFrame, { creases, anchor, under }: CollapseOptions): FoldFrame {
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
  const edges = sharedEdges(faces, frame.cuts);

  // Which crease, if any, each edge is on.
  const change = edges.map((e) => {
    const a = apply(old[e.f], e.pa);
    const b = apply(old[e.f], e.pb);
    // A valley or mountain along a line where the paper is already folded leaves that fold as it is:
    // only paper lying flat across the line gets the new crease. (Reverse folds do re-fold folded edges.)
    const alreadyFolded = frontUp(faces[e.f].world, faces[e.f].paper) !== frontUp(faces[e.g].world, faces[e.g].paper);
    return creases.find(
      (c) =>
        Math.abs(sideOf(c.line, a)) < 1e-7 &&
        Math.abs(sideOf(c.line, b)) < 1e-7 &&
        !(alreadyFolded && (c.kind === 'valley' || c.kind === 'mountain')) &&
        (!c.only || (c.only(faces[e.f].paper) && c.only(faces[e.g].paper))),
    );
  });

  // Walk out from the anchor, placing each face from a neighbour already placed.
  const start = faces.findIndex((f) => contains(f.paper, anchor));
  if (start < 0) throw new FoldError('anchorOffPaper');
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
      else if (c.kind === 'flat' || c.kind === 'split') t = placed[u]!;
      else t = compose(reflection(apply(placed[u]!, e.pa), apply(placed[u]!, e.pb)), placed[u]!);
      if (!placed[w]) {
        placed[w] = t;
        queue.push(w);
      } else if (!sameMap(placed[w]!, t, faces[w].paper)) {
        throw new FoldError('creasesNotFlat');
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

  // Where reverse folds tuck in: the middle of the flap's stack, which is where its two halves meet. Each
  // edge on the crease asks whether the face staying put there is in the stack's lower half: more of the
  // faces staying put along the same stretch of the crease lie over it than under it. Only those: layers
  // compare only where faces overlap, and a crease can run across stacks of different depths.
  const stillOf = (i: number) => (flipped[edges[i].f] ? edges[i].g : edges[i].f);
  const stretch = (i: number, c: Crease): [number, number] => {
    const along = [edges[i].pa, edges[i].pb].map((p) => {
      const w = apply(old[edges[i].f], p);
      return (w[0] - c.line.p[0]) * c.line.d[0] + (w[1] - c.line.p[1]) * c.line.d[1];
    });
    return [Math.min(...along), Math.max(...along)];
  };
  const lowerHalf = (i: number, c: Crease) => {
    const [a0, a1] = stretch(i, c);
    const still = faces[stillOf(i)];
    let over = 0;
    let under = 0;
    edges.forEach((_, j) => {
      if (change[j] !== c || stillOf(j) === stillOf(i)) return;
      const [b0, b1] = stretch(j, c);
      if (Math.min(a1, b1) - Math.max(a0, b0) < 1e-7) return;
      const other = faces[stillOf(j)];
      if (other.layer > still.layer) over++;
      else if (other.layer < still.layer) under++;
    });
    return over > under;
  };

  // How the faces either side of each new crease stack. `aside` is how reverse folds once stacked (the middle
  // was always taken as 0): every layer's point behind its layer for an inside reverse fold, in front for an
  // outside one, all to one side of the flap. Kept as a last resort, for where the stacking about the middle
  // can't keep the paper that stays put in its order (see below).
  const creaseOrder = new Map<number, boolean>();
  const asideOrder = new Map<number, boolean>();
  const setOrder = (f: number, g: number, fAbove: boolean, aside = fAbove) => {
    creaseOrder.set(f * faces.length + g, fAbove);
    asideOrder.set(f * faces.length + g, aside);
  };
  // For paper a reverse fold moves: which half of the flap's stack it comes from (true: the lower half).
  const halfOf = new Map<number, boolean>();
  // For paper a valley or mountain fold turns over: which way round it goes (true: up and over, a valley's way).
  const wayOf = new Map<number, boolean>();
  edges.forEach((e, i) => {
    const c = change[i];
    if (!c || c.kind === 'flat' || c.kind === 'split') return;
    if (c.kind === 'valley' || c.kind === 'mountain') {
      // Valley: g lands on the side of f that faced up before the step.
      setOrder(e.g, e.f, (c.kind === 'valley') !== flipped[e.f]);
      if (flipped[e.f] !== flipped[e.g]) wayOf.set(flipped[e.f] ? e.f : e.g, c.kind === 'valley');
    } else {
      // Reverse: the face that moved goes to the inner side of the one that stayed (or the outer side).
      const [still, moved] = flipped[e.f] ? [e.g, e.f] : [e.f, e.g];
      const lower = lowerHalf(i, c);
      setOrder(moved, still, lower === (c.kind === 'inside'), c.kind === 'outside');
      if (!halfOf.has(moved)) halfOf.set(moved, lower);
    }
  });
  // Each half of a reverse-folded point turns over on its own, so its layers swap order among themselves but
  // stay on their side of the other half's. The halves reach out from the crease over the paper moving with
  // it: first as far as it's joined flat, then across folds to what's left (a flap folded onto one half), as
  // a fold may also join the two halves (a point's folded edge does).
  const spread = (acrossFolds: boolean) => {
    let grew = false;
    const reach = [...halfOf.keys()];
    while (reach.length) {
      const u = reach.shift()!;
      for (const i of byFace[u]) {
        const w = edges[i].f === u ? edges[i].g : edges[i].f;
        if (change[i] || halfOf.has(w) || group[w] !== group[u]) continue;
        if (frontUp(faces[u].world, faces[u].paper) !== frontUp(faces[w].world, faces[w].paper)) {
          if (!acrossFolds) continue;
          halfOf.set(w, halfOf.get(u)!);
          grew = true;
          continue;
        }
        halfOf.set(w, halfOf.get(u)!);
        reach.push(w);
        grew = true;
      }
    }
    return grew;
  };
  spread(false);
  while (spread(true)) spread(false);
  const apart = (f: number, g: number) => halfOf.has(f) && halfOf.has(g) && halfOf.get(f) !== halfOf.get(g);
  // Paper lying on a flap that turns over goes round with it: of the faces moving as it does, each takes the way of
  // the nearest in the stack it lies on. Flaps turning over opposite ways about one line (a boat's two sides, one
  // folded up in front and one behind) move alike, but each keeps to its own side of the other: their layers swap
  // order among themselves, not with the other's.
  const turned = [...wayOf];
  const riding = new Set<number>();
  for (const f of faces.keys()) {
    if (wayOf.has(f)) continue;
    let near = Infinity;
    for (const [g, way] of turned) {
      const d = Math.abs(faces[g].layer - faces[f].layer);
      if (group[g] !== group[f] || d >= near || !overlappedBefore(f, g)) continue;
      near = d;
      wayOf.set(f, way);
      riding.add(f);
    }
  }
  const otherWay = (f: number, g: number) => wayOf.has(f) && wayOf.has(g) && wayOf.get(f) !== wayOf.get(g);

  const layerEdges: LayerEdge[] = edges.map((e) => ({
    f: e.f,
    g: e.g,
    a: apply(placed[e.f] ?? old[e.f], e.pa),
    b: apply(placed[e.f] ?? old[e.f], e.pb),
    folded: frontUp(now[e.f], faces[e.f].paper) !== frontUp(now[e.g], faces[e.g].paper),
  }));

  // Faces that move together usually keep their order. Not always: opening a pocket and flattening it the
  // other way (as when a hat becomes a diamond) lets layers swap, so if no stacking keeps the order, the
  // solver tries again keeping it only for faces still hinged together along an unchanged crease, then only
  // for the paper that stays put. Then, for reverse folds, the same with their points stacked aside; and
  // last, about the middle keeping no order.
  const hinged = new Set(edges.flatMap((e, i) => (change[i] ? [] : [e.f * faces.length + e.g, e.g * faces.length + e.f])));
  const solve = (keep: 'all' | 'hinged' | 'still' | 'none', aside: boolean) =>
    solveLayers(
      now.map((world) => ({ world })),
      layerEdges,
      (f, g) => {
        const order = aside ? asideOrder : creaseOrder;
        const k = order.get(f * faces.length + g);
        if (k !== undefined) return k;
        const r = order.get(g * faces.length + f);
        if (r !== undefined) return !r;
        const kept = keep === 'all' || (keep === 'hinged' && hinged.has(f * faces.length + g)) || (keep === 'still' && group[f] === group[start]);
        if (group[f] === group[g] && overlappedBefore(f, g) && kept) return wasAbove(f, g) !== (flipped[f] && !otherWay(f, g) && (aside || !apart(f, g)));
        // A tucked flap goes under the faces it slides beneath.
        if (under) {
          const moved = (i: number) => group[i] !== group[start];
          if (moved(f) && !moved(g) && under(faces[g].paper)) return false;
          if (moved(g) && !moved(f) && under(faces[f].paper)) return true;
        }
        return undefined;
      },
      (f, g) => {
        if (overlappedBefore(f, g)) return wasAbove(f, g);
        // Paper riding on a flap folded behind lands under what it comes to lie on, as its flap does; the rest
        // that moves, on top. (Not the flap's own faces, which its creases place: a point tucked into a pocket
        // goes behind one layer and in front of the next.)
        const behind = (i: number) => riding.has(i) && wayOf.get(i) === false;
        return behind(f) !== behind(g) ? behind(g) : group[f] !== group[start];
      },
    );
  const keeps = ['all', 'hinged', 'still'] as const;
  const tries = [
    ...keeps.map((keep) => [keep, false] as const),
    ...(halfOf.size ? keeps.map((keep) => [keep, true] as const) : []),
    ['none', false] as const,
  ];
  let layers: number[] = [];
  for (const [keep, aside] of tries) {
    try {
      layers = solve(keep, aside);
      break;
    } catch (e) {
      if (!(e instanceof LayerError)) throw e;
      if (keep === 'none') throw new FoldError(e.code ?? e.message, e.params);
    }
  }

  return fromFlat(faces.map((f, i) => ({ ...f, world: now[i], layer: layers[i] })));
}

/** Pairs of faces joined along an edge of the sheet, with the shared stretch in sheet coordinates. */
function sharedEdges(faces: FlatFace[], cuts?: Cut[]): { f: number; g: number; pa: Vec2; pb: Vec2 }[] {
  const out: { f: number; g: number; pa: Vec2; pb: Vec2 }[] = [];
  for (let f = 0; f < faces.length; f++) {
    for (let g = f + 1; g < faces.length; g++) {
      const shared = joinedSegment(faces[f].paper, faces[g].paper, cuts);
      if (shared) out.push({ f, g, pa: shared[0], pb: shared[1] });
    }
  }
  return out;
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
