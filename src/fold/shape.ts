import { checkNoTear, FoldError, toFlat, type FlatFace } from './fold';
import { sideOf, split, type Line } from './geometry2d';
import type { FoldFrame, Vec2, Vec3 } from './types';

/**
 * 3D shaping, for finishing steps: opening a flap partway, spreading wings, curling a petal. The paper
 * is bent about lines drawn on its last flat state. Each bend turns the paper on the left of its line's
 * direction up off the table by its angle; a piece of paper beyond several bends turns by each of them,
 * the one turning the most paper nearest the paper that stays put. So bends along a row of lines curl a
 * flap, and bends on different flaps shape them separately. Bends whose lines cross on the paper they turn
 * would stretch it, and are refused. The result isn't flat, so it can't be folded
 * further, but it can be shaped again (from the same flat state, with more bends).
 */
export interface Bend {
  line: Line;
  /** How far to turn, in radians: 0 leaves it flat, π/2 stands it straight up, π folds it right over. */
  angle: number;
  /** Turn only the top N layers on the moving side. Leave out to turn every layer there. */
  layers?: number;
  /** Turn only faces whose corners on the sheet pass this test. */
  only?: (paper: Vec2[]) => boolean;
}

export function shape(frame: FoldFrame, bends: Bend[]): FoldFrame {
  const faces = toFlat(frame);
  // Which of the flat state's faces each bend turns (before cutting them along the bend lines).
  const turns = bends.map((b) => {
    const movingSide = faces.filter((f) => f.world.some((x) => sideOf(b.line, x) > 1e-7));
    if (!movingSide.length) throw new FoldError('Nothing is on the lifting side of that line.');
    const from = b.layers === undefined ? -Infinity : Math.max(...movingSide.map((f) => f.layer)) - b.layers + 1;
    return faces.map((f) => f.layer >= from && (!b.only || b.only(f.paper)));
  });

  // Cut the faces each bend turns along its line.
  let pieces: (FlatFace & { source: number })[] = faces.map((f, i) => ({ ...f, parent: i, source: i }));
  bends.forEach((b, k) => {
    pieces = pieces.flatMap((p) => {
      if (!turns[k][p.source]) return [p];
      const { pos, neg } = split(p, b.line);
      return [pos, neg].filter((q) => q !== null).map((q) => ({ ...q!, layer: p.layer, parent: p.parent, source: p.source }));
    });
  });

  // For each bend, the pieces it turns: those it applies to, on the left of its line.
  const moves = bends.map((b, k) =>
    pieces.map((p) => turns[k][p.source] && sideOf(b.line, centre(p.world)) > 0),
  );
  bends.forEach((b, k) => {
    if (!moves[k].some(Boolean)) throw new FoldError('Nothing is on the lifting side of that line.');
    if (b.layers !== undefined || b.only) checkNoTear(pieces.map((p, i) => ({ ...p, moves: moves[k][i] })), b.line);
  });

  // A piece's place: each bend it's beyond turns it, from the one turning the least paper (furthest out) to
  // the one turning the most (nearest the paper that stays put).
  const count = moves.map((m) => m.filter(Boolean).length);
  const order = bends.map((_, k) => k).sort((a, b) => count[a] - count[b]);
  const place = (i: number, [x, z]: Vec2): Vec3 => {
    let q: Vec3 = [x, 0, z];
    for (const k of order) if (moves[k][i]) q = turn(q, bends[k]);
    return q;
  };

  const index = new Map<string, number>();
  const vertices_paper: Vec2[] = [];
  const vertices_coords: Vec3[] = [];
  const faces_vertices = pieces.map((p, i) =>
    p.paper.map((q, j) => {
      const key = `${q[0].toFixed(7)},${q[1].toFixed(7)}`;
      const at = place(i, p.world[j]);
      let v = index.get(key);
      if (v === undefined) {
        v = vertices_paper.push(q) - 1;
        vertices_coords.push(at);
        index.set(key, v);
      } else if (Math.hypot(...vertices_coords[v].map((c, n) => c - at[n])) > 1e-6) {
        throw new FoldError('Those bends cross on the paper, so they’d stretch it. Shape one part at a time.');
      }
      return v;
    }),
  );
  return {
    vertices_paper,
    vertices_coords,
    faces_vertices,
    faces_parent: pieces.map((p) => p.parent),
    faces_layer: pieces.map((p) => p.layer),
  };
}

/** Turns a point about a bend's line (on the table) by its angle, the left of the line going up. */
function turn([x, y, z]: Vec3, { line, angle }: Bend): Vec3 {
  const len = Math.hypot(line.d[0], line.d[1]);
  const [dx, dz] = [line.d[0] / len, line.d[1] / len];
  // Unit vector across the line towards its left (the moving side), and straight up.
  const [nx, nz] = [-dz, dx];
  const rx = x - line.p[0];
  const rz = z - line.p[1];
  const along = rx * dx + rz * dz;
  const across = rx * nx + rz * nz;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  // In the plane across the line, (across, up) turns by the angle.
  const a2 = across * c - y * s;
  const y2 = across * s + y * c;
  return [line.p[0] + along * dx + a2 * nx, y2, line.p[1] + along * dz + a2 * nz];
}

function centre(pts: Vec2[]): Vec2 {
  return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
}

/**
 * A curl: one bend's turn spread over `segments` bends, from its line out to the farthest paper it turns,
 * so the flap rolls over evenly instead of folding at the line.
 */
export function curl(frame: FoldFrame, bend: Bend, segments: number): Bend[] {
  if (segments <= 1) return [bend];
  const len = Math.hypot(bend.line.d[0], bend.line.d[1]);
  const reach = Math.max(
    0,
    ...toFlat(frame)
      .filter((f) => !bend.only || bend.only(f.paper))
      .flatMap((f) => f.world.map((x) => sideOf(bend.line, x) / len)),
  );
  const across: Vec2 = [-bend.line.d[1] / len, bend.line.d[0] / len];
  return Array.from({ length: segments }, (_, i) => ({
    ...bend,
    line: { p: [bend.line.p[0] + (across[0] * reach * i) / segments, bend.line.p[1] + (across[1] * reach * i) / segments], d: bend.line.d },
    angle: bend.angle / segments,
  }));
}

/**
 * For a frame shaped again from the flat state: points each face's parent at the face of `previous` it lies
 * within (on the sheet), so the step animates from where the paper was.
 */
export function reparent(previous: FoldFrame, next: FoldFrame): FoldFrame {
  const faces = previous.faces_vertices.map((face) => face.map((v) => previous.vertices_paper[v]));
  const faces_parent = next.faces_vertices.map((face) => {
    const c = centre(face.map((v) => next.vertices_paper[v]));
    const f = faces.findIndex((poly) => contains(poly, c));
    if (f < 0) throw new FoldError(`(${c.join(', ')}) isn’t on the paper.`);
    return f;
  });
  return { ...next, faces_parent };
}

function contains(poly: Vec2[], p: Vec2): boolean {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const c = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    if (Math.abs(c) < 1e-9) continue;
    if (sign && Math.sign(c) !== sign) return false;
    sign = Math.sign(c);
  }
  return true;
}
