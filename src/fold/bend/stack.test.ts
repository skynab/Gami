import { describe, expect, it } from 'vitest';
import { framesOf } from '../frames';
import { paper, Recipe } from '../recipe';
import type { FoldFrame, Vec3 } from '../types';
import { stackLifts } from './stack';

const sheet = { size: [1, 1] as [number, number], front: '#c33', back: '#eee' };

/**
 * A sheet folded in half, right half over left, and the top layer then bent a little, one corner lifted a few
 * layers' height, the fold staying shut: two layers still stacked on the table.
 */
const folded = new Recipe({ id: 'folded', title: 'Folded', sheet, card: 'finished' })
  .onto(paper(0.5, 0), paper(-0.5, 0), { title: 'Fold in half' })
  .bend({ title: 'Bend the top layer' }, { flex: ([u]) => u > 0, anchor: [-0.25, 0], goals: [{ point: { paper: [0.5, 0.5] }, to: [-0.5, 0.004, 0.5] }], mesh: 0.25 })
  .build();

const centre = (frame: FoldFrame, f: number) =>
  frame.faces_vertices[f].map((v) => frame.vertices_paper[v]).reduce((sum, q) => [sum[0] + q[0] / 3, sum[1] + q[1] / 3], [0, 0]);

describe('bent paper’s stacking, for drawing', () => {
  const k = folded.steps.length;
  const step = folded.steps[k - 1];
  const before = framesOf(folded)[k - 1];
  const parent = step.via![0].faces_parent!;

  it('never draws paper nearer than it is, only covered paper further back', () => {
    const lifts = stackLifts(before, parent, step.frame);
    expect(lifts.front).toHaveLength(step.frame.faces_vertices.length);
    for (const places of [...lifts.front, ...lifts.back]) expect(places).toBeLessThanOrEqual(0);
  });

  it('leaves the layer on show where it is, from either side, and puts the one under it a place back', () => {
    const lifts = stackLifts(before, parent, step.frame);
    step.frame.faces_vertices.forEach((_, f) => {
      const top = centre(step.frame, f)[0] > 0;
      // The right half was folded over, so it lies on top with its back up: seen from above, that's its back.
      const [fromAbove, fromBelow] = top ? [lifts.back[f], lifts.front[f]] : [lifts.front[f], lifts.back[f]];
      expect(fromAbove, `face ${f} from above`).toBe(top ? 0 : -1);
      expect(fromBelow, `face ${f} from below`).toBe(top ? -1 : 0);
      expect(lifts.layer[f]).toBe(top ? -1 : 0);
    });
  });

  it('counts only paper still stacked: layers that have come apart are each left where they are', () => {
    // The same triangles, the top layer lifted well clear of the bottom one.
    const lifted: FoldFrame = { ...step.frame, vertices_coords: step.frame.vertices_coords.map((p, v): Vec3 => (step.frame.vertices_paper[v][0] > 1e-9 ? [p[0], p[1] + 0.2, p[2]] : p)) };
    const moved = new Set(step.frame.faces_vertices.flatMap((_, f) => (centre(step.frame, f)[0] > 0 ? [f] : [])));
    // (Corners on the fold itself stay put, so only triangles clear of it count as lifted.)
    const clear = [...moved].filter((f) => step.frame.faces_vertices[f].every((v) => step.frame.vertices_paper[v][0] > 1e-9));
    expect(clear.length).toBeGreaterThan(0);
    const lifts = stackLifts(before, parent, lifted);
    for (const f of clear) expect([lifts.front[f], lifts.back[f]]).toEqual([0, 0]);
  });

  it('opened out flat, counts neither half of the fold against the other', () => {
    // The top layer turned right back over about the fold, so the sheet lies open: the halves face opposite ways
    // to how they were stacked.
    const open: FoldFrame = { ...step.frame, vertices_coords: step.frame.vertices_paper.map(([u, v]): Vec3 => [u, 0, v]) };
    const lifts = stackLifts(before, parent, open);
    expect(lifts.front.every((x) => x === 0) && lifts.back.every((x) => x === 0)).toBe(true);
  });
});
