import { FoldError, toFlat } from './fold';
import { facePositions } from './frames';
import { settle } from './settle';
import { shape, type Bend } from './shape';
import type { FoldFrame, Vec2, Vec3 } from './types';

/**
 * Putting folded units together in 3D, as a cube's six faces or a kusudama's flowers. Each piece (a unit,
 * usually: the faces `only` picks, by their corners on the sheet) can be bent along lines first, as `shape`
 * bends paper (a flap opened square), and then picked up and set down anywhere, turned any way: `pose` takes
 * the point `from` on the table to `to`, the table's +x to `x` and its up to `up`. Everything is worked out
 * from the paper's last flat state, so a later step can move a piece again or add more. A face goes with the
 * last piece that picks it; faces no piece picks stay as they lie. Nothing can be folded afterwards.
 */
export interface Piece {
  only: (paper: Vec2[]) => boolean;
  bends?: Bend[];
  pose?: Pose;
}

export interface Pose {
  from: Vec2;
  to: Vec3;
  x: Vec3;
  up: Vec3;
}

/**
 * `settled`: the flat state was pressed flat first (`settle`), so its faces start from those heights, each part only
 * as thick as the paper there, rather than stacked by layer. Pieces can't be bent then.
 */
export function assemble(base: FoldFrame, pieces: Piece[], { settled = false } = {}): FoldFrame {
  toFlat(base);
  const pieceOf = (paper: Vec2[]) => pieces.findLastIndex((p) => p.only(paper));
  // Each piece's bends turn only the faces it has, so a piece placed again later isn't bent by its old bends.
  const held = new Set(base.faces_vertices.map((face) => pieceOf(face.map((v) => base.vertices_paper[v]))));
  const bends = pieces.flatMap((p, i) =>
    held.has(i) ? (p.bends ?? []).map((b): Bend => ({ ...b, only: (paper) => pieceOf(paper) === i && (!b.only || b.only(paper)) })) : [],
  );
  if (settled && bends.length) throw new FoldError('Paper pressed flat can’t be bent as it’s put together.');
  const shaped = bends.length ? shape(base, bends) : base;
  const placed = facePositions(settled ? settle(base) : shaped);
  const moves = pieces.map((p) => p.pose && rigidMove(p.pose));

  // Faces meeting at the same point of the sheet in the same place share a vertex, which keeps files small.
  const vertices_paper: Vec2[] = [];
  const vertices_coords: Vec3[] = [];
  const index = new Map<string, number>();
  const faces_vertices = shaped.faces_vertices.map((face, f) => {
    const paper = face.map((v) => shaped.vertices_paper[v]);
    const move = moves[pieceOf(paper)];
    return placed[f].map((p, k) => {
      const q = move ? move(p) : p;
      const key = [...paper[k], ...q].map((c) => Math.round(c * 1e8)).join(',');
      let v = index.get(key);
      if (v === undefined) {
        v = vertices_paper.push(paper[k]) - 1;
        vertices_coords.push(q);
        index.set(key, v);
      }
      return v;
    });
  });
  return {
    vertices_paper,
    vertices_coords,
    faces_vertices,
    // Shaping cuts faces along the bends, each piece keeping its face of the flat state as its parent.
    faces_parent: bends.length && shaped.faces_parent ? shaped.faces_parent : shaped.faces_vertices.map((_, f) => f),
  };
}

/** The rigid move a pose makes: `from` (on the table) to `to`, the table's +x along `x` and its up along `up`. */
function rigidMove({ from, to, x, up }: Pose): (p: Vec3) => Vec3 {
  const unit = (v: Vec3): Vec3 => {
    const len = Math.hypot(...v);
    if (len < 1e-12) throw new FoldError('A pose needs directions that aren’t zero.');
    return v.map((c) => c / len) as Vec3;
  };
  const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  // Up as given; x made square to it; z completing them (x × y = z, as on the table).
  const ey = unit(up);
  const dot = x[0] * ey[0] + x[1] * ey[1] + x[2] * ey[2];
  const ex = unit([x[0] - dot * ey[0], x[1] - dot * ey[1], x[2] - dot * ey[2]]);
  const ez = cross(ex, ey);
  return ([px, py, pz]) => {
    const [dx, dy, dz] = [px - from[0], py, pz - from[1]];
    return [0, 1, 2].map((i) => to[i] + ex[i] * dx + ey[i] * dy + ez[i] * dz) as Vec3;
  };
}
