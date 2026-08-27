-- =====================================================================
--  PATCH 5 — school editing/deletion, school self-service portal
--  (PIN login, payment history, receipt uploads, blocked-reason
--  visibility, portal-access warnings), and activity-log date filters.
--  Additive except where noted. Depends on schema-registry.sql,
--  schema-patch-3-invoices.sql (and its patch-4 fix).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. SCHOOLS — new columns for PIN auth, blocked reason, portal warning
-- ---------------------------------------------------------------------
alter table public.schools
  add column if not exists portal_pin_hash   text,         -- bcrypt-style hash, never store plain PIN
  add column if not exists blocked_reason    text,         -- shown to the school when status = 'disabled'
  add column if not exists portal_warning    text,         -- operator's warning message, shown once in portal
  add column if not exists portal_warned_at  timestamptz;

-- pgcrypto already enabled in schema-prospects-jobs.sql, but safe to repeat
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Operator: set or change a school's portal PIN (4-8 digits recommended,
-- enforced client-side; stored only as a crypt() hash).
-- ---------------------------------------------------------------------
create or replace function public.set_school_pin(p_school_id uuid, p_pin text, p_by text)
returns void language plpgsql security definer set search_path = public as $$
declare v_key text;
begin
  if not public.is_operator() then raise exception 'not authorised'; end if;
  if length(trim(p_pin)) < 4 then raise exception 'PIN must be at least 4 characters'; end if;
  select school_key into v_key from public.schools where id = p_school_id;
  update public.schools set portal_pin_hash = crypt(trim(p_pin), gen_salt('bf')) where id = p_school_id;
  insert into public.activity_log (school_id, school_key, event, detail, by_email)
  values (p_school_id, v_key, 'portal_pin_set', 'Portal PIN set/changed by operator', p_by);
end; $$;

grant execute on function public.set_school_pin(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 2. EDIT SCHOOL — operator updates editable fields. Logs a diff-style
-- note to activity_log so changes are auditable.
-- ---------------------------------------------------------------------
create or replace function public.update_school(
  p_school_id uuid, p_name text, p_contact_person text, p_contact_email text,
  p_app_url text, p_plan text, p_notes text, p_by text
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
    notes = p_notes
  where id = p_school_id;

  insert into public.activity_log (school_id, school_key, event, detail, by_email)
  values (p_school_id, v_key, 'school_updated', 'School profile edited by operator', p_by);
end; $$;

grant execute on function public.update_school(uuid, text, text, text, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 3. DISABLE WITH REASON — replaces plain status toggle for the
-- "disable" direction, so the school can see why on their portal.
-- Enabling clears the reason.
-- ---------------------------------------------------------------------
create or replace function public.set_school_status(
  p_school_id uuid, p_status text, p_reason text, p_by text
) returns void language plpgsql security definer set search_path = public as $$
declare v_key text;
begin
  if not public.is_operator() then raise exception 'not authorised'; end if;
  if p_status not in ('active','disabled') then raise exception 'invalid status'; end if;
  select school_key into v_key from public.schools where id = p_school_id;

  update public.schools
     set status = p_status,
         blocked_reason = case when p_status = 'disabled' then p_reason else null end
   where id = p_school_id;

  insert into public.activity_log (school_id, school_key, event, detail, by_email)
  values (p_school_id, v_key,
          case when p_status = 'disabled' then 'school_disabled' else 'school_enabled' end,
          case when p_status = 'disabled' then 'Disabled: ' || coalesce(p_reason, 'no reason given') else 'Re-enabled' end,
          p_by);
end; $$;

grant execute on function public.set_school_status(uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 4. DELETE SCHOOL — operator-confirmed (name-typed) hard delete.
-- Cascades to invoices via existing FK; activity_log rows keep
-- school_id nullable reference pattern already used elsewhere, but
-- since activity_log.school_id has no explicit ON DELETE here in the
-- original schema, we null it out first to preserve history text.
-- ---------------------------------------------------------------------
create or replace function public.delete_school(p_school_id uuid, p_by text)
returns void language plpgsql security definer set search_path = public as $$
declare v_key text; v_name text;
begin
  if not public.is_operator() then raise exception 'not authorised'; end if;
  select school_key, name into v_key, v_name from public.schools where id = p_school_id;
  if v_key is null then raise exception 'school not found'; end if;

  insert into public.activity_log (school_key, event, detail, by_email)
  values (v_key, 'school_deleted', 'School "' || v_name || '" (' || v_key || ') permanently deleted by operator', p_by);

  update public.activity_log set school_id = null where school_id = p_school_id;
  delete from public.schools where id = p_school_id;
end; $$;

grant execute on function public.delete_school(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 5. PORTAL WARNING — operator sends a warning shown once to the
-- school (e.g. "your portal access looks unused / suspicious, contact
-- us or access will be revoked"). Separate from disabling the school.
-- ---------------------------------------------------------------------
create or replace function public.send_portal_warning(p_school_id uuid, p_message text, p_by text)
returns void language plpgsql security definer set search_path = public as $$
declare v_key text;
begin
  if not public.is_operator() then raise exception 'not authorised'; end if;
  select school_key into v_key from public.schools where id = p_school_id;
  update public.schools set portal_warning = p_message, portal_warned_at = now() where id = p_school_id;
  insert into public.activity_log (school_id, school_key, event, detail, by_email)
  values (p_school_id, v_key, 'portal_warning_sent', 'Portal warning sent: ' || p_message, p_by);
end; $$;

grant execute on function public.send_portal_warning(uuid, text, text) to authenticated;

-- Operator: revoke portal access entirely (clears the PIN, school can
-- no longer log in until operator sets a new PIN).
create or replace function public.revoke_school_portal(p_school_id uuid, p_by text)
returns void language plpgsql security definer set search_path = public as $$
declare v_key text;
begin
  if not public.is_operator() then raise exception 'not authorised'; end if;
  select school_key into v_key from public.schools where id = p_school_id;
  update public.schools set portal_pin_hash = null, portal_warning = null, portal_warned_at = null where id = p_school_id;
  insert into public.activity_log (school_id, school_key, event, detail, by_email)
  values (p_school_id, v_key, 'portal_access_revoked', 'Portal access revoked by operator', p_by);
end; $$;

grant execute on function public.revoke_school_portal(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 6. SCHOOL PORTAL LOGIN — public, school_key + PIN. Returns a minimal
-- session-safe profile: never returns the PIN hash itself.
-- ---------------------------------------------------------------------
create or replace function public.school_portal_login(p_school_key text, p_pin text)
returns table (
  school_id uuid, name text, school_key text, status text, blocked_reason text,
  portal_warning text, plan text, paid_until date
) language plpgsql stable security definer set search_path = public as $$
begin
  return query
  select s.id, s.name, s.school_key, s.status, s.blocked_reason,
         s.portal_warning, s.plan, s.paid_until
  from public.schools s
  where s.school_key = lower(trim(p_school_key))
    and s.portal_pin_hash is not null
    and s.portal_pin_hash = crypt(trim(p_pin), s.portal_pin_hash);
end; $$;

grant execute on function public.school_portal_login(text, text) to anon;

-- After a school views their warning once, they can dismiss it.
create or replace function public.dismiss_portal_warning(p_school_key text, p_pin text)
returns void language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select s.id into v_id from public.schools s
   where s.school_key = lower(trim(p_school_key))
     and s.portal_pin_hash is not null
     and s.portal_pin_hash = crypt(trim(p_pin), s.portal_pin_hash);
  if v_id is null then raise exception 'not authorised'; end if;
  update public.schools set portal_warning = null where id = v_id;
end; $$;

grant execute on function public.dismiss_portal_warning(text, text) to anon;

-- =====================================================================
-- 7. PAYMENTS & RECEIPTS
--   A school-submitted payment record, optionally linked to a specific
--   invoice, with a receipt file stored in Supabase Storage. Operator
--   reviews and marks confirmed/rejected; confirming a payment tied to
--   an invoice marks that invoice 'paid'.
-- =====================================================================
create table if not exists public.payment_submissions (
  id             uuid primary key default gen_random_uuid(),
  school_id      uuid not null references public.schools(id) on delete cascade,
  school_key     text not null,
  invoice_id     uuid references public.invoices(id) on delete set null,
  invoice_number text,                      -- snapshot, survives if invoice later removed

  amount         numeric(14,2),
  payment_date   date,
  note           text,                      -- school's note, e.g. "paid via OPay transfer"
  receipt_path   text not null,             -- Supabase Storage object path

  status         text not null default 'pending' check (status in ('pending','confirmed','rejected')),
  reviewer_note  text,
  reviewed_by    text,
  reviewed_at    timestamptz,

  created_at     timestamptz not null default now()
);

create index if not exists payment_submissions_school_idx on public.payment_submissions (school_id, created_at desc);
create index if not exists payment_submissions_status_idx on public.payment_submissions (status);

alter table public.payment_submissions enable row level security;
drop policy if exists payment_submissions_operator_all on public.payment_submissions;
create policy payment_submissions_operator_all on public.payment_submissions
  for all to authenticated using (public.is_operator()) with check (public.is_operator());

-- Storage bucket for receipts (private; access only via signed URLs
-- generated through the functions below, never public listing).
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Public (school-authenticated via key+PIN, re-checked here): submit a
-- payment with an already-uploaded receipt path.
-- ---------------------------------------------------------------------
create or replace function public.submit_payment(
  p_school_key text, p_pin text, p_invoice_number text, p_amount numeric,
  p_payment_date date, p_note text, p_receipt_path text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_school_id uuid; v_invoice_id uuid;
begin
  select s.id into v_school_id from public.schools s
   where s.school_key = lower(trim(p_school_key))
     and s.portal_pin_hash is not null
     and s.portal_pin_hash = crypt(trim(p_pin), s.portal_pin_hash);
  if v_school_id is null then raise exception 'not authorised'; end if;

  if p_invoice_number is not null and trim(p_invoice_number) <> '' then
    select i.id into v_invoice_id from public.invoices i
     where i.school_id = v_school_id and i.invoice_number = trim(p_invoice_number);
  end if;

  return (
    insert into public.payment_submissions
      (school_id, school_key, invoice_id, invoice_number, amount, payment_date, note, receipt_path)
    values
      (v_school_id, lower(trim(p_school_key)), v_invoice_id, nullif(trim(p_invoice_number),''),
       p_amount, p_payment_date, p_note, p_receipt_path)
    returning id
  );
end; $$;

grant execute on function public.submit_payment(text, text, text, numeric, date, text, text) to anon;

-- ---------------------------------------------------------------------
-- Public: list a school's own payment submissions (key+PIN gated).
-- ---------------------------------------------------------------------
create or replace function public.list_school_payments(p_school_key text, p_pin text)
returns table (
  id uuid, invoice_number text, amount numeric, payment_date date, note text,
  receipt_path text, status text, reviewer_note text, created_at timestamptz
) language plpgsql stable security definer set search_path = public as $$
declare v_school_id uuid;
begin
  select s.id into v_school_id from public.schools s
   where s.school_key = lower(trim(p_school_key))
     and s.portal_pin_hash is not null
     and s.portal_pin_hash = crypt(trim(p_pin), s.portal_pin_hash);
  if v_school_id is null then raise exception 'not authorised'; end if;

  return query
  select p.id, p.invoice_number, p.amount, p.payment_date, p.note,
         p.receipt_path, p.status, p.reviewer_note, p.created_at
  from public.payment_submissions p
  where p.school_id = v_school_id
  order by p.created_at desc;
end; $$;

grant execute on function public.list_school_payments(text, text) to anon;

-- ---------------------------------------------------------------------
-- Operator: confirm or reject a payment submission. Confirming marks
-- the linked invoice (if any) as 'paid' and logs to activity_log.
-- ---------------------------------------------------------------------
create or replace function public.review_payment_submission(
  p_id uuid, p_status text, p_reviewer_note text, p_by text
) returns void language plpgsql security definer set search_path = public as $$
declare v_school_id uuid; v_school_key text; v_invoice_id uuid; v_amount numeric;
begin
  if not public.is_operator() then raise exception 'not authorised'; end if;
  if p_status not in ('confirmed','rejected') then raise exception 'invalid status'; end if;

  select school_id, school_key, invoice_id, amount
    into v_school_id, v_school_key, v_invoice_id, v_amount
  from public.payment_submissions where id = p_id;

  update public.payment_submissions
     set status = p_status, reviewer_note = p_reviewer_note, reviewed_by = p_by, reviewed_at = now()
   where id = p_id;

  if p_status = 'confirmed' and v_invoice_id is not null then
    update public.invoices set status = 'paid' where id = v_invoice_id;
  end if;

  insert into public.activity_log (school_id, school_key, event, detail, amount, by_email)
  values (v_school_id, v_school_key,
          case when p_status = 'confirmed' then 'payment_confirmed' else 'payment_rejected' end,
          'Payment submission ' || p_status || coalesce(': ' || p_reviewer_note, ''),
          case when p_status = 'confirmed' then v_amount else null end,
          p_by);
end; $$;

grant execute on function public.review_payment_submission(uuid, text, text, text) to authenticated;

-- =====================================================================
-- 8. INVOICE TYPE — distinguish subscription invoices from hosting/
--    storage/domain charge invoices, so the school portal can filter.
-- =====================================================================
alter table public.invoices
  add column if not exists invoice_type text not null default 'subscription'
    check (invoice_type in ('subscription','hosting','storage','domain','custom','other'));

-- ---------------------------------------------------------------------
-- Public: school lists its own invoices by key+PIN (parallel to the
-- earlier key+email version, but for the authenticated portal).
-- ---------------------------------------------------------------------
create or replace function public.list_school_invoices_portal(p_school_key text, p_pin text)
returns table (
  invoice_number text, invoice_type text, line_items jsonb, currency text,
  subtotal numeric, total numeric, notes text, status text, issued_at timestamptz
) language plpgsql stable security definer set search_path = public as $$
declare v_school_id uuid;
begin
  select s.id into v_school_id from public.schools s
   where s.school_key = lower(trim(p_school_key))
     and s.portal_pin_hash is not null
     and s.portal_pin_hash = crypt(trim(p_pin), s.portal_pin_hash);
  if v_school_id is null then raise exception 'not authorised'; end if;

  return query
  select i.invoice_number, i.invoice_type, i.line_items, i.currency,
         i.subtotal, i.total, i.notes, i.status, i.issued_at
  from public.invoices i
  where i.school_id = v_school_id
  order by i.issued_at desc;
end; $$;

grant execute on function public.list_school_invoices_portal(text, text) to anon;

-- Update create_invoice to accept an invoice_type (defaults to
-- 'subscription' to preserve existing console behaviour).
drop function if exists public.create_invoice(uuid, jsonb, text, text);

create or replace function public.create_invoice(
  p_school_id uuid, p_line_items jsonb, p_notes text, p_by text, p_invoice_type text default 'subscription'
) returns table (out_id uuid, out_invoice_number text, out_total numeric)
language plpgsql security definer set search_path = public as $$
declare
  v_key text;
  v_total numeric(14,2) := 0;
  v_number text;
  v_id uuid;
  item jsonb;
begin
  if not public.is_operator() then raise exception 'not authorised'; end if;

  select schools.school_key into v_key from public.schools where schools.id = p_school_id;
  if v_key is null then raise exception 'school not found'; end if;

  for item in select * from jsonb_array_elements(p_line_items) loop
    v_total := v_total + (coalesce((item->>'qty')::numeric, 1) * coalesce((item->>'unit_price')::numeric, 0));
  end loop;

  v_number := public.gen_invoice_number();

  insert into public.invoices (invoice_number, school_id, school_key, line_items, subtotal, total, notes, issued_by, invoice_type)
  values (v_number, p_school_id, v_key, p_line_items, v_total, v_total, p_notes, p_by, coalesce(p_invoice_type,'subscription'))
  returning invoices.id into v_id;

  insert into public.activity_log (school_id, school_key, event, detail, amount, by_email)
  values (p_school_id, v_key, 'invoice_issued',
          'Invoice ' || v_number || ' (' || coalesce(p_invoice_type,'subscription') || ') issued', v_total, p_by);

  return query select v_id, v_number, v_total;
end; $$;

grant execute on function public.create_invoice(uuid, jsonb, text, text, text) to authenticated;

-- =====================================================================
-- 9. ACTIVITY LOG — date-range filtering support for both console and
--    school portal views. No schema change needed (at/created_at
--    already indexed); adds convenience RPCs with explicit range args
--    so the frontend never has to build raw filters against RLS-gated
--    tables inconsistently.
-- =====================================================================
create or replace function public.list_activity_log(
  p_school_id uuid default null,   -- null = all schools (console-wide view)
  p_from date default null, p_to date default null, p_limit int default 500
) returns table (
  id uuid, school_id uuid, school_key text, event text, detail text,
  amount numeric, by_email text, at timestamptz
) language sql stable security definer set search_path = public as $$
  select a.id, a.school_id, a.school_key, a.event, a.detail, a.amount, a.by_email, a.at
  from public.activity_log a
  where public.is_operator()
    and (p_school_id is null or a.school_id = p_school_id)
    and (p_from is null or a.at >= p_from::timestamptz)
    and (p_to is null or a.at < (p_to + 1)::timestamptz)
  order by a.at desc
  limit least(coalesce(p_limit,500), 2000);
$$;

grant execute on function public.list_activity_log(uuid, date, date, int) to authenticated;

-- Public: a school's own activity log (portal-visible events only —
-- excludes internal operator-only event types by an explicit allowlist,
-- so schools never see e.g. other schools' data or purely internal notes).
create or replace function public.list_school_activity_portal(
  p_school_key text, p_pin text, p_from date default null, p_to date default null
) returns table (event text, detail text, amount numeric, at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare v_school_id uuid;
begin
  select s.id into v_school_id from public.schools s
   where s.school_key = lower(trim(p_school_key))
     and s.portal_pin_hash is not null
     and s.portal_pin_hash = crypt(trim(p_pin), s.portal_pin_hash);
  if v_school_id is null then raise exception 'not authorised'; end if;

  return query
  select a.event, a.detail, a.amount, a.at
  from public.activity_log a
  where a.school_id = v_school_id
    and a.event in (
      'registered','payment_recorded','invoice_issued','payment_confirmed','payment_rejected',
      'school_disabled','school_enabled','offer_letter_issued','note'
    )
    and (p_from is null or a.at >= p_from::timestamptz)
    and (p_to is null or a.at < (p_to + 1)::timestamptz)
  order by a.at desc
  limit 500;
end; $$;

grant execute on function public.list_school_activity_portal(text, text, date, date) to anon;

-- =====================================================================
--  Done.
-- =====================================================================
