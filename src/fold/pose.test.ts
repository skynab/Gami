import { describe, expect, it } from 'vitest';
import { basics } from '../models/basics';
import { fold, FoldError } from './fold';
import { lineOnto } from './geometry2d';
import { pose } from './pose';
import { problems } from './validate';

const square = basics.start;
const midline = lineOnto([0, 0.5], [0, -0.5]);

describe('pose', () => {
  it('stands a flap straight up about its crease', () => {
    const up = pose(square, { line: midline, angle: Math.PI / 2 });
    const corner = up.vertices_coords[up.vertices_paper.findIndex(([u, v]) => u === -0.5 && v === 0.5)];
    // The bottom-left corner was half a sheet in front of the crease; now it's half a sheet up, over the crease.
    expect(corner[1]).toBeCloseTo(0.5);
    expect(corner[2]).toBeCloseTo(0);
  });

  it('makes a valid last step that animates without stretching', () => {
    // Right half over onto the left; then open the top layer partway, like a book.
    const half = fold(square, { line: lineOnto([0.5, 0], [-0.5, 0]), kind: 'valley' });
    const spine = { p: [0, 0] as [number, number], d: [0, 1] as [number, number] };
    const model = {
      ...basics,
      steps: [
        { title: 'Fold in half', kind: 'fold' as const, frame: half },
        { title: 'Open it a little', kind: 'fold' as const, frame: pose(half, { line: spine, angle: Math.PI / 3, layers: 1 }) },
      ],
    };
    expect(problems(model)).toEqual([]);
  });

  it('refuses to lift a layer that’s joined to the ones below somewhere else', () => {
    const half = fold(square, { line: lineOnto([0.5, 0], [-0.5, 0]), kind: 'valley' });
    expect(() => pose(half, { line: midline, angle: Math.PI / 3, layers: 1 })).toThrow(FoldError);
  });

  it('can’t be folded further once it isn’t flat', () => {
    const up = pose(square, { line: midline, angle: Math.PI / 4 });
    expect(() => fold(up, { line: midline, kind: 'valley' })).toThrow(FoldError);
  });
});
