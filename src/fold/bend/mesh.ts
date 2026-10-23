import type { Vec3 } from '../types';

/**
 * Triangle meshes for paper that bends (see docs/bending-plan.md): the bending paper as many small rigid
 * triangles, with a slight fold between neighbours.
 */

export type Tri = [number, number, number];

/**
 * A hinge: an edge shared by two triangles, `a`–`b`, with the corner of each triangle opposite it. The first
 * triangle runs a, b, c and the second b, a, d, so both wind the same way.
 */
export interface Hinge {
  a: number;
  b: number;
  c: number;
  d: number;
}

/**
 * A w × h rectangle lying flat in the xz plane (y = 0), centred on `at`, cut into nx × nz cells of two triangles
 * each. Points run along x first.
 */
export function gridMesh(w: number, h: number, nx: number, nz: number, at: Vec3 = [0, 0, 0]): { points: Vec3[]; triangles: Tri[] } {
  const points: Vec3[] = [];
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) points.push([at[0] - w / 2 + (w * i) / nx, at[1], at[2] - h / 2 + (h * j) / nz]);
  }
  const id = (i: number, j: number) => j * (nx + 1) + i;
  const triangles: Tri[] = [];
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      // Each cell's diagonal alternates, so the mesh has no preferred direction to bend in.
      const [p, q, r, s] = [id(i, j), id(i + 1, j), id(i + 1, j + 1), id(i, j + 1)];
      if ((i + j) % 2) triangles.push([p, q, r], [p, r, s]);
      else triangles.push([p, q, s], [q, r, s]);
    }
  }
  return { points, triangles };
}

/** A mesh's edges (each once, smaller index first) and its hinges. */
export function topology(triangles: Tri[]): { edges: [number, number][]; hinges: Hinge[] } {
  const edges: [number, number][] = [];
  const seen = new Map<string, { tri: number; a: number; b: number; c: number }>();
  const hinges: Hinge[] = [];
  triangles.forEach((t, k) => {
    for (let e = 0; e < 3; e++) {
      const [a, b, c] = [t[e], t[(e + 1) % 3], t[(e + 2) % 3]];
      const key = a < b ? `${a},${b}` : `${b},${a}`;
      const other = seen.get(key);
      if (!other) {
        seen.set(key, { tri: k, a, b, c });
        edges.push(a < b ? [a, b] : [b, a]);
      } else if (other.a === b && other.b === a) {
        // The same edge the other way round: the two triangles wind alike.
        hinges.push({ a: other.a, b: other.b, c: other.c, d: c });
      }
    }
  });
  return { edges, hinges };
}
