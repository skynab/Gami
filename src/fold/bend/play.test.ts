import { describe, expect, it } from 'vitest';
import { poseAt, stepTransition } from '../animate';
import { guidesFor } from '../guides';
import { paper, Recipe } from '../recipe';
import { thumbnailSvg } from '../thumbnail';
import type { Vec3 } from '../types';

const sheet = { size: [1, 1] as [number, number], front: '#c33', back: '#eee' };

/** A sheet creased down the middle, its right half then bent up with its corner pulled in, so the paper curves. */
const model = new Recipe({ id: 'bent', title: 'Bent', sheet, card: 'finished' })
  .crease(paper(-0.5, 0), paper(0.5, 0), { title: 'Crease down the middle' })
  .bend(
    { title: 'Bend the right half' },
    {
      flex: ([u]) => u > 0,
      anchor: [-0.25, 0],
      goals: [{ crease: [[0, -0.5], [0, 0.5]], degrees: 60 }, { point: { paper: [0.5, 0.5] }, to: [0.2, 0.4, 0.3] }],
      mesh: 0.125,
    },
  )
  .build();
const k = model.steps.length;
const step = model.steps[k - 1];
const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('playing a bend', () => {
  const t = stepTransition(model, k);

  it('keeps the triangles joined all the way', () => {
    for (let i = 1; i < 40; i++) {
      const at = new Map<number, Vec3>();
      poseAt(t, i / 40).forEach((pts, f) =>
        pts.forEach((p, c) => {
          const v = step.frame.faces_vertices[f][c];
          const seen = at.get(v);
          if (seen) expect(dist(p, seen)).toBeLessThan(1e-9);
          else at.set(v, p);
        }),
      );
    }
  });

  it('barely stretches the paper between the frames it passes through', () => {
    let worst = 0;
    for (let i = 0; i <= 120; i++) {
      poseAt(t, i / 120).forEach((pts, f) =>
        pts.forEach((p, c) => {
          const [a, b] = [t.faces[f].paper[c], t.faces[f].paper[(c + 1) % pts.length]];
          worst = Math.max(worst, Math.abs(dist(p, pts[(c + 1) % pts.length]) / Math.hypot(a[0] - b[0], a[1] - b[1]) - 1));
        }),
      );
    }
    // The baked frames are within 1%; one small triangle by the pulled corner turns a long way in the last stretch.
    expect(worst).toBeLessThan(0.05);
  });

  it('ends where the bent frame is', () => {
    poseAt(t, 1).forEach((pts, f) => pts.forEach((p, c) => expect(dist(p, step.frame.vertices_coords[step.frame.faces_vertices[f][c]] as Vec3)).toBeLessThan(1e-9)));
  });

  it('shows an arrow along the way the furthest corner goes, and no crease', () => {
    const g = guidesFor(model.steps[k - 2].frame, step.frame, step.via);
    expect(g.creases).toHaveLength(0);
    expect(g.arrows).toHaveLength(1);
    // The pulled corner, from its place on the table to its goal.
    expect(dist(g.arrows[0].from, [0.5, 0, 0.5])).toBeLessThan(0.02);
    expect(dist(g.arrows[0].to, [0.2, 0.4, 0.3])).toBeLessThan(0.02);
  });

  it('draws no lines on the card between the triangles', () => {
    const svg = thumbnailSvg(model);
    const lines = (svg.match(/<path d="[^"]*"/g) ?? []).join('').match(/M/g)?.length ?? 0;
    // Outlined triangles are filled in their own colour; only the sheet's outline and its crease get lines.
    expect(svg.match(/<polygon/g)!.length).toBe(step.frame.faces_vertices.length);
    expect(lines).toBeLessThan(step.frame.faces_vertices.length);
    expect(lines).toBeGreaterThan(0);
  });
});
