import { describe, expect, it } from 'vitest';
import { collapse } from '../fold/collapse';
import { fold, toFlat } from '../fold/fold';
import { dist, lineEdgeOnto, lineOnto, lineThrough, sideOf, type Line } from '../fold/geometry2d';
import { paper, Recipe } from '../fold/recipe';
import type { Vec2 } from '../fold/types';
import { pose } from '../fold/pose';
import { layOut, sheetOf } from '../fold/sheets';
import { basics } from '../models/basics';
import { anchorFor, project, topLayers } from './editor';

const square = basics.start;

/** Where a point lands when the paper is folded along a line. */
function reflect(l: Line, p: Vec2): Vec2 {
  const s = sideOf(l, p);
  return [p[0] + 2 * s * l.d[1], p[1] - 2 * s * l.d[0]];
}


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

  it('lays an edge onto another line: the kite fold', () => {
    // The left edge, from the bottom-left corner up, onto the diagonal from that corner.
    const [a1, a2, b1, b2]: Vec2[] = [[-0.5, 0.5], [-0.5, -0.5], [-0.5, 0.5], [0.5, -0.5]];
    const l = lineEdgeOnto(a1, a2, b1, b2)!;
    expect(sideOf(l, a2)).toBeGreaterThan(0);
    const landed = reflect(l, a2);
    // On the diagonal, as far from the corner as it was.
    expect(Math.abs(sideOf(lineThrough(b1, b2), landed))).toBeLessThan(1e-9);
    expect(dist(landed, a1)).toBeCloseTo(1);
    expect(dist(landed, b2)).toBeLessThan(dist(landed, b1));
  });

  it('folds parallel edges together along the line midway', () => {
    const l = lineEdgeOnto([-0.5, -0.5], [-0.5, 0.5], [0.5, -0.5], [0.5, 0.5])!;
    expect(Math.abs(l.d[0])).toBeLessThan(1e-9);
    expect(l.p[0]).toBeCloseTo(0);
    expect(sideOf(l, [-0.5, 0])).toBeGreaterThan(0);
    expect(lineEdgeOnto([-0.5, -0.5], [-0.5, 0.5], [-0.5, 0], [-0.5, 1])).toBeNull();
  });

  it('turns the edge the way its picked ends say', () => {
    // The bottom edge onto the left edge: its left end stays at the corner, or goes the other way round.
    const same = lineEdgeOnto([-0.5, 0.5], [0.5, 0.5], [-0.5, 0.5], [-0.5, -0.5])!;
    expect(dist(reflect(same, [0.5, 0.5]), [-0.5, -0.5])).toBeLessThan(1e-9);
    const other = lineEdgeOnto([-0.5, 0.5], [0.5, 0.5], [-0.5, -0.5], [-0.5, 0.5])!;
    expect(Math.abs(reflect(other, [0.5, 0.5])[0] + 0.5)).toBeLessThan(1e-9);
    expect(reflect(other, [0.5, 0.5])[1]).toBeGreaterThan(0.5);
  });

  it('folds an edge onto a crease in a recipe', () => {
    const r = new Recipe({ id: 'kite', title: 'Kite', sheet: { size: [1, 1], front: '#fff', back: '#000' } });
    r.crease(paper(-0.5, 0.5), paper(0.5, -0.5), { title: 'Diagonal' }).edgeOnto([paper(-0.5, 0.5), paper(-0.5, -0.5)], [paper(-0.5, 0.5), paper(0.5, -0.5)], { title: 'Kite' });
    expect(r.build().steps).toHaveLength(3);
  });

  it('draws lifted steps from above', () => {
    const up = pose(square, { line: lineThrough([-1, 0], [1, 0]), angle: Math.PI / 2 });
    expect(project(up)).toHaveLength(2);
  });
});
