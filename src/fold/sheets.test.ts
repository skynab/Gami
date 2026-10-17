import { describe, expect, it } from 'vitest';
import { fromFoldFile, toFoldFile } from './fold-format';
import { paper, Recipe } from './recipe';
import { faceColour, sheetOf } from './sheets';
import { thumbnailSvg } from './thumbnail';
import { problems } from './validate';

const two = () =>
  new Recipe({
    id: 'two',
    title: 'Two sheets',
    sheets: [
      { size: [1, 0.5], front: '#111111', back: '#222222', at: [0, -0.5] },
      { size: [1, 0.5], front: '#333333', back: '#444444', origin: [10, 0], at: [0, 0.5] },
    ],
  });

describe('multi-sheet models', () => {
  it('tells which sheet a face is on from its sheet coordinates', () => {
    const { sheets } = two().build();
    expect(sheetOf(sheets, [[-0.4, 0], [0.4, 0], [0, 0.2]])).toBe(0);
    expect(sheetOf(sheets, [[9.6, 0], [10.4, 0], [10, 0.2]])).toBe(1);
    expect(faceColour({ sheets }, [[10, 0]], false)).toBe('#444444');
  });

  it('folds each sheet separately and validates', () => {
    const model = two()
      .onto(paper(0, 0.25), paper(0, -0.25), { title: 'Fold the first in half' })
      .onto(paper(10, 0.25), paper(10, -0.25), { title: 'Fold the second in half' })
      .build();
    expect(model.start.faces_vertices).toHaveLength(2);
    expect(problems(model)).toEqual([]);
    expect(thumbnailSvg(model)).toContain('#333333');
  });

  it('round-trips through .fold, and reads files from before multiple sheets', () => {
    const model = two().build();
    expect(fromFoldFile(JSON.parse(JSON.stringify(toFoldFile(model))))).toEqual(JSON.parse(JSON.stringify(model)));
    const { 'gami:sheets': sheets, ...old } = toFoldFile(model);
    expect(fromFoldFile({ ...old, 'gami:sheet': sheets[0] } as never).sheets).toEqual([sheets[0]]);
  });
});
