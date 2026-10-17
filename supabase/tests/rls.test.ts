import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import { as, database, signUp } from './harness';

const LEARNER = '00000000-0000-0000-0000-00000000000a';
const CREATOR = '00000000-0000-0000-0000-00000000000b';
const ADMIN = '00000000-0000-0000-0000-00000000000c';
const OTHER = '00000000-0000-0000-0000-00000000000d';

let db: PGlite;

beforeAll(async () => {
  db = await database();
  for (const [id, email] of [
    [LEARNER, 'lee@example.com'],
    [CREATOR, 'cam@example.com'],
    [ADMIN, 'ada@example.com'],
    [OTHER, 'ola@example.com'],
  ]) {
    await signUp(db, id, email);
  }
  // The first admin is made by hand in the database; everyone after that through set_role.
  await db.query(`update public.profiles set role = 'admin' where id = $1`, [ADMIN]);
  await as(db, ADMIN, 'select public.set_role($1, $2)', [CREATOR, 'creator']);
}, 60_000);

const fold = JSON.stringify({ file_spec: 1.2, file_title: 'Test' });

describe('profiles', () => {
  it('are made on sign-up, named from the email', async () => {
    const [me] = await as<{ display_name: string; role: string }>(db, LEARNER, 'select display_name, role from public.profiles where id = $1', [LEARNER]);
    expect(me).toEqual({ display_name: 'lee', role: 'learner' });
  });

  it('are private to their owner, but admins see them all', async () => {
    expect(await as(db, LEARNER, 'select id from public.profiles')).toHaveLength(1);
    expect(await as(db, null, 'select id from public.profiles')).toHaveLength(0);
    expect(await as(db, ADMIN, 'select id from public.profiles')).toHaveLength(4);
  });

  it('let people rename themselves but not change their role', async () => {
    await as(db, LEARNER, `update public.profiles set display_name = 'Lee' where id = $1`, [LEARNER]);
    await expect(as(db, LEARNER, `update public.profiles set role = 'admin' where id = $1`, [LEARNER])).rejects.toThrow(/permission denied/);
    await expect(as(db, LEARNER, 'select public.set_role($1, $2)', [LEARNER, 'admin'])).rejects.toThrow(/Only admins/);
    const [me] = await as<{ role: string }>(db, LEARNER, 'select role from public.profiles where id = $1', [LEARNER]);
    expect(me.role).toBe('learner');
  });

  it('can’t be renamed by someone else', async () => {
    await as(db, OTHER, `update public.profiles set display_name = 'Hacked' where id = $1`, [LEARNER]);
    const [lee] = await as<{ display_name: string }>(db, ADMIN, 'select display_name from public.profiles where id = $1', [LEARNER]);
    expect(lee.display_name).toBe('Lee');
  });
});

describe('creator requests', () => {
  it('let a learner ask once, and only for themselves', async () => {
    await as(db, OTHER, `insert into public.creator_requests (user_id, message) values ($1, 'I fold a lot')`, [OTHER]);
    await expect(as(db, OTHER, `insert into public.creator_requests (user_id) values ($1)`, [OTHER])).rejects.toThrow();
    await expect(as(db, OTHER, `insert into public.creator_requests (user_id) values ($1)`, [LEARNER])).rejects.toThrow(/row-level security/);
    await expect(as(db, OTHER, `insert into public.creator_requests (user_id, status) values ($1, 'approved')`, [OTHER])).rejects.toThrow();
  });

  it('can only be decided by an admin, which grants the role', async () => {
    await expect(as(db, OTHER, 'select public.decide_creator_request($1, true)', [OTHER])).rejects.toThrow(/Only admins/);
    await as(db, ADMIN, 'select public.decide_creator_request($1, true)', [OTHER]);
    const [ola] = await as<{ role: string }>(db, OTHER, 'select role from public.profiles where id = $1', [OTHER]);
    expect(ola.role).toBe('creator');
    const [req] = await as<{ status: string }>(db, OTHER, 'select status from public.creator_requests where user_id = $1', [OTHER]);
    expect(req.status).toBe('approved');
  });
});

describe('models', () => {
  let draft: string;

  it('can be saved by creators but not learners or guests', async () => {
    [{ id: draft }] = await as<{ id: string }>(db, CREATOR, `insert into public.models (title, fold) values ('Swan', $1) returning id`, [fold]);
    await expect(as(db, LEARNER, `insert into public.models (title, fold) values ('Nope', $1)`, [fold])).rejects.toThrow(/row-level security/);
    await expect(as(db, null, `insert into public.models (title, fold) values ('Nope', $1)`, [fold])).rejects.toThrow();
  });

  it('can’t be saved already published, or for someone else', async () => {
    await expect(as(db, CREATOR, `insert into public.models (title, fold, status) values ('Sneaky', $1, 'published')`, [fold])).rejects.toThrow(/row-level security/);
    await expect(as(db, CREATOR, `insert into public.models (title, fold, owner) values ('Sneaky', $1, $2)`, [fold, OTHER])).rejects.toThrow(/row-level security/);
  });

  it('are private while drafts, except through their share link', async () => {
    expect(await as(db, LEARNER, 'select id from public.models where id = $1', [draft])).toHaveLength(0);
    expect(await as(db, null, 'select id from public.models where id = $1', [draft])).toHaveLength(0);
    const [{ share_token }] = await as<{ share_token: string }>(db, CREATOR, 'select share_token from public.models where id = $1', [draft]);
    expect(share_token).toMatch(/^[0-9a-f]{64}$/);
    const shared = await as<{ title: string }>(db, null, 'select title from public.shared_model($1)', [share_token]);
    expect(shared).toEqual([{ title: 'Swan' }]);
    expect(await as(db, null, 'select title from public.shared_model($1)', ['not-a-token'])).toHaveLength(0);
  });

  it('can be submitted by their owner, but not published', async () => {
    await expect(as(db, CREATOR, `update public.models set status = 'published' where id = $1`, [draft])).rejects.toThrow(/row-level security/);
    await as(db, CREATOR, `update public.models set status = 'submitted' where id = $1`, [draft]);
    // Locked while in review.
    await as(db, CREATOR, `update public.models set title = 'Changed' where id = $1`, [draft]);
    const [m] = await as<{ title: string; status: string }>(db, CREATOR, 'select title, status from public.models where id = $1', [draft]);
    expect(m).toEqual({ title: 'Swan', status: 'submitted' });
  });

  it('can’t have their owner, share link or review note changed by the owner', async () => {
    await expect(as(db, CREATOR, `update public.models set owner = $2 where id = $1`, [draft, OTHER])).rejects.toThrow(/permission denied/);
    await expect(as(db, CREATOR, `update public.models set share_token = 'x' where id = $1`, [draft])).rejects.toThrow(/permission denied/);
  });

  it('are published by admins, and then everyone can see them', async () => {
    await as(db, ADMIN, `update public.models set status = 'published', review_note = 'Lovely' where id = $1`, [draft]);
    expect(await as(db, null, 'select title from public.models where id = $1', [draft])).toEqual([{ title: 'Swan' }]);
    expect(await as(db, LEARNER, 'select title from public.models where id = $1', [draft])).toEqual([{ title: 'Swan' }]);
  });

  it('can’t be edited or deleted by other people', async () => {
    await as(db, OTHER, `update public.models set title = 'Mine now' where id = $1`, [draft]);
    await as(db, OTHER, 'delete from public.models where id = $1', [draft]);
    expect(await as(db, null, 'select title from public.models where id = $1', [draft])).toEqual([{ title: 'Swan' }]);
  });
});
