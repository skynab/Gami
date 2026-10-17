import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';

/**
 * A throwaway Postgres (PGlite, in-process) set up like Supabase: an `auth` schema with `users` and `auth.uid()`,
 * the `anon` and `authenticated` roles, and Supabase's default grants. Then every migration in supabase/migrations
 * runs, so tests exercise the real row-level security.
 */
export async function database() {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users (
      id uuid primary key,
      email text,
      raw_user_meta_data jsonb not null default '{}'
    );
    -- As in Supabase: the signed-in user comes from the request's JWT claims.
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema auth to anon, authenticated;
    grant usage on schema public to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant all on functions to anon, authenticated;
  `);
  const dir = new URL('../migrations/', import.meta.url);
  for (const file of readdirSync(dir).sort()) await db.exec(readFileSync(new URL(file, dir), 'utf8'));
  return db;
}

/** Adds an account, as signing up would. */
export async function signUp(db: PGlite, id: string, email: string) {
  await db.query('insert into auth.users (id, email) values ($1, $2)', [id, email]);
}

/** Runs a query as a guest (no id) or as a signed-in person, the way Supabase's API would. */
export async function as<T = Record<string, unknown>>(db: PGlite, who: string | null, sql: string, params: unknown[] = []) {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${who ? 'authenticated' : 'anon'}`);
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [who ?? '']);
    return (await tx.query<T>(sql, params)).rows;
  });
}
