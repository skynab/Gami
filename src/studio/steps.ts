import { replay, type Op, type Replay } from '../fold/ops';
import type { OrigamiModel, Step } from '../fold/types';

/**
 * Changing a model's steps in the middle: replacing, inserting or removing a step, then folding every step
 * after it again from its operation. A step with no operation (from an older file) can't be folded again,
 * so nothing before it can change.
 */

/** The last step with no operation, or -1. Steps after it can be changed; it can be replaced or removed. */
export function lastFixed(model: OrigamiModel): number {
  return model.steps.findLastIndex((s) => !s.op);
}

export const canReplace = (model: OrigamiModel, i: number) => i >= lastFixed(model);
export const canInsert = (model: OrigamiModel, i: number) => i > lastFixed(model);
export const canRemove = canReplace;

/** Puts `step` in place of step `i` (0-based) and folds the steps after it again. */
export function replaceStep(model: OrigamiModel, i: number, step: Step): Replay {
  return replay({ ...model, steps: model.steps.toSpliced(i, 1, step) }, i);
}

/** Puts `step` before step `i` (or at the end) and folds the steps after it again. */
export function insertStep(model: OrigamiModel, i: number, step: Step): Replay {
  // The paper after step k is now the paper after step k + 1, for every k from i + 1 on.
  const later = model.steps.slice(i).map((s) => withUnfoldsMoved(s, (to) => (to > i ? to + 1 : to)));
  return replay({ ...model, steps: [...model.steps.slice(0, i), step, ...later] }, i);
}

/** Takes out step `i` and folds the steps after it again. */
export function removeStep(model: OrigamiModel, i: number): Replay {
  // Unfolding to the paper after the removed step now unfolds to the paper before it.
  const later = model.steps.slice(i + 1).map((s) => withUnfoldsMoved(s, (to) => (to > i ? to - 1 : to)));
  return replay({ ...model, steps: [...model.steps.slice(0, i), ...later] }, i);
}

/** Keeps the steps before `i`, dropping the rest. */
export function removeFrom(model: OrigamiModel, i: number): OrigamiModel {
  return { ...model, steps: model.steps.slice(0, i) };
}

/** A step whose unfolds open to an earlier step by number, renumbered. */
function withUnfoldsMoved(step: Step, move: (to: number) => number): Step {
  return step.op ? { ...step, op: moveUnfolds(step.op, move) } : step;
}

function moveUnfolds(op: Op, move: (to: number) => number): Op {
  if (op.op === 'unfold' && op.to !== undefined) return { ...op, to: move(op.to) };
  if (op.op === 'together') return { ...op, ops: op.ops.map((o) => moveUnfolds(o, move)) };
  return op;
}
