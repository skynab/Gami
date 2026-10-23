import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fromFoldFile, toFoldFile } from '../fold-format';
import { LAYER_GAP } from '../frames';
import { signedArea } from '../geometry2d';
import type { FoldFrame, OrigamiModel, Vec2, Vec3 } from '../types';
import { bendFrame, meshFrame, type FrameMesh } from './frame';
import { topology } from './mesh';

const crane = fromFoldFile(JSON.parse(readFileSync(new URL('../../../public/models/crane.fold', import.meta.url), 'utf8')));

/** A 1 × 1 sheet lying flat. */
const flat: FoldFrame = {
  vertices_coords: [
    [-0.5, 0, 0.5],
    [0.5, 0, 0.5],
    [0.5, 0, -0.5],
    [-0.5, 0, -0.5],
  ],
  vertices_paper: [
    [-0.5, 0.5],
    [0.5, 0.5],
    [0.5, -0.5],
    [-0.5, -0.5],
  ],
  faces_vertices: [[0, 1, 2, 3]],
};

/** The same sheet in two halves, left and right, joined down the middle unless cut there. */
const halves = (cut: boolean): FoldFrame => ({
  vertices_coords: [
    [-0.5, 0, 0.5],
    [0, 0, 0.5],
    [0.5, 0, 0.5],
    [0.5, 0, -0.5],
    [0, 0, -0.5],
    [-0.5, 0, -0.5],
  ],
  vertices_paper: [
    [-0.5, 0.5],
    [0, 0.5],
    [0.5, 0.5],
    [0.5, -0.5],
    [0, -0.5],
    [-0.5, -0.5],
  ],
  faces_vertices: [
    [0, 1, 4, 5],
    [1, 2, 3, 4],
  ],
  ...(cut && {
    cuts: [
      [
        [0, 0.5],
        [0, -0.5],
      ],
    ],
  }),
});

const dist = (a: number[], b: number[]) => Math.hypot(...a.map((x, i) => x - b[i]));
const area = (m: FrameMesh, t: number[]) => signedArea(t.map((v) => m.paper[v]));

/** The total length of edges only one triangle has: the paper's outline, and both sides of every cut. */
const outline = (m: FrameMesh) => {
  const count = new Map<string, number>();
  for (const t of m.triangles) {
    for (let e = 0; e < 3; e++) {
      const [a, b] = [t[e], t[(e + 1) % 3]];
      const key = a < b ? `${a},${b}` : `${b},${a}`;
      count.set(key, (count.get(key) ?? 0) + 1);
    }
  }
  let total = 0;
  for (const [key, n] of count) {
    expect(n).toBeLessThanOrEqual(2);
    if (n === 1) {
      const [a, b] = key.split(',').map(Number);
      total += dist(m.paper[a], m.paper[b]);
    }
  }
  return total;
};

describe('meshing a frame', () => {
  const frame = crane.steps[12].frame;
  const mesh = meshFrame(frame, [0, 1, 2], 0.05);

  it('fills every face with triangles wound as it is, the bending ones small', () => {
    frame.faces_vertices.forEach((face, f) => {
      const faceArea = signedArea(face.map((v) => frame.vertices_paper[v]));
      const mine = mesh.triangles.filter((_, k) => mesh.parent[k] === f);
      const areas = mine.map((t) => area(mesh, t));
      for (const a of areas) expect(Math.sign(a)).toBe(Math.sign(faceArea));
      expect(areas.reduce((s, a) => s + a, 0)).toBeCloseTo(faceArea, 12);
      const limit = f <= 2 ? 0.05 : 0.15;
      for (const t of mine) for (let e = 0; e < 3; e++) expect(dist(mesh.paper[t[e]], mesh.paper[t[(e + 1) % 3]])).toBeLessThanOrEqual(limit + 1e-9);
    });
  });

  it('joins the triangles edge to edge, with no seams but the sheet’s edge', () => {
    expect(outline(mesh)).toBeCloseTo(4, 9);
  });

  it('puts each triangle where its face is in 3D', () => {
    // Stacked faces meet a hair apart along creases, so their shared points move by up to a few layers' gap.
    for (const t of mesh.triangles) {
      for (let e = 0; e < 3; e++) {
        const [a, b] = [t[e], t[(e + 1) % 3]];
        expect(Math.abs(dist(mesh.points[a], mesh.points[b]) - dist(mesh.paper[a], mesh.paper[b]))).toBeLessThan(10 * LAYER_GAP);
      }
    }
  });

  it('keeps paper apart along a cut', () => {
    const joined = meshFrame(halves(false), [0, 1], 0.25);
    const cut = meshFrame(halves(true), [0, 1], 0.25);
    expect(outline(joined)).toBeCloseTo(4, 9);
    expect(outline(cut)).toBeCloseTo(6, 9);
    // The middle line's five points, twice over.
    expect(cut.paper.length - joined.paper.length).toBe(5);
  });
});

describe('bending a frame', () => {
  // A flat sheet held at its middle, two opposite corners lifted up and drawn in: it curls like a taco, about a
  // diagonal, each half a quarter of a circle.
  const goals: { paper: Vec2; to: Vec3 }[] = [
    { paper: [-0.5, -0.5], to: [-0.32, 0.45, -0.32] },
    { paper: [0.5, 0.5], to: [0.32, 0.45, 0.32] },
  ];
  const bent = bendFrame(flat, { flex: [0], anchor: [0, 0], goals, mesh: 0.1 });

  it('takes the corners to their goals, keeping every triangle its shape', () => {
    expect(bent.strain).toBeLessThan(1e-3);
    const { frame } = bent;
    for (const g of goals) {
      const v = frame.vertices_paper.findIndex((p) => dist(p, g.paper) < 1e-9);
      expect(dist(frame.vertices_coords[v], g.to)).toBeLessThan(1e-3);
    }
    for (const t of frame.faces_vertices) {
      for (let e = 0; e < 3; e++) {
        const [a, b] = [t[e], t[(e + 1) % 3]];
        const want = dist(frame.vertices_paper[a], frame.vertices_paper[b]);
        expect(Math.abs(dist(frame.vertices_coords[a], frame.vertices_coords[b]) - want) / want).toBeLessThan(1e-3);
      }
    }
  });

  it('never looks stretched on the way', () => {
    // Every in-between frame is played, so each keeps its triangles' shapes too: within 2%.
    for (const frame of bent.via) {
      for (const t of frame.faces_vertices) {
        for (let e = 0; e < 3; e++) {
          const [a, b] = [t[e], t[(e + 1) % 3]];
          const want = dist(frame.vertices_paper[a], frame.vertices_paper[b]);
          expect(Math.abs(dist(frame.vertices_coords[a], frame.vertices_coords[b]) - want) / want).toBeLessThan(2e-2);
        }
      }
    }
  });

  it('marks every edge inside the sheet soft, and points the first frame back at the sheet', () => {
    const { frame, via } = bent;
    expect(frame.soft).toHaveLength(topology(frame.faces_vertices as [number, number, number][]).hinges.length);
    expect(via[0].faces_parent).toEqual(frame.faces_vertices.map(() => 0));
    expect(frame.faces_parent).toBeUndefined();
    expect(via).toHaveLength(11);
  });

  it('keeps paper that isn’t allowed to bend flat', { timeout: 20000 }, () => {
    // Only the right half bends; the left is held.
    const two = halves(false);
    const { frame } = bendFrame(two, { flex: [1], anchor: [-0.25, 0], goals: [{ paper: [0.5, 0.5], to: [0.4, 0.3, 0.4] }], mesh: 0.1 });
    frame.vertices_paper.forEach((p, v) => {
      if (p[0] <= 1e-9) expect(dist(frame.vertices_coords[v], [p[0], 0, p[1]])).toBeLessThan(1e-9);
    });
  });

  it('round-trips through a .fold file', () => {
    const model: OrigamiModel = {
      id: 'taco',
      title: 'Taco',
      sheets: [{ size: [1, 1], front: '#c33', back: '#eee' }],
      start: flat,
      steps: [{ title: 'Curl it', frame: bent.frame, via: bent.via }],
    };
    const back = fromFoldFile(JSON.parse(JSON.stringify(toFoldFile(model))));
    const close = (a: FoldFrame, b: FoldFrame) => {
      expect(a.faces_vertices).toEqual(b.faces_vertices);
      expect(a.soft).toEqual(b.soft);
      expect(a.faces_parent).toEqual(b.faces_parent);
      a.vertices_coords.forEach((p, v) => expect(dist(p, b.vertices_coords[v])).toBeLessThan(1e-8));
      a.vertices_paper.forEach((p, v) => expect(dist(p, b.vertices_paper[v])).toBeLessThan(1e-8));
    };
    close(back.steps[0].frame, bent.frame);
    expect(back.steps[0].via).toHaveLength(bent.via.length);
    back.steps[0].via!.forEach((f, k) => close(f, bent.via[k]));
  });
});
