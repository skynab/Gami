import { describe, expect, it } from 'vitest';
import { kingBee } from '../models/recipes/king-bee';
import { BREAK, breaksIn, restingBreaks } from './breaks';
import { LAYER_GAP } from './frames';
import { Recipe, table } from './recipe';
import type { FoldFrame } from './types';

/**
 * The king bee as its wings opened before 27 November 2026 (step 21 then, "Fold up the wingtips"), cut down to four
 * faces of the frame: the body stood 41 layers up, as high as its flat stack's top, the first wing lay on the
 * table under it, and the second, turned right over, lay on the table a stack's width beyond it. Each wing's face
 * here is joined along the crease at the wing line to a face of the body.
 */
const kingBeeBefore: FoldFrame = {
  vertices_coords: [
    [0.305264, -0.0385, 0.350793], [0.142617, -0.0385, 0.418164], [0.305264, -0.0385, 0.418164],
    [0.142617, 0.0287, 0.446864], [-0.002236, 0.0887, 0.446864], [0.305264, 0.0887, 0.446864], [0.305264, 0.0287, 0.446864],
    [0.142617, 0, 0.437764], [0.305264, 0, 0.505135], [0.305264, 0, 0.437764],
    [0.305264, 0.0887, 0.447564], [-0.002236, 0.0887, 0.447564], [0.142617, 0.0287, 0.447564], [0.305264, 0.0287, 0.447564],
  ],
  vertices_paper: [
    [-0.3075, -0.242371], [-0.144853, -0.175], [-0.259862, -0.290009],
    [-0.144853, -0.175], [0, -0.115], [-0.217435, -0.332435], [-0.259862, -0.290009],
    [0.144853, -0.175], [0.3075, -0.242371], [0.259862, -0.290009],
    [0.217435, -0.332435], [0, -0.115], [0.144853, -0.175], [0.259862, -0.290009],
  ],
  // The second wing, the body's face joined to it, the first wing, and the body's face joined to that.
  faces_vertices: [[0, 1, 2], [3, 4, 5, 6], [7, 8, 9], [10, 11, 12, 13]],
  faces_layer: [55, 28, 0, 27],
};

/** The two halves of a unit square, joined along u = 0: the left on the table, the right placed by `right` (its corners). */
const hinge = (right: [number, number, number][]): FoldFrame => ({
  vertices_coords: [[-0.5, 0, 0.5], [0, 0, 0.5], [0, 0, -0.5], [-0.5, 0, -0.5], ...right],
  vertices_paper: [[-0.5, 0.5], [0, 0.5], [0, -0.5], [-0.5, -0.5], [0, 0.5], [0.5, 0.5], [0.5, -0.5], [0, -0.5]],
  faces_vertices: [[0, 1, 2, 3], [4, 5, 6, 7]],
});

describe('paper come apart at rest', () => {
  it('finds the king bee’s body floating off its wings, as it did when they opened', () => {
    const found = breaksIn(kingBeeBefore).sort((a, b) => b.gap - a.gap);
    // Both wings: 6 mm and 4.5 mm on a 15 cm sheet.
    expect(found.map((b) => b.faces)).toEqual([[0, 1], [2, 3]]);
    expect(found[0].gap).toBeCloseTo(0.0406, 3);
    expect(found[1].gap).toBeCloseTo(0.0303, 3);
    expect(found.every((b) => b.gap > BREAK)).toBe(true);
  });

  it('finds the king bee’s wings joined to its body now, wingtips and all', () => {
    const model = kingBee();
    const tips = model.steps.findIndex((s) => s.title === 'Fold up the wingtips') + 1;
    expect(tips).toBeGreaterThan(0);
    expect(restingBreaks(model)).toEqual([]);
    // Within the thickness of the wings at their crease (14 layers).
    expect(Math.max(...breaksIn(model.steps[tips - 1].frame, 0).map((b) => b.gap))).toBeLessThan(15 * LAYER_GAP);
  });

  it('leaves layers stacked at a fold alone, which the viewer closes with a bend', () => {
    // Folded right over, 20 layers above: apart along the faces' normal only.
    const over = hinge([[0, 20 * LAYER_GAP, 0.5], [-0.5, 20 * LAYER_GAP, 0.5], [-0.5, 20 * LAYER_GAP, -0.5], [0, 20 * LAYER_GAP, -0.5]]);
    expect(breaksIn(over)).toEqual([]);
    // The same, slid a centimetre along the table as well: torn.
    const slid = hinge([[0.07, 20 * LAYER_GAP, 0.5], [-0.43, 20 * LAYER_GAP, 0.5], [-0.43, 20 * LAYER_GAP, -0.5], [0.07, 20 * LAYER_GAP, -0.5]]);
    expect(breaksIn(slid).map((b) => b.faces)).toEqual([[0, 1]]);
  });

  it('finds a fold stood up off its crease', () => {
    // Stood straight up from the crease: joined. Stood up 2 cm clear of it: torn, by 2 cm.
    const up = (y: number) => hinge([[0, y, 0.5], [0, y + 0.5, 0.5], [0, y + 0.5, -0.5], [0, y, -0.5]]);
    expect(breaksIn(up(0))).toEqual([]);
    const [b] = breaksIn(up(0.02 / 0.15));
    expect(b.gap).toBeCloseTo(0.02 / 0.15, 6);
    expect(b.paper).toEqual([0, 0]);
  });

  it('lets paper either side of a scissor cut part', () => {
    // A slit from the middle of the top edge to the centre, and the top left quarter folded down on its own: the
    // quarters beside the slit are far apart, but not joined.
    const slit = new Recipe({ id: 'c', title: 'c', sheet: { size: [1, 1], front: '#fff', back: '#000' } })
      .cut(table(0, -0.5), table(0, 0), { title: 'Cut' })
      .along(table(-1, 0), table(1, 0), table(-0.25, -0.25), { title: 'Fold', only: ([u]) => u < 0 })
      .build();
    expect(restingBreaks(slit)).toEqual([]);
  });
});
