import { describe, expect, it } from 'vitest';
import { crossings } from '../collisions';
import { LAYER_GAP } from '../frames';
import { paper, Recipe, table } from '../recipe';
import { BENT_PLAY_STRAIN, BENT_STRAIN, bendStrain, problems } from '../validate';
import { solve } from './solver';

const sheet = { size: [1, 1] as [number, number], front: '#c33', back: '#eee' };

/** The right half of a creased sheet bent up, its corner pulled in, so the paper curves. */
const curled = () =>
  new Recipe({ id: 'curled', title: 'Curled', sheet })
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

/** A sheet folded in half, its top layer's corner then lifted off the layer beneath. */
const lifted = () =>
  new Recipe({ id: 'lifted', title: 'Lifted', sheet })
    .onto(paper(0.5, 0.5), table(-0.5, 0.5), { title: 'Fold in half' })
    .bend({ title: 'Lift the corner' }, { flex: ([u]) => u > 0, anchor: [-0.25, 0], goals: [{ point: { paper: [0.5, 0.5] }, to: [-0.3, 0.3, 0.3] }], mesh: 0.125 })
    .build();

describe('checking bent paper', () => {
  for (const [name, make] of [
    ['bent on the table', curled],
    ['lifted off a layer', lifted],
  ] as const) {
    it(`passes, ${name}: keeps its shape closely, stays on the table, and doesn't pass through itself`, { timeout: 20000 }, () => {
      const model = make();
      expect(problems(model)).toEqual([]);
      const { still, playing } = bendStrain(model, model.steps.length);
      expect(still).toBeLessThan(BENT_STRAIN);
      expect(playing).toBeLessThan(BENT_PLAY_STRAIN);
      for (const c of crossings(model)) expect(c.depth).toBeLessThan(LAYER_GAP);
    });
  }

  it('compares bending triangles with each other for passing through', { timeout: 20000 }, () => {
    // Every triangle of a bend shares one motion, yet they move apart: a pose that folds paper through itself is found.
    const model = curled();
    const k = model.steps.length;
    const step = model.steps[k - 1];
    // The bent half laid flat on the other half, mirrored across the crease with no gap: it passes into it on the way.
    const through = { ...step.frame, faces_parent: step.via![0].faces_parent, vertices_coords: step.frame.vertices_coords.map((p, v) => (step.frame.vertices_paper[v][0] > 0.05 ? ([-p[0] + 0.02, 0.0001, p[2]] as typeof p) : p)) };
    const broken = { ...model, steps: [...model.steps.slice(0, -1), { ...step, frame: through, via: [] }] };
    expect(crossings(broken).length).toBeGreaterThan(0);
  });

  it('keeps paper off the table', () => {
    // A strip pulled down at one end, below the table it lies on: it stops on the table.
    const points: [number, number, number][] = [
      [0, 0, 0],
      [0, 0, 0.1],
      [0.1, 0, 0],
      [0.1, 0, 0.1],
      [0.2, 0, 0],
      [0.2, 0, 0.1],
    ];
    const triangles: [number, number, number][] = [
      [0, 2, 1],
      [1, 2, 3],
      [2, 4, 3],
      [3, 4, 5],
    ];
    const { frames } = solve({ points, triangles, pinned: [0, 1], goals: [{ vertex: 4, to: [0.15, -0.1, 0] }], floor: 0, stages: 4 });
    for (const f of frames) for (const p of f) expect(p[1]).toBeGreaterThanOrEqual(0);
  });
});
