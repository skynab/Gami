# Accounts and the Studio

Learning on Gami needs no account, and nor does designing in the Studio. Accounts exist so anyone can submit
a design to the gallery, approved **creators** can also save drafts online, and **admins** can review
submissions, deal with reports and approve creators.

Without the settings below the site works normally: the sign-in button and Studio simply aren't shown.

## Roles

| Role | Can |
|---|---|
| Guest | Use the gallery, the viewer and the Studio (designs kept in the browser); report a published model |
| Learner (signed in) | Submit a design to the gallery; ask to become a creator |
| Creator | Also save drafts online and share them by private link |
| Admin | Publish or send back submissions; dismiss reports or unpublish; approve creators |

The database enforces all of this with row-level security (`supabase/migrations`). The app only hides what
people can't use. `npm test` runs `supabase/tests/rls.test.ts`, which checks the rules in a real Postgres
(PGlite) acting as each kind of user.

## Setting up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Run the migrations, in order of their names: paste each of `supabase/migrations/*.sql` into the SQL editor, or
   with the Supabase CLI, `supabase link` then `supabase db push`. A project set up before 13 November 2026 needs
   the newer one, `20261113000000_submissions.sql`, before this version of the site is deployed: without it,
   submitting and reporting fail.
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

## How a model gets into the gallery

1. Anyone makes it in the Studio; it's kept in their browser. (Creators can also **Save to my models**, a
   private draft online, and **Copy share link** for a link (`/s/…`) anyone can open, listed nowhere.)
2. **Submit to the gallery…** (signing in first) asks whose design it is: their own, or traditional with no
   known designer. It also asks how to credit it and where it was first published, if anywhere, and says it's
   published under CC BY 4.0, the only licence the gallery takes. They tick to certify it and submit. The design
   goes to the admins and is locked while it's reviewed. The database records the certification and refuses to
   put a model into review any other way (`submit_design`).
3. An admin opens `/admin`, previews it, sees what was certified, checks it isn't a known copyrighted design
   (the page links Gilad's Origami Database), and either publishes it or sends it back with a note. Sent-back
   designs can be changed and submitted again, certified afresh.
4. Published models appear under **From the community** in the gallery, at `/m/<id>`, saying whose design they
   are and their licence. To change one, its owner submits a copy.
5. **Report** on a published model's page (no account needed) tells the admins it's someone else's design,
   copies copyrighted work, or is inappropriate, with details and, if they like, how to reach them. Only admins
   see reports. On `/admin` they dismiss a report, or unpublish the model, sending it back to its owner with a
   note (which settles every open report on it).

Sign-in uses emailed links (no passwords). Supabase's built-in email sender is rate-limited; set up custom
SMTP under **Authentication → Emails** before launch.
