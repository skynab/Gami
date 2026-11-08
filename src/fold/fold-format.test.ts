import { describe, expect, it } from 'vitest';
import { basics } from '../models/basics';
import { fromFoldFile, toFoldFile } from './fold-format';
import { paper, Recipe } from './recipe';

describe('.fold files', () => {
  it('round-trips a model through JSON', () => {
    const json = JSON.stringify(toFoldFile(basics));
    // Through JSON, so −0 in the source compares equal to the 0 the file stores.
    expect(fromFoldFile(JSON.parse(json))).toEqual(JSON.parse(JSON.stringify(basics)));
  });

  it('uses standard FOLD fields for the geometry', () => {
    const file = toFoldFile(basics);
    expect(file.file_frames).toHaveLength(basics.steps.length);
    expect(file.file_frames[0].frame_title).toBe(basics.steps[0].title);
    expect(file.vertices_coords[0]).toHaveLength(3);
  });

  it('rejects files from other tools', () => {
    expect(() => fromFoldFile({ file_spec: 1.1, vertices_coords: [] } as never)).toThrow();
  });
});

describe('bent paper in .fold files', () => {
  const round6 = (x: number) => Math.round(x * 1e6) / 1e6 || 0;
  /** A sheet creased down the middle, its right half turned up by guides, and a pinch of off-grid path in one. */
  const make = (offGrid = false) =>
    new Recipe({ id: 'bent', title: 'Bent', sheet: { size: [1, 1], front: '#c33', back: '#eee' } })
      .crease(paper(-0.5, 0), paper(0.5, 0), { title: 'Crease down the middle' })
      .bend(
        { title: 'Turn the right half up' },
        {
          flex: ([u]) => u > 0,
          anchor: [-0.25, 0],
          goals: [0.15, 0.35].flatMap((u) =>
            [-0.25, 0.25].map((v) => ({
              guide: { paper: [u, v] as [number, number] },
              path: [1, 2, 3, 4].map((k): [number, number, number] => {
                const turn = (k / 4) * (Math.PI / 3);
                return [round6(u * Math.cos(turn)) + (offGrid ? 1e-8 : 0), round6(u * Math.sin(turn)), v];
              }),
            })),
          ),
          mesh: 0.125,
          stages: 4,
        },
      )
      .build();
  const model = make();
  const file = JSON.parse(JSON.stringify(toFoldFile(model)));
  const step = model.steps.at(-1)!;
  const written = file.file_frames.at(-1);
  const read = fromFoldFile(file);

  it('writes the frames a bend passes through as moves, and reads them back with the step’s triangles', () => {
    expect(written['gami:via']).toHaveLength(step.via!.length);
    for (const v of written['gami:via']) {
      expect(Object.keys(v).sort()).toEqual(v['gami:faces_parent'] ? ['gami:faces_parent', 'gami:moves'] : ['gami:moves']);
      expect(v['gami:moves']).toHaveLength(3 * step.frame.vertices_coords.length);
    }
    const back = read.steps.at(-1)!;
    back.via!.forEach((f, n) => {
      expect(f.faces_vertices).toEqual(step.frame.faces_vertices);
      expect(f.vertices_paper).toEqual(back.frame.vertices_paper);
      expect(f.soft).toEqual(step.frame.soft);
      expect(f.faces_parent).toEqual(step.via![n].faces_parent);
      // To within the 1e-5 bent paper is kept to.
      f.vertices_coords.forEach((p, v) => expect(Math.hypot(...p.map((x, c) => x - step.via![n].vertices_coords[v][c]))).toBeLessThan(1e-5));
    });
  });

  it('writes guides’ paths as moves, and reads them back exactly', () => {
    const goals = written['gami:op'].goals;
    expect(goals.every((g: object) => 'gami:path' in g && !('path' in g))).toBe(true);
    expect(read.steps.at(-1)!.op).toEqual(JSON.parse(JSON.stringify(step.op)));
  });

  it('leaves paths that aren’t whole millionths as they are', () => {
    const off = make(true);
    const goals = JSON.parse(JSON.stringify(toFoldFile(off))).file_frames.at(-1)['gami:op'].goals;
    expect(goals.every((g: object) => 'path' in g && !('gami:path' in g))).toBe(true);
  });

  it('still reads frames written whole, as files did before', () => {
    const whole = JSON.parse(JSON.stringify(file));
    whole.file_frames.at(-1)['gami:via'] = step.via!.map((f) => ({
      vertices_coords: f.vertices_coords,
      faces_vertices: f.faces_vertices,
      'gami:vertices_paper': f.vertices_paper,
      ...(f.faces_parent && { 'gami:faces_parent': f.faces_parent }),
      'gami:soft': f.soft,
    }));
    const back = fromFoldFile(whole).steps.at(-1)!;
    back.via!.forEach((f, n) => expect(f.vertices_coords).toEqual(step.via![n].vertices_coords));
  });

  it('plays straight to the end when the moves are wrong, and says so', () => {
    const broken = JSON.parse(JSON.stringify(file));
    broken.file_frames.at(-1)['gami:via'][1]['gami:moves'].pop();
    const warnings: string[] = [];
    const back = fromFoldFile(broken, warnings).steps.at(-1)!;
    expect(back.via).toBeUndefined();
    expect(warnings).toHaveLength(1);
  });
});
