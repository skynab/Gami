import { describe, expect, it } from 'vitest';
import { basics } from '../models/basics';
import { paperPlane } from '../models/recipes/paper-plane';
import { fromFoldFile, toFoldFile } from './fold-format';
import { OpError, OPS_VERSION, parseOp, replay, type Op } from './ops';
import { paper, Recipe, table } from './recipe';
import type { FoldFrame, OrigamiModel, Vec2 } from './types';

/** The paper plane's operations, written out by hand the way its recipe folds it. */
function planeOps(): Op[] {
  const [l, r, top] = [-0.35, 0.35, -0.5];
  const corner = top + 0.35;
  const edge = top + Math.hypot(0.35, 0.35);
  const plane = paperPlane();
  const keel = Math.max(...plane.steps[7].frame.vertices_coords.map((p) => p[2]));
  const wing = keel - 0.13;
  const half = (u: number): Vec2[] => [[0, -1], [u, -1], [u, 1], [0, 1]];
  const at = (u: number, v: number) => ({ paper: [u, v] as Vec2 });
  const on = (x: number, z: number) => ({ table: [x, z] as Vec2 });
  return [
    { op: 'fold', line: { onto: [at(l, 0), at(r, 0)] } },
    { op: 'unfold' },
    { op: 'fold', line: { onto: [at(l, top), on(0, corner)] } },
    { op: 'fold', line: { onto: [at(r, top), on(0, corner)] } },
    { op: 'fold', line: { onto: [at(l, corner), on(0, edge)] } },
    { op: 'fold', line: { onto: [at(r, corner), on(0, edge)] } },
    { op: 'fold', line: { through: [on(0, -1), on(0, 1)], moving: on(-0.1, 0) }, kind: 'mountain' },
    { op: 'rotate', degrees: 90 },
    { op: 'fold', line: { through: [on(-1, wing), on(1, wing)], moving: on(0, wing - 0.1) }, only: { inPaper: [half(1)] } },
    { op: 'turnOver' },
    { op: 'fold', line: { through: [on(-1, wing), on(1, wing)], moving: on(0, wing - 0.1) }, only: { inPaper: [half(-1)] } },
  ];
}

function planeWithOps(): OrigamiModel {
  const model = paperPlane();
  const ops = planeOps();
  return { ...model, steps: model.steps.map((s, k) => ({ ...s, op: ops[k] })) };
}

/** Frames compared to the precision .fold files keep. */
function expectSameFrame(a: FoldFrame, b: FoldFrame) {
  const round = (f: FoldFrame) => JSON.parse(JSON.stringify(toFoldFile({ id: '', title: '', sheets: [], start: f, steps: [] })));
  expect(round(a)).toEqual(round(b));
}

describe('replaying fold operations', () => {
  it('folds the paper plane again exactly as its recipe did', () => {
    const model = planeWithOps();
    const { model: again, status, error } = replay(model);
    expect(error).toBeUndefined();
    expect(status.every((s) => s === 'replayed')).toBe(true);
    again.steps.forEach((s, k) => expectSameFrame(s.frame, model.steps[k].frame));
    expect(again.steps.map((s) => s.title)).toEqual(model.steps.map((s) => s.title));
  });

  it('keeps steps before `from` and folds the rest again after an edit', () => {
    const model = planeWithOps();
    // Fold the first corner only partway to the centre line.
    model.steps[2] = { ...model.steps[2], op: { op: 'fold', line: { onto: [{ paper: [-0.35, -0.5] }, { table: [-0.1, -0.15] }] } } };
    const { model: again, status } = replay(model, 2);
    expect(status.slice(0, 2)).toEqual(['kept', 'kept']);
    expect(again.steps[0]).toBe(model.steps[0]);
    expect(status[2]).toBe('replayed');
    // The corner is where the edited fold put it.
    const tl = again.steps[2].frame.vertices_paper.findIndex(([u, v]) => u === -0.35 && v === -0.5);
    expect(again.steps[2].frame.vertices_coords[tl][0]).toBeCloseTo(-0.1);
    expect(again.steps[2].frame.vertices_coords[tl][2]).toBeCloseTo(-0.15);
    expect(again.steps[3].frame).not.toEqual(paperPlane().steps[3].frame);
  });

  it('stops at a step that no longer works, keeping it and the rest as they were', () => {
    const model = planeWithOps();
    model.steps[3] = { ...model.steps[3], op: { op: 'fold', line: { onto: [{ paper: [5, 5] }, { table: [0, 0] }] } } };
    const { model: again, status, error } = replay(model);
    expect(status.slice(2, 5)).toEqual(['replayed', 'failed', 'skipped']);
    expect(error).toEqual({ step: 4, message: expect.stringContaining('isn’t on the paper') });
    expect(again.steps[3]).toBe(model.steps[3]);
    expect(again.steps).toHaveLength(model.steps.length);
  });

  it('can’t go past a step with no operation', () => {
    const model = planeWithOps();
    delete model.steps[4].op;
    const { status, error } = replay(model);
    expect(status.slice(3, 6)).toEqual(['replayed', 'baked', 'skipped']);
    expect(error).toBeUndefined();
  });

  it('shows several folds together as one step from the paper before them', () => {
    const square = { size: [1, 1] as Vec2, front: '#000', back: '#fff' };
    const made = new Recipe({ id: 't', title: 't', sheet: square })
      .together({ title: 'Both corners' }, (r) => {
        r.onto(paper(-0.5, -0.5), paper(0, 0), { title: '' }).onto(paper(0.5, 0.5), paper(0, 0), { title: '' });
      })
      .build();
    const op: Op = {
      op: 'together',
      ops: [
        { op: 'fold', line: { onto: [{ paper: [-0.5, -0.5] }, { paper: [0, 0] }] } },
        { op: 'fold', line: { onto: [{ paper: [0.5, 0.5] }, { paper: [0, 0] }] } },
      ],
    };
    const { model, status } = replay({ ...made, steps: [{ ...made.steps[0], op }] });
    expect(status).toEqual(['replayed']);
    expectSameFrame(model.steps[0].frame, made.steps[0].frame);
    expect(Math.max(...model.steps[0].frame.faces_parent!)).toBe(0);
  });

  it('adds a shaping step’s bends to the one before it, as recipes do', () => {
    const square = { size: [1, 1] as Vec2, front: '#000', back: '#fff' };
    const made = new Recipe({ id: 't', title: 't', sheet: square })
      .shape({ title: 'Lift the left' }, [{ through: [table(-0.25, -1), table(-0.25, 1)], moving: table(-0.5, 0), degrees: 40 }])
      .shape({ title: 'Curl the right' }, [{ through: [table(0.25, -1), table(0.25, 1)], moving: paper(0.5, 0), degrees: 60, segments: 3 }])
      .build();
    const ops: Op[] = [
      { op: 'shape', bends: [{ line: { through: [{ table: [-0.25, -1] }, { table: [-0.25, 1] }], moving: { table: [-0.5, 0] } }, degrees: 40 }] },
      {
        op: 'shape',
        bends: [
          { line: { through: [{ table: [0.25, -1] }, { table: [0.25, 1] }], moving: { paper: [0.5, 0] } }, degrees: 60, segments: 3, reach: { paper: [0.5, 0] } },
        ],
      },
    ];
    const { model, status } = replay({ ...made, steps: made.steps.map((s, k) => ({ ...s, op: ops[k] })) });
    expect(status).toEqual(['replayed', 'replayed']);
    model.steps.forEach((s, k) => expectSameFrame(s.frame, made.steps[k].frame));
  });

  it('works out a collapse’s still point when asked to', () => {
    const square = { size: [1, 1] as Vec2, front: '#000', back: '#fff' };
    const base = new Recipe({ id: 't', title: 't', sheet: square }).build();
    const op: Op = {
      op: 'collapse',
      creases: [{ line: { through: [{ table: [0, -1] }, { table: [0, 1] }], moving: { table: [0.4, 0] } }, kind: 'valley' }],
      anchor: { auto: true },
    };
    const { model, status } = replay({ ...base, steps: [{ title: 'Fold in half', kind: 'fold', frame: base.start, op }] });
    expect(status).toEqual(['replayed']);
    expect(Math.max(...model.steps[0].frame.vertices_coords.map((p) => p[0]))).toBeCloseTo(0);
  });
});

describe('checking operations from a file', () => {
  it('accepts every kind of operation', () => {
    const at = { paper: [0, 0] };
    const ops = [
      { op: 'fold', line: { edgeOnto: [[at, at], [at, { table: [1, 0] }]] }, flip: true, kind: 'mountain', layers: 2, only: { all: [{ sheet: 1 }, { top: 2 }] } },
      { op: 'collapse', creases: [{ line: { line: { p: [0, 0], d: [1, 0] } }, kind: 'inside' }], anchor: { auto: true, among: { sheet: 0 } }, under: { inPaper: [[[0, 0], [1, 0], [0, 1]]] } },
      { op: 'collapse', creases: [], anchor: { paper: [0.1, 0.1] } },
      { op: 'unfold', to: 3 },
      { op: 'turnOver' },
      { op: 'rotate', degrees: -45 },
      { op: 'move', only: { sheet: 1 }, to: { table: [0, 0] }, degrees: 90, flip: true, under: false },
      { op: 'newSheet' },
      { op: 'shape', bends: [{ line: { through: [at, at], moving: 'smaller' }, degrees: 30, segments: 4, reach: at, layers: 1 }] },
      { op: 'popUp', centre: at, rays: [{ azimuth: 0, elevation: 0.2 }] },
      { op: 'together', ops: [{ op: 'turnOver' }] },
    ];
    for (const op of ops) expect(parseOp(JSON.parse(JSON.stringify(op)))).toEqual(op);
  });

  it('drops fields it doesn’t know', () => {
    expect(parseOp({ op: 'turnOver', run: 'rm -rf' })).toEqual({ op: 'turnOver' });
  });

  it('says what’s wrong and where', () => {
    const bad: [unknown, RegExp][] = [
      [{ op: 'explode' }, /unknown operation/],
      [{ op: 'rotate', degrees: 'ninety' }, /op\.degrees: expected a number/],
      [{ op: 'rotate', degrees: null }, /expected a number/],
      [{ op: 'fold', line: { onto: [{ paper: [0, 0] }] } }, /op\.line\.onto: expected two items/],
      [{ op: 'fold', line: { line: { p: [0, 0], d: [0, 0] } } }, /needs a direction/],
      [{ op: 'fold', line: { onto: [{ paper: [0, 0] }, { paper: [1, 0] }] }, layers: -1 }, /whole number/],
      [{ op: 'move', only: { inPaper: [[[0, 0], [1, 1]]] } }, /three corners/],
      [{ op: 'collapse', creases: [], anchor: { table: [0, 0] } }, /point on the sheet/],
      [{ op: 'shape', bends: [{ line: { line: { p: [0, 0], d: [1, 0] } }, degrees: 10, segments: 1e6 }] }, /1 to 64/],
      [{ op: 'popUp', centre: { paper: [0, 0] }, rays: Array(1000).fill({ azimuth: 0, elevation: 0 }) }, /more than 256/],
      [[], /expected an object/],
    ];
    for (const [op, message] of bad) expect(() => parseOp(op), JSON.stringify(op)).toThrow(message);
    expect(() => parseOp({ op: 'rotate' })).toThrow(OpError);
  });

  it('refuses operations nested too deeply', () => {
    let op: unknown = { op: 'turnOver' };
    for (let i = 0; i < 10; i++) op = { op: 'together', ops: [op] };
    expect(() => parseOp(op)).toThrow(/nested too deeply/);
  });
});

describe('.fold files with operations', () => {
  it('keeps each step’s operation', () => {
    const model = planeWithOps();
    const file = JSON.parse(JSON.stringify(toFoldFile(model)));
    expect(file['gami:ops']).toBe(OPS_VERSION);
    expect(file.file_frames[0]['gami:op']).toEqual(model.steps[0].op);
    const warnings: string[] = [];
    const read = fromFoldFile(file, warnings);
    expect(warnings).toEqual([]);
    expect(read.steps.map((s) => s.op)).toEqual(model.steps.map((s) => s.op));
    expect(replay(read).status.every((s) => s === 'replayed')).toBe(true);
  });

  it('writes no version when no step has an operation', () => {
    expect(toFoldFile(basics)).not.toHaveProperty('gami:ops');
  });

  it('leaves out an operation that isn’t well formed, saying why', () => {
    const file = JSON.parse(JSON.stringify(toFoldFile(planeWithOps())));
    file.file_frames[2]['gami:op'] = { op: 'fold', line: 'diagonal' };
    const warnings: string[] = [];
    const read = fromFoldFile(file, warnings);
    expect(read.steps[2].op).toBeUndefined();
    expect(read.steps[3].op).toBeDefined();
    expect(warnings).toEqual([expect.stringContaining('step 3.line')]);
  });

  it('ignores operations from a newer version', () => {
    const file = JSON.parse(JSON.stringify(toFoldFile(planeWithOps())));
    file['gami:ops'] = OPS_VERSION + 1;
    const warnings: string[] = [];
    const read = fromFoldFile(file, warnings);
    expect(read.steps.every((s) => !s.op)).toBe(true);
    expect(warnings).toHaveLength(1);
    expect(read.steps).toHaveLength(paperPlane().steps.length);
  });
});
