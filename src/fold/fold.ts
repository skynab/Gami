import {
  overlapArea,
  reflect,
  segmentsOverlap,
  sideOf,
  signedArea,
  split,
  sub,
  type Line,
  type Piece,
} from './geometry2d';
import type { FoldFrame, Vec2, Vec3 } from './types';

/**
 * The fold engine: works out the paper after a fold, for models that lie flat on the table between steps.
 * Folds are straight lines on the table. Faces are convex polygons, each known both on the sheet and on
 * the table, plus a layer number for stacking. Everything is pure: operations return a new frame.
 */

export interface FlatFace extends Piece {
  layer: number;
  /** Index of the face in the previous frame this one came from. */
  parent: number;
}

export type FoldKind = 'valley' | 'mountain';

export interface FoldOptions {
  line: Line;
  /** Valley: the moving side comes up and over, landing on top. Mountain: it goes behind, underneath. */
  kind: FoldKind;
  /** Fold only the top N layers on the moving side. Leave out to fold through every layer. */
  layers?: number;
}

export class FoldError extends Error {}

const FLAT = 1e-6;

/** Reads a frame lying flat on the table. Throws a FoldError for 3D frames, which the engine can't fold. */
export function toFlat(frame: FoldFrame): FlatFace[] {
  return frame.faces_vertices.map((face, f) => {
    const world = face.map((v): Vec2 => {
      const [x, y, z] = frame.vertices_coords[v];
      if (Math.abs(y) > FLAT) throw new FoldError('This step isn’t flat, so it can’t be folded further here.');
      return [x, z];
    });
    return { world, paper: face.map((v) => frame.vertices_paper[v]), layer: frame.faces_layer?.[f] ?? 0, parent: f };
  });
}

/** Writes faces back out as a frame, sharing vertices between faces that meet at the same paper point. */
export function fromFlat(faces: FlatFace[]): FoldFrame {
  const layers = compact(faces);
  const index = new Map<string, number>();
  const vertices_paper: Vec2[] = [];
  const vertices_coords: Vec3[] = [];
  const faces_vertices = faces.map((f) =>
    f.paper.map((p, i) => {
      const key = `${p[0].toFixed(7)},${p[1].toFixed(7)}`;
      let v = index.get(key);
      if (v === undefined) {
        v = vertices_paper.push(p) - 1;
        vertices_coords.push([f.world[i][0], 0, f.world[i][1]]);
        index.set(key, v);
      }
      return v;
    }),
  );
  return {
    vertices_paper,
    vertices_coords,
    faces_vertices,
    faces_parent: faces.map((f) => f.parent),
    faces_layer: layers,
  };
}

/** Folds the paper along a line. The side to the left of the line's direction moves. */
export function fold(frame: FoldFrame, { line, kind, layers }: FoldOptions): FoldFrame {
  const faces = toFlat(frame);
  const movingSideLayers = faces.filter((f) => f.world.some((x) => sideOf(line, x) > 1e-7)).map((f) => f.layer);
  if (!movingSideLayers.length) throw new FoldError('Nothing is on the folding side of that line.');
  const from = layers === undefined ? -Infinity : Math.max(...movingSideLayers) - layers + 1;

  // Cut every face that takes part along the line.
  const pieces: (FlatFace & { moves: boolean })[] = [];
  faces.forEach((f, i) => {
    if (f.layer < from) {
      pieces.push({ ...f, parent: i, moves: false });
      return;
    }
    const { pos, neg } = split(f, line);
    if (pos) pieces.push({ ...pos, layer: f.layer, parent: i, moves: true });
    if (neg) pieces.push({ ...neg, layer: f.layer, parent: i, moves: false });
  });

  const moving = pieces.filter((p) => p.moves);
  if (!moving.length) throw new FoldError('Nothing is on the folding side of that line.');
  if (layers !== undefined) checkNoTear(pieces, line);

  // New stacking. Turning a pile over reverses it: in a valley fold the old top lands lowest of the
  // folded part, on top of everything else; in a mountain fold the old top ends up lowest of all.
  const all = pieces.map((p) => p.layer);
  const maxAll = Math.max(...all);
  const minAll = Math.min(...all);
  const movingLayers = moving.map((p) => p.layer);
  const maxM = Math.max(...movingLayers);
  const minM = Math.min(...movingLayers);
  const span = maxM - minM + 2;
  for (const p of moving) {
    p.world = p.world.map((x) => reflect(line, x));
    if (kind === 'valley') p.layer = maxAll + 1 + (maxM - p.layer);
    // Mountain: tuck in just under the folded layers (or under everything).
    else if (from === -Infinity) p.layer = minAll - 1 - (p.layer - minM);
    else p.layer = from - 1 + (maxM - p.layer + 1) / span;
  }
  return fromFlat(pieces.map(({ moves: _, ...p }) => p));
}

/** Turns the paper over from left to right, about its own middle. */
export function turnOver(frame: FoldFrame): FoldFrame {
  const faces = toFlat(frame);
  const xs = faces.flatMap((f) => f.world.map((w) => w[0]));
  const mid = (Math.min(...xs) + Math.max(...xs)) / 2;
  const top = Math.max(...faces.map((f) => f.layer));
  return fromFlat(faces.map((f) => ({ ...f, world: f.world.map(([x, z]): Vec2 => [2 * mid - x, z]), layer: top - f.layer })));
}

/** Turns the paper on the table about its own middle, anticlockwise seen from above. */
export function rotate(frame: FoldFrame, angle: number): FoldFrame {
  const faces = toFlat(frame);
  const pts = faces.flatMap((f) => f.world);
  const cx = (Math.min(...pts.map((p) => p[0])) + Math.max(...pts.map((p) => p[0]))) / 2;
  const cz = (Math.min(...pts.map((p) => p[1])) + Math.max(...pts.map((p) => p[1]))) / 2;
  // Seen from above, +x is right and +z is towards you, so anticlockwise turns x towards −z.
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const turn = ([x, z]: Vec2): Vec2 => {
    const dx = x - cx;
    const dz = z - cz;
    return [cx + c * dx + s * dz, cz - s * dx + c * dz];
  };
  return fromFlat(faces.map((f) => ({ ...f, world: f.world.map(turn) })));
}

/**
 * Opens the paper back to how it lay in an earlier frame, keeping every crease made since.
 * `frames` is the model so far; the result is placed like frames[target].
 */
export function unfoldTo(frames: FoldFrame[], target: number): FoldFrame {
  const last = frames.length - 1;
  const faces = toFlat(frames[last]);
  const then = toFlat(frames[target]);
  return fromFlat(
    faces.map((f, i) => {
      let a = i;
      for (let k = last; k > target; k--) a = frames[k].faces_parent?.[a] ?? a;
      const ancestor = then[a];
      return { ...f, world: f.paper.map(placeLike(ancestor)), layer: ancestor.layer, parent: i };
    }),
  );
}

/** Maps sheet points to the table the way `face` is placed. */
function placeLike(face: FlatFace): (p: Vec2) => Vec2 {
  const [q0, q1, q2] = widest(face.paper);
  const [w0, w1, w2] = [q0, q1, q2].map((q) => face.world[face.paper.indexOf(q)]);
  const a = sub(q1, q0);
  const b = sub(q2, q0);
  const det = a[0] * b[1] - a[1] * b[0];
  return (p) => {
    const d = sub(p, q0);
    const alpha = (d[0] * b[1] - d[1] * b[0]) / det;
    const beta = (a[0] * d[1] - a[1] * d[0]) / det;
    return [w0[0] + alpha * (w1[0] - w0[0]) + beta * (w2[0] - w0[0]), w0[1] + alpha * (w1[1] - w0[1]) + beta * (w2[1] - w0[1])];
  };
}

function widest(paper: Vec2[]): [Vec2, Vec2, Vec2] {
  let best: [Vec2, Vec2, Vec2] = [paper[0], paper[1], paper[2]];
  let area = -1;
  for (let j = 1; j < paper.length; j++) {
    for (let k = j + 1; k < paper.length; k++) {
      const s = Math.abs(signedArea([paper[0], paper[j], paper[k]]));
      if (s > area) [area, best] = [s, [paper[0], paper[j], paper[k]]];
    }
  }
  return best;
}

/** Moving and still parts may only be joined along the fold line, or the paper would tear. */
function checkNoTear(pieces: (FlatFace & { moves: boolean })[], line: Line) {
  const onLine = (x: Vec2) => Math.abs(sideOf(line, x)) < 1e-7;
  for (const m of pieces.filter((p) => p.moves)) {
    for (const s of pieces.filter((p) => !p.moves)) {
      for (let i = 0; i < m.paper.length; i++) {
        const i1 = (i + 1) % m.paper.length;
        if (onLine(m.world[i]) && onLine(m.world[i1])) continue;
        for (let j = 0; j < s.paper.length; j++) {
          if (segmentsOverlap(m.paper[i], m.paper[i1], s.paper[j], s.paper[(j + 1) % s.paper.length])) {
            throw new FoldError('Those layers are joined to the ones below, so folding only them would tear the paper. Try more layers.');
          }
        }
      }
    }
  }
}

/**
 * Smallest whole-number layers that keep the same order wherever faces overlap, so stacks stay thin.
 * Faces that don't overlap can share a layer.
 */
function compact(faces: FlatFace[]): number[] {
  const order = faces.map((_, i) => i).sort((a, b) => faces[a].layer - faces[b].layer || a - b);
  const out = new Array<number>(faces.length).fill(0);
  const placed: number[] = [];
  for (const f of order) {
    let layer = 0;
    for (const g of placed) if (out[g] + 1 > layer && overlapArea(faces[f].world, faces[g].world) > 1e-7) layer = out[g] + 1;
    out[f] = layer;
    placed.push(f);
  }
  return out;
}
