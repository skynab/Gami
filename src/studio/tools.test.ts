import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import type { Op } from '../fold/ops';
import type { OrigamiModel } from '../fold/types';
import { fortuneTeller } from '../models/recipes/fortune-teller';
import { masuBox } from '../models/recipes/masu-box';
import { basics } from '../models/basics';
import { TAPE_WIDTH } from '../fold/tape';
import { stepFor, toolsFor } from './tools';

/** The model before step `i`, as Change loads a step. */
const before = (m: OrigamiModel, i: number): OrigamiModel => ({ ...m, steps: m.steps.slice(0, i) });

describe('loading a step into the tools', () => {
  it('sets a pop-up from its creases', () => {
    const m = fortuneTeller();
    const last = m.steps.length - 1;
    const tools = toolsFor(m.steps[last].op, before(m, last));
    expect(tools).toMatchObject({ action: 'popUp', rays: 8, steep: 60 });
    expect(tools.picks).toHaveLength(2);
  });

  it('keeps a crease-by-crease lift’s bends and its exact anchor', () => {
    const m = masuBox();
    const i = m.steps.findIndex((s) => s.op?.op === 'shape' && s.op.chained);
    const made = m.steps[i].op as Extract<Op, { op: 'shape' }>;
    const tools = toolsFor(made, before(m, i));
    expect(tools).toMatchObject({ action: 'lift', chained: true, corners: false });
    expect(tools.bends).toHaveLength(made.bends.length);
    expect(tools.anchorPick?.at).toEqual(made.chained);
  });

  it('sets a fold limited to picked faces, and leaves out what it can’t show', () => {
    const fold: Op = { op: 'fold', line: { onto: [{ paper: [0, 0.5] }, { paper: [0, -0.5] }] }, kind: 'mountain', only: { inPaper: [[[0, 0], [0.5, 0], [0.5, 0.5]]] } };
    expect(toolsFor(fold, before(basics, 0))).toMatchObject({ action: 'fold', kind: 'mountain', tool: 'onto', picked: [[[0, 0], [0.5, 0], [0.5, 0.5]]] });
    // A line given on the table has no picks to show.
    const onTable: Op = { op: 'fold', line: { line: { p: [0, 0], d: [1, 0] } } };
    expect(toolsFor(onTable, before(basics, 0)).picks).toBeUndefined();
    expect(toolsFor(undefined, before(basics, 0))).toEqual({ corners: false, chained: false });
  });

  it('sets tape from its two ends and its width', () => {
    const strip: Op = { op: 'tape', from: { paper: [-0.3, 0.1] }, to: { paper: [0.3, 0.1] }, width: 0.2 };
    const tools = toolsFor(strip, before(basics, 0));
    expect(tools).toMatchObject({ action: 'tape', tapeWidth: 0.2 });
    expect(tools.picks?.flat().map((n) => +n.toFixed(9))).toEqual([-0.3, 0.1, 0.3, 0.1]);
    expect(toolsFor({ ...strip, width: undefined }, before(basics, 0)).tapeWidth).toBe(TAPE_WIDTH);
    expect(stepFor(strip, ((key: string) => key) as unknown as TFunction)).toEqual({ title: 'studio.steps.tape', kind: 'tape' });
  });
});

describe('default step titles', () => {
  const t = ((key: string) => key) as unknown as TFunction;
  it('names a step after what it does, and a step of several parts after its first', () => {
    expect(stepFor({ op: 'turnOver' }, t)).toEqual({ title: 'studio.steps.turnOver', kind: 'turn-over' });
    const reverse: Op = { op: 'collapse', creases: [{ line: { line: { p: [0, 0], d: [1, 0] } }, kind: 'inside' }], anchor: { auto: true } };
    expect(stepFor(reverse, t)).toEqual({ title: 'studio.steps.inside', kind: 'reverse' });
    expect(stepFor({ op: 'together', ops: [reverse, { op: 'rotate', degrees: 90 }] }, t)).toEqual({ title: 'studio.steps.inside', kind: 'fold' });
  });
});
