import { describe, expect, it } from 'vitest';
import type { Vec3 } from '../types';
import { gridMesh, topology, type Tri } from './mesh';
import { hingeAngle, hingeGradient, solve } from './solver';

/** The point index at column i, row j of a grid nx cells wide. */
const at = (nx: number) => (i: number, j: number) => j * (nx + 1) + i;

describe('bending meshes', () => {
  it('finds each edge once, and a hinge wherever two triangles share an edge', () => {
    const { triangles } = gridMesh(1, 1, 2, 2);
    const { edges, hinges } = topology(triangles);
    // A 2 × 2 grid of squares, each split in two: 12 sides of squares and 4 diagonals; every inner edge is a hinge.
    expect(edges).toHaveLength(16);
    expect(hinges).toHaveLength(16 - 8);
  });
});

describe('the fold angle', () => {
  const p: Vec3[] = [
    [0, 0, 0],
    [1, 0.1, 0],
    [0.4, 0.3, 0.9],
    [0.6, -0.5, -0.7],
  ];
  const h = { a: 0, b: 1, c: 2, d: 3 };

  it('is 0 lying flat and grows as the paper folds', () => {
    const flat: Vec3[] = [
      [0, 0, 0],
      [1, 0, 0],
      [0.5, 0, 1],
      [0.5, 0, -1],
    ];
    expect(hingeAngle(flat, h)).toBeCloseTo(0, 12);
    // The corner beyond the edge raised to 45°.
    const raised: Vec3[] = [...flat.slice(0, 3), [0.5, Math.SQRT1_2, -Math.SQRT1_2]];
    expect(Math.abs(hingeAngle(raised, h))).toBeCloseTo(Math.PI / 4, 12);
  });

  it('has the gradient finite differences give', () => {
    const g = hingeGradient(p, h);
    const eps = 1e-6;
    for (let i = 0; i < 4; i++) {
      for (let k = 0; k < 3; k++) {
        const plus = p.map((q) => [...q] as Vec3);
        const minus = p.map((q) => [...q] as Vec3);
        plus[i][k] += eps;
        minus[i][k] -= eps;
        expect(g[i][k]).toBeCloseTo((hingeAngle(plus, h) - hingeAngle(minus, h)) / (2 * eps), 6);
      }
    }
  });
});

describe('solving', () => {
  /** A strip 1 long and 0.2 wide, its left end held, its right end brought in to 0.64 from it: it arches. */
  const arch = () => {
    const nx = 20;
    const nz = 4;
    const { points: rest, triangles } = gridMesh(1, 0.2, nx, nz);
    const id = at(nx);
    // A hair of lift in the middle, so it arches up rather than down.
    const points = rest.map(([x, y, z]): Vec3 => [x, y + 0.001 * Math.sin(Math.PI * (x + 0.5)), z]);
    const ends = (i: number) => Array.from({ length: nz + 1 }, (_, j) => id(i, j));
    return solve({
      points,
      rest,
      triangles,
      pinned: ends(0),
      goals: ends(nx).map((v) => ({ vertex: v, to: [-0.5 + 0.64, 0, rest[v][2]] as Vec3 })),
    });
  };

  it('arches a strip brought in at one end, keeping every triangle its shape', () => {
    const { frames, strain } = arch();
    const final = frames.at(-1)!;
    // Within 0.2% of their length: on a 15 cm sheet, a third of a millimetre.
    expect(strain).toBeLessThan(2e-3);
    // The middle rises well clear of the table, and the right end reaches its goal.
    const top = Math.max(...final.map((q) => q[1]));
    expect(top).toBeGreaterThan(0.15);
    expect(Math.abs(final[at(20)(20, 2)][0] - 0.14)).toBeLessThan(2e-3);
    // Each stage is kept, rising in turn.
    expect(frames).toHaveLength(12);
    expect(Math.max(...frames[1].map((q) => q[1]))).toBeLessThan(top);
  });

  it('gives the same paper every time', () => {
    expect(arch()).toEqual(arch());
  });

  it('twists a strip whose far end turns a quarter turn about its length', () => {
    const nx = 20;
    const nz = 4;
    const { points, triangles } = gridMesh(1, 0.2, nx, nz);
    const id = at(nx);
    const ends = (i: number) => Array.from({ length: nz + 1 }, (_, j) => id(i, j));
    const { frames, strain } = solve({
      points,
      triangles,
      pinned: ends(0),
      // The far end stood on edge, a little nearer, as a twisted strip draws in.
      goals: ends(nx).map((v) => ({ vertex: v, to: [0.49, points[v][2], 0] as Vec3 })),
    });
    const final = frames.at(-1)!;
    const end = ends(nx).map((v) => final[v]);
    expect(strain).toBeLessThan(1e-2);
    // The far end stands up (its width now runs up and down), and the paper stays one piece in between.
    expect(Math.max(...end.map((q) => q[1])) - Math.min(...end.map((q) => q[1]))).toBeGreaterThan(0.18);
    expect(Math.max(...end.map((q) => Math.abs(q[2])))).toBeLessThan(0.02);
  });

  it('keeps a sheet pushed down onto another from passing through it', () => {
    const gap = 0.01;
    const below = gridMesh(0.6, 0.6, 6, 6);
    const above = gridMesh(0.4, 0.4, 4, 4, [0, gap, 0]);
    const offset = below.points.length;
    const triangles: Tri[] = [...below.triangles, ...above.triangles.map((t) => t.map((v) => v + offset) as Tri)];
    const points = [...below.points, ...above.points];
    const middle = offset + 2 * 5 + 2;
    const { frames } = solve({
      points,
      triangles,
      pinned: below.points.map((_, v) => v),
      goals: [{ vertex: middle, to: [0, -0.1, 0], compliance: 1e-4 }],
      thickness: gap,
    });
    // The sheet below stays put, and every point of the one above stays at least about a gap over it, all the way.
    for (const frame of frames) {
      expect(frame.slice(0, offset)).toEqual(below.points);
      expect(Math.min(...frame.slice(offset).map((q) => q[1]))).toBeGreaterThan(gap * 0.9);
    }
  });
});
