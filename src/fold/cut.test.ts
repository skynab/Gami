import { describe, expect, it } from 'vitest';
import { fromFoldFile, toFoldFile } from './fold-format';
import { joinedAlong } from './geometry2d';
import { replay } from './ops';
import { paper, Recipe, table } from './recipe';
import { problems } from './validate';

const square = () => new Recipe({ id: 'c', title: 'c', sheet: { size: [1, 1], front: '#fff', back: '#000' } });
// A slit from the middle of the top edge down to the centre, then the top left quarter folded down on its own.
const slit = () =>
  square()
    .cut(table(0, -0.5), table(0, 0), { title: 'Cut' })
    .along(table(-1, 0), table(1, 0), table(-0.25, -0.25), { title: 'Fold', only: ([u]) => u < 0 });

describe('scissor cuts', () => {
  it('counts an edge as joined unless cuts cover all of it', () => {
    expect(joinedAlong([0, 0], [1, 0], [])).toBe(true);
    expect(joinedAlong([0, 0], [1, 0], [[[0, 0], [1, 0]]])).toBe(false);
    expect(joinedAlong([0, 0], [1, 0], [[[0, 0], [0.5, 0]], [[0.5, 0], [1, 0]]])).toBe(false);
    expect(joinedAlong([0, 0], [1, 0], [[[0, 0], [0.6, 0]]])).toBe(true);
    expect(joinedAlong([0, 0], [1, 0], [[[0, 0.1], [1, 0.1]]])).toBe(true);
  });

  it('lets paper either side of a cut fold apart', () => {
    // Creased instead of cut, the quarter is joined to the one beside it, so folding it alone would tear the paper.
    expect(() => square().crease(paper(-0.5, 0), paper(0.5, 0), { title: 'Crease' }).along(table(-1, 0), table(1, 0), table(-0.25, -0.25), { title: 'Fold', only: ([u]) => u < 0 })).toThrow(/tear/);
    const model = slit().build();
    expect(model.steps[0].kind).toBe('cut');
    expect(model.steps[0].frame.cuts).toEqual([[[0, -0.5], [0, 0]]]);
    // The quarter folded down; the one beside it stayed.
    const [, folded] = model.steps.map((s) => s.frame);
    const where = (u: number, v: number) => {
      const i = folded.vertices_paper.findIndex((p) => Math.abs(p[0] - u) < 1e-9 && Math.abs(p[1] - v) < 1e-9);
      return [folded.vertices_coords[i][0], folded.vertices_coords[i][2]];
    };
    expect(where(-0.5, -0.5)).toEqual([-0.5, 0.5]);
    expect(where(0.5, -0.5)).toEqual([0.5, -0.5]);
    expect(problems(model)).toEqual([]);
  });

  it('keeps cuts in later frames, in .fold files and when folded again', () => {
    const model = slit().turnOver().build();
    expect(model.steps.at(-1)!.frame.cuts).toEqual(model.steps[0].frame.cuts);
    const back = fromFoldFile(JSON.parse(JSON.stringify(toFoldFile(model))));
    expect(back.steps.map((s) => s.frame.cuts)).toEqual(model.steps.map((s) => s.frame.cuts));
    expect(back.steps[0].op).toEqual({ op: 'cut', from: { table: [0, -0.5] }, to: { table: [0, 0] } });
    const again = replay(back);
    expect(again.status.every((s) => s === 'replayed')).toBe(true);
    expect(again.model.steps.at(-1)!.frame).toEqual(model.steps.at(-1)!.frame);
  });

  it('cuts only the top layers when asked', () => {
    const model = square()
      .onto(paper(0, -0.5), paper(0, 0.5), { title: 'Fold in half' })
      .cut(table(0, 0.5), table(0, 0.2), { title: 'Snip the top layer', layers: 1 })
      .build();
    // One layer cut: one stretch of cut on the sheet.
    expect(model.steps[1].frame.cuts).toHaveLength(1);
  });

  it('bends the flap between two slits up on its own', () => {
    // Two slits in from the bottom edge, and the strip between them bent up like an aileron: its corners on
    // the edge part from the paper beside it, which stays flat.
    const model = square()
      .cut(table(-0.1, 0.5), table(-0.1, 0.3), { title: 'Slit' })
      .cut(table(0.1, 0.5), table(0.1, 0.3), { title: 'Slit' })
      .shape({ title: 'Bend up' }, [{ through: [table(-1, 0.3), table(1, 0.3)], moving: table(0, 0.5), degrees: 30, only: ([u]) => Math.abs(u) < 0.1 }])
      .build();
    const f = model.steps.at(-1)!.frame;
    // The heights a point of the sheet is at: two, where a slit parts the paper.
    const heights = (u: number, v: number) => f.vertices_coords.filter((_, i) => Math.hypot(f.vertices_paper[i][0] - u, f.vertices_paper[i][1] - v) < 1e-9).map((p) => p[1]);
    for (const u of [-0.1, 0.1]) {
      expect(Math.max(...heights(u, 0.5))).toBeCloseTo(0.2 * Math.sin(Math.PI / 6));
      expect(Math.min(...heights(u, 0.5))).toBeCloseTo(0);
    }
    expect(heights(0.5, 0.5)).toEqual([0]);
    expect(problems(model)).toEqual([]);
  });
});
