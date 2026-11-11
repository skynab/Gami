import { describe, expect, it } from 'vitest';
import { basics } from '../models/basics';
import { squareBase } from '../models/recipes/bird-base';
import { crane } from '../models/recipes/crane';
import { foldsLesson } from '../models/recipes/folds-lesson';
import { toFlat, unplaceLike } from './fold';
import { frontUp } from './geometry2d';
import { applyOp } from './ops';
import { PresetError, presetOp, type Preset } from './presets';
import { paper, Recipe, table } from './recipe';
import { inside, locate } from './select';
import type { FoldFrame, OrigamiModel, Vec2 } from './types';
import { problems } from './validate';

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

  it('swivels a flap as Recipe.swivel does, the paper it swings across pleated', () => {
    // A square's corner folded over on a hinge from the middle of the bottom edge, swung 30° about that end.
    const corner = () => new Recipe({ id: 's', title: 's', sheet: { size: [1, 1], front: '#fff', back: '#000' } }).along(table(0, 0.5), table(0.5, 0), table(0.45, 0.45), { title: 'Fold the corner over' });
    const flap = ([u, v]: Vec2) => u + v > 0.5;
    const want = corner().swivel({ title: 'Swivel' }, { pivot: paper(0, 0.5), hinge: paper(0.5, 0), degrees: 30, anchor: paper(-0.4, -0.4), flap }).build();
    const turned = (deg: number): Vec2 => {
      const a = (deg * Math.PI) / 180;
      return [0.5 * Math.cos(a) - 0.5 * Math.sin(a), 0.5 - 0.5 * Math.sin(a) - 0.5 * Math.cos(a)];
    };
    const before = corner().build();
    expectSame(make(before, { kind: 'swivel', picks: [[0, 0.5], [0.5, 0], turned(30)] }), want.steps[1].frame);
    // Swung the other way there's only the flap's own paper to cross.
    expect(() => presetOp(before, { kind: 'swivel', picks: [[0, 0.5], [0.5, 0], turned(-20)] })).toThrow(PresetError);
  });

  it('open-sinks a square base’s point, each layer’s tip tucked into the point’s inside', () => {
    const r = new Recipe({ id: 'x', title: 'x', sheet: { size: [1, 1], front: '#fff', back: '#000' } });
    squareBase(r);
    const before = r.build();
    const tip = r.where(paper(0, 0));
    const at: Vec2 = [tip[0], tip[1] + 0.15];
    const op = presetOp(before, { kind: 'sink', picks: [tip, at] });
    const made = { ...before, steps: [...before.steps, { ...applyOp(before, op), title: 'Open sink' }] };
    expect(problems(made)).toEqual([]);
    const frame = made.steps.at(-1)!.frame;
    // In each half, under the sunk tip: the four layers as they were, the tips in pairs between them, each beside the
    // layer it's folded from and on that layer's inside (the paper's white side, all round the point).
    for (const spot of [[tip[0] - 0.04, at[1] + 0.05], [tip[0] + 0.04, at[1] + 0.05]] as Vec2[]) {
      const layers = toFlat(frame)
        .filter((f) => inside(f.world, spot))
        .sort((a, b) => b.layer - a.layer)
        .map((f) => ({ p: unplaceLike(f)(spot), up: frontUp(f.world, f.paper) }));
      expect(layers.map((l) => Math.hypot(...l.p) < 0.15)).toEqual([false, true, true, false, false, true, true, false]);
      const was = stackAt(before.steps.at(-1)!.frame, spot);
      [0, 3, 4, 7].forEach((k, i) => expect(Math.hypot(layers[k].p[0] - was[i][0], layers[k].p[1] - was[i][1]), `layer ${k}`).toBeLessThan(1e-6));
      const quarter = (p: Vec2) => `${Math.sign(p[0])}${Math.sign(p[1])}`;
      for (const [t, body] of [[1, 0], [2, 3], [5, 4], [6, 7]]) expect(quarter(layers[t].p), `tip ${t}`).toBe(quarter(layers[body].p));
      // The body layer above a pair of tips lies front side up (white inside facing down to them), the one below it back side up.
      for (const body of [0, 4]) expect(layers[body].up).toBe(true);
      for (const body of [3, 7]) expect(layers[body].up).toBe(false);
    }
  });

  it('open-sinks a point creased along the line first as it does one that isn’t', () => {
    const base = () => {
      const r = new Recipe({ id: 'x', title: 'x', sheet: { size: [1, 1], front: '#fff', back: '#000' } });
      squareBase(r);
      return r;
    };
    // (A recipe's build shares its list of steps, so each model gets a recipe of its own.)
    const r = base();
    const tip = r.where(paper(0, 0));
    const at: Vec2 = [tip[0], tip[1] + 0.15];
    const creased = r.along(table(at[0] - 1, at[1]), table(at[0] + 1, at[1]), table(...tip), { title: 'Crease the tip' }).unfold().build();
    const sunk = make(creased, { kind: 'sink', picks: [tip, at] });
    expectSame(sunk, make(base().build(), { kind: 'sink', picks: [tip, at] }));
    // The tip is inside the point, not where it was.
    expect(Math.min(...toFlat(sunk).flatMap((f) => f.world.map((p) => p[1])))).toBeCloseTo(at[1], 6);
  });

  it('says why when there’s nothing to fold', () => {
    const sheet = { ...basics, steps: [] };
    expect(() => presetOp(sheet, { kind: 'squash', picks: [[0, 0], [0.2, 0.2]] })).toThrow(PresetError);
    expect(() => presetOp(sheet, { kind: 'rabbitEar', picks: [[0, 0], [0.1, 0.1], [0.2, 0.2]] })).toThrow(PresetError);
    expect(() => presetOp(sheet, { kind: 'pleat', picks: [[0, 0], [0, 0], [0.1, 0], [0.1, 1]] })).toThrow(PresetError);
    expect(() => presetOp(sheet, { kind: 'swivel', picks: [[-0.5, 0.5], [0.5, 0.5], [0.5, 0]] })).toThrow(PresetError);
    expect(() => presetOp(sheet, { kind: 'sink', picks: [[0, 0], [0, 0.1]] })).toThrow(PresetError);
  });
});
