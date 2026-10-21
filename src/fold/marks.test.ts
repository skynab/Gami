import { describe, expect, it } from 'vitest';
import { fromFoldFile, toFoldFile } from './fold-format';
import { marksUpTo, onFace } from './marks';
import { replay } from './ops';
import { paper, Recipe } from './recipe';
import type { OrigamiModel, Vec2 } from './types';

/** A square folded in half, with a line drawn across the fold's edge and a dot on the top layer. */
function drawn(): OrigamiModel {
  return new Recipe({ id: 'drawn', title: 'Drawn', sheet: { size: [1, 1], front: '#ffffff', back: '#000000' } })
    .onto(paper(-0.5, 0), paper(0.5, 0), { title: 'Fold in half' })
    .draw({ title: 'Draw', text: 'Draw a line and a dot.' }, [
      { line: [[0.1, -0.3], [0.4, -0.3]] },
      { fill: [[0.2, 0.2], [0.3, 0.2], [0.25, 0.3]] },
    ])
    .build();
}

/** Through JSON, as a file is saved and opened. */
const throughFile = (model: OrigamiModel, change: (file: Record<string, unknown>) => void = () => {}, warnings: string[] = []) => {
  const file = JSON.parse(JSON.stringify(toFoldFile(model)));
  change(file);
  return fromFoldFile(file, warnings);
};

describe('marks drawn on the paper', () => {
  it('are kept with their step, on the side of the paper facing up', () => {
    const model = drawn();
    const step = model.steps[1];
    expect(step.kind).toBe('draw');
    expect(step.marks).toHaveLength(2);
    // Folded left over right, the top layer is the left half, turned over: its back faces up.
    expect(step.marks!.every((m) => m.side === 'back')).toBe(true);
    expect(step.op).toEqual({ op: 'draw', marks: step.marks });
    // The paper doesn't move.
    expect(step.frame.vertices_coords).toEqual(model.steps[0].frame.vertices_coords);
    expect(marksUpTo(model, 1)).toEqual([]);
    expect(marksUpTo(model, 2).map((m) => m.step)).toEqual([2, 2]);
  });

  it('go through a .fold file and back', () => {
    const model = drawn();
    const warnings: string[] = [];
    const read = throughFile(model, undefined, warnings);
    expect(warnings).toEqual([]);
    expect(read.steps[1].marks).toEqual(model.steps[1].marks);
    expect(read.steps[1].op).toEqual(model.steps[1].op);
    expect(read.steps[1].kind).toBe('draw');
  });

  it('stay with their step when its operations can’t be read', () => {
    // Saved by a newer Gami: the operations are left out, but the drawing is part of the step.
    const warnings: string[] = [];
    const read = throughFile(drawn(), (f) => (f['gami:ops'] = 999), warnings);
    expect(warnings).toHaveLength(1);
    expect(read.steps[1].op).toBeUndefined();
    expect(read.steps[1].marks).toEqual(drawn().steps[1].marks);
  });

  it('that aren’t well formed are left out, with a warning, and the rest of the file still opens', () => {
    for (const bad of [[{ side: 'top', points: [[0, 0], [1, 1]] }], [{ side: 'front', points: [[0, 0]] }], [{ side: 'front', points: [[0, 0], [1, 0]], fill: true }], 'lines']) {
      const warnings: string[] = [];
      const read = throughFile(drawn(), (f) => ((f.file_frames as Record<string, unknown>[])[1]['gami:marks'] = bad), warnings);
      expect(warnings.length, JSON.stringify(bad)).toBeGreaterThan(0);
      expect(read.steps[1].marks).toBeUndefined();
      expect(read.steps).toHaveLength(2);
    }
  });

  it('are drawn again when the model is folded again from its operations', () => {
    const model = drawn();
    // Even if the step had lost its marks, its operation draws them again.
    const stripped = { ...model, steps: model.steps.map(({ marks: _, ...s }) => s) };
    const { model: again, status } = replay(stripped);
    expect(status).toEqual(['replayed', 'replayed']);
    expect(again.steps[1].marks).toEqual(model.steps[1].marks);
  });

  it('drawn as part of a step of several operations are kept together', () => {
    const model = new Recipe({ id: 'both', title: 'Both', sheet: { size: [1, 1], front: '#ffffff', back: '#000000' } })
      .together({ title: 'Fold and draw' }, (r) => {
        r.onto(paper(-0.5, 0), paper(0.5, 0), { title: '' }).draw({ title: '' }, [{ line: [[0.1, 0], [0.4, 0]] }]);
      })
      .build();
    expect(model.steps).toHaveLength(1);
    expect(model.steps[0].marks).toHaveLength(1);
    expect(replay(model).model.steps[0].marks).toEqual(model.steps[0].marks);
    expect(throughFile(model).steps[0].marks).toEqual(model.steps[0].marks);
  });

  it('are cut into their parts on each face, so a line across a crease follows the paper on either side', () => {
    const left: Vec2[] = [[-0.5, -0.5], [0, -0.5], [0, 0.5], [-0.5, 0.5]];
    const right: Vec2[] = [[0, -0.5], [0.5, -0.5], [0.5, 0.5], [0, 0.5]];
    const line = { side: 'front' as const, points: [[-0.2, 0], [0.2, 0.1]] as Vec2[] };
    const [onLeft] = onFace(line, left);
    const [onRight] = onFace(line, right);
    expect(onLeft[0]).toEqual([-0.2, 0]);
    expect(onLeft[1][0]).toBeCloseTo(0);
    expect(onLeft[1][1]).toBeCloseTo(0.05);
    expect(onRight[0][0]).toBeCloseTo(0);
    expect(onRight[1]).toEqual([0.2, 0.1]);
    // A fill is cut to the face's outline; a mark that misses a face has no part on it.
    const dot = { side: 'front' as const, points: [[-0.1, -0.1], [0.1, -0.1], [0.1, 0.1], [-0.1, 0.1]] as Vec2[], fill: true };
    const [cut] = onFace(dot, right);
    expect(Math.max(...cut.map((p) => p[0]))).toBeCloseTo(0.1);
    expect(Math.min(...cut.map((p) => p[0]))).toBeCloseTo(0);
    expect(onFace({ side: 'front', points: [[0.3, 0], [0.4, 0]] }, left)).toEqual([]);
  });

  it('can be drawn only where there’s paper', () => {
    const r = new Recipe({ id: 'off', title: 'Off', sheet: { size: [1, 1], front: '#ffffff', back: '#000000' } });
    expect(() => r.draw({ title: 'Draw' }, [{ line: [[2, 2], [3, 3]] }])).toThrow(/no paper/);
  });
});
