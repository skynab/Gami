import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fromFoldFile, toFoldFile } from '../fold-format';
import { LAYER_GAP } from '../frames';
import { signedArea } from '../geometry2d';
import type { FoldFrame, OrigamiModel, Vec2, Vec3 } from '../types';
import { bendFrame, crumpleOf, meshFrame, type FrameMesh } from './frame';
import { topology } from './mesh';
import { paper, Recipe, table } from '../recipe';

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

  it('wraps a fold round the layers inside it, and leaves one round none where it is', () => {
    // Folded in half (right over left), then the stack's left quarter folded over onto it: the second fold joins
    // the bottom layer to the top one, round the two between them.
    const folded = new Recipe({ id: 'twice', title: 'Twice', sheet: { size: [1, 1], front: '#c33', back: '#eee' } })
      .onto(paper(0.5, 0.5), table(-0.5, 0.5), { title: 'Fold in half' })
      .onto(table(-0.5, 0.5), table(0, 0.5), { title: 'Fold the left quarter over' })
      .build()
      .steps.at(-1)!.frame;
    const mesh = meshFrame(folded, [], 0.25);
    const xs = (u: number) => mesh.paper.flatMap((q, v) => (Math.abs(q[0] - u) < 1e-9 ? [mesh.points[v][0]] : []));
    const outer = xs(-0.25);
    expect(outer.length).toBeGreaterThan(0);
    // Out past the stack's edge (it lies to the right of x = −0.25) by half the three gaps it goes round.
    for (const x of outer) expect(x).toBeCloseTo(-0.25 - 1.5 * LAYER_GAP, 9);
    // The first fold has nothing between its two layers: its points stay on the edge.
    const inner = xs(0);
    expect(inner.length).toBeGreaterThan(0);
    for (const x of inner) expect(Math.abs(x + 0.25) < 1e-9 || Math.abs(x) < 1e-9 || Math.abs(x + 0.5) < 1e-9).toBe(true);
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

  it('keeps the sheet’s shape where folds wrap round other layers, held beside one', { timeout: 20000 }, () => {
    // Folded twice, the second fold round the first's two layers: its points start out past the fold, a little off
    // the sheet's shape. With nothing asked of it, the paper takes the sheet's shape back before anything moves.
    const folded = new Recipe({ id: 'twice', title: 'Twice', sheet: { size: [1, 1], front: '#c33', back: '#eee' } })
      .onto(paper(0.5, 0.5), table(-0.5, 0.5), { title: 'Fold in half' })
      .onto(table(-0.5, 0.5), table(0, 0.5), { title: 'Fold the left quarter over' })
      .build()
      .steps.at(-1)!.frame;
    const still = bendFrame(folded, { flex: folded.faces_vertices.map((_, f) => f), anchor: [-0.27, 0.1], goals: [], mesh: 0.125 });
    // Within the 1% the model checks allow on the way, and closely at the end, after the last pass.
    const strain = (frame: FoldFrame) =>
      Math.max(...frame.faces_vertices.flatMap((t) => [0, 1, 2].map((e) => {
        const [a, b] = [t[e], t[(e + 1) % 3]];
        const want = dist(frame.vertices_paper[a], frame.vertices_paper[b]);
        return Math.abs(dist(frame.vertices_coords[a], frame.vertices_coords[b]) - want) / want;
      })));
    for (const frame of still.via) expect(strain(frame)).toBeLessThan(1e-2);
    expect(strain(still.frame)).toBeLessThan(2e-3);
  });

  it('puffs up paper with air blown in, resting on the table', { timeout: 30000 }, () => {
    // Folded in half: blown in between its layers, both puff out and the whole lifts to rest on the table.
    const folded = new Recipe({ id: 'puffed', title: 'Puffed', sheet: { size: [1, 1], front: '#c33', back: '#eee' } })
      .onto(paper(0.5, 0.5), table(-0.5, 0.5), { title: 'Fold in half' })
      .build()
      .steps.at(-1)!.frame;
    const puffed = bendFrame(folded, { flex: folded.faces_vertices.map((_, f) => f), anchor: [-0.25, 0], goals: [], mesh: 0.125, inflate: 0.01 });
    const { frame } = puffed;
    const ys = frame.vertices_coords.map((q) => q[1]);
    expect(Math.min(...ys)).toBeCloseTo(0, 9);
    // Well off the table, both layers out.
    expect(Math.max(...ys)).toBeGreaterThan(0.05);
    for (const t of frame.faces_vertices) {
      for (let e = 0; e < 3; e++) {
        const [a, b] = [t[e], t[(e + 1) % 3]];
        const want = dist(frame.vertices_paper[a], frame.vertices_paper[b]);
        expect(Math.abs(dist(frame.vertices_coords[a], frame.vertices_coords[b]) - want) / want).toBeLessThan(1e-2);
      }
    }
  });

  it('follows guides into a shape far from flat, keeping its lengths', { timeout: 20000 }, () => {
    // Rolled into half a tube about its left edge, a little more each stage: every stage's shape is the sheet's own,
    // so guided there, the paper follows unstretched. Nothing holds it but the guides.
    const rolled = ([u, v]: Vec2, share: number): Vec3 => {
      if (!share) return [u, 0, v];
      const radius = 1 / (Math.PI * share);
      const a = (u + 0.5) / radius;
      return [-0.5 + radius * Math.sin(a), radius * (1 - Math.cos(a)), v];
    };
    const guides = [-0.5, -1 / 3, -1 / 6, 0, 1 / 6, 1 / 3, 0.5].flatMap((u) => [-0.5, 0, 0.5].map((v): { paper: Vec2; path: Vec3[] } => ({ paper: [u, v], path: [1, 2, 3, 4, 5, 6].map((k) => rolled([u, v], k / 6)) })));
    const { frame, via } = bendFrame(flat, { flex: [0], anchor: [0, 0], goals: [], guides, mesh: 0.1, stages: 6 });
    expect(via).toHaveLength(5);
    frame.vertices_paper.forEach((p, v) => {
      const q = frame.vertices_coords[v];
      // Close to the roll, but for the far edge, which the guides pull round softly, so it trails a little: still
      // right over the near edge, and up by the top.
      if (p[0] < 0.4) expect(dist(q, rolled(p, 1))).toBeLessThan(0.015);
      else if (p[0] > 0.5 - 1e-9) expect([q[0] < -0.45, q[1] > 0.6]).toEqual([true, true]);
    });
    for (const f of [...via, frame]) {
      for (const t of f.faces_vertices) {
        for (let e = 0; e < 3; e++) {
          const [a, b] = [t[e], t[(e + 1) % 3]];
          const want = dist(f.vertices_paper[a], f.vertices_paper[b]);
          expect(Math.abs(dist(f.vertices_coords[a], f.vertices_coords[b]) - want) / want).toBeLessThan(1e-2);
        }
      }
    }
  });

  it('folds along lines it’s given, though no crease is there, the mesh cut along them', { timeout: 20000 }, () => {
    // The right of the sheet turned straight up about x = 0.1, which runs through the middle of the one face.
    const up = ([u, v]: Vec2, share: number): Vec3 => {
      const turn = (share * Math.PI) / 2;
      return u <= 0.1 ? [u, 0, v] : [0.1 + (u - 0.1) * Math.cos(turn), (u - 0.1) * Math.sin(turn), v];
    };
    const at = [-0.4, -0.2, 0, 0.05, 0.15, 0.25, 0.4];
    const guides = at.flatMap((u) => [-0.4, 0, 0.4].map((v): { paper: Vec2; path: Vec3[] } => ({ paper: [u, v], path: [1, 2, 3, 4].map((k) => up([u, v], k / 4)) })));
    const bend = (lines?: [Vec2, Vec2][]) => bendFrame(flat, { flex: [0], anchor: [0, 0], goals: [], guides, mesh: 0.15, stages: 4, ...(lines && { lines }) });
    // How far the paper ends from the fold's shape, at most.
    const off = (f: FoldFrame) => Math.max(...f.vertices_paper.map((p, v) => dist(f.vertices_coords[v], up(p, 1))));
    const along = bend([[[0.1, -1], [0.1, 1]]]);
    // The mesh has a line of points down x = 0.1, and every triangle still comes from the sheet's one face.
    expect(along.frame.vertices_paper.filter(([u]) => Math.abs(u - 0.1) < 1e-9).length).toBeGreaterThan(3);
    expect(new Set(along.via[0].faces_parent)).toEqual(new Set([0]));
    // Folding along it, the paper takes the fold's shape; without it, triangles across the line can't.
    expect(off(along.frame)).toBeLessThan(0.01);
    expect(off(bend().frame)).toBeGreaterThan(2 * off(along.frame));
  });

  it('lets paper crumple where it may: drawn in on the way, never stretched, and exact at the end', { timeout: 30000 }, () => {
    // The right of the sheet drawn in towards the left on the table and back out again. Paper that can't crumple
    // stays where it is, short of its guides; a strip down the middle that may crumple draws in to let it follow.
    const drawn = [0.05, 0.1, 0.05, 0];
    const guides = [-0.4, -0.2, 0.2, 0.3, 0.4].flatMap((u) => [-0.4, 0, 0.4].map((v): { paper: Vec2; path: Vec3[] } => ({ paper: [u, v], path: drawn.map((d): Vec3 => [u > 0 ? u - d : u, 0, v]) })));
    const strip: Vec2[][] = [[[-0.1, -1], [0.15, -1], [0.15, 1], [-0.1, 1]]];
    const sheet: FoldFrame = { ...flat, faces_layer: [0] };
    const bend = (crumple?: Vec2[][]) => bendFrame(sheet, { flex: [0], anchor: [0, 0], goals: [], guides, mesh: 0.1, stages: 4, ...(crumple && { crumple }) });
    const strains = (f: FoldFrame) =>
      f.faces_vertices.flatMap((t) => [0, 1, 2].map((e) => dist(f.vertices_coords[t[e]], f.vertices_coords[t[(e + 1) % 3]]) / dist(f.vertices_paper[t[e]], f.vertices_paper[t[(e + 1) % 3]]) - 1));
    const height = (f: FoldFrame) => Math.max(...f.vertices_coords.map((q) => q[1]));
    // How far the right edge is short of where the guides take it, drawn in furthest.
    const short = (f: FoldFrame) => Math.max(...f.vertices_coords.map((q) => q[0])) - 0.4;
    const crumpled = bend(strip);
    const middle = crumpled.via[1];
    for (const f of [...crumpled.via, crumpled.frame]) {
      expect(height(f)).toBeLessThan(0.01);
      expect(Math.max(...strains(f))).toBeLessThan(0.01);
    }
    expect(Math.min(...strains(middle))).toBeLessThan(-0.1);
    expect(Math.max(...strains(crumpled.frame).map(Math.abs))).toBeLessThan(1e-3);
    expect(short(middle)).toBeLessThan(0.025);
    expect(short(bend().via[1])).toBeGreaterThan(0.035);
    // The triangles that may crumple, found again from the frame before (as checking a model does): the strip's.
    const give = crumpleOf(sheet, crumpled.via[0], strip)!;
    const mids = middle.faces_vertices.map((t) => t.reduce((s, v) => s + middle.vertices_paper[v][0] / 3, 0));
    expect(give.some(Boolean)).toBe(true);
    give.forEach((g, k) => expect(g).toBe(mids[k] > -0.1 && mids[k] < 0.15));
  });

  it('can’t fold along lines unless the paper lies flat', () => {
    const tilted: FoldFrame = { ...flat, vertices_coords: flat.vertices_coords.map(([x, , z]): Vec3 => [x, x + 0.5, z]) };
    expect(() => bendFrame(tilted, { flex: [0], anchor: [0, 0], goals: [{ paper: [0.5, 0.5], to: [0.5, 1, 0.5] }], lines: [[[0, -1], [0, 1]]] })).toThrow(/flat/);
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
      // Bent paper's points are kept to 1e-5, the rest to 1e-9.
      a.vertices_coords.forEach((p, v) => expect(dist(p, b.vertices_coords[v])).toBeLessThan(1e-5));
      a.vertices_paper.forEach((p, v) => expect(dist(p, b.vertices_paper[v])).toBeLessThan(1e-8));
    };
    close(back.steps[0].frame, bent.frame);
    expect(back.steps[0].via).toHaveLength(bent.via.length);
    back.steps[0].via!.forEach((f, k) => close(f, bent.via[k]));
  });
});
