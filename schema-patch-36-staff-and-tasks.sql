-- =====================================================================
--  PATCH 36 — staff accounts + task assignment/tracking.
--
--  ASSUMPTIONS ABOUT YOUR EXISTING SCHEMA (please verify before running,
--  since the schema is spread across many patch files):
--    - public.is_operator() exists (used throughout the console)
--    - public.activity_log(school_id, school_key, event, detail, amount, at, by_email)
--    - public.job_applicants table exists, with at minimum: id, full_name (or
--      similar), email, status. If your actual column names differ (e.g.
--      "name" instead of "full_name"), the activate_staff_from_applicant()
--      function below is the ONLY place that needs adjusting — everything
--      else in this patch is self-contained and does not depend on
--      job_applicants' exact shape.
--    - extensions.crypt() / extensions.gen_salt() are available (pgcrypto
--      in the extensions schema — used throughout the school portal PIN
--      system, per prior work).
--
--  RATE LIMITING: staff login shares the SAME brute-force protection
--  already built for schools (portal_login_attempts, 8 failed attempts /
--  15 minute lockout) — no new lockout mechanism invented here, reusing
--  the exact pattern already audited and hardened.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Staff accounts. Deliberately NOT Supabase Auth — a lightweight
-- username + PIN pair fully contained in this database, exactly like
-- the school portal, so there is no path to accidentally elevating a
-- contractor to full operator access, and deactivating someone when a
-- contract ends is just deleting a row, not deprovisioning an Auth user.
-- ---------------------------------------------------------------------
create table if not exists public.staff (
  id            uuid primary key default gen_random_uuid(),
  username      text unique not null,
  pin_hash      text not null,
  full_name     text not null,
  email         text,
  phone         text,
  applicant_id  uuid,            -- set if created via "Activate as staff", else null
  status        text not null default 'active' check (status in ('active', 'suspended')),
  created_at    timestamptz not null default now(),
  created_by    text
);

create index if not exists staff_username_idx on public.staff (username);

alter table public.staff enable row level security;

drop policy if exists staff_operator_all on public.staff;
create policy staff_operator_all on public.staff
  for all to authenticated using (public.is_operator()) with check (public.is_operator());

-- ---------------------------------------------------------------------
-- Task categories — a small, extensible list. Operators can add a new
-- one inline when creating a task (handled in create_task below via
-- upsert-by-name), so there is no separate "manage categories" screen.
-- ---------------------------------------------------------------------
create table if not exists public.task_categories (
  id    uuid primary key default gen_random_uuid(),
  name  text unique not null
);

insert into public.task_categories (name) values
  ('General'), ('E-Reportsheet Entry'), ('Exam Question Entry')
on conflict (name) do nothing;

alter table public.task_categories enable row level security;

drop policy if exists task_categories_operator_all on public.task_categories;
create policy task_categories_operator_all on public.task_categories
  for all to authenticated using (public.is_operator()) with check (public.is_operator());

drop policy if exists task_categories_staff_read on public.task_categories;
create policy task_categories_staff_read on public.task_categories
  for select to anon using (true);
-- Categories are just short labels (no sensitive content), safe to read
-- publicly since only the RPC layer below actually exposes task data,
-- and every task-reading RPC is itself PIN-gated.

-- ---------------------------------------------------------------------
-- Tasks. school_name / school_url are captured as plain text at the
-- point of assignment (per the requirement: staff should see which
-- school and be able to reach that school's own separate portal) —
-- deliberately NOT a foreign key into public.schools, since a school's
-- own login is a fully separate system per the existing architecture,
-- and a task should still show correctly even if the school row it
-- refers to is later renamed or removed from this registry.
-- ---------------------------------------------------------------------
create table if not exists public.tasks (
  id             uuid primary key default gen_random_uuid(),
  staff_id       uuid not null references public.staff(id) on delete cascade,
  category       text not null default 'General',
  title          text not null,
  instructions   text,
  school_name    text,
  school_url     text,
  status         text not null default 'assigned'
                   check (status in ('assigned', 'in_progress', 'done', 'reviewed')),
  created_by     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists tasks_staff_idx on public.tasks (staff_id, updated_at desc);
create index if not exists tasks_status_idx on public.tasks (status, updated_at desc);

alter table public.tasks enable row level security;

drop policy if exists tasks_operator_all on public.tasks;
create policy tasks_operator_all on public.tasks
  for all to authenticated using (public.is_operator()) with check (public.is_operator());

drop trigger if exists tasks_touch on public.tasks;
create or replace function public.touch_task_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;
create trigger tasks_touch before update on public.tasks
  for each row execute function public.touch_task_updated_at();

-- ---------------------------------------------------------------------
-- Task message thread — mirrors the school complaint_messages pattern
-- exactly (sender is 'staff' or 'operator').
-- ---------------------------------------------------------------------
create table if not exists public.task_messages (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks(id) on delete cascade,
  sender      text not null check (sender in ('staff', 'operator')),
  body        text not null,
  by_email    text,
  created_at  timestamptz not null default now()
);

create index if not exists task_messages_task_idx on public.task_messages (task_id, created_at asc);

alter table public.task_messages enable row level security;

drop policy if exists task_messages_operator_all on public.task_messages;
create policy task_messages_operator_all on public.task_messages
  for all to authenticated using (public.is_operator()) with check (public.is_operator());

-- =====================================================================
--  Shared staff-PIN verifier — same shape and same lockout table as
--  verify_school_pin(), just keyed by staff username instead of a
--  school key. Reuses portal_login_attempts (created for schools) by
--  prefixing the key so the two credential spaces can never collide.
-- =====================================================================
create or replace function public.verify_staff_pin(p_username text, p_pin text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_key text := 'staff:' || lower(trim(p_username));
  v_recent_failures int;
  v_staff_id uuid;
begin
  select count(*) into v_recent_failures
  from public.portal_login_attempts pla
  where pla.school_key = v_key and pla.succeeded = false and pla.created_at > now() - interval '15 minutes';

  if v_recent_failures >= 8 then
    raise exception 'Too many failed attempts. Please wait 15 minutes before trying again.';
  end if;

  select s.id into v_staff_id from public.staff s
   where lower(s.username) = lower(trim(p_username))
     and s.status = 'active'
     and s.pin_hash = extensions.crypt(trim(p_pin), s.pin_hash);

  insert into public.portal_login_attempts (school_key, succeeded)
  values (v_key, v_staff_id is not null);

  return v_staff_id;
end; $$;

-- ---------------------------------------------------------------------
-- Staff login.
-- ---------------------------------------------------------------------
create or replace function public.staff_portal_login(p_username text, p_pin text)
returns table (staff_id uuid, username text, full_name text)
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  v_id := public.verify_staff_pin(p_username, p_pin);
  if v_id is null then return; end if;
  return query select s.id, s.username, s.full_name from public.staff s where s.id = v_id;
end; $$;

grant execute on function public.staff_portal_login(text, text) to anon;

create or replace function public.change_staff_pin(p_username text, p_current_pin text, p_new_pin text)
returns void language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if length(trim(p_new_pin)) < 4 then raise exception 'New PIN must be at least 4 characters'; end if;
  v_id := public.verify_staff_pin(p_username, p_current_pin);
  if v_id is null then raise exception 'current PIN is incorrect'; end if;
  update public.staff set pin_hash = extensions.crypt(trim(p_new_pin), extensions.gen_salt('bf')) where id = v_id;
end; $$;

grant execute on function public.change_staff_pin(text, text, text) to anon;

-- ---------------------------------------------------------------------
-- Staff: view their own tasks and reply to a task's thread.
-- ---------------------------------------------------------------------
create or replace function public.list_staff_tasks(p_username text, p_pin text)
returns table (
  id uuid, category text, title text, instructions text,
  school_name text, school_url text, status text, updated_at timestamptz, created_at timestamptz
) language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  v_id := public.verify_staff_pin(p_username, p_pin);
  if v_id is null then raise exception 'not authorised'; end if;
  return query
  select t.id, t.category, t.title, t.instructions, t.school_name, t.school_url, t.status, t.updated_at, t.created_at
  from public.tasks t where t.staff_id = v_id order by t.updated_at desc;
end; $$;

grant execute on function public.list_staff_tasks(text, text) to anon;

create or replace function public.get_task_thread(p_username text, p_pin text, p_task_id uuid)
returns table (id uuid, sender text, body text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_owner uuid;
begin
  v_id := public.verify_staff_pin(p_username, p_pin);
  if v_id is null then raise exception 'not authorised'; end if;
  select staff_id into v_owner from public.tasks where id = p_task_id;
  if v_owner is distinct from v_id then raise exception 'not authorised for this task'; end if;
  return query select m.id, m.sender, m.body, m.created_at from public.task_messages m
    where m.task_id = p_task_id order by m.created_at asc;
end; $$;

grant execute on function public.get_task_thread(text, text, uuid) to anon;

create or replace function public.update_task_status(p_username text, p_pin text, p_task_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_owner uuid;
begin
  v_id := public.verify_staff_pin(p_username, p_pin);
  if v_id is null then raise exception 'not authorised'; end if;
  if p_status not in ('in_progress', 'done') then
    raise exception 'staff may only set status to in_progress or done';
  end if;
  select staff_id into v_owner from public.tasks where id = p_task_id;
  if v_owner is distinct from v_id then raise exception 'not authorised for this task'; end if;
  update public.tasks set status = p_status where id = p_task_id;
end; $$;

grant execute on function public.update_task_status(text, text, uuid, text) to anon;

create or replace function public.reply_to_task_as_staff(p_username text, p_pin text, p_task_id uuid, p_message text)
returns void language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_owner uuid;
begin
  v_id := public.verify_staff_pin(p_username, p_pin);
  if v_id is null then raise exception 'not authorised'; end if;
  if trim(p_message) = '' then raise exception 'message cannot be empty'; end if;
  select staff_id into v_owner from public.tasks where id = p_task_id;
  if v_owner is distinct from v_id then raise exception 'not authorised for this task'; end if;
  insert into public.task_messages (task_id, sender, body) values (p_task_id, 'staff', trim(p_message));
  update public.tasks set updated_at = now() where id = p_task_id;
end; $$;

grant execute on function public.reply_to_task_as_staff(text, text, uuid, text) to anon;

-- =====================================================================
--  Operator side.
-- =====================================================================

create or replace function public.add_staff(
  p_username text, p_pin text, p_full_name text, p_email text, p_phone text,
  p_applicant_id uuid, p_by text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_operator() then raise exception 'not authorised'; end if;
  if trim(p_username) = '' or trim(p_full_name) = '' then raise exception 'username and full name are required'; end if;
  if length(trim(p_pin)) < 4 then raise exception 'PIN must be at least 4 characters'; end if;

  insert into public.staff (username, pin_hash, full_name, email, phone, applicant_id, created_by)
  values (lower(trim(p_username)), extensions.crypt(trim(p_pin), extensions.gen_salt('bf')),
          trim(p_full_name), nullif(trim(p_email), ''), nullif(trim(p_phone), ''), p_applicant_id, p_by)
  returning id into v_id;

  insert into public.activity_log (event, detail, by_email)
  values ('staff_added', trim(p_full_name) || ' (' || lower(trim(p_username)) || ') added as staff', p_by);

  return v_id;
end; $$;

grant execute on function public.add_staff(text, text, text, text, text, uuid, text) to authenticated;

create or replace function public.list_staff()
returns table (id uuid, username text, full_name text, email text, phone text, status text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_operator() then raise exception 'not authorised'; end if;
  return query select s.id, s.username, s.full_name, s.email, s.phone, s.status, s.created_at
    from public.staff s order by s.created_at desc;
end; $$;

grant execute on function public.list_staff() to authenticated;

create or replace function public.reset_staff_pin(p_staff_id uuid, p_new_pin text, p_by text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_operator() then raise exception 'not authorised'; end if;
  if length(trim(p_new_pin)) < 4 then raise exception 'PIN must be at least 4 characters'; end if;
  update public.staff set pin_hash = extensions.crypt(trim(p_new_pin), extensions.gen_salt('bf')) where id = p_staff_id;
  insert into public.activity_log (event, detail, by_email)
  values ('staff_pin_reset', 'PIN reset for staff ' || p_staff_id, p_by);
end; $$;

grant execute on function public.reset_staff_pin(uuid, text, text) to authenticated;

create or replace function public.set_staff_status(p_staff_id uuid, p_status text, p_by text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_operator() then raise exception 'not authorised'; end if;
  if p_status not in ('active', 'suspended') then raise exception 'invalid status'; end if;
  update public.staff set status = p_status where id = p_staff_id;
  insert into public.activity_log (event, detail, by_email)
  values ('staff_' || p_status, 'Staff ' || p_staff_id || ' set to ' || p_status, p_by);
end; $$;

grant execute on function public.set_staff_status(uuid, text, text) to authenticated;

-- Full removal — for when a contract ends and the record itself should
-- go, not just be suspended. Cascades to that staff member's tasks and
-- task_messages (their own foreign keys), but never touches
-- activity_log (no FK relationship, exactly the same safety property
-- used for school/document/invoice deletion elsewhere in this system).
create or replace function public.delete_staff(p_staff_id uuid, p_by text)
returns void language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  if not public.is_operator() then raise exception 'not authorised'; end if;
  select full_name into v_name from public.staff where id = p_staff_id;
  delete from public.staff where id = p_staff_id;
  insert into public.activity_log (event, detail, by_email)
  values ('staff_deleted', coalesce(v_name, p_staff_id::text) || ' removed as staff', p_by);
end; $$;

grant execute on function public.delete_staff(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- Note: activating a job applicant as staff does not need a dedicated
-- lookup function — the console already has the full applicant row in
-- hand (JobsQueue.tsx loads job_applicants directly), so the
-- "Activate as staff" button simply pre-fills add_staff()'s
-- p_full_name / p_email / p_phone / p_applicant_id from that row.

-- ---------------------------------------------------------------------
-- Task management (operator side).
-- ---------------------------------------------------------------------
create or replace function public.create_task(
  p_staff_id uuid, p_category text, p_title text, p_instructions text,
  p_school_name text, p_school_url text, p_by text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_operator() then raise exception 'not authorised'; end if;
  if trim(p_title) = '' then raise exception 'title is required'; end if;

  -- Add the category to the managed list if it's new, so it shows up
  -- as a known option next time without a separate management screen.
  insert into public.task_categories (name) values (nullif(trim(p_category), ''))
  on conflict (name) do nothing;

  insert into public.tasks (staff_id, category, title, instructions, school_name, school_url, created_by)
  values (p_staff_id, coalesce(nullif(trim(p_category), ''), 'General'), trim(p_title),
          nullif(trim(p_instructions), ''), nullif(trim(p_school_name), ''), nullif(trim(p_school_url), ''), p_by)
  returning id into v_id;

  insert into public.activity_log (event, detail, by_email)
  values ('task_assigned', 'Task assigned: ' || trim(p_title), p_by);

  return v_id;
end; $$;

grant execute on function public.create_task(uuid, text, text, text, text, text, text) to authenticated;

create or replace function public.list_task_categories()
returns table (name text) language sql stable security definer set search_path = public as $$
  select name from public.task_categories order by name asc;
$$;

grant execute on function public.list_task_categories() to authenticated;

create or replace function public.reply_to_task_as_operator(p_task_id uuid, p_message text, p_by text, p_mark_reviewed boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_operator() then raise exception 'not authorised'; end if;
  if trim(p_message) = '' then raise exception 'message cannot be empty'; end if;
  insert into public.task_messages (task_id, sender, body, by_email) values (p_task_id, 'operator', trim(p_message), p_by);
  update public.tasks
     set updated_at = now(), status = case when p_mark_reviewed then 'reviewed' else status end
   where id = p_task_id;
end; $$;

grant execute on function public.reply_to_task_as_operator(uuid, text, text, boolean) to authenticated;

create or replace function public.set_task_status_as_operator(p_task_id uuid, p_status text, p_by text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_operator() then raise exception 'not authorised'; end if;
  if p_status not in ('assigned', 'in_progress', 'done', 'reviewed') then raise exception 'invalid status'; end if;
  update public.tasks set status = p_status where id = p_task_id;
  insert into public.activity_log (event, detail, by_email)
  values ('task_' || p_status, 'Task ' || p_task_id || ' set to ' || p_status, p_by);
end; $$;

grant execute on function public.set_task_status_as_operator(uuid, text, text) to authenticated;

create or replace function public.delete_task(p_task_id uuid, p_by text)
returns void language plpgsql security definer set search_path = public as $$
declare v_title text;
begin
  if not public.is_operator() then raise exception 'not authorised'; end if;
  select title into v_title from public.tasks where id = p_task_id;
  delete from public.tasks where id = p_task_id;
  insert into public.activity_log (event, detail, by_email)
  values ('task_deleted', 'Task deleted: ' || coalesce(v_title, p_task_id::text), p_by);
end; $$;

grant execute on function public.delete_task(uuid, text) to authenticated;

-- =====================================================================
--  Done.
-- =====================================================================
