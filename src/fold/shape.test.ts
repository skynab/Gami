import { describe, expect, it } from 'vitest';
import { basics } from '../models/basics';
import { fold, FoldError } from './fold';
import { lineOnto } from './geometry2d';
import { paper, Recipe, table } from './recipe';
import { shape } from './shape';
import { problems } from './validate';

const square = basics.start;
const at = (frame: typeof square, u: number, v: number) => frame.vertices_coords[frame.vertices_paper.findIndex(([a, b]) => Math.abs(a - u) < 1e-9 && Math.abs(b - v) < 1e-9)];

describe('shape', () => {
  it('turns paper beyond two bends by both', () => {
    // Lines at z = 0 and z = 0.25, the near side turning up a quarter turn at each: the near edge ends up
    // folded right back over, a quarter of a sheet up.
    const up = shape(square, [
      { line: { p: [0, 0], d: [1, 0] }, angle: Math.PI / 2 },
      { line: { p: [0, 0.25], d: [1, 0] }, angle: Math.PI / 2 },
    ]);
    const corner = at(up, -0.5, 0.5);
    expect(corner[0]).toBeCloseTo(-0.5);
    expect(corner[1]).toBeCloseTo(0.25);
    expect(corner[2]).toBeCloseTo(-0.25);
    // The bit between the lines stands straight up.
    expect(at(up, -0.5, 0.25)[1]).toBeCloseTo(0.25);
  });

  it('curls a flap without stretching, and animates cleanly', () => {
    const r = new Recipe({ id: 'curl', title: 'Curl', sheet: { size: [1, 1], front: '#fff', back: '#000' } }).shape({ title: 'Curl the edge' }, [
      { through: [table(-1, 0), table(1, 0)], moving: table(0, 0.5), degrees: 180, segments: 6 },
    ]);
    const model = r.build();
    expect(problems(model)).toEqual([]);
    // Curled through a half turn over half a sheet: the edge comes back over the line, a curl's width up.
    const edge = at(model.steps[0].frame, -0.5, 0.5);
    expect(edge[2]).toBeLessThan(0.05);
    expect(edge[1]).toBeGreaterThan(0.25);
  });

  it('shapes separate flaps separately, and builds on earlier shaping', () => {
    const r = new Recipe({ id: 'wings', title: 'Wings', sheet: { size: [1, 1], front: '#fff', back: '#000' } })
      .shape({ title: 'Lift the left edge' }, [{ through: [table(-0.25, -1), table(-0.25, 1)], moving: paper(-0.5, 0.5), degrees: 60 }])
      .shape({ title: 'And the right' }, [{ through: [table(0.25, -1), table(0.25, 1)], moving: paper(0.5, 0.5), degrees: 60 }]);
    const model = r.build();
    expect(problems(model)).toEqual([]);
    const last = model.steps[1].frame;
    expect(at(last, -0.5, 0.5)[1]).toBeCloseTo(0.25 * Math.sin(Math.PI / 3));
    expect(at(last, 0.5, 0.5)[1]).toBeCloseTo(0.25 * Math.sin(Math.PI / 3));
  });

  it('refuses to bend layers that are joined to the ones below elsewhere', () => {
    const half = fold(square, { line: lineOnto([0.5, 0], [-0.5, 0]), kind: 'valley' });
    expect(() => shape(half, [{ line: lineOnto([0, 0.5], [0, -0.5]), angle: 1, layers: 1 }])).toThrow(FoldError);
  });
});

describe('shape, combining bends', () => {
  it('puts the bend turning more paper nearest the base, whatever the order', () => {
    const near = { line: { p: [0, 0] as [number, number], d: [1, 0] as [number, number] }, angle: Math.PI / 2 };
    const far = { line: { p: [0, 0.25] as [number, number], d: [1, 0] as [number, number] }, angle: Math.PI / 2 };
    const a = shape(square, [near, far]);
    const b = shape(square, [far, near]);
    expect(at(b, -0.5, 0.5)).toEqual(at(a, -0.5, 0.5));
  });

  it('refuses bends that cross on the paper they turn', () => {
    expect(() =>
      shape(square, [
        { line: { p: [0, 0], d: [1, 0] }, angle: 1 },
        { line: { p: [0, 0], d: [0, 1] }, angle: 1 },
      ]),
    ).toThrow(FoldError);
  });
});
