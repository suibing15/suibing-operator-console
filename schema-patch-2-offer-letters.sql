-- =====================================================================
--  PATCH 2 — offer letter details on job_applicants
--  Additive only. Lets the operator record offer terms once, so BOTH
--  the console and the applicant's own /careers/status page can
--  regenerate the identical branded PDF client-side (no file storage
--  needed — the PDF is built from these fields on demand).
-- =====================================================================

alter table public.job_applicants
  add column if not exists offer_role            text,
  add column if not exists offer_employment_type  text,
  add column if not exists offer_start_date       text,   -- display string, e.g. "1 September 2026"
  add column if not exists offer_salary           text,   -- display string, e.g. "NGN 150,000 / month"
  add column if not exists offer_reporting_to     text,
  add column if not exists offer_additional_terms text,
  add column if not exists offer_issued_by        text,
  add column if not exists offer_issued_at        timestamptz;

-- ---------------------------------------------------------------------
-- Operator: save offer terms on an approved applicant. Logs the action.
-- ---------------------------------------------------------------------
create or replace function public.save_job_offer(
  p_id uuid, p_role text, p_employment_type text, p_start_date text,
  p_salary text, p_reporting_to text, p_additional_terms text, p_by text
) returns void language plpgsql security definer set search_path = public as $$
declare v_form text; v_name text;
begin
  if not public.is_operator() then raise exception 'not authorised'; end if;
  select form_number, full_name into v_form, v_name from public.job_applicants where id = p_id;
  update public.job_applicants
     set offer_role = p_role, offer_employment_type = p_employment_type,
         offer_start_date = p_start_date, offer_salary = p_salary,
         offer_reporting_to = p_reporting_to, offer_additional_terms = p_additional_terms,
         offer_issued_by = p_by, offer_issued_at = now()
   where id = p_id;
  insert into public.activity_log (event, detail, by_email)
    values ('offer_letter_issued',
            'Offer of appointment issued to ' || coalesce(v_name,'?') || ' (' || coalesce(v_form,'?') || '), role: ' || p_role,
            p_by);
end; $$;

grant execute on function public.save_job_offer(uuid,text,text,text,text,text,text,text) to authenticated;

-- ---------------------------------------------------------------------
-- Public: fetch offer details for an approved applicant, by form number
-- + login code (same credentials as the status check). Only returns
-- data if an offer has actually been issued.
-- ---------------------------------------------------------------------
create or replace function public.get_job_offer(p_form text, p_code text)
returns table (
  full_name text, offer_role text, offer_employment_type text, offer_start_date text,
  offer_salary text, offer_reporting_to text, offer_additional_terms text,
  offer_issued_by text, offer_issued_at timestamptz, form_number text
) language sql stable security definer set search_path = public as $$
  select j.full_name, j.offer_role, j.offer_employment_type, j.offer_start_date,
         j.offer_salary, j.offer_reporting_to, j.offer_additional_terms,
         j.offer_issued_by, j.offer_issued_at, j.form_number
  from public.job_applicants j
  where j.form_number = p_form and j.login_code = p_code
    and j.status = 'approved' and j.offer_issued_at is not null;
$$;

grant execute on function public.get_job_offer(text,text) to anon;

-- =====================================================================
--  Done.
-- =====================================================================
