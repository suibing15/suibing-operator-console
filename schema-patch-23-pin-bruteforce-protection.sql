-- =====================================================================
--  PATCH 23 — SECURITY: rate-limit school portal PIN attempts.
--
--  Problem: school_portal_login accepts a school_key + PIN with no
--  limit on how many times it can be called. A 4-character PIN has
--  as few as 10,000 possible combinations (if numeric) — completely
--  brute-forceable in minutes via automated requests, since Postgres
--  will evaluate crypt() comparisons as fast as they arrive.
--
--  Fix: track failed attempts per school_key, and temporarily lock
--  that school_key out after too many failures in a short window —
--  independent of which IP the requests come from, so it can't be
--  bypassed by simply rotating IPs.
-- =====================================================================

create table if not exists public.portal_login_attempts (
  id           bigint generated always as identity primary key,
  school_key   text not null,
  succeeded    boolean not null,
  created_at   timestamptz not null default now()
);

create index if not exists portal_login_attempts_key_time_idx
  on public.portal_login_attempts (school_key, created_at desc);

alter table public.portal_login_attempts enable row level security;
-- No policies granted to anon/authenticated — this table is only ever
-- touched from inside security definer functions, never directly.

-- ---------------------------------------------------------------------
-- Replace school_portal_login to check + record attempts.
-- Lockout: 8 failed attempts within 15 minutes blocks further tries
-- for that school_key for 15 minutes, regardless of whether the
-- correct PIN is then supplied — this makes brute-forcing require
-- waiting out real time, not just retrying faster.
-- ---------------------------------------------------------------------
drop function if exists public.school_portal_login(text, text);

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
    return; -- no row returned, same as before on wrong credentials
  end if;

  return query
  select v_matched.id, v_matched.name, v_matched.school_key, v_matched.status, v_matched.blocked_reason,
         v_matched.portal_warning, v_matched.plan, v_matched.paid_until,
         v_matched.students_count, v_matched.records_count, v_matched.counts_updated;
end; $$;

grant execute on function public.school_portal_login(text, text) to anon;

-- ---------------------------------------------------------------------
-- Housekeeping: old attempt rows are only ever needed for the trailing
-- 15-minute window, so periodically trim anything older than a day.
-- (No pg_cron assumed available — safe to call this occasionally from
-- the operator console, or leave it; the table stays small regardless
-- since only failed/succeeded rows accumulate, not a runaway log.)
-- ---------------------------------------------------------------------
create or replace function public.cleanup_old_login_attempts()
returns void language sql security definer set search_path = public as $$
  delete from public.portal_login_attempts where created_at < now() - interval '1 day';
$$;

grant execute on function public.cleanup_old_login_attempts() to authenticated;

-- =====================================================================
--  Done.
-- =====================================================================
