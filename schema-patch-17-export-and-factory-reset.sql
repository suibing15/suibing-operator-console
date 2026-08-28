-- =====================================================================
--  PATCH 17 — export a school's full record (for backup before delete),
--  plus a factory-reset function for wiping all operational/demo data
--  while leaving the operator account and schema itself intact.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Export everything about one school as a single JSON object: profile,
-- all invoices, all payment submissions (including receipt images —
-- these can be large, but this is an explicit, occasional backup action,
-- not a hot path). Operator-only.
-- ---------------------------------------------------------------------
create or replace function public.export_school_data(p_school_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_school jsonb;
  v_invoices jsonb;
  v_payments jsonb;
begin
  if not public.is_operator() then raise exception 'not authorised'; end if;

  select to_jsonb(s) - 'portal_pin_hash' into v_school
  from public.schools s where s.id = p_school_id;

  if v_school is null then raise exception 'school not found'; end if;

  select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb) into v_invoices
  from public.invoices i where i.school_id = p_school_id;

  select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) into v_payments
  from public.payment_submissions p where p.school_id = p_school_id;

  return jsonb_build_object(
    'exported_at', now(),
    'school', v_school,
    'invoices', v_invoices,
    'payment_submissions', v_payments
  );
end; $$;

grant execute on function public.export_school_data(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Factory reset — deliberately narrow in scope. This wipes OPERATIONAL
-- DATA ONLY: all schools (and, via cascade, their invoices and payment
-- submissions), all prospects, all job applicants, all job postings,
-- and the activity log. It does NOT touch:
--   - the calling operator's own account/login (you cannot lock
--     yourself out with this)
--   - company_settings (signature, bank details, payment QR)
--   - products / testimonials (your public showcase content)
--   - the database schema itself (no tables/functions are dropped)
-- This is intentionally a single all-or-nothing action, gated by a
-- literal confirmation phrase the frontend must pass through unchanged,
-- so it cannot be triggered by a stray click.
-- ---------------------------------------------------------------------
create or replace function public.factory_reset_operational_data(p_confirm_phrase text, p_by text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_operator() then raise exception 'not authorised'; end if;
  if p_confirm_phrase is distinct from 'DELETE ALL DATA' then
    raise exception 'confirmation phrase did not match';
  end if;

  delete from public.schools;       -- cascades to invoices, payment_submissions
  delete from public.prospects;
  delete from public.job_applicants;
  delete from public.job_postings;
  delete from public.activity_log;

  -- Leave one fresh log entry recording the reset itself, so there is at
  -- least a trace of when this happened and by whom.
  insert into public.activity_log (event, detail, by_email)
  values ('factory_reset', 'All operational data (schools, prospects, applicants, postings, activity log) wiped by operator', p_by);
end; $$;

grant execute on function public.factory_reset_operational_data(text, text) to authenticated;

-- =====================================================================
--  Done.
-- =====================================================================
