-- =====================================================================
--  PATCH 11 — official Receipt of Payment
--  When a payment submission is confirmed, generate a permanent
--  receipt number for it, so the school can download a proper branded
--  Receipt of Payment (distinct from the invoice) from their portal.
-- =====================================================================

alter table public.payment_submissions
  add column if not exists receipt_number text unique;

-- ---------------------------------------------------------------------
-- Human-friendly receipt numbers, e.g. RCT-2026-0483
-- ---------------------------------------------------------------------
create or replace function public.gen_receipt_number()
returns text language plpgsql as $$
declare yr text := to_char(now(), 'YYYY'); n int;
begin
  n := floor(random() * 9000 + 1000)::int;
  return 'RCT-' || yr || '-' || n::text;
end; $$;

-- ---------------------------------------------------------------------
-- Replace review_payment_submission to assign a receipt_number when
-- confirming (only ever assigned once; re-confirming an already
-- confirmed payment will not generate a second number).
-- ---------------------------------------------------------------------
create or replace function public.review_payment_submission(
  p_id uuid, p_status text, p_reviewer_note text, p_by text
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_school_id uuid; v_school_key text; v_invoice_id uuid; v_amount numeric;
  v_existing_receipt text;
begin
  if not public.is_operator() then raise exception 'not authorised'; end if;
  if p_status not in ('confirmed','rejected') then raise exception 'invalid status'; end if;

  select school_id, school_key, invoice_id, amount, receipt_number
    into v_school_id, v_school_key, v_invoice_id, v_amount, v_existing_receipt
  from public.payment_submissions where id = p_id;

  if p_status = 'confirmed' and v_existing_receipt is null then
    update public.payment_submissions
       set status = p_status, reviewer_note = p_reviewer_note, reviewed_by = p_by, reviewed_at = now(),
           receipt_number = public.gen_receipt_number()
     where id = p_id;
  else
    update public.payment_submissions
       set status = p_status, reviewer_note = p_reviewer_note, reviewed_by = p_by, reviewed_at = now()
     where id = p_id;
  end if;

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

-- ---------------------------------------------------------------------
-- Update list_school_payments and list_school_invoices... wait, this
-- is payments: add receipt_number to what the school can see.
-- ---------------------------------------------------------------------
drop function if exists public.list_school_payments(text, text);

create or replace function public.list_school_payments(p_school_key text, p_pin text)
returns table (
  id uuid, invoice_number text, amount numeric, payment_date date, note text,
  receipt_data text, receipt_mimetype text, receipt_filename text,
  status text, reviewer_note text, receipt_number text, created_at timestamptz
) language plpgsql stable security definer set search_path = public as $$
declare v_school_id uuid;
begin
  select s.id into v_school_id from public.schools s
   where s.school_key = lower(trim(p_school_key))
     and s.portal_pin_hash is not null
     and s.portal_pin_hash = extensions.crypt(trim(p_pin), s.portal_pin_hash);
  if v_school_id is null then raise exception 'not authorised'; end if;

  return query
  select p.id, p.invoice_number, p.amount, p.payment_date, p.note,
         p.receipt_data, p.receipt_mimetype, p.receipt_filename,
         p.status, p.reviewer_note, p.receipt_number, p.created_at
  from public.payment_submissions p
  where p.school_id = v_school_id
  order by p.created_at desc;
end; $$;

grant execute on function public.list_school_payments(text, text) to anon;

-- ---------------------------------------------------------------------
-- Public: fetch one confirmed payment's full detail for the official
-- Receipt of Payment PDF (school name needed for the document header).
-- ---------------------------------------------------------------------
create or replace function public.get_payment_receipt(p_school_key text, p_pin text, p_receipt_number text)
returns table (
  receipt_number text, school_name text, invoice_number text, amount numeric,
  payment_date date, note text, confirmed_at timestamptz
) language plpgsql stable security definer set search_path = public as $$
declare v_school_id uuid;
begin
  select s.id into v_school_id from public.schools s
   where s.school_key = lower(trim(p_school_key))
     and s.portal_pin_hash is not null
     and s.portal_pin_hash = extensions.crypt(trim(p_pin), s.portal_pin_hash);
  if v_school_id is null then raise exception 'not authorised'; end if;

  return query
  select p.receipt_number, s.name, p.invoice_number, p.amount, p.payment_date, p.note, p.reviewed_at
  from public.payment_submissions p
  join public.schools s on s.id = p.school_id
  where p.school_id = v_school_id and p.receipt_number = p_receipt_number and p.status = 'confirmed';
end; $$;

grant execute on function public.get_payment_receipt(text, text, text) to anon;

-- Operator (console) already reads payment_submissions rows directly
-- via RLS is_operator() policy, so no new function needed for the
-- console's own receipt download — it already has receipt_number in
-- the row it fetches.

-- =====================================================================
--  Done.
-- =====================================================================
