-- =====================================================================
--  PATCH 38 — multi-product clients: tag every registered "school" row
--  with which of YOUR products it actually is, and let non-Bucket
--  products report their own metrics instead of the Bucket-specific
--  students_count/records_count pair.
--
--  Deliberately additive, NOT a rename. The table stays "schools" and
--  students_count/records_count/report_counts() are UNTOUCHED — every
--  existing SUIBING Bucket deployment keeps working with zero changes.
--  This patch only adds:
--    - product_key on schools, defaulting to 'bucket' (so existing
--      rows are correctly tagged with no manual work needed)
--    - a generic metrics jsonb column + report_metrics() RPC, for any
--      OTHER product (SSMS, SuibingLedger, Tracker, etc.) to report
--      whatever numbers actually matter to it
--    - update_school() extended so the operator can also set/change
--      the product after creation
--
--  product_key is intentionally free text, not a hard foreign key to
--  products.slug — the console's "Add client" / "Edit" dropdowns pull
--  live from the products table, so in practice it always matches, but
--  nothing breaks if a product is later renamed or removed there.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. New columns.
-- ---------------------------------------------------------------------
alter table public.schools
  add column if not exists product_key text not null default 'bucket',
  add column if not exists metrics jsonb not null default '{}'::jsonb;

create index if not exists schools_product_idx on public.schools (product_key);

-- ---------------------------------------------------------------------
-- 2. Generic metrics heartbeat, for any product other than Bucket.
-- Same shape/spirit as report_counts(): fire-and-forget, no auth
-- needed (the school_key itself is the only credential), only ever
-- touches this one school's own metrics + counts_updated timestamp.
-- ---------------------------------------------------------------------
create or replace function public.report_metrics(p_key text, p_metrics jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.schools
     set metrics = coalesce(p_metrics, '{}'::jsonb),
         counts_updated = now()
   where school_key = p_key;
end; $$;

grant execute on function public.report_metrics(text, jsonb) to anon;

-- ---------------------------------------------------------------------
-- 3. Extend update_school() so the operator can (re)assign a client's
-- product from the console, not just at creation time. Same signature
-- as before, plus p_product_key inserted before p_notes — the console
-- calls this with named parameters, so argument order doesn't matter,
-- but the old 8-arg overload is dropped first to avoid two versions
-- of the same function name existing side by side.
-- ---------------------------------------------------------------------
drop function if exists public.update_school(uuid, text, text, text, text, text, text, text);

create or replace function public.update_school(
  p_school_id uuid, p_name text, p_contact_person text, p_contact_email text,
  p_app_url text, p_plan text, p_product_key text, p_notes text, p_by text
) returns void language plpgsql security definer set search_path = public as $$
declare v_key text;
begin
  if not public.is_operator() then raise exception 'not authorised'; end if;
  if p_name is null or trim(p_name) = '' then raise exception 'name is required'; end if;
  select school_key into v_key from public.schools where id = p_school_id;

  update public.schools set
    name = trim(p_name),
    contact_person = nullif(trim(coalesce(p_contact_person,'')), ''),
    contact_email = nullif(trim(coalesce(p_contact_email,'')), ''),
    app_url = nullif(trim(coalesce(p_app_url,'')), ''),
    plan = coalesce(nullif(trim(p_plan),''), plan),
    product_key = coalesce(nullif(trim(p_product_key),''), product_key),
    notes = p_notes
  where id = p_school_id;

  insert into public.activity_log (school_id, school_key, event, detail, by_email)
  values (p_school_id, v_key, 'school_updated', 'School profile edited by operator', p_by);
end; $$;

grant execute on function public.update_school(uuid, text, text, text, text, text, text, text, text) to authenticated;

-- =====================================================================
--  Done. New: product_key + metrics columns, report_metrics().
--  Changed (same purpose, one new field): update_school().
-- =====================================================================
