import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toFoldFile } from '../fold/fold-format';
import { basics } from '../models/basics';

/** Records the calls a query builder receives, and answers with `next`. */
const calls: { table: string; op: string; args: unknown[] }[] = [];
let next: { data: unknown; error: { message: string } | null } = { data: null, error: null };

vi.mock('../auth/store', () => {
  const builder = (table: string) => {
    const b: Record<string, unknown> = {};
    for (const op of ['select', 'insert', 'update', 'delete', 'eq', 'order', 'limit']) {
      b[op] = (...args: unknown[]) => {
        calls.push({ table, op, args });
        return b;
      };
    }
    b.single = b.maybeSingle = async () => next;
    b.then = (resolve: (v: unknown) => void) => resolve(next);
    return b;
  };
  return {
    supabase: async () => ({
      from: (table: string) => builder(table),
      rpc: async (fn: string, args: unknown) => {
        calls.push({ table: fn, op: 'rpc', args: [args] });
        return next;
      },
    }),
  };
});

const { openShared, saveModel, submitModel } = await import('./models');

const row = { id: 'm1', title: 'Folding basics', status: 'draft', review_note: null, share_token: 'abc', updated_at: '', fold: toFoldFile(basics) };

beforeEach(() => {
  calls.length = 0;
  next = { data: row, error: null };
});

describe('cloud models', () => {
  it('saves a new model as an insert', async () => {
    const saved = await saveModel(basics);
    expect(calls.find((c) => c.op === 'insert')?.args[0]).toMatchObject({ title: 'Folding basics' });
    expect(saved.model.steps).toHaveLength(basics.steps.length);
  });

  it('puts an edited model back to draft (as the database requires after a rejection)', async () => {
    await saveModel(basics, 'm1');
    expect(calls.find((c) => c.op === 'update')?.args[0]).toMatchObject({ status: 'draft' });
    expect(calls.find((c) => c.op === 'eq')?.args).toEqual(['id', 'm1']);
  });

  it('submits for review', async () => {
    next = { data: { ...row, status: 'submitted' }, error: null };
    expect((await submitModel('m1')).status).toBe('submitted');
    expect(calls.find((c) => c.op === 'update')?.args[0]).toEqual({ status: 'submitted' });
  });

  it('passes on what the database refused', async () => {
    next = { data: null, error: { message: 'new row violates row-level security policy' } };
    await expect(saveModel(basics, 'm1')).rejects.toThrow(/row-level security/);
  });

  it('explains a share link that doesn’t open anything', async () => {
    next = { data: [], error: null };
    await expect(openShared('nope')).rejects.toThrow(/doesn’t open a model/);
  });
});
