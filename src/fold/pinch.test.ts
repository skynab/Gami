import { describe, expect, it } from 'vitest';
import { fromFoldFile, toFoldFile } from './fold-format';
import { applyOp, replay } from './ops';
import { drawnParts, foldLines, merged, onFoldLine, unpressed } from './pinch';
import { paper, Recipe, table } from './recipe';
import { fromAbove } from './thumbnail';
import type { OrigamiModel, Vec2 } from './types';

const sheet = { size: [1, 1] as [number, number], front: '#ffffff', back: '#000000' };

/** A square folded in half, left onto right, pinched only at the top edge, and opened again. */
function pinched() {
  return new Recipe({ id: 'pinched', title: 'Pinched', sheet })
    .onto(paper(-0.5, 0), paper(0.5, 0), { title: 'Fold in half' })
    .unfold({ title: 'Pinch', text: 'Pinch at the top edge, and unfold.', pinch: [table(0, -0.5), table(0, -0.4)] });
}

const near = (segments: [Vec2, Vec2][] | undefined) => (segments ?? []).map((s) => s.map((p) => p.map((n) => +n.toFixed(6) || 0)).sort((a, b) => a[1] - b[1]));

describe('pinches', () => {
  it('leave the fold line uncreased but for the pinch', () => {
    const model = pinched().build();
    const open = model.steps[1].frame;
    expect(near(open.uncreased)).toEqual([[[0, -0.4], [0, 0.5]]]);
    expect(model.steps[1].op).toEqual({ op: 'unfold', pinch: [[0, -0.5], [0, -0.4]] });
    // The paper is split along the whole line, as for any crease: only the drawing differs.
    expect(open.faces_vertices).toHaveLength(2);
    const parts = drawnParts(open);
    expect(parts([0, -0.5], [0, 0.5]).map((p) => p.map((n) => +n.toFixed(6)))).toEqual([[0, 0.1]]);
    expect(parts([0.5, -0.5], [0.5, 0.5])).toEqual([[0, 1]]);
  });

  it('are kept through a file and folded again from their operation', () => {
    const model = pinched().build();
    const again = fromFoldFile(JSON.parse(JSON.stringify(toFoldFile(model))));
    expect(near(again.steps[1].frame.uncreased)).toEqual(near(model.steps[1].frame.uncreased));
    const { model: replayed, status } = replay(again);
    expect(status).toEqual(['replayed', 'replayed']);
    expect(near(replayed.steps[1].frame.uncreased)).toEqual(near(model.steps[1].frame.uncreased));
  });

  it('stay through folds that cross them, and crease where a later fold presses them', () => {
    const r = pinched().onto(paper(0, 0.5), paper(0, -0.5), { title: 'Fold up' });
    // Folded across the pinch's line, the paper either side of it still lies the same way: still uncreased.
    expect(near(r.current.uncreased)).toEqual([[[0, -0.4], [0, 0.5]]]);
    r.unfold().onto(paper(-0.5, 0), paper(0.5, 0), { title: 'Fold in half again' });
    // Folded along it, it's pressed, and stays a crease once opened.
    expect(r.current.uncreased).toBeUndefined();
    expect(r.unfold().current.uncreased).toBeUndefined();
  });

  it('crease only the stretch a later fold presses', () => {
    // Cut across the middle, then the top piece folded along the pinch's line: the bottom piece's stretch stays.
    const r = pinched().cut(table(-0.6, 0), table(0.6, 0), { title: 'Cut across' });
    r.onto(paper(-0.5, -0.25), paper(0.5, -0.25), { title: 'Fold the top over', only: ([, v]) => v < 0 });
    expect(near(r.current.uncreased)).toEqual([[[0, 0], [0, 0.5]]]);
    expect(unpressed([[[0, -1], [0, 1]]], new Recipe({ id: 'flat', title: 'Flat', sheet }).build().start)).toEqual([[[0, -1], [0, 1]]]);
  });

  it('join up when they meet on one line', () => {
    expect(near(merged([[[0, 0], [0, 0.2]], [[0, 0.1], [0, 0.4]], [[1, 0], [1, 1]]]))).toEqual([[[0, 0], [0, 0.4]], [[1, 0], [1, 1]]]);
  });

  it('are drawn only where pressed on the card', () => {
    const model: OrigamiModel = pinched().build();
    const { body } = fromAbove(model, model.steps[1].frame);
    // Each half's outline is drawn edge by edge, its edge on the fold only as far as the pinch.
    const onFold = [...body.matchAll(/M0,(-?[\d.]+)L0,(-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])].sort((a, b) => a - b));
    expect(onFold).toEqual([[-0.5, -0.4], [-0.5, -0.4]]);
  });

  it('can be pressed along the folds an unfold opens, picked near them', () => {
    const r = new Recipe({ id: 'x', title: 'X', sheet }).onto(paper(-0.5, 0), paper(0.5, 0), { title: 'Fold' });
    const model = r.build();
    const open = applyOp(model, { op: 'unfold' }).frame;
    const lines = foldLines([model.start, ...model.steps.map((s) => s.frame)], 0, open);
    expect(near(lines)).toEqual([[[0, -0.5], [0, 0.5]]]);
    // Each point goes onto the line nearest the first, kept within it.
    expect(onFoldLine(lines, [[0.04, -0.45], [0.1, -0.7]])?.map((p) => p.map((n) => +n.toFixed(9) || 0))).toEqual([[0, -0.45], [0, -0.5]]);
    expect(onFoldLine([], [[0, 0]])).toBeNull();
  });

  it('can be replayed from a hand-written operation', () => {
    const r = new Recipe({ id: 'x', title: 'X', sheet }).onto(paper(-0.5, 0), paper(0.5, 0), { title: 'Fold' });
    const model = r.build();
    const step = applyOp(model, { op: 'unfold', pinch: [[0, 0.5], [0, 0.3]] });
    expect(near(step.frame.uncreased)).toEqual([[[0, -0.5], [0, 0.3]]]);
  });
});
