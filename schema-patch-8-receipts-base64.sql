-- =====================================================================
--  PATCH 8 — receipts stored directly in the database (base64)
--  Bypasses Supabase Storage entirely, avoiding the anon-key/JWT
--  format issue that blocked uploads. Receipts (images/PDFs, typically
--  well under a few MB) are stored as base64 text in a new column.
--  The old receipt_path column and Storage bucket are left in place
--  but no longer used going forward — nothing is deleted.
-- =====================================================================

alter table public.payment_submissions
  add column if not exists receipt_data     text,   -- base64-encoded file content
  add column if not exists receipt_mimetype text,   -- e.g. 'image/png', 'application/pdf'
  add column if not exists receipt_filename text;    -- original filename, for display/download

-- receipt_path is now optional (was "not null" before) since new
-- submissions use receipt_data instead.
alter table public.payment_submissions alter column receipt_path drop not null;

-- ---------------------------------------------------------------------
-- Replace submit_payment to accept the file inline as base64.
-- ---------------------------------------------------------------------
drop function if exists public.submit_payment(text, text, text, numeric, date, text, text);

create or replace function public.submit_payment(
  p_school_key text, p_pin text, p_invoice_number text, p_amount numeric,
  p_payment_date date, p_note text,
  p_receipt_data text, p_receipt_mimetype text, p_receipt_filename text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_school_id uuid; v_invoice_id uuid; v_new_id uuid;
begin
  select s.id into v_school_id from public.schools s
   where s.school_key = lower(trim(p_school_key))
     and s.portal_pin_hash is not null
     and s.portal_pin_hash = extensions.crypt(trim(p_pin), s.portal_pin_hash);
  if v_school_id is null then raise exception 'not authorised'; end if;

  if p_receipt_data is null or length(p_receipt_data) = 0 then
    raise exception 'receipt file is required';
  end if;

  if p_invoice_number is not null and trim(p_invoice_number) <> '' then
    select i.id into v_invoice_id from public.invoices i
     where i.school_id = v_school_id and i.invoice_number = trim(p_invoice_number);
  end if;

  insert into public.payment_submissions
    (school_id, school_key, invoice_id, invoice_number, amount, payment_date, note,
     receipt_data, receipt_mimetype, receipt_filename, receipt_path)
  values
    (v_school_id, lower(trim(p_school_key)), v_invoice_id, nullif(trim(p_invoice_number),''),
     p_amount, p_payment_date, p_note,
     p_receipt_data, p_receipt_mimetype, p_receipt_filename, 'inline')
  returning id into v_new_id;

  return v_new_id;
end; $$;

grant execute on function public.submit_payment(text, text, text, numeric, date, text, text, text, text) to anon;

-- ---------------------------------------------------------------------
-- Update list_school_payments to return the inline receipt fields.
-- ---------------------------------------------------------------------
create or replace function public.list_school_payments(p_school_key text, p_pin text)
returns table (
  id uuid, invoice_number text, amount numeric, payment_date date, note text,
  receipt_data text, receipt_mimetype text, receipt_filename text,
  status text, reviewer_note text, created_at timestamptz
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
         p.status, p.reviewer_note, p.created_at
  from public.payment_submissions p
  where p.school_id = v_school_id
  order by p.created_at desc;
end; $$;

grant execute on function public.list_school_payments(text, text) to anon;

-- ---------------------------------------------------------------------
-- Operator (console): needs to read receipt_data too — it's already
-- readable via direct table select (is_operator() RLS policy already
-- covers all columns), so no new function needed there. The console
-- frontend will read receipt_data/receipt_mimetype directly from the
-- payment_submissions row it already fetches.
-- =====================================================================
--  Done.
-- =====================================================================
