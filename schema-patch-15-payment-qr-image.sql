-- =====================================================================
--  PATCH 15 — real payment QR image (e.g. OPay "Scan to Pay Me")
--  Adds storage for an actual scannable payment QR image the operator
--  uploads once from their banking app, used on invoices instead of a
--  generated text QR. Same pattern as the signature image.
-- =====================================================================

alter table public.company_settings
  add column if not exists payment_qr_data     text,   -- base64-encoded QR image
  add column if not exists payment_qr_mimetype text;

-- ---------------------------------------------------------------------
-- Extend get_company_settings to also return the payment QR image.
-- ---------------------------------------------------------------------
drop function if exists public.get_company_settings();

create or replace function public.get_company_settings()
returns table (
  signature_data text, signature_mimetype text,
  bank_name text, account_name text, account_number text,
  payment_qr_data text, payment_qr_mimetype text
) language sql stable security definer set search_path = public as $$
  select signature_data, signature_mimetype, bank_name, account_name, account_number,
         payment_qr_data, payment_qr_mimetype
  from public.company_settings where id = 1;
$$;

grant execute on function public.get_company_settings() to anon, authenticated;

-- ---------------------------------------------------------------------
-- Extend update_company_settings to accept the payment QR image too.
-- ---------------------------------------------------------------------
drop function if exists public.update_company_settings(text,text,text,text,text);

create or replace function public.update_company_settings(
  p_signature_data text, p_signature_mimetype text,
  p_bank_name text, p_account_name text, p_account_number text,
  p_payment_qr_data text default null, p_payment_qr_mimetype text default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_operator() then raise exception 'not authorised'; end if;
  update public.company_settings set
    signature_data = coalesce(p_signature_data, signature_data),
    signature_mimetype = coalesce(p_signature_mimetype, signature_mimetype),
    bank_name = coalesce(nullif(trim(p_bank_name),''), bank_name),
    account_name = coalesce(nullif(trim(p_account_name),''), account_name),
    account_number = coalesce(nullif(trim(p_account_number),''), account_number),
    payment_qr_data = coalesce(p_payment_qr_data, payment_qr_data),
    payment_qr_mimetype = coalesce(p_payment_qr_mimetype, payment_qr_mimetype)
  where id = 1;
end; $$;

grant execute on function public.update_company_settings(text,text,text,text,text,text,text) to authenticated;

-- =====================================================================
--  Done.
-- =====================================================================
