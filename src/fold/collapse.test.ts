import { describe, expect, it } from 'vitest';
import { basics } from '../models/basics';
import { collapse } from './collapse';
import { fold, FoldError, toFlat, unfoldTo } from './fold';
import { lineOnto, overlapArea, sideOf, type Line } from './geometry2d';
import type { FoldFrame, Vec2 } from './types';

const square = basics.start;

const fmt = (x: number) => (Math.round(x * 1e6) / 1e6 || 0).toFixed(6);

/** Same faces in the same places, and the same one on top wherever two overlap. */
function expectSame(a: FoldFrame, b: FoldFrame) {
  const key = (f: { paper: Vec2[] }) => f.paper.map((p) => p.map(fmt).join(',')).sort().join(' ');
  const fa = toFlat(a);
  const fb = toFlat(b);
  expect(fa.map(key).sort()).toEqual(fb.map(key).sort());
  const match = fa.map((f) => fb.find((g) => key(g) === key(f))!);
  fa.forEach((f, i) => f.world.forEach((w, k) => expect(w.map(fmt)).toEqual(match[i].world[k].map(fmt))));
  for (let i = 0; i < fa.length; i++) {
    for (let j = i + 1; j < fa.length; j++) {
      if (overlapArea(fa[i].world, fa[j].world) > 1e-6) expect(fa[i].layer > fa[j].layer).toBe(match[i].layer > match[j].layer);
    }
  }
}

/** A fold done as a collapse: anchored on a point that stays put. */
function asCollapse(frame: FoldFrame, line: Line, kind: 'valley' | 'mountain', stays: Vec2) {
  return collapse(frame, { creases: [{ line, kind }], anchor: stays });
}

describe('collapse', () => {
  it('matches a plain fold through all layers', () => {
    const line = lineOnto([-0.5, -0.5], [0.5, 0.5]);
    expectSame(asCollapse(square, line, 'valley', [0.4, 0.4]), fold(square, { line, kind: 'valley' }));
    expectSame(asCollapse(square, line, 'mountain', [0.4, 0.4]), fold(square, { line, kind: 'mountain' }));
  });

  it('matches a run of plain folds, layer for layer', () => {
    const steps: [Line, 'valley' | 'mountain'][] = [
      [lineOnto([0, 0.5], [0, -0.5]), 'valley'],
      [lineOnto([0.5, -0.25], [-0.5, -0.25]), 'valley'],
      [lineOnto([-0.5, 0], [0, -0.5]), 'mountain'],
    ];
    let a = square;
    let b = square;
    for (const [line, kind] of steps) {
      // Anchor on a sheet point that's on the side that stays.
      const stay = toFlat(a).flatMap((f) => f.paper.map((p, i): [Vec2, Vec2] => [p, f.world[i]])).find(([, w]) => sideOf(line, w) < -0.05)![0];
      a = asCollapse(a, line, kind, stay);
      b = fold(b, { line, kind });
      expectSame(a, b);
    }
  });

  it('opens creases out flat', () => {
    const half = fold(square, { line: lineOnto([0, 0.5], [0, -0.5]), kind: 'valley' });
    const open = collapse(half, { creases: [{ line: { p: [0, 0], d: [1, 0] }, kind: 'flat' }], anchor: [0, -0.4] });
    expectSame(open, unfoldTo([square, half], 0));
  });

  it('refuses creases that can’t fold flat together', () => {
    // Folding along both midlines at once, both as valleys, would need the paper to pass through itself.
    const x: Line = { p: [0, 0], d: [1, 0] };
    const z: Line = { p: [0, 0], d: [0, 1] };
    expect(() =>
      collapse(square, {
        creases: [
          { line: x, kind: 'valley' },
          { line: z, kind: 'valley' },
        ],
        anchor: [-0.3, -0.3],
      }),
    ).toThrow(FoldError);
  });
});
