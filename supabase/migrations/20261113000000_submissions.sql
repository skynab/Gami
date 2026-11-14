-- Submitting designs to the gallery (docs/studio-plan.md, part 4).
--
-- Anyone signed in can submit a design from the Studio; designing still needs no account, and saving drafts to
-- the cloud stays a creator's. Every submission says whose design it is: the submitter's own, or traditional with
-- no known designer. It also says how to credit it and where it was first published, if anywhere. It's published
-- under CC BY 4.0, the only licence the gallery takes for submissions, so anyone can fold and teach it. Admins
-- review it as before. Anyone, signed in or not, can report a published model that isn't the submitter's; admins
-- see the reports and can unpublish.

-- Ownership and licence -------------------------------------------------------------------------------

alter table public.models
  add column ownership text check (ownership in ('own', 'traditional')),
  add column credit text check (char_length(credit) between 1 and 80),
  add column first_published text check (char_length(first_published) <= 200),
  add column licence text check (licence = 'CC-BY-4.0'),
  -- When the submitter last certified the above, which every submission does afresh.
  add column certified_at timestamptz;

-- A model goes into review only through submit_design, which certifies it: setting the status by hand (the owner
-- update policy still allows draft → submitted) is refused, since the owner can't write certified_at.
create or replace function public.guard_model_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not public.is_admin() and new.review_note is distinct from old.review_note then
    raise exception 'Only admins can write review notes' using errcode = '42501';
  end if;
  if new.status = 'submitted' and old.status <> 'submitted' and new.certified_at is not distinct from old.certified_at then
    raise exception 'Submit through submit_design, which records whose design it is' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Submits a design: a new one (model_id null), straight into review and owned by the caller, or the caller's own
-- draft or sent-back model, its title and file replaced. Returns the model's id.
create function public.submit_design(
  model_id uuid,
  title text,
  fold jsonb,
  ownership text,
  credit text,
  first_published text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  out_id uuid;
begin
  if me is null then
    raise exception 'Sign in to submit a design' using errcode = '42501';
  end if;
  if ownership is null or ownership not in ('own', 'traditional') then
    raise exception 'Say whose design it is: your own, or traditional' using errcode = '22023';
  end if;
  if credit is null or char_length(trim(credit)) = 0 then
    raise exception 'Say how to credit the design' using errcode = '22023';
  end if;
  if model_id is null then
    insert into public.models (owner, title, fold, status, ownership, credit, first_published, licence, certified_at)
    values (me, title, fold, 'submitted', ownership, trim(credit), nullif(trim(first_published), ''), 'CC-BY-4.0', now())
    returning id into out_id;
  else
    update public.models m
      set title = submit_design.title, fold = submit_design.fold, status = 'submitted',
          ownership = submit_design.ownership, credit = trim(submit_design.credit),
          first_published = nullif(trim(submit_design.first_published), ''), licence = 'CC-BY-4.0', certified_at = clock_timestamp()
      where m.id = model_id and m.owner = me and m.status in ('draft', 'rejected')
      returning m.id into out_id;
    if out_id is null then
      raise exception 'That model isn''t yours, or it''s already in review or published' using errcode = '42501';
    end if;
  end if;
  return out_id;
end;
$$;

revoke execute on function public.submit_design(uuid, text, jsonb, text, text, text) from public, anon;
grant execute on function public.submit_design(uuid, text, jsonb, text, text, text) to authenticated;

-- Reports ---------------------------------------------------------------------------------------------

create table public.model_reports (
  id uuid primary key default gen_random_uuid(),
  model uuid not null references public.models (id) on delete cascade,
  reason text not null check (reason in ('notTheirs', 'copyrighted', 'inappropriate', 'other')),
  details text not null default '' check (char_length(details) <= 1000),
  -- How to reach the person reporting, if they'd like an answer. Only admins can read it.
  contact text not null default '' check (char_length(contact) <= 200),
  reporter uuid default auth.uid() references public.profiles (id) on delete set null,
  status text not null default 'open' check (status in ('open', 'dismissed', 'unpublished')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles (id)
);

alter table public.model_reports enable row level security;

-- Anyone may report a published model; nobody but admins can read reports, so a reporter's contact stays private.
create policy "Anyone can report a published model"
  on public.model_reports for insert to anon, authenticated
  with check (
    status = 'open' and decided_at is null and decided_by is null
    and reporter is not distinct from auth.uid()
    and exists (select 1 from public.models m where m.id = model and m.status = 'published')
  );

create policy "Admins can see reports"
  on public.model_reports for select to authenticated
  using (public.is_admin());

revoke update, delete on public.model_reports from anon, authenticated;

-- Deciding a report: dismissed, or the model unpublished (sent back to its owner with a note, as a rejected one).
create function public.decide_report(report uuid, unpublish boolean, note text default '') returns void
language plpgsql security definer set search_path = '' as $$
declare
  target uuid;
begin
  if not public.is_admin() then
    raise exception 'Only admins can decide reports' using errcode = '42501';
  end if;
  update public.model_reports
    set status = case when unpublish then 'unpublished' else 'dismissed' end, decided_at = now(), decided_by = auth.uid()
    where id = report and status = 'open'
    returning model into target;
  if target is null then
    raise exception 'No open report with that id' using errcode = 'P0002';
  end if;
  if unpublish then
    update public.models set status = 'rejected', review_note = coalesce(nullif(trim(note), ''), 'Unpublished after a report.')
      where id = target and status = 'published';
    -- Any other open reports on it are settled too.
    update public.model_reports set status = 'unpublished', decided_at = now(), decided_by = auth.uid()
      where model = target and status = 'open';
  end if;
end;
$$;

revoke execute on function public.decide_report(uuid, boolean, text) from public, anon;
grant execute on function public.decide_report(uuid, boolean, text) to authenticated;
