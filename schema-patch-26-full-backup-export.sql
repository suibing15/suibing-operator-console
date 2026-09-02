-- =====================================================================
--  PATCH 26 — full data export, for manual backups. Supabase's free
--  tier has no automatic database backups, so this gives the operator
--  a one-click way to download everything as a single JSON file,
--  to be stored safely outside the database (Drive, local disk, etc.)
--  and repeated periodically.
--
--  Deliberately excludes the operators table's internal id/created_at
--  bookkeeping fields where not useful, and never includes any PIN
--  hash or password data (those must never leave the database, even
--  in a backup file the operator controls).
-- =====================================================================

create or replace function public.export_full_backup()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_schools jsonb;
  v_invoices jsonb;
  v_payments jsonb;
  v_complaints jsonb;
  v_complaint_messages jsonb;
  v_prospects jsonb;
  v_job_applicants jsonb;
  v_job_postings jsonb;
  v_products jsonb;
  v_testimonials jsonb;
  v_activity_log jsonb;
begin
  if not public.is_operator() then raise exception 'not authorised'; end if;

  -- schools: exclude the PIN hash explicitly, even though it wouldn't
  -- be usable outside the database anyway — never worth the risk.
  select coalesce(jsonb_agg(to_jsonb(s) - 'portal_pin_hash'), '[]'::jsonb) into v_schools from public.schools s;
  select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb) into v_invoices from public.invoices i;
  select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) into v_payments from public.payment_submissions p;
  select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) into v_complaints from public.complaints c;
  select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) into v_complaint_messages from public.complaint_messages m;
  select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) into v_prospects from public.prospects p;
  select coalesce(jsonb_agg(to_jsonb(j)), '[]'::jsonb) into v_job_applicants from public.job_applicants j;
  select coalesce(jsonb_agg(to_jsonb(j)), '[]'::jsonb) into v_job_postings from public.job_postings j;
  select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) into v_products from public.products p;
  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into v_testimonials from public.testimonials t;
  select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) into v_activity_log from public.activity_log a;

  return jsonb_build_object(
    'exported_at', now(),
    'schools', v_schools,
    'invoices', v_invoices,
    'payment_submissions', v_payments,
    'complaints', v_complaints,
    'complaint_messages', v_complaint_messages,
    'prospects', v_prospects,
    'job_applicants', v_job_applicants,
    'job_postings', v_job_postings,
    'products', v_products,
    'testimonials', v_testimonials,
    'activity_log', v_activity_log
  );
end; $$;

grant execute on function public.export_full_backup() to authenticated;

-- =====================================================================
--  Done.
-- =====================================================================
