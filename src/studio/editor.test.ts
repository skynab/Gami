import { describe, expect, it } from 'vitest';
import { collapse } from '../fold/collapse';
import { fold, toFlat } from '../fold/fold';
import { lineOnto, lineThrough, sideOf } from '../fold/geometry2d';
import { pose } from '../fold/pose';
import { layOut, sheetOf } from '../fold/sheets';
import { basics } from '../models/basics';
import { anchorFor, project, topLayers } from './editor';

const square = basics.start;

describe('Studio helpers', () => {
  it('anchors on the still side, off every crease', () => {
    const h = lineThrough([-1, 0], [1, 0]);
    const v = lineThrough([0, -1], [0, 1]);
    const at = anchorFor(square, [h, v])!;
    // Behind the first line, and not on either one.
    expect(sideOf(h, at)).toBeLessThan(0);
    expect(Math.abs(at[0])).toBeGreaterThan(0.05);
    expect(Math.abs(at[1])).toBeGreaterThan(0.05);
  });

  it('anchors on one sheet when asked', () => {
    const { start, sheets } = layOut([
      { size: [1, 1], front: '#111111', back: '#222222' },
      { size: [1, 1], front: '#333333', back: '#444444' },
    ]);
    // A line across both sheets: the biggest piece behind it is on whichever sheet; on sheet 2 if asked.
    const across = lineThrough([-2, 0], [2, 0]);
    const at = anchorFor(start, [across], (paper) => sheetOf(sheets, paper) === 1)!;
    expect(at[0]).toBeGreaterThan(5);
  });

  it('collapses a square base from three creases, the way the Studio does', () => {
    const creases = [
      { line: lineThrough([-1, 0], [1, 0]), kind: 'mountain' as const },
      { line: lineThrough([0, -1], [0, 1]), kind: 'mountain' as const },
      { line: lineThrough([-1, -1], [1, 1]), kind: 'valley' as const },
    ];
    const base = collapse(square, { creases, anchor: anchorFor(square, creases.map((c) => c.line))! });
    expect(Math.max(...base.faces_layer!) + 1).toBe(4);
  });

  it('limits a reverse fold to the top layers', () => {
    const half = fold(square, { line: lineOnto([0, 0.5], [0, -0.5]), kind: 'valley' });
    const line = lineThrough([0.25, -1], [0.25, 1]);
    const top = topLayers(half, line, 1);
    const faces = toFlat(half).filter((f) => f.world.some((x) => sideOf(line, x) > 0));
    expect(faces.filter((f) => top(f.paper))).toHaveLength(1);
  });

  it('draws lifted steps from above', () => {
    const up = pose(square, { line: lineThrough([-1, 0], [1, 0]), angle: Math.PI / 2 });
    expect(project(up)).toHaveLength(2);
  });
});
