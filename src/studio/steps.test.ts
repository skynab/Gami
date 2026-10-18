import { describe, expect, it } from 'vitest';
import { applyOp, type Op } from '../fold/ops';
import { paper, Recipe, table } from '../fold/recipe';
import type { OrigamiModel, Step } from '../fold/types';
import { canInsert, canReplace, insertStep, removeFrom, removeStep, replaceStep } from './steps';

const square = { size: [1, 1] as [number, number], front: '#000', back: '#fff' };

/** Fold in half, fold a corner, open both back to the half, open everything. */
function model(): OrigamiModel {
  const r = new Recipe({ id: 't', title: 't', sheet: square });
  const start = r.mark();
  r.onto(paper(0, 0.5), paper(0, -0.5), { title: 'Half' });
  const half = r.mark();
  return r
    .onto(paper(-0.5, -0.5), table(0, 0), { title: 'Corner' })
    .unfold({ title: 'Open the corner', to: half })
    .unfold({ title: 'Open it all', to: start })
    .build();
}

const step = (m: OrigamiModel, at: number, title: string, op: Op): Step => ({
  title,
  kind: 'fold',
  op,
  frame: applyOp({ ...m, steps: m.steps.slice(0, at) }, op).frame,
});

describe('changing steps in the middle', () => {
  it('folds the later steps again after replacing one', () => {
    const m = model();
    const other: Op = { op: 'fold', line: { onto: [{ paper: [-0.5, -0.5] }, { table: [-0.1, 0] }] } };
    const { model: next, status, error } = replaceStep(m, 1, step(m, 1, 'Corner', other));
    expect(error).toBeUndefined();
    expect(status).toEqual(['kept', 'replayed', 'replayed', 'replayed']);
    expect(next.steps[1].frame).not.toEqual(m.steps[1].frame);
    // Opening the corner still gets back to the folded half: the paper lies between the top edge and the middle.
    expect(Math.max(...next.steps[2].frame.vertices_coords.map((p) => p[2]))).toBeCloseTo(0);
  });

  it('renumbers unfolds after an inserted step', () => {
    const m = model();
    const { model: next, status } = insertStep(m, 0, { ...step(m, 0, 'Turn over', { op: 'turnOver' }), kind: 'turn-over' });
    expect(status).toEqual(['replayed', 'replayed', 'replayed', 'replayed', 'replayed']);
    // Opening the corner goes back to the half, now the paper after step 2.
    expect(next.steps.map((s) => s.op?.op === 'unfold' && s.op.to)).toEqual([false, false, false, 2, 0]);
  });

  it('renumbers unfolds after a removed step', () => {
    const { model: next, status } = removeStep(model(), 0);
    // Opening the corner now opens to the start, the paper before the removed half.
    expect(next.steps.map((s) => s.op?.op === 'unfold' && s.op.to)).toEqual([false, 0, 0]);
    expect(status).toEqual(['replayed', 'replayed', 'replayed']);
  });

  it('stops where a step no longer works', () => {
    const m = model();
    // Without the corner, there's nothing to open back to the half.
    const { model: next, status, error } = removeStep(m, 1);
    expect(status).toEqual(['kept', 'failed', 'skipped']);
    expect(error?.step).toBe(2);
    expect(next.steps[1]).toEqual(m.steps[2]);
  });

  it('can drop every step from one on', () => {
    expect(removeFrom(model(), 2).steps.map((s) => s.title)).toEqual(['Half', 'Corner']);
  });

  it('only changes steps after the last one with no operation', () => {
    const m = model();
    delete m.steps[1].op;
    expect([0, 1, 2].map((i) => canReplace(m, i))).toEqual([false, true, true]);
    expect([0, 1, 2].map((i) => canInsert(m, i))).toEqual([false, false, true]);
  });
});
