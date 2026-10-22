import { describe, expect, it } from 'vitest';
import { fromFoldFile, toFoldFile } from './fold-format';
import { replay } from './ops';
import { paper, Recipe, table } from './recipe';
import { locate } from './select';
import { problems } from './validate';
import type { Vec2 } from './types';

/** A square with its bottom right corner folded over on a hinge from the middle of the bottom edge. */
const corner = () =>
  new Recipe({ id: 's', title: 's', sheet: { size: [1, 1], front: '#fff', back: '#000' } }).along(table(0, 0.5), table(0.5, 0), table(0.45, 0.45), {
    title: 'Fold the corner over',
  });

/** The corner's paper: beyond its hinge on the sheet. */
const flap = ([u, v]: Vec2) => u + v > 0.5;

describe('swivel folds', () => {
  it('swings a flap round its pivot, the wedge folding into a gusset', () => {
    // The corner lies at the middle of the sheet; swivelled 30° anticlockwise (across the rest of the sheet) about
    // the middle of the bottom edge, it moves round a circle about there.
    const r = corner().swivel({ title: 'Swivel' }, { pivot: paper(0, 0.5), hinge: paper(0.5, 0), degrees: 30, anchor: paper(-0.4, -0.4), flap });
    const model = r.build();
    const before = locate(model.steps[0].frame, [0.5, 0.5]);
    const after = locate(model.steps[1].frame, [0.5, 0.5]);
    const pivot: Vec2 = [0, 0.5];
    const radius = (q: Vec2) => Math.hypot(q[0] - pivot[0], q[1] - pivot[1]);
    expect(radius(after)).toBeCloseTo(radius(before));
    // Anticlockwise seen from above, with z towards you on the table.
    const angle = (q: Vec2) => Math.atan2(pivot[1] - q[1], q[0] - pivot[0]);
    expect(((angle(after) - angle(before)) * 180) / Math.PI).toBeCloseTo(30);
    // The rest of the sheet's far corner stays put.
    expect(locate(model.steps[1].frame, [-0.5, -0.5])).toEqual([-0.5, -0.5]);
    expect(problems(model)).toEqual([]);
  });

  it('is kept as a collapse, so it folds again from its .fold file', () => {
    const model = corner()
      .swivel({ title: 'Swivel' }, { pivot: paper(0, 0.5), hinge: paper(0.5, 0), degrees: 20, anchor: paper(-0.4, -0.4), flap })
      .build();
    expect(model.steps[1].op?.op).toBe('collapse');
    const back = fromFoldFile(JSON.parse(JSON.stringify(toFoldFile(model))));
    const again = replay(back);
    expect(again.status.every((s) => s === 'replayed')).toBe(true);
    expect(toFoldFile(again.model)).toEqual(toFoldFile(back));
  });

  it('refuses to swing a flap where there is no paper to swing across', () => {
    expect(() => corner().swivel({ title: 'Swivel' }, { pivot: paper(0, 0.5), hinge: paper(0.5, 0), degrees: -20, anchor: paper(-0.4, -0.4), flap })).toThrow(/no paper/);
  });
});
