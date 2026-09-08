-- =====================================================================
--  PATCH 33 — notification bell for the operator console. Reuses the
--  existing activity_log as the single source of truth (every
--  payment, complaint, PIN reset, document sent, etc. is already
--  logged there) rather than building a second, parallel notification
--  table that could drift out of sync with it.
--
--  Adds a per-operator "last seen" timestamp so the bell can show a
--  genuine unread count — how many activity_log entries have
--  happened since this operator last opened the notifications panel.
-- =====================================================================

alter table public.operators
  add column if not exists notifications_seen_at timestamptz not null default now();

-- ---------------------------------------------------------------------
-- Recent activity feed for the bell dropdown — the newest N entries,
-- with a flag for whether each is new since the operator last checked.
-- ---------------------------------------------------------------------
create or replace function public.get_recent_activity(p_limit int default 30)
returns table (
  id uuid, school_id uuid, school_key text, event text, detail text,
  amount numeric, at timestamptz, by_email text, is_new boolean
) language plpgsql stable security definer set search_path = public as $$
declare v_seen_at timestamptz;
begin
  if not public.is_operator() then raise exception 'not authorised'; end if;

  select notifications_seen_at into v_seen_at from public.operators
  where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''));

  return query
  select a.id, a.school_id, a.school_key, a.event, a.detail, a.amount, a.at, a.by_email,
         a.at > coalesce(v_seen_at, now())
  from public.activity_log a
  order by a.at desc
  limit p_limit;
end; $$;

grant execute on function public.get_recent_activity(int) to authenticated;

-- ---------------------------------------------------------------------
-- How many entries are new since this operator last checked, for the
-- badge count — cheaper than fetching the full list just to count it.
-- ---------------------------------------------------------------------
create or replace function public.get_unread_activity_count()
returns int language plpgsql stable security definer set search_path = public as $$
declare v_seen_at timestamptz; v_count int;
begin
  if not public.is_operator() then raise exception 'not authorised'; end if;

  select notifications_seen_at into v_seen_at from public.operators
  where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''));

  select count(*) into v_count from public.activity_log where at > coalesce(v_seen_at, now());
  return v_count;
end; $$;

grant execute on function public.get_unread_activity_count() to authenticated;

-- ---------------------------------------------------------------------
-- Mark all caught up — called when the operator opens the bell.
-- ---------------------------------------------------------------------
create or replace function public.mark_activity_seen()
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_operator() then raise exception 'not authorised'; end if;
  update public.operators
     set notifications_seen_at = now()
   where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''));
end; $$;

grant execute on function public.mark_activity_seen() to authenticated;

-- =====================================================================
--  Done.
-- =====================================================================
