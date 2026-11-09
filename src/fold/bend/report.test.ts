import { describe, expect, it } from 'vitest';
import { paper, Recipe } from '../recipe';
import type { OrigamiModel, Vec2, Vec3 } from '../types';
import { bendReport, describeBend } from './report';

const sheet = { size: [1, 1] as [number, number], front: '#c33', back: '#eee' };
const STAGES = 6;
const round6 = (x: number) => Math.round(x * 1e6) / 1e6 || 0;

/**
 * A sheet creased down the middle, its right half turned up about the crease by its guides, a sixth of 60° a stage:
 * a path the paper can follow exactly.
 */
const guided = (): OrigamiModel =>
  new Recipe({ id: 'guided', title: 'Guided', sheet })
    .crease(paper(-0.5, 0), paper(0.5, 0), { title: 'Crease down the middle' })
    .bend(
      { title: 'Turn the right half up' },
      {
        flex: ([u]) => u > 0,
        anchor: [-0.25, 0],
        goals: [0.1, 0.25, 0.4].flatMap((u) =>
          [-0.3, 0, 0.3].map((v) => ({
            guide: { paper: [u, v] as Vec2 },
            path: Array.from({ length: STAGES }, (_, k): Vec3 => {
              const turn = (((k + 1) / STAGES) * Math.PI) / 3;
              return [u * Math.cos(turn), u * Math.sin(turn), v].map(round6) as Vec3;
            }),
          })),
        ),
        mesh: 0.125,
        stages: STAGES,
      },
    )
    .build();

describe('a report on a bent step', () => {
  const model = guided();
  const k = model.steps.length;
  const report = bendReport(model, k, { samples: 6 });

  it('finds a path followed smoothly: little stretch, small turns, close to its guides, nothing through anything', () => {
    expect(report.step).toBe(k);
    expect(report.frames).toBe(STAGES);
    expect(report.still.strain).toBeLessThan(0.01);
    expect(report.playing.strain).toBeLessThan(0.05);
    // Each stage turns the half 10°.
    expect(report.turns.degrees).toBeLessThan(20);
    expect(report.turns.over45).toBe(0);
    expect(report.guides!.stages.map((s) => s.stage)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(report.guides!.lag).toBeLessThan(0.01);
    expect(report.crossing.depth).toBe(0);
    expect(report.bytes).toBeGreaterThan(0);
  });

  it('finds paper that turns right over between two frames, and where', () => {
    // The third frame's right half swung right over, under the table, and back for the next.
    const step = model.steps[k - 1];
    const over = ([x, y, z]: Vec3): Vec3 => (x > 1e-9 ? [-x, -y, z] : [x, y, z]);
    const via = step.via!.map((f, n) => (n === 2 ? { ...f, vertices_coords: f.vertices_coords.map(over) } : f));
    const snapped: OrigamiModel = { ...model, steps: [...model.steps.slice(0, -1), { ...step, via }] };
    const r = bendReport(snapped, k, { samples: 6 });
    expect(r.turns.degrees).toBeGreaterThan(90);
    expect(r.turns.over90).toBeGreaterThan(0);
    expect(r.turns.frames[1] === 2 || r.turns.frames[0] === 2).toBe(true);
    // On the half that bends.
    expect(r.turns.at[0]).toBeGreaterThan(0);
  });

  it('reads as lines, one for each measure', () => {
    const lines = describeBend(report);
    expect(lines[0]).toMatch(/^Step \d+: \d+ triangles, 6 frames/);
    expect(lines.some((l) => l.includes('behind its guides'))).toBe(true);
    expect(lines).toHaveLength(6);
  });
});
