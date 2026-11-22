import { describe, expect, it } from 'vitest';
import { toFlat } from './fold';
import { fromFoldFile, toFoldFile } from './fold-format';
import { opKind, replay } from './ops';
import { paper, Recipe, table } from './recipe';
import { faceColour, layOut, sheetOf } from './sheets';
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

describe('turning one sheet of several', () => {
  // Two squares side by side: a big one, and a little one to its right.
  const pair = () =>
    new Recipe({
      id: 'pair',
      title: 'Two squares',
      sheets: [
        { size: [1, 1], front: '#111111', back: '#222222', at: [0, 0] },
        { size: [0.2, 0.2], front: '#333333', back: '#444444', origin: [10, 0], at: [1, 0] },
      ],
    });
  const big = ([u]: [number, number]) => u < 5;
  const little = ([u]: [number, number]) => u > 5;

  it('turns over just the sheet picked, about its own middle, leaving the other where it lies', () => {
    const r = pair().onto(paper(-0.5, 0.5), paper(0.5, -0.5), { title: 'Fold one corner over', only: big });
    const littleBefore = r.where(paper(10, 0));
    const corner = r.where(paper(0.5, 0.5));
    r.turnOver('Turn the big square over.', { only: big });
    // The big square's own middle stays put; turning over a sheet beside it used to move it too.
    expect(r.where(paper(0.5, 0.5))[0]).toBeCloseTo(-corner[0]);
    expect(r.where(paper(10, 0))).toEqual(littleBefore);
    const model = r.build();
    expect(model.steps.at(-1)!.kind).toBe('turn-over');
    expect(opKind(model.steps.at(-1)!.op!)).toBe('turn-over');
  });

  it('turns just the sheet picked on the table, about its own middle', () => {
    const r = pair();
    const littleBefore = r.where(paper(10, 0));
    r.rotate(45, { title: 'Turn the big square' }, { only: big });
    const [x, z] = r.where(paper(0.5, 0.5));
    expect(x).toBeCloseTo(Math.SQRT1_2);
    expect(z).toBeCloseTo(0);
    expect(r.where(paper(10, 0))).toEqual(littleBefore);
  });

  it('folds again exactly as the recipe did, turning one sheet', () => {
    const model = pair()
      .rotate(45, { title: 'Turn the big square' }, { only: big })
      .turnOver('Turn it over.', { only: big })
      .build();
    const { model: again, status } = replay(model);
    expect(status).toEqual(['replayed', 'replayed']);
    again.steps.forEach((s, k) => expect(s.frame.vertices_coords).toEqual(model.steps[k].frame.vertices_coords));
  });

  it('counts the top layers on the sheet being folded, not on another stacked higher beside it', () => {
    // The little square, folded in half twice, is three layers higher than the big one, and a fold line down the
    // table crosses both.
    const r = pair()
      .onto(table(1.1, 0), table(0.9, 0), { title: 'Fold the little one in half', only: little })
      .onto(table(1, 0.1), table(1, -0.1), { title: 'And again', only: little });
    expect(() => r.onto(table(0.5, 0), table(0, 0), { title: 'Fold the big one’s top layer', layers: 1, only: big })).not.toThrow();
    const folded = toFlat(r.current).filter((f) => big(f.paper[0]));
    expect(folded.length).toBe(2);
  });
});

describe('laying out sheets for the Studio', () => {
  it('keeps a single sheet in plain coordinates', () => {
    const { sheets, start } = layOut([{ size: [1, 1], front: '#111111', back: '#222222', origin: [10, 0] }]);
    expect(sheets[0].origin).toBeUndefined();
    expect(Math.min(...start.vertices_paper.map((p) => p[0]))).toBeCloseTo(-0.5);
  });

  it('gives each sheet its own patch and puts them in a row, centred', () => {
    const square = { size: [1, 1] as [number, number], front: '#111111', back: '#222222' };
    const { sheets, start } = layOut([square, { ...square, size: [0.5, 1] }], 0.25);
    expect(sheets.map((s) => s.origin)).toEqual([[0, 0], [10, 0]]);
    const xs = start.vertices_coords.map((p) => p[0]);
    // 1 + 0.25 + 0.5 wide, centred.
    expect(Math.min(...xs)).toBeCloseTo(-0.875);
    expect(Math.max(...xs)).toBeCloseTo(0.875);
    // Every corner of the second sheet is on the second sheet.
    const second = start.faces_vertices[1].map((v) => start.vertices_paper[v]);
    expect(sheetOf(sheets, second)).toBe(1);
  });
});
