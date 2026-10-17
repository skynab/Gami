import { cross, dot, overlapArea, sub } from './geometry2d';
import type { Vec2 } from './types';

/**
 * Works out the stacking order of flat-folded paper once every face's position is known.
 *
 * Every pair of overlapping faces gets one unknown: which is on top. The rules of flat folding constrain them:
 *  - a crease's direction (valley or mountain) says which of its two faces is on top;
 *  - paper can't pass between the two sides of a fold (taco–tortilla), or between two faces that continue
 *    flat across a crease (tortilla–tortilla);
 *  - two folds along the same line can't interleave (taco–taco);
 *  - stacking can't go round in a circle (transitivity, wherever three faces overlap at one spot).
 * Known orders (from before the step) are given up front; the rest is found by propagation and, where that
 * isn't enough, a backtracking search that tries the preferred order first.
 */

export interface LayerFace {
  world: Vec2[];
}

export interface LayerEdge {
  f: number;
  g: number;
  /** The shared edge's ends on the table. */
  a: Vec2;
  b: Vec2;
  /** Folded flat (the faces overlap) rather than continuing flat across the crease. */
  folded: boolean;
}

export class LayerError extends Error {}

const AREA = 1e-7;
const LEN = 1e-7;

/**
 * Returns a layer number per face (higher on top), as low as possible.
 * `known(f, g)` says if f must be above g (true), below (false), or is free (undefined).
 * `prefer(f, g)` is the order to try first for free pairs.
 */
export function solveLayers(
  faces: LayerFace[],
  edges: LayerEdge[],
  known: (f: number, g: number) => boolean | undefined,
  prefer: (f: number, g: number) => boolean,
): number[] {
  const n = faces.length;

  // One variable per overlapping pair: value[v] = 1 when the lower-numbered face is on top, −1 when below.
  const pairIndex = new Map<number, number>();
  const pairs: [number, number][] = [];
  const neighbours: Set<number>[] = faces.map(() => new Set());
  const boxes = faces.map((f) => box(f.world));
  for (let f = 0; f < n; f++) {
    for (let g = f + 1; g < n; g++) {
      if (!boxesMeet(boxes[f], boxes[g])) continue;
      if (overlapArea(faces[f].world, faces[g].world) <= AREA) continue;
      pairIndex.set(f * n + g, pairs.length);
      pairs.push([f, g]);
      neighbours[f].add(g);
      neighbours[g].add(f);
    }
  }
  const value = new Int8Array(pairs.length);

  /** A literal: "f is above g". */
  const lit = (f: number, g: number): Lit | null => {
    const v = pairIndex.get(f < g ? f * n + g : g * n + f);
    return v === undefined ? null : { v, neg: f > g };
  };
  const get = (l: Lit) => (value[l.v] === 0 ? 0 : (value[l.v] === 1) !== l.neg ? 1 : -1);

  // Parity constraints: the listed "above" literals must xor to `odd`.
  const xors: { lits: Lit[]; odd: boolean }[] = [];
  const watch: number[][] = pairs.map(() => []);
  const addXor = (lits: (Lit | null)[], odd: boolean) => {
    if (lits.some((l) => !l)) return;
    const c = xors.push({ lits: lits as Lit[], odd }) - 1;
    for (const l of lits as Lit[]) watch[l.v].push(c);
  };

  // A face that the crease runs through must be on the same side of both faces at that crease.
  for (const e of edges) {
    for (const h of neighbours[e.f]) {
      if (h === e.g || !neighbours[e.g].has(h)) continue;
      if (crosses(faces[h].world, e.a, e.b)) addXor([lit(h, e.f), lit(h, e.g)], false);
    }
  }

  // Two creases lying along the same line on the table. Each side of each crease has one face:
  // a fold (taco) has both faces on one side, a flat crease (tortilla) one face on each side.
  // Which side of edge `along`'s line a face is on. Both edges of a pair are measured against the same line.
  const sideOfEdge = (along: LayerEdge, face: number) => {
    const d = sub(along.b, along.a);
    const c = centroid(faces[face].world);
    return Math.sign(cross(d, sub(c, along.a)));
  };
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      const p = edges[i];
      const q = edges[j];
      if (new Set([p.f, p.g, q.f, q.g]).size < 4 || !collinearOverlap(p, q)) continue;
      if (p.folded && q.folded) {
        // Two folds: one fold's faces are both between the other's, or neither is.
        addXor([lit(q.f, p.f), lit(q.f, p.g), lit(q.g, p.f), lit(q.g, p.g)], false);
      } else if (p.folded || q.folded) {
        // A fold and a flat crease: the flat paper can't run between the fold's two faces.
        const [taco, flat] = p.folded ? [p, q] : [q, p];
        const side = sideOfEdge(taco, taco.f);
        const t = sideOfEdge(taco, flat.f) === side ? flat.f : flat.g;
        addXor([lit(t, taco.f), lit(t, taco.g)], false);
      } else {
        // Two flat creases crossing the same line: their halves on each side stack the same way round.
        const pPlus = sideOfEdge(p, p.f) > 0 ? p.f : p.g;
        const qPlus = sideOfEdge(p, q.f) > 0 ? q.f : q.g;
        const pMinus = pPlus === p.f ? p.g : p.f;
        const qMinus = qPlus === q.f ? q.g : q.f;
        addXor([lit(pPlus, qPlus), lit(pMinus, qMinus)], false);
      }
    }
  }

  // Whether three faces overlap at a common spot, worked out when first needed.
  const tripleCache = new Map<string, boolean>();
  const together = (f: number, g: number, h: number) => {
    const k = [f, g, h].sort((x, y) => x - y).join(',');
    let t = tripleCache.get(k);
    if (t === undefined) {
      t = overlapArea(clip(faces[f].world, faces[g].world), faces[h].world) > AREA;
      tripleCache.set(k, t);
    }
    return t;
  };

  const trail: number[] = [];
  const queue: number[] = [];
  const set = (l: Lit, above: boolean): boolean => {
    const want = above !== l.neg ? 1 : -1;
    if (value[l.v] === want) return true;
    if (value[l.v] !== 0) return false;
    value[l.v] = want;
    trail.push(l.v);
    queue.push(l.v);
    return true;
  };

  const propagate = (): boolean => {
    while (queue.length) {
      const v = queue.pop()!;
      for (const c of watch[v]) {
        const { lits, odd } = xors[c];
        let parity = false;
        let open: Lit | null = null;
        let unknown = 0;
        for (const l of lits) {
          const x = get(l);
          if (x === 0) {
            unknown++;
            open = l;
          } else if (x === 1) parity = !parity;
        }
        if (unknown === 0 && parity !== odd) return false;
        if (unknown === 1 && !set(open!, parity !== odd)) return false;
      }
      // No cycles: f above g and g above h means f above h, wherever all three meet.
      const [f, g] = pairs[v];
      const fg = value[v] === 1;
      const [top, bottom] = fg ? [f, g] : [g, f];
      for (const h of neighbours[f]) {
        if (h === g || !neighbours[g].has(h) || !together(f, g, h)) continue;
        const hb = get(lit(h, bottom)!);
        const th = get(lit(top, h)!);
        // bottom below top; if h is below bottom it's below top, and if h is above top it's above bottom.
        if (hb === -1 && !set(lit(top, h)!, true)) return false;
        if (th === -1 && !set(lit(h, bottom)!, true)) return false;
      }
    }
    return true;
  };

  const undo = (to: number) => {
    while (trail.length > to) value[trail.pop()!] = 0;
    queue.length = 0;
  };

  for (let v = 0; v < pairs.length; v++) {
    const [f, g] = pairs[v];
    const k = known(f, g);
    if (k !== undefined && !set({ v, neg: false }, k)) throw new LayerError('The known stacking contradicts itself.');
  }
  if (!propagate()) throw new LayerError('These folds can’t lie flat in any stacking order.');

  // Backtracking search over whatever is still free, preferred order first.
  const search = (from: number): boolean => {
    let v = from;
    while (v < pairs.length && value[v] !== 0) v++;
    if (v === pairs.length) return true;
    const [f, g] = pairs[v];
    const first = prefer(f, g);
    for (const choice of [first, !first]) {
      const mark = trail.length;
      if (set({ v, neg: false }, choice) && propagate() && search(v + 1)) return true;
      undo(mark);
    }
    return false;
  };
  if (!search(0)) throw new LayerError('These folds can’t lie flat in any stacking order.');

  // Layers: each face sits one above the highest face it covers.
  const below: number[][] = faces.map(() => []);
  pairs.forEach(([f, g], v) => (value[v] === 1 ? below[f].push(g) : below[g].push(f)));
  const layer = new Array<number>(n).fill(-1);
  const state = new Uint8Array(n);
  const visit = (f: number): number => {
    if (state[f] === 2) return layer[f];
    if (state[f] === 1) throw new LayerError('These faces overlap in a circle, which a stack of layers can’t show.');
    state[f] = 1;
    let l = 0;
    for (const g of below[f]) l = Math.max(l, visit(g) + 1);
    state[f] = 2;
    return (layer[f] = l);
  };
  for (let f = 0; f < n; f++) visit(f);
  return layer;
}

interface Lit {
  v: number;
  neg: boolean;
}

type Box = [number, number, number, number];

function box(poly: Vec2[]): Box {
  const xs = poly.map((p) => p[0]);
  const zs = poly.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)];
}

const boxesMeet = (a: Box, b: Box) => a[0] < b[2] - LEN && b[0] < a[2] - LEN && a[1] < b[3] - LEN && b[1] < a[3] - LEN;

/** Whether the segment a–b runs through the inside of a convex polygon (not just along its edge). */
function crosses(poly: Vec2[], a: Vec2, b: Vec2): boolean {
  const ccw = signed(poly) > 0 ? poly : [...poly].reverse();
  let t0 = 0;
  let t1 = 1;
  const d = sub(b, a);
  for (let i = 0; i < ccw.length; i++) {
    const p = ccw[i];
    const q = ccw[(i + 1) % ccw.length];
    const e = sub(q, p);
    // Inside when cross(e, x − p) > 0.
    const num = cross(e, sub(a, p));
    const den = cross(e, d);
    if (Math.abs(den) < 1e-12) {
      if (num <= LEN) return false;
      continue;
    }
    const t = -num / den;
    if (den > 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t1 - t0 <= LEN) return false;
  }
  // The middle of the part inside must be strictly inside, not on an edge.
  const mid: Vec2 = [a[0] + d[0] * (t0 + t1) / 2, a[1] + d[1] * (t0 + t1) / 2];
  for (let i = 0; i < ccw.length; i++) {
    const p = ccw[i];
    const e = sub(ccw[(i + 1) % ccw.length], p);
    if (cross(e, sub(mid, p)) / Math.hypot(e[0], e[1]) <= LEN) return false;
  }
  return Math.hypot(d[0], d[1]) * (t1 - t0) > LEN;
}

function collinearOverlap(p: LayerEdge, q: LayerEdge): boolean {
  const d = sub(p.b, p.a);
  const len = Math.hypot(d[0], d[1]);
  if (len < LEN) return false;
  const u: Vec2 = [d[0] / len, d[1] / len];
  if (Math.abs(cross(u, sub(q.a, p.a))) > LEN || Math.abs(cross(u, sub(q.b, p.a))) > LEN) return false;
  const s0 = dot(sub(q.a, p.a), u);
  const s1 = dot(sub(q.b, p.a), u);
  return Math.min(len, Math.max(s0, s1)) - Math.max(0, Math.min(s0, s1)) > LEN;
}

function centroid(poly: Vec2[]): Vec2 {
  return [poly.reduce((s, p) => s + p[0], 0) / poly.length, poly.reduce((s, p) => s + p[1], 0) / poly.length];
}

function signed(poly: Vec2[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) a += cross(poly[i], poly[(i + 1) % poly.length]);
  return a;
}

/** The part of convex polygon `a` inside convex polygon `b`. */
function clip(a: Vec2[], b: Vec2[]): Vec2[] {
  let out = signed(a) < 0 ? [...a].reverse() : a;
  const c = signed(b) < 0 ? [...b].reverse() : b;
  for (let i = 0; i < c.length && out.length; i++) {
    const p = c[i];
    const e = sub(c[(i + 1) % c.length], p);
    const inside = (x: Vec2) => cross(e, sub(x, p)) >= -1e-12;
    const input = out;
    out = [];
    for (let k = 0; k < input.length; k++) {
      const cur = input[k];
      const prev = input[(k + input.length - 1) % input.length];
      if (inside(cur) !== inside(prev)) {
        const sp = cross(e, sub(prev, p));
        const sc = cross(e, sub(cur, p));
        const t = sp / (sp - sc);
        out.push([prev[0] + (cur[0] - prev[0]) * t, prev[1] + (cur[1] - prev[1]) * t]);
      }
      if (inside(cur)) out.push(cur);
    }
  }
  return out;
}
