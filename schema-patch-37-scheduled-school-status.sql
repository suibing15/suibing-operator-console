-- =====================================================================
--  PATCH 37 — scheduled (timed) school status changes.
--
--  Lets the operator set, ahead of time, "at this timestamp, make this
--  school {active|disabled}, and show it this message" instead of
--  having to remember to come back and flip the switch by hand.
--
--  IMPORTANT — how "automatic" works here: this project has no
--  background worker or pg_cron job running independently of a
--  request (Supabase's free tier does not guarantee either is
--  available), so a due schedule is applied the moment anything next
--  asks "what is this school's status?" — specifically:
--    1. the school's OWN app calling school_status() (registry check),
--    2. someone logging into /school-portal (school_portal_login()),
--    3. any of the ~10 other school-portal actions that re-check the
--       PIN mid-session (verify_school_pin()),
--    4. the operator console loading/refreshing the Schools tab.
--  In practice this means the change takes effect within moments of
--  being due, since all of the above are hit constantly. The console
--  also polls this while it is open (every 60 seconds), so an operator
--  watching the dashboard sees a school flip live without touching
--  anything.
--
--  If your Supabase project ever has the pg_cron extension available,
--  apply_due_school_schedules() can additionally be scheduled directly
--  in Postgres so it is enforced even with zero traffic — see the note
--  at the bottom of this file. Not required for this patch to work.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. New columns holding the pending schedule, if any.
-- ---------------------------------------------------------------------
alter table public.schools
  add column if not exists scheduled_status  text check (scheduled_status in ('active','disabled')),
  add column if not exists scheduled_at      timestamptz,
  add column if not exists scheduled_message text,
  add column if not exists scheduled_by      text,
  add column if not exists scheduled_set_at  timestamptz;

create index if not exists schools_scheduled_idx
  on public.schools (scheduled_at) where scheduled_at is not null;

-- ---------------------------------------------------------------------
-- 2. The engine: apply every schedule whose time has come. Safe to
-- call as often as needed — a no-op when nothing is due. Granted to
-- anon as well as authenticated because it needs to run from the
-- fully public school_status() / school_portal_login() paths; it
-- takes no inputs and only ever acts on schedules an operator already
-- set, so there is nothing here for an anonymous caller to abuse.
--
-- Reuses the exact same fields the school portal already displays:
--   - disabling  -> blocked_reason (shown as the "access paused" notice)
--   - activating -> portal_warning (shown as a one-time dismissible
--                   banner) if a message was given, so a "welcome
--                   back" note can accompany a scheduled re-enable.
-- ---------------------------------------------------------------------
create or replace function public.apply_due_school_schedules()
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in
    select id, school_key, scheduled_status, scheduled_message
    from public.schools
    where scheduled_at is not null and scheduled_at <= now()
  loop
    update public.schools
       set status = r.scheduled_status,
           blocked_reason = case when r.scheduled_status = 'disabled' then r.scheduled_message else null end,
           portal_warning = case when r.scheduled_status = 'active' and r.scheduled_message is not null
                                  then r.scheduled_message else portal_warning end,
           portal_warned_at = case when r.scheduled_status = 'active' and r.scheduled_message is not null
                                  then now() else portal_warned_at end,
           scheduled_status = null, scheduled_at = null, scheduled_message = null,
           scheduled_by = null, scheduled_set_at = null
     where id = r.id;

    insert into public.activity_log (school_id, school_key, event, detail, by_email)
    values (
      r.id, r.school_key,
      case when r.scheduled_status = 'disabled' then 'school_disabled' else 'school_enabled' end,
      'Automatically ' || (case when r.scheduled_status = 'disabled' then 'disabled' else 'activated' end)
        || ' — scheduled change applied'
        || case when r.scheduled_message is not null and trim(r.scheduled_message) <> ''
                then ' ("' || r.scheduled_message || '")' else '' end,
      'system (scheduled)'
    );
  end loop;
end; $$;

grant execute on function public.apply_due_school_schedules() to anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Operator: set (or replace) a school's pending scheduled change.
-- p_status: 'active' or 'disabled'. p_at: when it should take effect
-- (any timestamp; if already in the past, applied immediately below
-- rather than left sitting as an overdue schedule).
-- ---------------------------------------------------------------------
create or replace function public.schedule_school_status(
  p_school_id uuid, p_status text, p_at timestamptz, p_message text, p_by text
) returns void language plpgsql security definer set search_path = public as $$
declare v_key text;
begin
  if not public.is_operator() then raise exception 'not authorised'; end if;
  if p_status not in ('active','disabled') then raise exception 'invalid status'; end if;
  if p_at is null then raise exception 'a date/time is required'; end if;
  select school_key into v_key from public.schools where id = p_school_id;
  if v_key is null then raise exception 'school not found'; end if;

  update public.schools
     set scheduled_status = p_status,
         scheduled_at = p_at,
         scheduled_message = nullif(trim(coalesce(p_message,'')), ''),
         scheduled_by = p_by,
         scheduled_set_at = now()
   where id = p_school_id;

  insert into public.activity_log (school_id, school_key, event, detail, by_email)
  values (p_school_id, v_key, 'schedule_set',
          'Scheduled to become ' || p_status || ' at ' || p_at
            || case when p_message is not null and trim(p_message) <> ''
                    then ' — "' || trim(p_message) || '"' else '' end,
          p_by);

  perform public.apply_due_school_schedules();
end; $$;

grant execute on function public.schedule_school_status(uuid, text, timestamptz, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Operator: cancel a pending schedule without applying it.
-- ---------------------------------------------------------------------
create or replace function public.clear_school_schedule(p_school_id uuid, p_by text)
returns void language plpgsql security definer set search_path = public as $$
declare v_key text;
begin
  if not public.is_operator() then raise exception 'not authorised'; end if;
  select school_key into v_key from public.schools where id = p_school_id;

  update public.schools
     set scheduled_status = null, scheduled_at = null, scheduled_message = null,
         scheduled_by = null, scheduled_set_at = null
   where id = p_school_id;

  insert into public.activity_log (school_id, school_key, event, detail, by_email)
  values (p_school_id, v_key, 'schedule_cleared', 'Scheduled status change cancelled', p_by);
end; $$;

grant execute on function public.clear_school_schedule(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Optional convenience read: every school with a pending schedule,
-- soonest first. Not required by the console (it already selects * on
-- schools, which now includes these columns) but kept for anywhere
-- else that only wants this slice.
-- ---------------------------------------------------------------------
create or replace function public.list_scheduled_schools()
returns table (
  id uuid, school_key text, name text,
  scheduled_status text, scheduled_at timestamptz, scheduled_message text,
  scheduled_by text, scheduled_set_at timestamptz
) language sql stable security definer set search_path = public as $$
  select id, school_key, name, scheduled_status, scheduled_at, scheduled_message, scheduled_by, scheduled_set_at
  from public.schools
  where scheduled_at is not null
  order by scheduled_at asc;
$$;

grant execute on function public.list_scheduled_schools() to authenticated;

-- ---------------------------------------------------------------------
-- 6. Hook the auto-apply into the three existing check-in paths, so a
-- due schedule takes effect the moment any of them is next called.
-- Each is recreated with the SAME signature/return type as its live
-- version (registry: school_status; patch 23: school_portal_login;
-- patch 24: verify_school_pin) — only one added line each, no other
-- logic, column, or return shape changed.
-- ---------------------------------------------------------------------

-- 6a. school_status() — called by each SCHOOL'S OWN separate app.
create or replace function public.school_status(p_key text)
returns table (active boolean, name text, paid_until date)
language plpgsql security definer set search_path = public as $$
begin
  perform public.apply_due_school_schedules();
  return query
  select (s.status = 'active') as active, s.name, s.paid_until
  from public.schools s
  where s.school_key = p_key;
end; $$;

grant execute on function public.school_status(text) to anon;

-- 6b. school_portal_login() — this console's own school-portal login.
create or replace function public.school_portal_login(p_school_key text, p_pin text)
returns table (
  school_id uuid, name text, school_key text, status text, blocked_reason text,
  portal_warning text, plan text, paid_until date,
  students_count int, records_count int, counts_updated timestamptz
) language plpgsql security definer set search_path = public as $$
declare
  v_key text := lower(trim(p_school_key));
  v_recent_failures int;
  v_matched public.schools%rowtype;
begin
  perform public.apply_due_school_schedules();

  select count(*) into v_recent_failures
  from public.portal_login_attempts pla
  where pla.school_key = v_key and pla.succeeded = false and pla.created_at > now() - interval '15 minutes';

  if v_recent_failures >= 8 then
    raise exception 'Too many failed attempts. Please wait 15 minutes before trying again.';
  end if;

  select s.* into v_matched from public.schools s
   where s.school_key = v_key
     and s.portal_pin_hash is not null
     and s.portal_pin_hash = extensions.crypt(trim(p_pin), s.portal_pin_hash);

  insert into public.portal_login_attempts (school_key, succeeded)
  values (v_key, v_matched.id is not null);

  if v_matched.id is null then
    return;
  end if;

  return query
  select v_matched.id, v_matched.name, v_matched.school_key, v_matched.status, v_matched.blocked_reason,
         v_matched.portal_warning, v_matched.plan, v_matched.paid_until,
         v_matched.students_count, v_matched.records_count, v_matched.counts_updated;
end; $$;

grant execute on function public.school_portal_login(text, text) to anon;

-- 6c. verify_school_pin() — shared by every other portal action
-- (payments, invoices, complaints, PIN change, etc.), so a schedule
-- also takes effect mid-session, not just at the initial login.
create or replace function public.verify_school_pin(p_school_key text, p_pin text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_key text := lower(trim(p_school_key));
  v_recent_failures int;
  v_school_id uuid;
begin
  perform public.apply_due_school_schedules();

  select count(*) into v_recent_failures
  from public.portal_login_attempts pla
  where pla.school_key = v_key and pla.succeeded = false and pla.created_at > now() - interval '15 minutes';

  if v_recent_failures >= 8 then
    raise exception 'Too many failed attempts for this school. Please wait 15 minutes before trying again.';
  end if;

  select s.id into v_school_id from public.schools s
   where s.school_key = v_key
     and s.portal_pin_hash is not null
     and s.portal_pin_hash = extensions.crypt(trim(p_pin), s.portal_pin_hash);

  insert into public.portal_login_attempts (school_key, succeeded)
  values (v_key, v_school_id is not null);

  return v_school_id;
end; $$;

-- =====================================================================
--  OPTIONAL — true server-side cron, only if your Supabase project has
--  the pg_cron extension available (Dashboard → Database → Extensions).
--  Not required: the hooks above already make this self-applying via
--  normal traffic. Add this only if you want it enforced even when
--  nothing has checked in for a while:
--
--    create extension if not exists pg_cron;
--    select cron.schedule('apply-school-schedules', '* * * * *',
--      $$ select public.apply_due_school_schedules(); $$);
-- =====================================================================

-- =====================================================================
--  Done. New: apply_due_school_schedules(), schedule_school_status(),
--  clear_school_schedule(), list_scheduled_schools(). Updated (same
--  signatures, one added line): school_status(), school_portal_login(),
--  verify_school_pin().
-- =====================================================================
