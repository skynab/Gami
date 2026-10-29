import { describe, expect, it } from 'vitest';
import { poseAt, stepTransition } from './animate';
import { crossings } from './collisions';
import { toFlat } from './fold';
import { fromFoldFile, toFoldFile } from './fold-format';
import { applyOp } from './ops';
import { paper, Recipe, table } from './recipe';
import { sheetOf } from './sheets';
import type { FoldFrame, Vec2 } from './types';
import { problems } from './validate';

/** Three strips: the first on its own, the other two in a pile beside it. */
const strips = () =>
  new Recipe({
    id: 'strips',
    title: 'Strips',
    sheets: [
      { size: [1, 0.4], front: '#111111', back: '#222222', at: [0, 0] },
      { size: [1, 0.4], front: '#333333', back: '#444444', origin: [10, 0], at: [0, 1] },
      { size: [1, 0.4], front: '#555555', back: '#666666', origin: [20, 0], at: [0, 1] },
    ],
  });

const first = ([u]: Vec2) => u < 5;
const onSheet = (n: number) => ([u]: Vec2) => Math.abs(u - 10 * n) < 5;

/** Each face's sheet, layer and middle on the table. */
function faces(frame: FoldFrame) {
  return toFlat(frame).map((f) => ({
    sheet: Math.round((f.paper.reduce((s, p) => s + p[0], 0) / f.paper.length) / 10),
    layer: f.layer,
    at: [f.world.reduce((s, p) => s + p[0], 0) / f.world.length, f.world.reduce((s, p) => s + p[1], 0) / f.world.length] as Vec2,
  }));
}

/** The first strip folded in half end to end, then the right end tucked: two layers a quarter long, and a flap. */
const folded = () =>
  strips()
    .onto(paper(0.5, 0), paper(-0.5, 0), { title: 'In half', only: first })
    .onto(paper(0, 0), paper(-0.25, 0), { title: 'Again', only: first });

describe('a pile of sheets', () => {
  it('stacks sheets put down in the same place, later ones on top', () => {
    const { start } = strips().build();
    expect(start.faces_layer).toEqual([0, 0, 1]);
  });

  it('leaves sheets apart on one layer, as before', () => {
    const { start } = new Recipe({
      id: 'apart',
      title: 'Apart',
      sheets: [
        { size: [1, 1], front: '#111111', back: '#222222', at: [-1, 0] },
        { size: [1, 1], front: '#333333', back: '#444444', origin: [10, 0], at: [1, 0] },
      ],
    }).build();
    expect(start.faces_layer).toBeUndefined();
  });
});

describe('copying a folded unit', () => {
  it('folds the sheets in the pile the same way, each in its own place', () => {
    const r = folded();
    const unit = faces(r.current).filter((f) => f.sheet === 0);
    const model = r.copy({ title: 'Fold the rest' }, 0, [1, 2], [[2, 0], [4, 0]]).build();
    const after = faces(model.steps.at(-1)!.frame);
    // Faces' middles relative to the leftmost, stacked in order.
    const shape = (fs: typeof unit) => {
      const x0 = Math.min(...fs.map((f) => f.at[0]));
      return [...fs].sort((a, b) => a.layer - b.layer).map((f) => `${(f.at[0] - x0).toFixed(5)},${f.at[1].toFixed(5)}`);
    };
    for (const [n, x] of [[1, 2], [2, 4]] as const) {
      const copy = after.filter((f) => f.sheet === n);
      expect(copy).toHaveLength(unit.length);
      expect(shape(copy)).toEqual(shape(unit));
      // The unit runs from −½ to −⅛ across, so its middle, −0.3125, goes to x.
      expect(Math.min(...copy.map((f) => f.at[0])) - Math.min(...unit.map((f) => f.at[0]))).toBeCloseTo(x + 0.3125);
    }
    expect(problems(model)).toEqual([]);
  });

  it('puts copies where their sheets lay when no places are given, each on top of the last', () => {
    const model = folded().copy({ title: 'Fold the rest' }, 0, [1, 2]).build();
    const after = faces(model.steps.at(-1)!.frame);
    const lowest = (n: number) => Math.min(...after.filter((f) => f.sheet === n).map((f) => f.layer));
    const highest = (n: number) => Math.max(...after.filter((f) => f.sheet === n).map((f) => f.layer));
    expect(lowest(2)).toBeGreaterThan(highest(1));
    for (const f of after.filter((g) => g.sheet > 0)) expect(f.at[1]).toBeCloseTo(1);
  });

  it('keeps each copy in its own sheet’s colours', () => {
    const model = folded().copy({ title: 'Fold the rest' }, 0, [1]).build();
    const frame = model.steps.at(-1)!.frame;
    const sheets = new Set(frame.faces_vertices.map((face) => sheetOf(model.sheets, face.map((v) => frame.vertices_paper[v]))));
    expect([...sheets].sort()).toEqual([0, 1, 2]);
  });

  it('replays from its operation, through a .fold file', () => {
    const model = folded().copy({ title: 'Fold the rest' }, 0, [1, 2], [[2, 0], [4, 0]]).build();
    const read = fromFoldFile(JSON.parse(JSON.stringify(toFoldFile(model))));
    const step = read.steps.at(-1)!;
    const again = applyOp({ ...read, steps: read.steps.slice(0, -1) }, step.op!).frame;
    expect(again.faces_vertices.length).toBe(step.frame.faces_vertices.length);
    expect(faces(again)).toEqual(faces(step.frame));
  });

  it('plays each copy folding as the first did, in turn, through no other paper', () => {
    const model = folded().copy({ title: 'Fold the rest' }, 0, [1, 2], [[2, 0], [4, 0]]).build();
    const k = model.steps.length;
    const t = stepTransition(model, k);
    // Halfway through, the copies are on their way, and nothing passes through paper all through the step.
    const mid = poseAt(t, 0.5);
    const lifted = t.faces.map((f, i) => (f.before.some((p, c) => Math.hypot(...p.map((x, d) => x - mid[i][c][d])) > 1e-6) ? i : -1)).filter((i) => i >= 0);
    expect(lifted.length).toBeGreaterThan(0);
    expect(crossings(model).filter((c) => c.step === k && c.depth > 0.005)).toEqual([]);
    expect(problems(model)).toEqual([]);
  });

  it('won’t copy onto a sheet of another size', () => {
    const r = new Recipe({
      id: 'sizes',
      title: 'Sizes',
      sheets: [
        { size: [1, 1], front: '#111111', back: '#222222', at: [-1, 0] },
        { size: [1, 0.5], front: '#333333', back: '#444444', origin: [10, 0], at: [1, 0] },
      ],
    });
    expect(() => r.copy({ title: 'Copy' }, 0, [1])).toThrow(/same size/);
  });
});

describe('sliding a piece in between layers', () => {
  it('puts each part just under the paper it slides beneath, above the rest there', () => {
    // Sheet 0 folded in half: two layers. Sheet 1 folded in half too, then laid across sheet 0's middle with its
    // lower layer under sheet 0's lower layer and its upper layer between sheet 0's layers.
    const r = new Recipe({
      id: 'cross',
      title: 'Cross',
      sheets: [
        { size: [1, 0.4], front: '#111111', back: '#222222', at: [0, 0] },
        { size: [1, 0.4], front: '#333333', back: '#444444', origin: [10, 0], at: [0, 2] },
      ],
    })
      .onto(paper(0.5, 0), paper(-0.5, 0), { title: 'Fold 0', only: first })
      .onto(paper(10.5, 0), paper(9.5, 0), { title: 'Fold 1', only: onSheet(1) });
    // Sheet 0's halves: u < 0 stays below, u > 0 is folded on top. The same for sheet 1 about u = 10.
    const model = r
      .move({ title: 'Slide in' }, onSheet(1), {
        to: table(-0.25, 0),
        degrees: 90,
        into: [
          { part: ([u]) => u > 10, under: ([u]) => u > 0 && u < 5 },
          { part: ([u]) => u > 5 && u < 10, under: ([u]) => u < 0 },
        ],
      })
      .build();
    const frame = model.steps.at(-1)!.frame;
    const flat = toFlat(frame);
    const layerOf = (test: (u: number) => boolean) => flat.filter((f) => test(f.paper.reduce((s, p) => s + p[0], 0) / f.paper.length)).map((f) => f.layer);
    const [zeroLow] = layerOf((u) => u < 0);
    const [zeroHigh] = layerOf((u) => u > 0 && u < 5);
    const [oneLow] = layerOf((u) => u > 5 && u < 10);
    const [oneHigh] = layerOf((u) => u > 10);
    expect(oneLow).toBeLessThan(zeroLow);
    expect(zeroLow).toBeLessThan(oneHigh);
    expect(oneHigh).toBeLessThan(zeroHigh);
    // And it replays the same from its operation.
    const read = fromFoldFile(JSON.parse(JSON.stringify(toFoldFile(model))));
    const again = applyOp({ ...read, steps: read.steps.slice(0, -1) }, read.steps.at(-1)!.op!).frame;
    expect(again.faces_layer).toEqual(read.steps.at(-1)!.frame.faces_layer);
  });
});
