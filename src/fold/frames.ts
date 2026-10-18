import type { FoldFrame, OrigamiModel, Vec3 } from './types';

/** Gap between stacked layers, so flat faces on top of each other don't flicker. */
export const LAYER_GAP = 0.0007;

/** Every frame of a model: the start, then one per step. Frame k is the paper after step k. */
export function framesOf(model: OrigamiModel): FoldFrame[] {
  return [model.start, ...model.steps.map((s) => s.frame)];
}

/**
 * Each face's corners in 3D, with flat stacked faces lifted by their layer.
 * Faces get their own copies of shared vertices, since each one moves on its own while animating.
 */
export function facePositions(frame: FoldFrame): Vec3[][] {
  return frame.faces_vertices.map((face, f) => {
    const points = face.map((v) => [...frame.vertices_coords[v]] as Vec3);
    const layer = frame.faces_layer?.[f] ?? 0;
    if (layer && isHorizontal(points)) for (const p of points) p[1] += layer * LAYER_GAP;
    return points;
  });
}

function isHorizontal(points: Vec3[]): boolean {
  const n = normal(points);
  return Math.abs(n[1]) > 0.999;
}

/** Unit normal of a planar polygon (Newell's method), pointing out of its front side. */
export function normal(points: Vec3[]): Vec3 {
  let x = 0;
  let y = 0;
  let z = 0;
  for (let i = 0; i < points.length; i++) {
    const [ax, ay, az] = points[i];
    const [bx, by, bz] = points[(i + 1) % points.length];
    x += (ay - by) * (az + bz);
    y += (az - bz) * (ax + bx);
    z += (ax - bx) * (ay + by);
  }
  const len = Math.hypot(x, y, z) || 1;
  return [x / len, y / len, z / len];
}

/** Center and radius of a sphere around a set of points, for fitting the camera. */
export function sphereAround(points: Iterable<Vec3>): { center: Vec3; radius: number } {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of points) {
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], p[i]);
      max[i] = Math.max(max[i], p[i]);
    }
  }
  const center: Vec3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  return { center, radius: Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2 };
}
