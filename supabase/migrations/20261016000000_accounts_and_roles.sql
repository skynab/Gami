-- Accounts and roles for Gami.
--
-- Learning needs no account. Signing in gives a profile with the role "learner". Learners can ask to become
-- creators; an admin approves or declines. Creators can save models (drafts, shared by unlisted link, and
-- submitted for the public gallery); only admins can publish.
--
-- Row-level security does the real protection: the app hides buttons people can't use, but every rule
-- below holds no matter what the browser sends.

-- Profiles ---------------------------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60),
  role text not null default 'learner' check (role in ('learner', 'creator', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Every new account gets a profile.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, ''), '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Role checks for policies. Security definer so they can read profiles regardless of the caller's own access.
create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create function public.is_creator() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('creator', 'admin'));
$$;

create policy "People can see their own profile"
  on public.profiles for select to authenticated
  using (id = auth.uid());

create policy "Admins can see every profile"
  on public.profiles for select to authenticated
  using (public.is_admin());

create policy "People can rename themselves"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "Admins can change any profile"
  on public.profiles for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Only the display name can be changed through the API; roles change only through admins (below).
revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;

-- Roles are changed by admins with this function, so the column grant above can stay narrow.
create function public.set_role(target uuid, new_role text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can change roles' using errcode = '42501';
  end if;
  if new_role not in ('learner', 'creator', 'admin') then
    raise exception 'Unknown role %', new_role using errcode = '22023';
  end if;
  update public.profiles set role = new_role where id = target;
end;
$$;

revoke execute on function public.set_role(uuid, text) from public, anon;
grant execute on function public.set_role(uuid, text) to authenticated;

-- Asking to become a creator --------------------------------------------------------------------------

create table public.creator_requests (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  message text not null default '' check (char_length(message) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles (id)
);

alter table public.creator_requests enable row level security;

create policy "Learners can ask once"
  on public.creator_requests for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');

create policy "People can see their own request"
  on public.creator_requests for select to authenticated
  using (user_id = auth.uid());

create policy "Admins can see every request"
  on public.creator_requests for select to authenticated
  using (public.is_admin());

-- Approving or declining goes through this function, which also grants the role.
create function public.decide_creator_request(target uuid, approve boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can decide requests' using errcode = '42501';
  end if;
  update public.creator_requests
    set status = case when approve then 'approved' else 'declined' end, decided_at = now(), decided_by = auth.uid()
    where user_id = target and status = 'pending';
  if not found then
    raise exception 'No pending request for that person' using errcode = 'P0002';
  end if;
  if approve then
    update public.profiles set role = 'creator' where id = target and role = 'learner';
  end if;
end;
$$;

revoke execute on function public.decide_creator_request(uuid, boolean) from public, anon;
grant execute on function public.decide_creator_request(uuid, boolean) to authenticated;

-- Models made in the Studio ---------------------------------------------------------------------------

create table public.models (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  -- The model as a Gami .fold file.
  fold jsonb not null,
  -- draft → submitted → published, or back to draft (rejected) with a note from the admin.
  status text not null default 'draft' check (status in ('draft', 'submitted', 'published', 'rejected')),
  review_note text,
  -- Anyone with this token can view the model, whatever its status. Unguessable, and only readable by the owner.
  -- Two random UUIDs (built into Postgres, no extension needed): about 244 random bits.
  share_token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.models enable row level security;

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger models_updated_at
  before update on public.models
  for each row execute function public.touch_updated_at();

create policy "Published models are public"
  on public.models for select to anon, authenticated
  using (status = 'published');

create policy "Owners can see their models"
  on public.models for select to authenticated
  using (owner = auth.uid());

create policy "Admins can see every model"
  on public.models for select to authenticated
  using (public.is_admin());

create policy "Creators can save new drafts"
  on public.models for insert to authenticated
  with check (public.is_creator() and owner = auth.uid() and status = 'draft');

-- Owners edit their own models and can submit them, but can't publish or edit one that's in review or live.
create policy "Owners can edit drafts and submit them"
  on public.models for update to authenticated
  using (owner = auth.uid() and status in ('draft', 'rejected'))
  with check (owner = auth.uid() and status in ('draft', 'submitted'));

create policy "Admins can review"
  on public.models for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Owners can delete their models"
  on public.models for delete to authenticated
  using (owner = auth.uid());

-- Owners can't rewrite who owns a model, its share link, or the admin's note.
revoke update on public.models from authenticated;
grant update (title, fold, status, review_note) on public.models to authenticated;

create function public.guard_model_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not public.is_admin() and new.review_note is distinct from old.review_note then
    raise exception 'Only admins can write review notes' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger models_guard
  before update on public.models
  for each row execute function public.guard_model_update();

-- Opening a model from its unlisted link. A function, so share tokens can be checked but never listed.
create function public.shared_model(token text)
returns table (id uuid, title text, fold jsonb, status text)
language sql stable security definer set search_path = '' as $$
  select m.id, m.title, m.fold, m.status from public.models m where m.share_token = token;
$$;

grant execute on function public.shared_model(text) to anon, authenticated;
