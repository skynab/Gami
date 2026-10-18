import type { OrigamiModel, Vec2, Vec3 } from '../fold/types';

/**
 * "Folding basics": a four-step practice model, written by hand. It covers a fold, an unfold, turning over,
 * and a fold that splits existing faces. Kept by hand as a fixed model for the engine's tests; the gallery's
 * copy is made from a recipe (recipes/basics.ts), so its file says how each step is folded.
 *
 * Paper corners: BL (−½, ½), BR (½, ½), TR (½, −½), TL (−½, −½). "Top" is the edge furthest from you.
 */

const BL: Vec2 = [-0.5, 0.5];
const BR: Vec2 = [0.5, 0.5];
const TR: Vec2 = [0.5, -0.5];
const TL: Vec2 = [-0.5, -0.5];
const C: Vec2 = [0, 0];
const L: Vec2 = [-0.5, 0];
const R: Vec2 = [0.5, 0];

/** Flat on the table, front side up. */
const flat = ([u, v]: Vec2): Vec3 => [u, 0, v];
/** Flat on the table, turned over left to right. */
const flipped = ([u, v]: Vec2): Vec3 => [-u, 0, v];
/** Turned over, then folded bottom edge to top edge. */
const flippedFoldedUp = ([u, v]: Vec2): Vec3 => [-u, 0, -v];

const corners = [BL, BR, TR, TL];
/** The diagonal from BL to TR splits the square into two triangles. */
const halves = [
  [0, 1, 2],
  [0, 2, 3],
];

export const basics: OrigamiModel = {
  id: 'basics',
  title: 'Folding basics',
  sheets: [{ size: [1, 1], front: '#5b54e8', back: '#f6f3ec' }],
  start: {
    vertices_paper: corners,
    vertices_coords: corners.map(flat),
    faces_vertices: [[0, 1, 2, 3]],
  },
  steps: [
    {
      title: 'Fold in half diagonally',
      text: 'Bring the top-left corner down to meet the bottom-right corner, then press the crease flat.',
      kind: 'fold',
      frame: {
        vertices_paper: corners,
        // TL lands on BR; the other corners stay put.
        vertices_coords: [flat(BL), flat(BR), flat(TR), flat(BR)],
        faces_vertices: halves,
        faces_parent: [0, 0],
        faces_layer: [0, 1],
      },
    },
    {
      title: 'Unfold',
      text: 'Open the paper back up. The diagonal crease stays as a guide for later.',
      kind: 'unfold',
      frame: {
        vertices_paper: corners,
        vertices_coords: corners.map(flat),
        faces_vertices: halves,
      },
    },
    {
      title: 'Turn over',
      text: 'Flip the paper from left to right, so the white side faces up.',
      kind: 'turn-over',
      frame: {
        vertices_paper: corners,
        vertices_coords: corners.map(flipped),
        faces_vertices: halves,
      },
    },
    {
      title: 'Fold in half',
      text: 'Bring the bottom edge up to the top edge and crease. The fold crosses the diagonal at the centre.',
      kind: 'fold',
      frame: {
        // The new crease runs from L to R through C, splitting both triangles in two.
        vertices_paper: [BL, BR, TR, TL, C, L, R],
        vertices_coords: [
          // The bottom half swings over onto the top half...
          flippedFoldedUp(BL),
          flippedFoldedUp(BR),
          // ...and everything on the crease or above it stays put.
          flipped(TR),
          flipped(TL),
          flipped(C),
          flipped(L),
          flipped(R),
        ],
        faces_vertices: [
          [0, 1, 6, 4],
          [6, 2, 4],
          [0, 4, 5],
          [4, 2, 3, 5],
        ],
        faces_parent: [0, 0, 1, 1],
        faces_layer: [1, 0, 1, 0],
      },
    },
  ],
};
