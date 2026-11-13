import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toFoldFile } from '../fold/fold-format';
import { basics } from '../models/basics';

/** Records the calls a query builder receives, and answers with `next`. */
const calls: { table: string; op: string; args: unknown[] }[] = [];
let next: { data: unknown; error: { message: string } | null } = { data: null, error: null };
/** What a database function answers, where it differs from the query after it. */
let rpcNext: typeof next | null = null;

vi.mock('../auth/store', () => {
  const builder = (table: string) => {
    const b: Record<string, unknown> = {};
    for (const op of ['select', 'insert', 'update', 'delete', 'eq', 'in', 'order', 'limit']) {
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
        return rpcNext ?? next;
      },
    }),
  };
});

const { openShared, reportModel, saveModel, submitDesign } = await import('./models');

const row = { id: 'm1', title: 'Folding basics', status: 'draft', review_note: null, share_token: 'abc', updated_at: '', fold: toFoldFile(basics) };

beforeEach(() => {
  calls.length = 0;
  next = { data: row, error: null };
  rpcNext = null;
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

  it('submits a design through the database, saying whose it is, then reads it back', async () => {
    // The function answers with the id; then the model is read, as submitted.
    rpcNext = { data: 'm1', error: null };
    next = { data: { ...row, status: 'submitted', ownership: 'traditional', credit: 'Gami', first_published: null, licence: 'CC-BY-4.0' }, error: null };
    const saved = await submitDesign(basics, { ownership: 'traditional', credit: ' Gami ', firstPublished: '' });
    expect(calls.find((c) => c.op === 'rpc')).toMatchObject({
      table: 'submit_design',
      args: [{ model_id: null, title: 'Folding basics', ownership: 'traditional', credit: 'Gami', first_published: null }],
    });
    expect(saved.status).toBe('submitted');
    expect(saved.submission).toEqual({ ownership: 'traditional', credit: 'Gami', firstPublished: '', licence: 'CC-BY-4.0' });
    // Nothing is put into review by setting its status directly.
    expect(calls.some((c) => c.op === 'update')).toBe(false);
  });

  it('reports a published model', async () => {
    next = { data: null, error: null };
    await reportModel('m1', 'notTheirs', ' Not theirs ', '');
    expect(calls.find((c) => c.op === 'insert')).toMatchObject({ table: 'model_reports', args: [{ model: 'm1', reason: 'notTheirs', details: 'Not theirs', contact: '' }] });
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
