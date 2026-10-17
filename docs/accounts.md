# Accounts and the Studio

Learning on Gami needs no account. Accounts exist so approved **creators** can use the Studio, and so
**admins** can approve creators and (from milestone 7) publish their models to the gallery.

Without the settings below the site works normally: the sign-in button and Studio simply aren't shown.

## Roles

| Role | Can |
|---|---|
| Guest | Use the gallery and viewer |
| Learner (signed in) | Ask to become a creator |
| Creator | Use the Studio; save drafts, share them by private link, submit them for the gallery |
| Admin | Approve creators; publish or reject submitted models |

The database enforces all of this with row-level security (`supabase/migrations`). The app only hides what
people can't use. `npm test` runs `supabase/tests/rls.test.ts`, which checks the rules in a real Postgres
(PGlite) acting as each kind of user.

## Setting up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Run the migration: paste `supabase/migrations/*.sql` into the SQL editor, or with the Supabase CLI,
   `supabase link` then `supabase db push`.
3. **Authentication → URL configuration:** set the Site URL to where Gami is hosted, and add it (plus
   `http://localhost:5180` for development) to the redirect URLs, so sign-in links come back to the site.
4. Copy `.env.example` to `.env.local` and fill in the project URL and anon key from
   **Project Settings → API**. Set the same two variables in your host for production builds.
5. Sign in once on the site, then make yourself the first admin in the SQL editor:

   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'you@example.com');
   ```

   After that, approve creators at `/admin`.

Sign-in uses emailed links (no passwords). Supabase's built-in email sender is rate-limited; set up custom
SMTP under **Authentication → Emails** before launch.
