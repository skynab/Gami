import { describe, expect, it } from 'vitest';
import { basics } from '../models/basics';
import { poseAt, transition } from './animate';
import { fold, FoldError, rotate, toFlat, turnOver, unfoldTo } from './fold';
import { dist, lineOnto, lineThrough, overlapArea } from './geometry2d';
import { facePositions } from './frames';
import type { FoldFrame, Vec2 } from './types';

const square = basics.start;

/** Every face keeps its paper shape, and stacked faces have different layers where they overlap. */
function expectValid(frame: FoldFrame) {
  const faces = toFlat(frame);
  for (const f of faces) {
    for (let i = 0; i < f.paper.length; i++) {
      const j = (i + 1) % f.paper.length;
      expect(dist(f.world[i], f.world[j])).toBeCloseTo(dist(f.paper[i], f.paper[j]), 6);
    }
  }
  for (let a = 0; a < faces.length; a++) {
    for (let b = a + 1; b < faces.length; b++) {
      if (overlapArea(faces[a].world, faces[b].world) > 1e-6) expect(faces[a].layer).not.toBe(faces[b].layer);
    }
  }
  const area = faces.reduce((sum, f) => sum + Math.abs(polygonArea(f.paper)), 0);
  expect(area).toBeCloseTo(1, 6);
}

function polygonArea(p: Vec2[]) {
  let a = 0;
  for (let i = 0; i < p.length; i++) a += p[i][0] * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * p[i][1];
  return a / 2;
}

const at = (frame: FoldFrame, paper: Vec2) => {
  const v = frame.vertices_paper.findIndex((p) => dist(p, paper) < 1e-9);
  return frame.vertices_coords[v];
};

describe('fold engine', () => {
  it('rebuilds Folding basics from fold, unfold and turn over', () => {
    const f1 = fold(square, { line: lineOnto([-0.5, -0.5], [0.5, 0.5]), kind: 'valley' });
    expect(at(f1, [-0.5, -0.5])).toEqual([0.5, 0, 0.5].map((x) => expect.closeTo(x, 9)));
    expect(f1.faces_vertices).toHaveLength(2);
    expect([...f1.faces_layer!].sort()).toEqual([0, 1]);

    const f2 = unfoldTo([square, f1], 0);
    for (let v = 0; v < f2.vertices_paper.length; v++) {
      const [u, w] = f2.vertices_paper[v];
      expect(f2.vertices_coords[v]).toEqual([u, 0, w].map((x) => expect.closeTo(x, 9)));
    }
    expect(f2.faces_vertices).toHaveLength(2);

    const f3 = turnOver(f2);
    expect(at(f3, [-0.5, 0.5])).toEqual([0.5, 0, 0.5].map((x) => expect.closeTo(x, 9)));

    const f4 = fold(f3, { line: lineOnto([0, 0.5], [0, -0.5]), kind: 'valley' });
    expect(f4.faces_vertices).toHaveLength(4);
    expect(at(f4, [-0.5, 0.5])).toEqual([0.5, 0, -0.5].map((x) => expect.closeTo(x, 9)));
    for (const f of [f1, f2, f3, f4]) expectValid(f);
  });

  it('puts a mountain fold underneath', () => {
    const f = fold(square, { line: lineOnto([0, 0.5], [0, -0.5]), kind: 'mountain' });
    const faces = toFlat(f);
    const moved = faces.find((x) => x.paper.some((p) => p[1] > 0.4))!;
    const stayed = faces.find((x) => x.paper.some((p) => p[1] < -0.4))!;
    expect(moved.layer).toBeLessThan(stayed.layer);
    expectValid(f);
  });

  it('keeps stacks in order through repeated folds', () => {
    let f = fold(square, { line: lineOnto([0, 0.5], [0, -0.5]), kind: 'valley' });
    f = fold(f, { line: lineOnto([0.5, -0.25], [-0.5, -0.25]), kind: 'valley' });
    f = fold(f, { line: lineOnto([-0.5, 0], [0, -0.5]), kind: 'valley' });
    expectValid(f);
    expect(Math.max(...f.faces_layer!)).toBe(7);
  });

  it('folds only the top layer when that doesn’t tear the paper', () => {
    const half = fold(square, { line: lineOnto([0, 0.5], [0, -0.5]), kind: 'valley' });
    // The top layer's free edge folds back down; it's only joined to the bottom layer at the far crease.
    const flap = fold(half, { line: { p: [0, -0.25], d: [-1, 0] }, kind: 'valley', layers: 1 });
    expectValid(flap);
    expect(toFlat(flap)).toHaveLength(3);
  });

  it('refuses a top-layer fold that would tear the paper', () => {
    const half = fold(square, { line: lineOnto([0, 0.5], [0, -0.5]), kind: 'valley' });
    expect(() => fold(half, { line: lineThrough([0.25, -1], [0.25, 1]), kind: 'valley', layers: 1 })).toThrow(FoldError);
  });

  it('refuses a fold with nothing to fold', () => {
    expect(() => fold(square, { line: lineThrough([-1, 0.5], [1, 0.5]), kind: 'valley' })).toThrow(FoldError);
  });

  it('rotates on the table and turns over without changing shape', () => {
    const half = fold(square, { line: lineOnto([0, 0.5], [0, -0.5]), kind: 'valley' });
    expectValid(rotate(half, Math.PI / 2));
    expectValid(turnOver(half));
    expect(turnOver(half).faces_layer).toEqual([...half.faces_layer!].map((l) => 1 - l));
  });

  it('makes steps the animator can play without stretching', () => {
    const frames = [square];
    frames.push(fold(frames[0], { line: lineOnto([-0.5, -0.5], [0.5, 0.5]), kind: 'valley' }));
    frames.push(fold(frames[1], { line: lineOnto([0.5, -0.5], [0.5, 0.5]), kind: 'mountain' }));
    frames.push(unfoldTo(frames, 0));
    for (let k = 1; k < frames.length; k++) {
      const t = transition(frames[k - 1], frames[k]);
      const end = facePositions(frames[k]);
      poseAt(t, 1 - 1e-9).forEach((pts, i) => pts.forEach((p, c) => expect(dist([p[0], p[2]], [end[i][c][0], end[i][c][2]])).toBeLessThan(1e-6)));
      poseAt(t, 0.5).forEach((pts, i) => {
        const paper = t.faces[i].paper;
        for (let a = 0; a < pts.length; a++) {
          const b = (a + 1) % pts.length;
          expect(Math.hypot(pts[a][0] - pts[b][0], pts[a][1] - pts[b][1], pts[a][2] - pts[b][2])).toBeCloseTo(dist(paper[a], paper[b]), 6);
        }
      });
    }
  });
});
