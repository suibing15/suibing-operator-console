-- =====================================================================
--  PATCH 18 — school self-service PIN change, and a "forgot PIN"
--  request flow that notifies the operator (no email delivery is
--  available server-side, so this logs a request the operator sees
--  in the console and can act on, rather than sending mail directly).
-- =====================================================================

-- ---------------------------------------------------------------------
-- School changes their own PIN, authenticated by their current PIN.
-- ---------------------------------------------------------------------
create or replace function public.change_school_pin(
  p_school_key text, p_current_pin text, p_new_pin text
) returns void language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_key text;
begin
  if length(trim(p_new_pin)) < 4 then raise exception 'New PIN must be at least 4 characters'; end if;

  select s.id, s.school_key into v_id, v_key from public.schools s
   where s.school_key = lower(trim(p_school_key))
     and s.portal_pin_hash is not null
     and s.portal_pin_hash = extensions.crypt(trim(p_current_pin), s.portal_pin_hash);
  if v_id is null then raise exception 'current PIN is incorrect'; end if;

  update public.schools
     set portal_pin_hash = extensions.crypt(trim(p_new_pin), extensions.gen_salt('bf'))
   where id = v_id;

  insert into public.activity_log (school_id, school_key, event, detail)
  values (v_id, v_key, 'portal_pin_changed_by_school', 'School changed their own portal PIN');
end; $$;

grant execute on function public.change_school_pin(text, text, text) to anon;

-- ---------------------------------------------------------------------
-- "Forgot PIN" — the school cannot reset their own PIN without knowing
-- it (that would defeat the point), so this logs a visible request the
-- operator sees in the console (Schools tab / activity log) and can act
-- on manually via the existing "Set/Change PIN" tool. No auto-reset.
-- ---------------------------------------------------------------------
create or replace function public.request_pin_reset(p_school_key text, p_contact_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_key text;
begin
  select s.id, s.school_key into v_id, v_key from public.schools s
   where s.school_key = lower(trim(p_school_key));
  if v_id is null then raise exception 'school not found'; end if;

  insert into public.activity_log (school_id, school_key, event, detail)
  values (v_id, v_key, 'portal_pin_reset_requested',
    'School requested a PIN reset via the portal login screen.' ||
    coalesce(' Note: ' || p_contact_note, ''));
end; $$;

grant execute on function public.request_pin_reset(text, text) to anon;

-- =====================================================================
--  Done.
-- =====================================================================
