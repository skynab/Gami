import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FoldError } from './fold';
import { english, FOLD_MESSAGES, said } from './messages';
import { applyOp, replay, type Op } from './ops';
import type { OrigamiModel } from './types';

const sheet: OrigamiModel = {
  id: 't',
  title: 't',
  difficulty: 1,
  category: 'object',
  minutes: 1,
  sheets: [{ id: 's', size: [1, 1], frontColor: '#f00', backColor: '#fff' }],
  start: {
    vertices_coords: [[-0.5, 0, -0.5], [0.5, 0, -0.5], [0.5, 0, 0.5], [-0.5, 0, 0.5]],
    vertices_paper: [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]],
    faces_vertices: [[0, 1, 2, 3]],
  },
  steps: [],
} as unknown as OrigamiModel;

/** Every source file under `dir`, tests aside. */
function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return sources(p);
    return /\.tsx?$/.test(e.name) && !e.name.includes('.test.') ? [p] : [];
  });
}

describe('fold messages', () => {
  it('fills in their values, in English', () => {
    expect(english('noSheetToCopyOnto', { sheet: 2 })).toBe('There’s no sheet 2 to copy onto.');
    expect(english('shareStep', { step: 3, error: { message: 'Nothing to move.' } })).toBe('step 3: Nothing to move.');
  });

  it('are made from codes the engine knows', () => {
    // A misspelt code would quietly become the message itself, in English only.
    const src = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
    const used = new Set<string>();
    for (const file of sources(src)) {
      for (const m of readFileSync(file, 'utf8').matchAll(/(?:Fold|Layer|Op|Preset|NoStill|Share)Error\('([a-z][A-Za-z]*)'/g)) used.add(m[1]);
    }
    expect(used.size).toBeGreaterThan(50);
    for (const code of used) expect(Object.keys(FOLD_MESSAGES), code).toContain(code);
  });

  it('keep their code as plain data, and through a model folded again', () => {
    const e = new FoldError('notOnPaper', { point: '1, 2' });
    expect(e.message).toBe('(1, 2) isn’t on the paper.');
    expect(said(e)).toEqual({ message: e.message, code: 'notOnPaper', params: { point: '1, 2' } });
    expect(said(new FoldError('A plain message for an author.'))).toEqual({ message: 'A plain message for an author.' });

    // A cut that misses the paper, saved as a step, fails when the model is folded again.
    const op: Op = { op: 'cut', from: { table: [2, 2] }, to: { table: [3, 3] } };
    expect(() => applyOp(sheet, op)).toThrow(FoldError);
    const { error } = replay({ ...sheet, steps: [{ title: 'Cut', frame: sheet.start, op }] } as OrigamiModel);
    expect(error).toMatchObject({ step: 1, code: 'cutMissesPaper', message: FOLD_MESSAGES.cutMissesPaper });
  });
});
