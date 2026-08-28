-- =====================================================================
--  PATCH 16 — expose students_count and records_count to the school
--  portal, so schools can see their own tracked numbers directly and
--  be reassured everything is being recorded correctly.
-- =====================================================================

drop function if exists public.school_portal_login(text, text);

create or replace function public.school_portal_login(p_school_key text, p_pin text)
returns table (
  school_id uuid, name text, school_key text, status text, blocked_reason text,
  portal_warning text, plan text, paid_until date,
  students_count int, records_count int, counts_updated timestamptz
) language plpgsql stable security definer set search_path = public as $$
begin
  return query
  select s.id, s.name, s.school_key, s.status, s.blocked_reason,
         s.portal_warning, s.plan, s.paid_until,
         s.students_count, s.records_count, s.counts_updated
  from public.schools s
  where s.school_key = lower(trim(p_school_key))
    and s.portal_pin_hash is not null
    and s.portal_pin_hash = extensions.crypt(trim(p_pin), s.portal_pin_hash);
end; $$;

grant execute on function public.school_portal_login(text, text) to anon;

-- =====================================================================
--  Done.
-- =====================================================================
