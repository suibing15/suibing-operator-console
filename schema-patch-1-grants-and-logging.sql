-- =====================================================================
--  PATCH 1 — fixes + activity log tracking for prospects & job applicants
--  Safe to run on top of schema-prospects-jobs.sql. Additive only:
--  no tables are dropped, no data is deleted.
--
--  Fixes:
--   1. The operator-only functions (reject / request-correction /
--      delete-stale / approve, for BOTH prospects and job applicants)
--      were missing GRANT EXECUTE TO authenticated. Postgres defaults
--      to "no one but the owner" for new functions, so every call from
--      the signed-in console was silently rejected — this is why reject
--      and request-correction appeared to "not work."
--   2. Every reviewer action (reject, request correction, approve,
--      delete-stale) now writes a row to activity_log, so you have a
--      full audit trail visible in the console, same as schools do.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. GRANTS — the actual bug fix. Without this, authenticated operators
--    could not call these functions at all.
-- ---------------------------------------------------------------------
grant execute on function public.reject_prospect(uuid, text, text) to authenticated;
grant execute on function public.request_prospect_correction(uuid, text, text) to authenticated;
grant execute on function public.delete_stale_prospect(uuid, text) to authenticated;
grant execute on function public.approve_prospect(uuid, text, text, text) to authenticated;

grant execute on function public.reject_job_application(uuid, text, text) to authenticated;
grant execute on function public.request_job_correction(uuid, text, text) to authenticated;
grant execute on function public.delete_stale_job_application(uuid, text) to authenticated;
grant execute on function public.approve_job_application(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 2. ACTIVITY LOG — rewrite each function to also insert a log row.
--    activity_log.school_id is nullable (already true in schema-registry.sql)
--    so prospect/job events (which aren't tied to a school) log with
--    school_id = null and a descriptive event name.
-- ---------------------------------------------------------------------

create or replace function public.reject_prospect(p_id uuid, p_reason text, p_by text)
returns void language plpgsql security definer set search_path = public as $$
declare v_form text; v_org text;
begin
  if not public.is_operator() then raise exception 'not authorised'; end if;
  select form_number, org_name into v_form, v_org from public.prospects where id = p_id;
  update public.prospects
     set status = 'rejected', reviewer_note = p_reason, reviewed_by = p_by, reviewed_at = now()
   where id = p_id;
  insert into public.activity_log (event, detail, by_email)
    values ('prospect_rejected',
            'Prospect ' || coalesce(v_form,'?') || ' (' || coalesce(v_org,'?') || ') rejected: ' || p_reason,
            p_by);
end; $$;

create or replace function public.request_prospect_correction(p_id uuid, p_reason text, p_by text)
returns void language plpgsql security definer set search_path = public as $$
declare v_form text; v_org text;
begin
  if not public.is_operator() then raise exception 'not authorised'; end if;
  select form_number, org_name into v_form, v_org from public.prospects where id = p_id;
  update public.prospects
     set status = 'needs_correction', reviewer_note = p_reason, reviewed_by = p_by, reviewed_at = now()
   where id = p_id;
  insert into public.activity_log (event, detail, by_email)
    values ('prospect_correction_requested',
            'Correction requested for ' || coalesce(v_form,'?') || ' (' || coalesce(v_org,'?') || '): ' || p_reason,
            p_by);
end; $$;

-- delete_stale_prospect and approve_prospect already logged to
-- activity_log in schema-prospects-jobs.sql — no change needed there
-- beyond the grant above.

create or replace function public.reject_job_application(p_id uuid, p_reason text, p_by text)
returns void language plpgsql security definer set search_path = public as $$
declare v_form text; v_name text;
begin
  if not public.is_operator() then raise exception 'not authorised'; end if;
  select form_number, full_name into v_form, v_name from public.job_applicants where id = p_id;
  update public.job_applicants
     set status = 'rejected', reviewer_note = p_reason, reviewed_by = p_by, reviewed_at = now()
   where id = p_id;
  insert into public.activity_log (event, detail, by_email)
    values ('job_applicant_rejected',
            'Applicant ' || coalesce(v_form,'?') || ' (' || coalesce(v_name,'?') || ') rejected: ' || p_reason,
            p_by);
end; $$;

create or replace function public.request_job_correction(p_id uuid, p_reason text, p_by text)
returns void language plpgsql security definer set search_path = public as $$
declare v_form text; v_name text;
begin
  if not public.is_operator() then raise exception 'not authorised'; end if;
  select form_number, full_name into v_form, v_name from public.job_applicants where id = p_id;
  update public.job_applicants
     set status = 'needs_correction', reviewer_note = p_reason, reviewed_by = p_by, reviewed_at = now()
   where id = p_id;
  insert into public.activity_log (event, detail, by_email)
    values ('job_applicant_correction_requested',
            'Correction requested for ' || coalesce(v_form,'?') || ' (' || coalesce(v_name,'?') || '): ' || p_reason,
            p_by);
end; $$;

create or replace function public.approve_job_application(p_id uuid, p_by text)
returns void language plpgsql security definer set search_path = public as $$
declare v_form text; v_name text;
begin
  if not public.is_operator() then raise exception 'not authorised'; end if;
  select form_number, full_name into v_form, v_name from public.job_applicants where id = p_id;
  update public.job_applicants
     set status = 'approved', reviewed_by = p_by, reviewed_at = now()
   where id = p_id;
  insert into public.activity_log (event, detail, by_email)
    values ('job_applicant_approved',
            'Applicant ' || coalesce(v_form,'?') || ' (' || coalesce(v_name,'?') || ') approved',
            p_by);
end; $$;

-- =====================================================================
--  Done. Run this once. Every reviewer action now appears in the same
--  activity_log used by the Schools tab, and the reject/correction
--  buttons will actually work now that the grants are in place.
-- =====================================================================
