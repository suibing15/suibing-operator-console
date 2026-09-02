-- =====================================================================
--  PATCH 28 — lightweight visitor tracking for public pages. Records
--  a page-view event per visit: path, referrer, and a coarse date —
--  deliberately NOT storing IP addresses, device fingerprints, or
--  anything that identifies an individual visitor. This is a traffic
--  counter, not a tracking/profiling system.
-- =====================================================================

create table if not exists public.page_views (
  id           bigint generated always as identity primary key,
  path         text not null,
  referrer     text,
  session_id   text not null,   -- random id generated client-side per browser tab, not tied to any person
  created_at   timestamptz not null default now()
);

create index if not exists page_views_created_idx on public.page_views (created_at desc);
create index if not exists page_views_path_idx on public.page_views (path, created_at desc);

alter table public.page_views enable row level security;

drop policy if exists page_views_operator_read on public.page_views;
create policy page_views_operator_read on public.page_views
  for select to authenticated using (public.is_operator());

-- ---------------------------------------------------------------------
-- Public: log a page view. No PIN, no auth — this is anonymous by
-- design. Rate-limited loosely by capping how many rows one session_id
-- can insert per minute, to blunt trivial abuse without needing real
-- infrastructure for it.
-- ---------------------------------------------------------------------
create or replace function public.log_page_view(p_path text, p_referrer text, p_session_id text)
returns void language plpgsql security definer set search_path = public as $$
declare v_recent int;
begin
  if p_path is null or trim(p_path) = '' or p_session_id is null or trim(p_session_id) = '' then
    return;
  end if;

  select count(*) into v_recent from public.page_views
  where session_id = p_session_id and created_at > now() - interval '1 minute';
  if v_recent >= 20 then return; end if; -- quietly drop, no error needed for a background beacon

  insert into public.page_views (path, referrer, session_id)
  values (left(trim(p_path), 300), left(nullif(trim(coalesce(p_referrer, '')), ''), 300), left(trim(p_session_id), 100));
end; $$;

grant execute on function public.log_page_view(text, text, text) to anon;

-- ---------------------------------------------------------------------
-- Operator: summary stats for the console dashboard.
-- ---------------------------------------------------------------------
create or replace function public.get_visitor_stats(p_days int default 30)
returns table (
  total_views bigint, unique_sessions bigint,
  today_views bigint, today_sessions bigint
) language sql stable security definer set search_path = public as $$
  select
    count(*) filter (where created_at > now() - (p_days || ' days')::interval),
    count(distinct session_id) filter (where created_at > now() - (p_days || ' days')::interval),
    count(*) filter (where created_at::date = current_date),
    count(distinct session_id) filter (where created_at::date = current_date)
  from public.page_views;
$$;

grant execute on function public.get_visitor_stats(int) to authenticated;

create or replace function public.get_top_pages(p_days int default 30, p_limit int default 10)
returns table (path text, views bigint, unique_sessions bigint)
language sql stable security definer set search_path = public as $$
  select path, count(*) as views, count(distinct session_id) as unique_sessions
  from public.page_views
  where created_at > now() - (p_days || ' days')::interval
  group by path
  order by views desc
  limit p_limit;
$$;

grant execute on function public.get_top_pages(int, int) to authenticated;

create or replace function public.get_daily_visits(p_days int default 30)
returns table (day date, views bigint, unique_sessions bigint)
language sql stable security definer set search_path = public as $$
  select created_at::date as day, count(*) as views, count(distinct session_id) as unique_sessions
  from public.page_views
  where created_at > now() - (p_days || ' days')::interval
  group by created_at::date
  order by day asc;
$$;

grant execute on function public.get_daily_visits(int) to authenticated;

create or replace function public.get_top_referrers(p_days int default 30, p_limit int default 10)
returns table (referrer text, views bigint)
language sql stable security definer set search_path = public as $$
  select coalesce(referrer, 'Direct / unknown') as referrer, count(*) as views
  from public.page_views
  where created_at > now() - (p_days || ' days')::interval
  group by coalesce(referrer, 'Direct / unknown')
  order by views desc
  limit p_limit;
$$;

grant execute on function public.get_top_referrers(int, int) to authenticated;

-- =====================================================================
--  Done.
-- =====================================================================
