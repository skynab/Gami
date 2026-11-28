import { describe, expect, it } from 'vitest';
import { facePositions, LAYER_GAP, normal } from '../fold/frames';
import type { FoldFrame, OrigamiModel, Vec3 } from '../fold/types';
import { kestrel } from '../models/recipes/kestrel';
import { COVER_RANGE, coverNeeded, depthSteps, lineCovers, showingThrough, SLACK, stepsShowingThrough, SURFACE_OFFSET } from './depth';
import { CAMERA, nearFor } from './views';

const kestrelModel = kestrel();
const last = kestrelModel.steps.length;

/** A model of one step: two unit squares lying one on the other, `gap` apart. */
const stacked = (gap: number): OrigamiModel => {
  const frame: FoldFrame = {
    vertices_coords: [[-0.5, 0, -0.5], [0.5, 0, -0.5], [0.5, 0, 0.5], [-0.5, 0, 0.5], [-0.5, gap, -0.5], [0.5, gap, -0.5], [0.5, gap, 0.5], [-0.5, gap, 0.5]],
    vertices_paper: [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5], [-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]],
    faces_vertices: [[0, 3, 2, 1], [4, 7, 6, 5]],
  };
  return { id: 's', title: 's', sheets: [{ size: [1, 1], front: '#fff', back: '#000' }], start: frame, steps: [{ title: 'Stack', frame }] } as unknown as OrigamiModel;
};

describe('paper underneath kept out of sight', () => {
  it('showed the kestrel’s creases underneath through its wings, zoomed right out, with the near plane fixed', () => {
    // As it was until November 2026: a layer's gap was under two of the depth buffer's steps from 8 away.
    expect(depthSteps(LAYER_GAP, CAMERA.maxDistance, CAMERA.near)).toBeLessThan(SURFACE_OFFSET + SLACK);
    const before = showingThrough(kestrelModel, { near: CAMERA.near });
    expect(before.map((s) => s.step)).toContain(last);
    // Layers a gap apart, on top of each other: not paper lying on paper.
    expect(Math.min(...before.filter((s) => s.step === last).map((s) => s.gap))).toBeGreaterThan(0.9 * LAYER_GAP);
    // Close up it was fine, as it still is.
    expect(stepsShowingThrough(kestrelModel, { distance: 1, near: CAMERA.near })).toEqual([]);
  });

  it('keeps them hidden zoomed right out, now the near plane follows the camera out', () => {
    expect(nearFor(CAMERA.minDistance)).toBe(CAMERA.near);
    expect(depthSteps(LAYER_GAP, CAMERA.maxDistance + 1, nearFor(CAMERA.maxDistance))).toBeGreaterThan(5 * (SURFACE_OFFSET + SLACK));
    expect(stepsShowingThrough(kestrelModel)).toEqual([]);
    for (let d = CAMERA.minDistance; d <= CAMERA.maxDistance; d += 0.5) expect(stepsShowingThrough(kestrelModel, { distance: d }), `${d} away`).toEqual([]);
  });

  it('finds paper lying right on other paper however close the camera is', () => {
    expect(showingThrough(stacked(0), { distance: CAMERA.minDistance })).toEqual([{ step: 1, faces: [0, 1], gap: 0, steps: 0 }]);
    // A layer's gap apart, the lower one stays hidden from anywhere.
    expect(stepsShowingThrough(stacked(LAYER_GAP))).toEqual([]);
    // Side by side rather than one on the other, nothing is hidden to show.
    const side = stacked(0);
    side.steps[0].frame.vertices_coords = side.steps[0].frame.vertices_coords.map(([x, y, z], i) => (i < 4 ? [x, y, z] : [x + 1, y, z]));
    expect(showingThrough(side)).toEqual([]);
  });
});

/** How big a pixel is `z` from the camera, on a canvas `height` pixels tall. */
const pixelAt = (z: number, height: number) => (2 * z * Math.tan((CAMERA.fov / 2) * (Math.PI / 180))) / height;
/** The free view's slant, on paper lying flat. */
const freeSlant = Math.sin(Math.PI / 3.6);

/** Every stretch of crease line in a frame, with the paper over it (see `lineCovers`). */
const stretches = (frame: FoldFrame) => {
  const pose = facePositions(frame);
  const covers = lineCovers(pose);
  return pose.flatMap((face, f) => face.flatMap((p, i) => covers(f, p, face[(i + 1) % face.length], 0, 1).map((s) => ({ ...s, face: f }))));
};

describe('crease lines under paper on top', () => {
  const lines = stretches(kestrelModel.steps[last - 1].frame);
  const nearest = (s: { front: number; back: number }) => Math.min(s.front, s.back);

  it('finds the kestrel’s creases inside its wing, which showed through it from the free view', () => {
    // The paper is pushed back by a pixel's worth of its slope, so its own creases draw on top. From the free view,
    // that's further than the layers inside the wing lie under it: their creases came out on top as a web of lines
    // zoomed out, and as a triangle in the middle of the wing at the usual zoom (about two sheets off).
    for (const [z, height] of [
      [CAMERA.maxDistance, 650],
      [2, 650],
    ]) {
      const pushed = pixelAt(z, height) * freeSlant;
      const through = lines.filter((s) => nearest(s) < pushed);
      expect(through.length, `${z} away`).toBeGreaterThan(0);
      // Each is left out where the viewer draws the lines: under paper too close above it for depth to hide.
      expect(through.every((s) => nearest(s) < coverNeeded(pixelAt(z, height), freeSlant, z, nearFor(z))), `${z} away`).toBe(true);
    }
    // Close up and straight on, depth hides them, and they're drawn.
    expect(lines.filter((s) => nearest(s) < coverNeeded(pixelAt(0.5, 650), 0, 0.5, nearFor(0.5)))).toEqual([]);
  });

  it('keeps the lines along the edges of the paper on top, where a fold joins it', () => {
    // Two squares folded one onto the other along u = 0: the fold's line, the edges round them, and none under
    // the other square, which lies right over the one beneath.
    const gap = 2 * LAYER_GAP;
    const square = (y: number): Vec3[] => [[0, y, -0.5], [0, y, 0.5], [0.5, y, 0.5], [0.5, y, -0.5]];
    const covers = lineCovers([square(0), square(gap)]);
    const lower = square(0);
    for (let i = 0; i < 4; i++) expect(covers(0, lower[i], lower[(i + 1) % 4], 0, 1)).toEqual([{ from: 0, to: 1, front: Infinity, back: Infinity }]);
  });

  it('cuts a line into the stretches under paper and those not', () => {
    // A long face, and a square lying a layer over its middle (seen from its front, the face's normal pointing
    // up), and another lying two layers under its left end.
    const long: Vec3[] = [[-1, 0, 0], [-1, 0, 1], [1, 0, 1], [1, 0, 0]];
    const over: Vec3[] = [[-0.25, LAYER_GAP, -0.5], [-0.25, LAYER_GAP, 0.75], [0.25, LAYER_GAP, 0.75], [0.25, LAYER_GAP, -0.5]];
    const under: Vec3[] = [[-1.5, -2 * LAYER_GAP, -0.5], [-1.5, -2 * LAYER_GAP, 0.75], [-0.5, -2 * LAYER_GAP, 0.75], [-0.5, -2 * LAYER_GAP, -0.5]];
    const covers = lineCovers([long, over, under]);
    // Along z = 0, from x = 1 to x = -1 (the face's last edge, its corners being counted round anticlockwise from above).
    const along = covers(0, long[3], long[0], 0, 1);
    expect(along.map((s) => [+s.from.toFixed(4), +s.to.toFixed(4)])).toEqual([[0, 0.375], [0.375, 0.625], [0.625, 0.75], [0.75, 1]]);
    // Paper above is on the face's front if its front faces up, and paper below on its back; the other way round if not.
    const up = normal(long)[1] > 0;
    const [above, below] = up ? (['front', 'back'] as const) : (['back', 'front'] as const);
    expect(along[1][above]).toBeCloseTo(LAYER_GAP, 9);
    expect(along[1][below]).toBe(Infinity);
    expect(along[3][below]).toBeCloseTo(2 * LAYER_GAP, 9);
    expect(along[3][above]).toBe(Infinity);
    expect([along[0].front, along[0].back, along[2].front, along[2].back]).toEqual([Infinity, Infinity, Infinity, Infinity]);
  });

  it('always asks for less than it looks for', () => {
    // On a small phone, zoomed right out, edge on: still within reach of the paper `lineCovers` looks for.
    const z = CAMERA.maxDistance + 2;
    expect(coverNeeded(pixelAt(z, 300), 1, z, nearFor(CAMERA.maxDistance))).toBeLessThan(COVER_RANGE);
  });
});
