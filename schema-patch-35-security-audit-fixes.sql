-- =====================================================================
--  PATCH 35 — security audit fixes. Two functions were found bypassing
--  the shared brute-force protection that everything else in the
--  school portal goes through:
--
--  1. dismiss_portal_warning — did its own inline PIN check instead of
--     calling verify_school_pin(), so it had zero rate limiting.
--
--  2. get_school_invoice / list_school_invoices — the public
--     "check my invoices by email" lookup (used from the homepage,
--     separate from the PIN-gated portal) authenticates by
--     school_key + contact_email instead of a PIN. A contact email is
--     often far more guessable than a random PIN (predictable
--     patterns, or simply the school's own publicly listed contact
--     address), and this had NO rate limiting at all. Extended the
--     same attempt-tracking/lockout mechanism to cover this path too,
--     keyed by school_key (same protection shape, independent of
--     which credential type is being guessed).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Fix dismiss_portal_warning to route through verify_school_pin().
-- ---------------------------------------------------------------------
create or replace function public.dismiss_portal_warning(p_school_key text, p_pin text)
returns void language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  v_id := public.verify_school_pin(p_school_key, p_pin);
  if v_id is null then raise exception 'not authorised'; end if;
  update public.schools set portal_warning = null where id = v_id;
end; $$;

grant execute on function public.dismiss_portal_warning(text, text) to anon;

-- ---------------------------------------------------------------------
-- 2. Extend the same lockout mechanism to the email-based public
-- invoice lookup. Shares the portal_login_attempts table (created in
-- patch 23) — a school_key under attack via either credential type
-- locks out consistently.
-- ---------------------------------------------------------------------
create or replace function public.verify_school_email(p_school_key text, p_email text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_key text := lower(trim(p_school_key));
  v_recent_failures int;
  v_school_id uuid;
begin
  if trim(p_email) = '' then return null; end if;

  select count(*) into v_recent_failures
  from public.portal_login_attempts pla
  where pla.school_key = v_key and pla.succeeded = false and pla.created_at > now() - interval '15 minutes';

  if v_recent_failures >= 8 then
    raise exception 'Too many failed attempts for this school. Please wait 15 minutes before trying again.';
  end if;

  select s.id into v_school_id from public.schools s
   where s.school_key = v_key
     and lower(coalesce(s.contact_email, '')) = lower(trim(p_email));

  insert into public.portal_login_attempts (school_key, succeeded)
  values (v_key, v_school_id is not null);

  return v_school_id;
end; $$;

drop function if exists public.get_school_invoice(text, text, text);
create or replace function public.get_school_invoice(p_school_key text, p_email text, p_invoice_number text)
returns table (
  invoice_number text, school_name text, line_items jsonb, currency text,
  subtotal numeric, total numeric, notes text, status text, issued_at timestamptz
) language plpgsql security definer set search_path = public as $$
declare v_school_id uuid;
begin
  v_school_id := public.verify_school_email(p_school_key, p_email);
  if v_school_id is null then return; end if;
  return query
  select i.invoice_number, s.name, i.line_items, i.currency, i.subtotal, i.total, i.notes, i.status, i.issued_at
  from public.invoices i
  join public.schools s on s.id = i.school_id
  where i.school_id = v_school_id and i.invoice_number = p_invoice_number;
end; $$;

grant execute on function public.get_school_invoice(text, text, text) to anon;

drop function if exists public.list_school_invoices(text, text);
create or replace function public.list_school_invoices(p_school_key text, p_email text)
returns table (
  invoice_number text, line_items jsonb, currency text, subtotal numeric,
  total numeric, notes text, status text, issued_at timestamptz
) language plpgsql security definer set search_path = public as $$
declare v_school_id uuid;
begin
  v_school_id := public.verify_school_email(p_school_key, p_email);
  if v_school_id is null then return; end if;
  return query
  select i.invoice_number, i.line_items, i.currency, i.subtotal, i.total, i.notes, i.status, i.issued_at
  from public.invoices i
  where i.school_id = v_school_id
  order by i.issued_at desc;
end; $$;

grant execute on function public.list_school_invoices(text, text) to anon;


drop function if exists public.get_visitor_stats(int);
drop function if exists public.get_top_pages(int, int);
drop function if exists public.get_daily_visits(int);
drop function if exists public.get_top_referrers(int, int);
drop function if exists public.get_top_locations(int, int);
drop function if exists public.get_broadcast_banner_admin();
drop function if exists public.list_operators();

-- ---------------------------------------------------------------------
-- 3. list_operators had no explicit authorization check — it relied
-- entirely on "authenticated" meaning "operator", which is an
-- assumption the function itself should not depend on. Reveals every
-- operator's email and name, so this matters.
-- ---------------------------------------------------------------------
create or replace function public.list_operators()
returns table (email text, full_name text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_operator() then raise exception 'not authorised'; end if;
  return query select email, full_name, created_at from public.operators order by created_at asc;
end; $$;

grant execute on function public.list_operators() to authenticated;

-- ---------------------------------------------------------------------
-- 4. Visitor-analytics functions (page view counts) are low severity —
-- they only reveal anonymous traffic stats, nothing personal — but
-- were likewise missing an explicit check. Added defensively so none
-- of these silently depend on "authenticated always means operator"
-- continuing to hold true.
-- ---------------------------------------------------------------------
create or replace function public.get_visitor_stats(p_days int default 30)
returns table (
  total_views bigint, unique_sessions bigint,
  today_views bigint, today_sessions bigint
) language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_operator() then raise exception 'not authorised'; end if;
  return query
  select
    count(*) filter (where created_at > now() - (p_days || ' days')::interval),
    count(distinct session_id) filter (where created_at > now() - (p_days || ' days')::interval),
    count(*) filter (where created_at::date = current_date),
    count(distinct session_id) filter (where created_at::date = current_date)
  from public.page_views;
end; $$;

grant execute on function public.get_visitor_stats(int) to authenticated;

create or replace function public.get_top_pages(p_days int default 30, p_limit int default 10)
returns table (path text, views bigint, unique_sessions bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_operator() then raise exception 'not authorised'; end if;
  return query
  select path, count(*) as views, count(distinct session_id) as unique_sessions
  from public.page_views
  where created_at > now() - (p_days || ' days')::interval
  group by path
  order by views desc
  limit p_limit;
end; $$;

grant execute on function public.get_top_pages(int, int) to authenticated;

create or replace function public.get_daily_visits(p_days int default 30)
returns table (day date, views bigint, unique_sessions bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_operator() then raise exception 'not authorised'; end if;
  return query
  select created_at::date as day, count(*) as views, count(distinct session_id) as unique_sessions
  from public.page_views
  where created_at > now() - (p_days || ' days')::interval
  group by created_at::date
  order by day asc;
end; $$;

grant execute on function public.get_daily_visits(int) to authenticated;

create or replace function public.get_top_referrers(p_days int default 30, p_limit int default 10)
returns table (referrer text, views bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_operator() then raise exception 'not authorised'; end if;
  return query
  select coalesce(referrer, 'Direct / unknown') as referrer, count(*) as views
  from public.page_views
  where created_at > now() - (p_days || ' days')::interval
  group by coalesce(referrer, 'Direct / unknown')
  order by views desc
  limit p_limit;
end; $$;

grant execute on function public.get_top_referrers(int, int) to authenticated;

create or replace function public.get_top_locations(p_days int default 30, p_limit int default 10)
returns table (city text, country text, views bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_operator() then raise exception 'not authorised'; end if;
  return query
  select coalesce(city, 'Unknown'), coalesce(country, 'Unknown'), count(*) as views
  from public.page_views
  where created_at > now() - (p_days || ' days')::interval
  group by coalesce(city, 'Unknown'), coalesce(country, 'Unknown')
  order by views desc
  limit p_limit;
end; $$;

grant execute on function public.get_top_locations(int, int) to authenticated;

create or replace function public.get_broadcast_banner_admin()
returns table (message text, link_url text, link_label text, is_active boolean, updated_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_operator() then raise exception 'not authorised'; end if;
  return query select message, link_url, link_label, is_active, updated_at from public.broadcast_banner where id = 1;
end; $$;

grant execute on function public.get_broadcast_banner_admin() to authenticated;

-- =====================================================================
--  Done.
-- =====================================================================
