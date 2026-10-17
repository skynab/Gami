import { beforeEach, describe, expect, it, vi } from 'vitest';

/** A stand-in for the bits of the Supabase client the store uses, backed by plain objects. */
const db = {
  profile: { display_name: 'Cam', role: 'learner' } as Record<string, string> | null,
  request: null as { status: string } | null,
  inserted: [] as unknown[],
  insertError: null as { code: string; message: string } | null,
  signedOut: false,
};

vi.mock('./client', () => {
  const single = (table: string) => ({
    select: () => ({
      eq: () => ({ maybeSingle: async () => ({ data: table === 'profiles' ? db.profile : db.request, error: null }) }),
    }),
    insert: async (row: unknown) => {
      if (db.insertError) return { error: db.insertError };
      db.inserted.push(row);
      return { error: null };
    },
  });
  return {
    client: {
      from: (table: string) => single(table),
      auth: {
        signOut: async () => {
          db.signedOut = true;
          return { error: null };
        },
      },
    },
  };
});

vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'key');
const { useAuth, accountsEnabled } = await import('./store');

beforeEach(() => {
  db.profile = { display_name: 'Cam', role: 'learner' };
  db.request = null;
  db.inserted = [];
  db.insertError = null;
  useAuth.setState({ status: 'signed-in', userId: 'u1', email: 'cam@example.com', name: '', role: null, request: null });
});

describe('accounts', () => {
  it('turns on when the site has a Supabase project', () => {
    expect(accountsEnabled).toBe(true);
  });

  it('loads the signed-in person’s name, role and request', async () => {
    db.profile = { display_name: 'Cam', role: 'creator' };
    db.request = { status: 'approved' };
    await useAuth.getState().refresh();
    expect(useAuth.getState()).toMatchObject({ name: 'Cam', role: 'creator', request: 'approved' });
  });

  it('asks to become a creator, and shows the request as pending', async () => {
    expect(await useAuth.getState().askToCreate('Swans!')).toBeNull();
    expect(db.inserted).toEqual([{ user_id: 'u1', message: 'Swans!' }]);
    expect(useAuth.getState().request).toBe('pending');
  });

  it('explains when someone has already asked', async () => {
    db.insertError = { code: '23505', message: 'duplicate key value' };
    expect(await useAuth.getState().askToCreate('again')).toMatch(/already asked/);
    expect(useAuth.getState().request).toBeNull();
  });

  it('signs out', async () => {
    await useAuth.getState().signOut();
    expect(db.signedOut).toBe(true);
    expect(useAuth.getState()).toMatchObject({ status: 'signed-out', userId: null, role: null });
  });
});
