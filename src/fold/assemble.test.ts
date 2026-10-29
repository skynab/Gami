import { describe, expect, it } from 'vitest';
import { toFlat } from './fold';
import { fromFoldFile, toFoldFile } from './fold-format';
import { framesOf } from './frames';
import { applyOp, toolsNeeded } from './ops';
import { paper, Recipe, table } from './recipe';
import type { FoldFrame, Vec2, Vec3 } from './types';
import { problems } from './validate';

/** Two squares side by side, the first with its right edge folded over as a flap. */
const two = () =>
  new Recipe({
    id: 'two',
    title: 'Two',
    sheets: [
      { size: [1, 1], front: '#111111', back: '#222222', at: [-1, 0] },
      { size: [1, 1], front: '#333333', back: '#444444', origin: [10, 0], at: [1, 0] },
    ],
  }).onto(paper(0.5, 0), paper(0.25, 0), { title: 'Fold a flap', only: ([u]) => u < 5 });

/** Where a point of the sheet is, in 3D (from the first face that has it as a corner). */
function pointAt(frame: FoldFrame, p: Vec2): Vec3 {
  const v = frame.vertices_paper.findIndex((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 1e-9);
  return frame.vertices_coords[v];
}

const near = (a: Vec3, b: Vec3) => a.forEach((c, i) => expect(c).toBeCloseTo(b[i], 5));

/** The first square's flap (its right edge, folded over at x = −0.625) opened straight up. */
const flapOpen = { through: [table(-0.625, -1), table(-0.625, 1)] as [ReturnType<typeof table>, ReturnType<typeof table>], moving: table(-0.7, 0), degrees: 90, only: ([u]: Vec2) => u > 0.375 && u < 5 };

/** Asks a frame where each faces' replay ends up, through its .fold file. */
function replayLast(model: ReturnType<Recipe['build']>) {
  const read = fromFoldFile(JSON.parse(JSON.stringify(toFoldFile(model))));
  return applyOp({ ...read, steps: read.steps.slice(0, -1) }, read.steps.at(-1)!.op!).frame;
}

describe('putting units together in 3D', () => {
  it('stands a piece up, turned and moved rigidly', () => {
    // The second square stood up facing +x, its middle 1 above (0, 0, 0): the table's +x goes up, so its +z goes
    // to −z.
    const model = two()
      .assemble({ title: 'Stand it up' }, [{ sheet: 1, pose: { from: table(1, 0), to: [0, 1, 0], x: [0, 1, 0], up: [1, 0, 0] } }])
      .build();
    const frame = model.steps.at(-1)!.frame;
    // Its left edge (table x = 0.5) goes down to y = 0.5; its right edge up to y = 1.5.
    near(pointAt(frame, [9.5, 0.5]), [0, 0.5, -0.5]);
    near(pointAt(frame, [10.5, -0.5]), [0, 1.5, 0.5]);
    expect(problems(model)).toEqual([]);
  });

  it('bends a flap open before setting a piece down', () => {
    const model = two()
      .assemble({ title: 'Open the flap' }, [{ sheet: 0, bends: [flapOpen] }])
      .build();
    const frame = model.steps.at(-1)!.frame;
    // The flap's free edge (sheet u = ½), folded over to x = −0.75, stands straight up over its hinge at x = −0.625.
    const tip = pointAt(frame, [0.5, 0.5]);
    expect(tip[0]).toBeCloseTo(-0.625, 2);
    expect(tip[1]).toBeCloseTo(0.125, 2);
    expect(problems(model)).toEqual([]);
  });

  it('adds to earlier steps, and places a piece afresh when it’s listed again', () => {
    const r = two().assemble({ title: 'Lift the first' }, [{ sheet: 0, pose: { from: table(-1, 0), to: [-1, 1, 0], x: [1, 0, 0], up: [0, 1, 0] } }]);
    const first = pointAt(r.current, [-0.5, -0.5]);
    r.assemble({ title: 'Lift the second' }, [{ sheet: 1, pose: { from: table(1, 0), to: [1, 2, 0], x: [1, 0, 0], up: [0, 1, 0] } }]);
    // The first stays where the step before put it; the second goes up too.
    near(pointAt(r.current, [-0.5, -0.5]), first);
    expect(pointAt(r.current, [9.5, -0.5])[1]).toBeCloseTo(2, 3);
    r.assemble({ title: 'Lower the first' }, [{ sheet: 0, pose: { from: table(-1, 0), to: [-1, 0.5, 0], x: [1, 0, 0], up: [0, 1, 0] } }]);
    expect(pointAt(r.current, [-0.5, -0.5])[1]).toBeCloseTo(0.5, 3);
    expect(pointAt(r.current, [9.5, -0.5])[1]).toBeCloseTo(2, 3);
    const model = r.build();
    expect(problems(model)).toEqual([]);
    // Each step's faces come from the step before's.
    const frames = framesOf(model);
    frames.slice(1).forEach((f, k) => expect(Math.max(...f.faces_parent!)).toBeLessThan(frames[k].faces_vertices.length));
  });

  it('replays from its operation, through a .fold file', () => {
    const model = two()
      .assemble({ title: 'Lift the first' }, [{ sheet: 0, pose: { from: table(-1, 0), to: [-1, 1, 0], x: [1, 0, 0], up: [0, 1, 0] } }])
      .assemble({ title: 'Open its flap and stand the second up' }, [
        { sheet: 0, bends: [flapOpen] },
        { sheet: 1, pose: { from: table(1, 0), to: [0, 1, 0], x: [0, 1, 0], up: [1, 0, 0] } },
      ])
      .build();
    const again = replayLast(model);
    expect(again.vertices_coords.length).toBe(model.steps.at(-1)!.frame.vertices_coords.length);
    again.vertices_coords.forEach((p, i) => near(p, model.steps.at(-1)!.frame.vertices_coords[i]));
  });
  it('says when pieces are glued, so the model needs glue', () => {
    const glued = two()
      .assemble({ title: 'Glue it on', glue: true }, [{ sheet: 1, pose: { from: table(1, 0), to: [0, 1, 0], x: [0, 1, 0], up: [1, 0, 0] } }])
      .build();
    const read = fromFoldFile(JSON.parse(JSON.stringify(toFoldFile(glued))));
    expect(toolsNeeded(read.steps)).toEqual(['glue']);
    expect(toolsNeeded(two().assemble({ title: 'Put it on' }, [{ sheet: 1, pose: { from: table(1, 0), to: [0, 1, 0], x: [0, 1, 0], up: [1, 0, 0] } }]).build().steps)).toEqual([]);
  });
});

describe('pressing paper flat', () => {
  it('sets each face only as high as the paper under it', () => {
    // Three strips folded in half, each laid over the end of the one before and slid in under its top layer: a
    // chain whose flat layers stack up, the first strip's top layer above everything.
    const r = new Recipe({
      id: 'chain',
      title: 'Chain',
      sheets: [0, 1, 2].map((n) => ({ size: [1, 0.2] as Vec2, front: '#111111', back: '#222222', origin: [10 * n, 0] as Vec2, at: [0, 1 + n] as Vec2 })),
    });
    const strip = (n: number) => ([u]: Vec2) => Math.abs(u - 10 * n) < 5;
    for (const n of [0, 1, 2]) r.onto(paper(10 * n + 0.5, 0), paper(10 * n - 0.5, 0), { title: 'Fold', only: strip(n) });
    // Each folded strip is ½ long and 0.2 wide; strip n goes at x = 0.4n, crossing the last at its end.
    r.move({ title: 'Place 0' }, strip(0), { to: table(0, 0) });
    for (const n of [1, 2]) {
      r.move({ title: `Place ${n}` }, strip(n), {
        to: table(0.4 * n, 0),
        into: [{ part: strip(n), under: ([u]) => strip(n - 1)([u, 0]) && u > 10 * (n - 1) }],
      });
    }
    const flatTop = Math.max(...toFlat(r.current).map((f) => f.layer));
    const model = r.settle({ title: 'Press it flat' }).build();
    const frame = model.steps.at(-1)!.frame;
    // Six layers in one stack, but never more than four lie on top of each other.
    expect(flatTop).toBe(5);
    expect(Math.max(...frame.vertices_coords.map((p) => p[1]))).toBeLessThan(4 * 0.0007);
    expect(problems(model)).toEqual([]);
    replayLast(model).vertices_coords.forEach((p, i) => near(p, frame.vertices_coords[i]));
  });
});
