import { describe, expect, it } from 'vitest';
import { basics } from '../models/basics';
import { fold, FoldError } from './fold';
import { lineOnto } from './geometry2d';
import { paper, Recipe, table } from './recipe';
import { radial, shape } from './shape';
import { problems } from './validate';

const square = basics.start;
const at = (frame: typeof square, u: number, v: number) => frame.vertices_coords[frame.vertices_paper.findIndex(([a, b]) => Math.abs(a - u) < 1e-9 && Math.abs(b - v) < 1e-9)];

describe('shape', () => {
  it('turns paper beyond two bends by both', () => {
    // Lines at z = 0 and z = 0.25, the near side turning up a quarter turn at each: the near edge ends up
    // folded right back over, a quarter of a sheet up.
    const up = shape(square, [
      { line: { p: [0, 0], d: [1, 0] }, angle: Math.PI / 2 },
      { line: { p: [0, 0.25], d: [1, 0] }, angle: Math.PI / 2 },
    ]);
    const corner = at(up, -0.5, 0.5);
    expect(corner[0]).toBeCloseTo(-0.5);
    expect(corner[1]).toBeCloseTo(0.25);
    expect(corner[2]).toBeCloseTo(-0.25);
    // The bit between the lines stands straight up.
    expect(at(up, -0.5, 0.25)[1]).toBeCloseTo(0.25);
  });

  it('curls a flap without stretching, and animates cleanly', () => {
    const r = new Recipe({ id: 'curl', title: 'Curl', sheet: { size: [1, 1], front: '#fff', back: '#000' } }).shape({ title: 'Curl the edge' }, [
      { through: [table(-1, 0), table(1, 0)], moving: table(0, 0.5), degrees: 180, segments: 6 },
    ]);
    const model = r.build();
    expect(problems(model)).toEqual([]);
    // Curled through a half turn over half a sheet: the edge comes back over the line, a curl's width up.
    const edge = at(model.steps[0].frame, -0.5, 0.5);
    expect(edge[2]).toBeLessThan(0.05);
    expect(edge[1]).toBeGreaterThan(0.25);
  });

  it('shapes separate flaps separately, and builds on earlier shaping', () => {
    const r = new Recipe({ id: 'wings', title: 'Wings', sheet: { size: [1, 1], front: '#fff', back: '#000' } })
      .shape({ title: 'Lift the left edge' }, [{ through: [table(-0.25, -1), table(-0.25, 1)], moving: paper(-0.5, 0.5), degrees: 60 }])
      .shape({ title: 'And the right' }, [{ through: [table(0.25, -1), table(0.25, 1)], moving: paper(0.5, 0.5), degrees: 60 }]);
    const model = r.build();
    expect(problems(model)).toEqual([]);
    const last = model.steps[1].frame;
    expect(at(last, -0.5, 0.5)[1]).toBeCloseTo(0.25 * Math.sin(Math.PI / 3));
    expect(at(last, 0.5, 0.5)[1]).toBeCloseTo(0.25 * Math.sin(Math.PI / 3));
  });

  it('refuses to bend layers that are joined to the ones below elsewhere', () => {
    const half = fold(square, { line: lineOnto([0.5, 0], [-0.5, 0]), kind: 'valley' });
    expect(() => shape(half, [{ line: lineOnto([0, 0.5], [0, -0.5]), angle: 1, layers: 1 }])).toThrow(FoldError);
  });
});

describe('shape, combining bends', () => {
  it('puts the bend turning more paper nearest the base, whatever the order', () => {
    const near = { line: { p: [0, 0] as [number, number], d: [1, 0] as [number, number] }, angle: Math.PI / 2 };
    const far = { line: { p: [0, 0.25] as [number, number], d: [1, 0] as [number, number] }, angle: Math.PI / 2 };
    const a = shape(square, [near, far]);
    const b = shape(square, [far, near]);
    expect(at(b, -0.5, 0.5)).toEqual(at(a, -0.5, 0.5));
  });

  it('refuses bends that cross on the paper they turn', () => {
    expect(() =>
      shape(square, [
        { line: { p: [0, 0], d: [1, 0] }, angle: 1 },
        { line: { p: [0, 0], d: [0, 1] }, angle: 1 },
      ]),
    ).toThrow(FoldError);
  });

  it('raises walls together, pinching the corners into ears', () => {
    // A tray: four walls round a middle square, each standing straight up about its own line. Where two meet,
    // the corner square folds along its diagonal into an ear standing out from the corner.
    const walls = (degrees: number) =>
      [
        [table(0.3, -1), table(0.3, 1), table(0.45, 0)],
        [table(-0.3, -1), table(-0.3, 1), table(-0.45, 0)],
        [table(-1, 0.3), table(1, 0.3), table(0, 0.45)],
        [table(-1, -0.3), table(1, -0.3), table(0, -0.45)],
      ].map(([a, b, moving]) => ({ through: [a, b] as [typeof a, typeof a], moving, degrees }));
    const tray = new Recipe({ id: 'tray', title: 'Tray', sheet: { size: [1, 1], front: '#fff', back: '#000' } })
      .shape({ title: 'Raise the walls' }, walls(90), { corners: true })
      .build();
    const f = tray.steps[0].frame;
    // The walls stand straight up, 0.2 high, and each corner's ear stands out diagonally at the top.
    expect(at(f, 0.5, 0.3)).toEqual([expect.closeTo(0.3), expect.closeTo(0.2), expect.closeTo(0.3)]);
    expect(at(f, 0.5, 0.5)).toEqual([expect.closeTo(0.3 + 0.2 * Math.SQRT1_2), expect.closeTo(0.2), expect.closeTo(0.3 + 0.2 * Math.SQRT1_2)]);
    // The middle stays on the table, and nothing stretches, on the way up or at the end.
    expect(at(f, 0.3, 0.3)).toEqual([expect.closeTo(0.3), 0, expect.closeTo(0.3)]);
    expect(problems(tray)).toEqual([]);
    // Without corners, the same walls would stretch the paper where they meet.
    expect(() => new Recipe({ id: 'tray', title: 'Tray', sheet: { size: [1, 1], front: '#fff', back: '#000' } }).shape({ title: 'Raise' }, walls(90))).toThrow(FoldError);
  });

  it('keeps raised corners in .fold files', async () => {
    const { fromFoldFile, toFoldFile } = await import('./fold-format');
    const { replay } = await import('./ops');
    const tray = new Recipe({ id: 'tray', title: 'Tray', sheet: { size: [1, 1], front: '#fff', back: '#000' } })
      .shape(
        { title: 'Raise the walls' },
        [
          { through: [table(0.3, -1), table(0.3, 1)], moving: table(0.45, 0), degrees: 60 },
          { through: [table(-1, 0.3), table(1, 0.3)], moving: table(0, 0.45), degrees: 60 },
        ],
        { corners: true },
      )
      .build();
    const back = fromFoldFile(JSON.parse(JSON.stringify(toFoldFile(tray))));
    expect(back.steps[0].op).toMatchObject({ op: 'shape', corners: true });
    const again = replay(back);
    expect(again.status.every((s) => s === 'replayed')).toBe(true);
    expect(toFoldFile(again.model)).toEqual(toFoldFile(back));
  });

  it('opens stacked pleats one by one, along the paper', () => {
    // A strip pleated into four panels lies in a stack, its folds on two lines. Opened along the paper from the
    // first panel, each fold opens a sixth of a turn: the panels zigzag up, each one 60° off the one before.
    const r = new Recipe({ id: 'pleats', title: 'Pleats', sheet: { size: [1, 0.25], front: '#fff', back: '#000' } }).collapse(
      { title: 'Pleat' },
      [
        { through: [table(-0.25, -1), table(-0.25, 1)], kind: 'valley' },
        { through: [table(0, -1), table(0, 1)], kind: 'mountain' },
        { through: [table(0.25, -1), table(0.25, 1)], kind: 'valley' },
      ],
      paper(-0.4, 0),
    );
    const model = r
      .shape(
        { title: 'Open the pleats' },
        [-0.25, -0.5].map((x) => ({ through: [table(x, -1), table(x, 1)] as [ReturnType<typeof table>, ReturnType<typeof table>], moving: table(-0.4, 0), degrees: 60 })),
        { chained: paper(-0.4, 0) },
      )
      .build();
    const f = model.steps.at(-1)!.frame;
    const edge = (u: number) => f.vertices_coords.find((_, i) => Math.abs(f.vertices_paper[i][0] - u) < 1e-9 && Math.abs(f.vertices_paper[i][1] + 0.125) < 1e-9)!;
    const h = 0.25 * Math.sin(Math.PI / 3);
    // The first panel flat, the second rising back at 60°, the third level again, the fourth rising again.
    expect(edge(-0.25)[1]).toBeCloseTo(0, 2);
    expect(edge(0)).toEqual([expect.closeTo(-0.375, 2), expect.closeTo(h, 2), expect.closeTo(-0.125)]);
    expect(edge(0.25)[1]).toBeCloseTo(h, 2);
    expect(edge(0.5)[1]).toBeCloseTo(2 * h, 2);
    expect(problems(model)).toEqual([]);
  });

  it('turns flat creases along the paper as plain bends do, from either side', () => {
    // A crease at x = 0.3, the strip beyond it turned up a sixth of a turn: posed along the paper from the main
    // part it lands where a plain bend puts it; posed from the strip, the strip stays and the rest turns instead.
    const creased = new Recipe({ id: 'c', title: 'c', sheet: { size: [1, 1], front: '#fff', back: '#000' } }).crease(table(0.5, 0), table(0.1, 0), { title: 'Crease' }).current;
    const bend = { line: { p: [0.3, 0] as [number, number], d: [0, -1] as [number, number] }, angle: Math.PI / 3 };
    const plain = shape(creased, [bend]);
    const chained = shape(creased, [bend], { chained: [-0.4, 0] });
    for (const i of [0, 1, 2]) expect(at(chained, 0.5, 0.5)[i]).toBeCloseTo(at(plain, 0.5, 0.5)[i]);
    const fromStrip = shape(creased, [bend], { chained: [0.45, 0] });
    expect(at(fromStrip, 0.5, 0.5)).toEqual([expect.closeTo(0.5), expect.closeTo(0), expect.closeTo(0.5)]);
    expect(at(fromStrip, -0.5, 0.5)[1]).toBeCloseTo(0.8 * Math.sin(Math.PI / 3));
  });
});

describe('shape, riding layers', () => {
  // A strip folded in from the right edge lies across the line x = 0.1, where the paper beyond turns up into a wall.
  const folded = () =>
    new Recipe({ id: 't', title: 't', sheet: { size: [1, 1], front: '#fff', back: '#000' } }).along(table(0.25, -1), table(0.25, 1), table(0.45, 0), {
      title: 'Fold the strip in',
    });
  const wall = { through: [table(0.1, -1), table(0.1, 1)] as [ReturnType<typeof table>, ReturnType<typeof table>], moving: table(0.2, 0), degrees: 90 };

  it('moves each piece of a riding layer with the face it lies on', () => {
    const model = folded()
      .shape({ title: 'Raise the wall' }, [wall], { chained: paper(-0.3, 0), ride: ([u]) => u > 0.25 })
      .build();
    const frame = model.steps.at(-1)!.frame;
    // The strip lies from x = 0.25 (its fold, paper u = 0.25) back to x = 0 (its edge, u = 0.5). Its paper over the
    // floor (u past 0.4) stays down; its paper over the wall stands up with it, its fold at the wall's top.
    const strip = (lo: number, hi: number) => frame.vertices_coords.filter((_, v) => frame.vertices_paper[v][0] > lo && frame.vertices_paper[v][0] < hi);
    expect(Math.max(...strip(0.41, 0.51).map((p) => p[1]))).toBeLessThan(0.01);
    expect(Math.min(...strip(0.24, 0.26).map((p) => p[1]))).toBeCloseTo(0.15, 2);
    expect(problems(model)).toEqual([]);
  });

  it('keeps riding layers in .fold files, so the step folds again the same', async () => {
    const { fromFoldFile, toFoldFile } = await import('./fold-format');
    const { replay } = await import('./ops');
    const model = folded()
      .shape({ title: 'Raise the wall' }, [wall], { chained: paper(-0.3, 0), ride: ([u]) => u > 0.25 })
      .build();
    const read = fromFoldFile(JSON.parse(JSON.stringify(toFoldFile(model))));
    expect(read.steps.at(-1)!.op).toMatchObject({ op: 'shape', ride: { inPaper: expect.any(Array) } });
    const again = replay(read);
    expect(again.error).toBeUndefined();
    expect(toFoldFile(again.model)).toEqual(toFoldFile(read));
  });
});

describe('radial', () => {
  const square = () => new Recipe({ id: 't', title: 't', sheet: { size: [1, 1], front: '#fff', back: '#000' } }).current;
  const quarters = (heading: (k: number) => number | undefined) =>
    Array.from({ length: 4 }, (_, k) => ({ azimuth: (k * Math.PI) / 2, elevation: 0, ...(heading(k) !== undefined && { heading: heading(k) }) }));

  it('raises a crease straight up from where it lies unless it has a heading', () => {
    const plain = radial(square(), [0, 0], quarters(() => undefined));
    expect(radial(square(), [0, 0], quarters((k) => (k * Math.PI) / 2)).vertices_coords).toEqual(plain.vertices_coords);
  });

  it('turns a crease to its heading, keeping the paper between creases unstretched', () => {
    // Every crease turned a quarter round: the whole sheet turns with them, flat.
    const turned = radial(square(), [0, 0], quarters((k) => ((k + 1) * Math.PI) / 2));
    const corner = turned.vertices_coords.find((p) => Math.abs(Math.abs(p[0]) - 0.5) < 1e-9 && Math.abs(Math.abs(p[2]) - 0.5) < 1e-9);
    expect(corner).toBeDefined();
    // A heading that doesn't keep the angle between neighbouring creases would stretch the paper.
    expect(() => radial(square(), [0, 0], quarters((k) => (k ? (k * Math.PI) / 2 : 0.3)))).toThrow(FoldError);
  });
});
