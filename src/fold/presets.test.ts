import { describe, expect, it } from 'vitest';
import { basics } from '../models/basics';
import { crane } from '../models/recipes/crane';
import { foldsLesson } from '../models/recipes/folds-lesson';
import { toFlat, unplaceLike } from './fold';
import { applyOp } from './ops';
import { PresetError, presetOp, type Preset } from './presets';
import { inside, locate } from './select';
import type { FoldFrame, OrigamiModel, Vec2 } from './types';

const lesson = foldsLesson();
const h = Math.SQRT1_2;

/** The lesson up to its step titled `title` that's a collapse (or the last step so titled), and that step's paper. */
function at(title: string, collapse = true): { before: OrigamiModel; after: FoldFrame } {
  const i = lesson.steps.findLastIndex((s) => s.title === title && (!collapse || s.op?.op === 'collapse'));
  if (i < 0) throw new Error(`No step "${title}"`);
  return { before: { ...lesson, steps: lesson.steps.slice(0, i) }, after: lesson.steps[i].frame };
}

/** Points of the sheet off every crease the lesson makes, to compare where they land. */
const samples: Vec2[] = [];
for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) samples.push([-0.47 + i * 0.1171, -0.46 + j * 0.1137]);

/** The points of the sheet stacked at a spot on the table, top first. */
function stackAt(frame: FoldFrame, spot: Vec2): Vec2[] {
  return toFlat(frame)
    .filter((f) => inside(f.world, spot))
    .sort((a, b) => b.layer - a.layer)
    .map((f) => unplaceLike(f)(spot));
}

/** Two flat frames are the same paper: every sample lands in the same place, and the layers stack the same way. */
function expectSame(made: FoldFrame, want: FoldFrame) {
  for (const p of samples) {
    const [a, b] = [locate(made, p), locate(want, p)];
    expect(a[0], `x of ${p}`).toBeCloseTo(b[0], 6);
    expect(a[1], `z of ${p}`).toBeCloseTo(b[1], 6);
    const [got, expected] = [stackAt(made, a), stackAt(want, b)];
    expect(got.length, `layers at ${p}`).toBe(expected.length);
    got.forEach((q, k) => expect(Math.hypot(q[0] - expected[k][0], q[1] - expected[k][1]), `layer ${k} at ${p}`).toBeLessThan(1e-6));
  }
}

const make = (before: OrigamiModel, preset: Preset) => applyOp(before, presetOp(before, preset)).frame;

describe('fold presets make the common folds as the lesson does', () => {
  it('pleat: a valley and a mountain crease side by side', () => {
    const { before } = at('Fold the bottom up', false);
    const { after } = at('Fold it back down', false);
    const sheet = { ...before, steps: before.steps };
    expectSame(make(sheet, { kind: 'pleat', picks: [[-0.5, 0.25], [0.5, 0.25], [-0.5, 0.375], [0.5, 0.375]] }), after);
  });

  it('crimp: an inside and an outside reverse fold together', () => {
    const { before, after } = at('Crimp');
    const ray = (x: number, deg: number): Vec2 => [x + Math.cos((deg * Math.PI) / 180), -Math.sin((deg * Math.PI) / 180)];
    expectSame(make(before, { kind: 'crimp', picks: [[0.05, 0], ray(0.05, 85), [0.1, 0], ray(0.1, 70)] }), after);
  });

  it('squash: the flap on top pressed flat over its middle line', () => {
    const { before, after } = at('Squash fold');
    expectSame(make(before, { kind: 'squash', picks: [[0, 0], [-h / 2, -h / 2]] }), after);
  });

  it('rabbit ear: two edges folded in, the corner between them standing up and laid over', () => {
    const { before, after } = at('Rabbit ear');
    expectSame(make(before, { kind: 'rabbitEar', picks: [[0, -h], [-h, 0], [h, 0]] }), after);
  });

  it('petal: a square base’s flap lifted, its sides folding in', () => {
    const { before, after } = at('Petal fold');
    const corner = locate(before.steps.at(-1)!.frame, [0.5, 0.5]);
    expectSame(make(before, { kind: 'petal', picks: [corner] }), after);
  });
});

describe('fold presets elsewhere', () => {
  it('petal-folds the back of the crane’s square base, turned over, as the crane does', () => {
    const m = crane();
    const i = m.steps.findLastIndex((s) => s.title === 'Petal fold' && s.op?.op === 'collapse');
    const before = { ...m, steps: m.steps.slice(0, i) };
    const corner = locate(before.steps.at(-1)!.frame, [0.5, 0.5]);
    expectSame(make(before, { kind: 'petal', picks: [corner] }), m.steps[i].frame);
  });

  it('says why when there’s nothing to fold', () => {
    const sheet = { ...basics, steps: [] };
    expect(() => presetOp(sheet, { kind: 'squash', picks: [[0, 0], [0.2, 0.2]] })).toThrow(PresetError);
    expect(() => presetOp(sheet, { kind: 'rabbitEar', picks: [[0, 0], [0.1, 0.1], [0.2, 0.2]] })).toThrow(PresetError);
    expect(() => presetOp(sheet, { kind: 'pleat', picks: [[0, 0], [0, 0], [0.1, 0], [0.1, 1]] })).toThrow(PresetError);
  });
});
