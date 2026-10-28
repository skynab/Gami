import { describe, expect, it } from 'vitest';
import { fromFoldFile, toFoldFile } from './fold-format';
import { parseOp, toolsNeeded } from './ops';
import { locate } from './select';
import { paper, Recipe, table } from './recipe';
import { stuckTogether } from './tape';
import { toFlat } from './fold';
import type { Vec2 } from './types';

/**
 * A square with its top folded down short of the bottom edge, so the bottom layer still shows below the flap:
 * with `taped`, a strip of tape across the flap's edge sticks the flap to the layer under it.
 */
function flap(taped: boolean) {
  const r = new Recipe({ id: 'tape-test', title: 'Tape', sheet: { size: [1, 1], front: '#fff', back: '#000' } });
  r.along(table(-1, -0.1), table(1, -0.1), paper(0, -0.4), { title: 'Fold the top down' });
  if (taped) r.tape(table(0, 0.2), table(0, 0.4), { title: 'Tape the flap down' });
  return r;
}

describe('tape', () => {
  it('sticks to the paper showing under it', () => {
    const frame = flap(true).current;
    const [strip] = frame.tapes!;
    // The flap's back is up; the bottom layer shows its front below it.
    expect(strip.pieces.map((p) => p.side).sort()).toEqual(['back', 'front']);
    const faces = toFlat(frame);
    const [stuck] = stuckTogether(frame.tapes, faces.map((f) => f.paper));
    expect(stuck.map((f) => faces[f].layer).sort()).toEqual([0, 1]);
  });

  it('carries the layer it sticks to along when only the top layer folds', () => {
    // The flap's edge folds back up, just above where it's taped. The bottom layer's lower left corner stays put
    // unless the tape carries it.
    const corner: Vec2 = [-0.45, 0.45];
    const foldTop = (r: Recipe) => r.along(table(-1, 0.2), table(1, 0.2), table(0, 0.25), { title: 'Fold the flap’s edge up', layers: 1 });
    const loose = foldTop(flap(false));
    expect(locate(loose.current, corner)[1]).toBeCloseTo(0.45);
    const taped = foldTop(flap(true));
    expect(locate(taped.current, corner)[1]).toBeCloseTo(-0.05);
  });

  it('stays on the paper through later steps, and in the file', () => {
    const r = flap(true).turnOver();
    const model = r.build();
    expect(model.steps.at(-1)!.frame.tapes).toEqual(model.steps[1].frame.tapes);
    const read = fromFoldFile(JSON.parse(JSON.stringify(toFoldFile(model))));
    expect(read.steps.at(-1)!.frame.tapes).toEqual(model.steps.at(-1)!.frame.tapes);
    expect(read.steps[1].op).toEqual({ op: 'tape', from: { table: [0, 0.2] }, to: { table: [0, 0.4] } });
    expect(toolsNeeded(model.steps)).toEqual(['tape']);
  });

  it('is gone on a fresh sheet', () => {
    const r = flap(true).unfold({ to: 0 }).newSheet({ title: 'A fresh sheet' });
    expect(r.current.tapes).toBeUndefined();
  });

  it('checks a tape operation read from a file', () => {
    expect(parseOp({ op: 'tape', from: { table: [0, 0] }, to: { paper: [0.1, 0] }, width: 0.05 })).toEqual({
      op: 'tape',
      from: { table: [0, 0] },
      to: { paper: [0.1, 0] },
      width: 0.05,
    });
    expect(() => parseOp({ op: 'tape', from: { table: [0, 0] }, to: { table: [0, 1] }, width: 0 })).toThrow(/width/);
  });

  it('needs paper under it, and two ends', () => {
    expect(() => flap(false).tape(table(3, 3), table(3, 4), { title: 'Off the paper' })).toThrow(/no paper/);
    expect(() => flap(false).tape(table(0, 0), table(0, 0), { title: 'Nowhere' })).toThrow(/two different ends/);
  });
});
