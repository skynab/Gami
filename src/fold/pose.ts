import { checkNoTear, FoldError, toFlat } from './fold';
import { sideOf, split, type Line } from './geometry2d';
import type { FoldFrame, Vec2, Vec3 } from './types';

/**
 * Finishing steps in 3D: lift part of the paper off the table by turning it about a crease, like opening a
 * wing or standing up a flap. Unlike a fold, the result isn't flat, so it's usually a model's last step.
 */
export interface PoseOptions {
  line: Line;
  /** How far to turn, in radians: 0 leaves it flat, π/2 stands it straight up, π folds it right over. */
  angle: number;
  /** Turn only the top N layers on the moving side. Leave out to turn every layer there. */
  layers?: number;
  /** Turn only faces whose corners on the sheet pass this test. */
  only?: (paper: Vec2[]) => boolean;
}

/** Turns the side to the left of the line's direction up off the table about the line. */
export function pose(frame: FoldFrame, { line, angle, layers, only }: PoseOptions): FoldFrame {
  const faces = toFlat(frame);
  const movingSide = faces.filter((f) => f.world.some((x) => sideOf(line, x) > 1e-7));
  if (!movingSide.length) throw new FoldError('Nothing is on the lifting side of that line.');
  const from = layers === undefined ? -Infinity : Math.max(...movingSide.map((f) => f.layer)) - layers + 1;

  const pieces: { world: Vec2[]; paper: Vec2[]; layer: number; parent: number; moves: boolean }[] = [];
  faces.forEach((f, i) => {
    if (f.layer < from || (only && !only(f.paper))) {
      pieces.push({ ...f, parent: i, moves: false });
      return;
    }
    const { pos, neg } = split(f, line);
    if (pos) pieces.push({ ...pos, layer: f.layer, parent: i, moves: true });
    if (neg) pieces.push({ ...neg, layer: f.layer, parent: i, moves: false });
  });
  if (!pieces.some((p) => p.moves)) throw new FoldError('Nothing is on the lifting side of that line.');
  if (layers !== undefined || only) checkNoTear(pieces, line);

  // Turning about the line: a point's distance across the line becomes partly height.
  // Layers of a lifted flap end up in the same place; that's fine for a finishing pose.
  const [dx, dz] = line.d;
  // Unit vector across the line, towards the moving side.
  const nx = -dz;
  const nz = dx;
  const lift = ([x, z]: Vec2): Vec3 => {
    const r = sideOf(line, [x, z]);
    const foot: Vec2 = [x - nx * r, z - nz * r];
    return [foot[0] + nx * r * Math.cos(angle), r * Math.sin(angle), foot[1] + nz * r * Math.cos(angle)];
  };

  const index = new Map<string, number>();
  const vertices_paper: Vec2[] = [];
  const vertices_coords: Vec3[] = [];
  const faces_vertices = pieces.map((p) =>
    p.paper.map((q, i) => {
      const key = `${q[0].toFixed(7)},${q[1].toFixed(7)}`;
      let v = index.get(key);
      if (v === undefined) {
        v = vertices_paper.push(q) - 1;
        const [x, z] = p.world[i];
        vertices_coords.push(p.moves ? lift([x, z]) : [x, 0, z]);
        index.set(key, v);
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
