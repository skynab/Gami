import { describe, expect, it } from 'vitest';
import { fromFoldFile, toFoldFile } from '../fold-format';
import { parseOp, replay, type Op } from '../ops';
import { paper, Recipe } from '../recipe';
import type { FoldFrame, OrigamiModel, Vec3 } from '../types';
import { hingeAngle } from './solver';
import { topology } from './mesh';

const sheet = { size: [1, 1] as [number, number], front: '#c33', back: '#eee' };

/** A sheet creased down the middle, its right half then bent: its crease to `degrees`, and its corners to goals. */
const bent = (degrees: number, corner?: Vec3) =>
  new Recipe({ id: 'bent', title: 'Bent', sheet })
    .crease(paper(-0.5, 0), paper(0.5, 0), { title: 'Crease down the middle' })
    .bend(
      { title: 'Bend the right half' },
      {
        flex: ([u]) => u > 0,
        anchor: [-0.25, 0],
        goals: [{ crease: [[0, -0.5], [0, 0.5]], degrees }, ...(corner ? [{ point: { paper: [0.5, 0.5] as [number, number] }, to: corner }] : [])],
        mesh: 0.125,
      },
    );

const dist = (a: number[], b: number[]) => Math.hypot(...a.map((x, i) => x - b[i]));

/** Every point of the frames within a hair (files keep coordinates to 1e-9), and everything else the same. */
const same = (a: FoldFrame, b: FoldFrame) => {
  expect(a.faces_vertices).toEqual(b.faces_vertices);
  expect(a.faces_parent).toEqual(b.faces_parent);
  expect(a.soft).toEqual(b.soft);
  a.vertices_coords.forEach((p, v) => expect(dist(p, b.vertices_coords[v])).toBeLessThan(1e-8));
};

describe('the bend operation', () => {
  it('folds the crease it’s given, a valley fold lifting the bending half', () => {
    const model = bent(90).build();
    const step = model.steps.at(-1)!;
    expect(step.kind).toBe('pose');
    expect(step.via?.length).toBeGreaterThan(1);
    const { frame } = step;
    // The right half stands up off the table; the left half, which doesn't bend, stays flat.
    const right = frame.vertices_paper.flatMap((p, v) => (p[0] > 0.01 ? [frame.vertices_coords[v]] : []));
    const left = frame.vertices_paper.flatMap((p, v) => (p[0] < -0.01 ? [frame.vertices_coords[v]] : []));
    expect(Math.min(...right.map((q) => q[1]))).toBeGreaterThan(0);
    for (const q of left) expect(Math.abs(q[1])).toBeLessThan(1e-9);
    // The crease's hinges are at about a right angle.
    const tris = frame.faces_vertices as [number, number, number][];
    const onCrease = topology(tris).hinges.filter((h) => Math.abs(frame.vertices_paper[h.a][0]) < 1e-9 && Math.abs(frame.vertices_paper[h.b][0]) < 1e-9);
    expect(onCrease.length).toBeGreaterThan(0);
    for (const h of onCrease) expect(Math.abs(hingeAngle(frame.vertices_coords, h))).toBeCloseTo(Math.PI / 2, 1);
  });

  it('turns a flap all the way on a fine mesh', { timeout: 20000 }, () => {
    // A narrow strip meshed at a twentieth of its length: the flap's far edge has far to go for the size of its
    // triangles, and once got only half way.
    const model = new Recipe({ id: 'fine', title: 'Fine', sheet: { ...sheet, size: [0.2, 1] } })
      .crease(paper(-0.1, 0), paper(0.1, 0), { title: 'Crease down the middle' })
      .bend({ title: 'Stand the right half up' }, { flex: ([u]) => u > 0, anchor: [-0.05, 0], goals: [{ crease: [[0, -0.5], [0, 0.5]], degrees: 90 }], mesh: 0.05 })
      .build();
    const { frame } = model.steps.at(-1)!;
    const tris = frame.faces_vertices as [number, number, number][];
    const onCrease = topology(tris).hinges.filter((h) => Math.abs(frame.vertices_paper[h.a][0]) < 1e-9 && Math.abs(frame.vertices_paper[h.b][0]) < 1e-9);
    expect(onCrease.length).toBeGreaterThan(10);
    for (const h of onCrease) expect(Math.abs(hingeAngle(frame.vertices_coords, h))).toBeCloseTo(Math.PI / 2, 1);
  });

  it('replays from its file to the same frames', () => {
    const model = bent(60, [0.2, 0.4, 0.3]).build();
    const file = fromFoldFile(JSON.parse(JSON.stringify(toFoldFile(model))));
    expect(file.steps.at(-1)!.op?.op).toBe('bend');
    const again = replay(file);
    expect(again.status.every((s) => s === 'replayed')).toBe(true);
    const [mine, theirs] = [model.steps.at(-1)!, again.model.steps.at(-1)!];
    same(theirs.frame, mine.frame);
    expect(theirs.via).toHaveLength(mine.via!.length);
    theirs.via!.forEach((f, k) => same(f, mine.via![k]));
  });

  it('can’t be folded after', () => {
    expect(() => bent(90).turnOver()).toThrow(/bent/);
    const model = bent(90).build();
    const after: OrigamiModel = { ...model, steps: [...model.steps, { ...model.steps[0], op: { op: 'turnOver' } }] };
    const again = replay(after, model.steps.length);
    expect(again.status.at(-1)).toBe('failed');
    expect(again.error?.message).toMatch(/bent/);
  });

  it('reads only well-formed bends', () => {
    const good: Op = { op: 'bend', flex: { sheet: 0 }, anchor: { paper: [0, 0] }, goals: [{ point: { paper: [0.5, 0.5] }, to: [0, 1, 0] }, { crease: [[0, 0], [1, 0]], degrees: 90 }], mesh: 0.1 };
    expect(parseOp(JSON.parse(JSON.stringify(good)))).toEqual(good);
    expect(() => parseOp({ ...good, goals: [{ point: { paper: [0, 0] }, to: [0, 1] }] })).toThrow();
    expect(() => parseOp({ ...good, goals: [{ crease: [[0, 0], [1, 0]], degrees: 400 }] })).toThrow();
    expect(() => parseOp({ ...good, anchor: { table: [0, 0] } })).toThrow();
    // Too fine a mesh would take too long to solve.
    expect(() => parseOp({ ...good, mesh: 0.001 })).toThrow();
  });
});
