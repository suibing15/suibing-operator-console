-- =====================================================================
--  PATCH 30 — add coarse location (city/country only) to page views.
--  Deliberately does NOT store IP addresses anywhere — the IP is
--  resolved to a city/country server-side (in the Next.js API route,
--  never in the browser) and only the resolved location is ever
--  written to the database. This keeps the tracker anonymous in the
--  sense that matters: nothing here can identify a specific device,
--  person, or household, only a general area.
-- =====================================================================

alter table public.page_views
  add column if not exists city    text,
  add column if not exists country text;

-- ---------------------------------------------------------------------
-- Replace log_page_view to accept the resolved location. Still no PIN,
-- still anonymous, still capped per session per minute.
-- ---------------------------------------------------------------------
drop function if exists public.log_page_view(text, text, text);

create or replace function public.log_page_view(
  p_path text, p_referrer text, p_session_id text,
  p_city text default null, p_country text default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_recent int;
begin
  if p_path is null or trim(p_path) = '' or p_session_id is null or trim(p_session_id) = '' then
    return;
  end if;

  select count(*) into v_recent from public.page_views
  where session_id = p_session_id and created_at > now() - interval '1 minute';
  if v_recent >= 20 then return; end if;

  insert into public.page_views (path, referrer, session_id, city, country)
  values (
    left(trim(p_path), 300), left(nullif(trim(coalesce(p_referrer, '')), ''), 300), left(trim(p_session_id), 100),
    left(nullif(trim(coalesce(p_city, '')), ''), 100), left(nullif(trim(coalesce(p_country, '')), ''), 100)
  );
end; $$;

grant execute on function public.log_page_view(text, text, text, text, text) to anon;

-- ---------------------------------------------------------------------
-- Top locations, for the console dashboard.
-- ---------------------------------------------------------------------
create or replace function public.get_top_locations(p_days int default 30, p_limit int default 10)
returns table (city text, country text, views bigint)
language sql stable security definer set search_path = public as $$
  select coalesce(city, 'Unknown'), coalesce(country, 'Unknown'), count(*) as views
  from public.page_views
  where created_at > now() - (p_days || ' days')::interval
  group by coalesce(city, 'Unknown'), coalesce(country, 'Unknown')
  order by views desc
  limit p_limit;
$$;

grant execute on function public.get_top_locations(int, int) to authenticated;

-- ---------------------------------------------------------------------
-- Retention: page view data is only ever kept for 12 months (see the
-- Privacy Policy). No automatic scheduler is assumed available here —
-- this can be called from the console occasionally, or wired to a
-- scheduled job later if one becomes available.
-- ---------------------------------------------------------------------
create or replace function public.cleanup_old_page_views()
returns void language sql security definer set search_path = public as $$
  delete from public.page_views where created_at < now() - interval '12 months';
$$;

grant execute on function public.cleanup_old_page_views() to authenticated;

-- =====================================================================
--  Done.
-- =====================================================================
