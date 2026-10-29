import { FoldError, toFlat } from './fold';
import { LAYER_GAP } from './frames';
import { inside } from './select';
import type { FoldFrame, Vec2, Vec3 } from './types';

/**
 * Pressing flat paper down, so each part of it is only as thick as the paper there. Flat paper's layers are one
 * stack: a face is drawn as high as its layer, however few faces lie under it where it is. That's right for one
 * folded sheet, but a long chain of units, each slid inside the last, stacks up into a wedge: every unit's
 * layers go above and below all the units after it. Here each face is set at the height of the paper under it,
 * corner by corner (the faces below it, in the stacking order, that cover that corner), tilted to fit, and put
 * down rigidly. Faces that overlap keep their order wherever they meet. The result isn't flat, so nothing can be
 * folded after it.
 */
export function settle(frame: FoldFrame): FoldFrame {
  const faces = toFlat(frame);
  if (faces.length < 2) throw new FoldError('There’s nothing to press down.');
  const boxes = faces.map((f) => {
    const xs = f.world.map((p) => p[0]);
    const zs = f.world.map((p) => p[1]);
    return [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
  });
  const vertices_paper: Vec2[] = [];
  const vertices_coords: Vec3[] = [];
  const faces_vertices = faces.map((f) => {
    const [cx, cz] = mean(f.world);
    // Each corner's height: the faces below this one that cover a point just inside it.
    const heights = f.world.map(([x, z]) => {
      const p: Vec2 = [x + (cx - x) * 1e-3, z + (cz - z) * 1e-3];
      const under = faces.filter((g, j) => g.layer < f.layer && boxes[j][0] <= p[0] && p[0] <= boxes[j][1] && boxes[j][2] <= p[1] && p[1] <= boxes[j][3] && inside(g.world, p));
      return under.length * LAYER_GAP;
    });
    const placed = rigidFit(f.world, heights);
    return placed.map((q, k) => {
      vertices_coords.push(q);
      return vertices_paper.push(f.paper[k]) - 1;
    });
  });
  return { vertices_paper, vertices_coords, faces_vertices, faces_parent: faces.map((_, i) => i) };
}

const mean = (pts: Vec2[]): Vec2 => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];

/**
 * A flat polygon on the table, lifted rigidly onto the plane that best fits the heights wanted at its corners
 * (least squares): turned about its middle to face that plane's way up, and raised to it.
 */
function rigidFit(world: Vec2[], heights: number[]): Vec3[] {
  const [cx, cz] = mean(world);
  const h = heights.reduce((s, y) => s + y, 0) / heights.length;
  // Slopes b (along x) and c (along z) of y = h + b(x − cx) + c(z − cz).
  let sxx = 0;
  let sxz = 0;
  let szz = 0;
  let sxy = 0;
  let szy = 0;
  world.forEach(([x, z], i) => {
    const [dx, dz, dy] = [x - cx, z - cz, heights[i] - h];
    sxx += dx * dx;
    sxz += dx * dz;
    szz += dz * dz;
    sxy += dx * dy;
    szy += dz * dy;
  });
  const det = sxx * szz - sxz * sxz;
  const [b, c] = Math.abs(det) > 1e-18 ? [(sxy * szz - szy * sxz) / det, (szy * sxx - sxy * sxz) / det] : [0, 0];
  // The plane's normal, and the turn taking straight up to it (about the axis up × normal).
  const len = Math.hypot(b, 1, c);
  const n: Vec3 = [-b / len, 1 / len, -c / len];
  const axis: Vec3 = [n[2], 0, -n[0]];
  const s = Math.hypot(axis[0], axis[2]);
  const turn = (v: Vec3): Vec3 => {
    if (s < 1e-15) return v;
    const k: Vec3 = [axis[0] / s, 0, axis[2] / s];
    const cos = n[1];
    const dot = k[0] * v[0] + k[2] * v[2];
    const cross: Vec3 = [k[1] * v[2] - k[2] * v[1], k[2] * v[0] - k[0] * v[2], k[0] * v[1] - k[1] * v[0]];
    return [0, 1, 2].map((i) => v[i] * cos + cross[i] * s + k[i] * dot * (1 - cos)) as Vec3;
  };
  return world.map(([x, z]) => {
    const [dx, dy, dz] = turn([x - cx, 0, z - cz]);
    return [cx + dx, h + dy, cz + dz];
  });
}
