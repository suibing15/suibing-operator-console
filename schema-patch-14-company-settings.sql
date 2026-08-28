-- =====================================================================
--  PATCH 14 — company settings: signature image + payment QR details
--  A single-row settings table the operator manages from the console,
--  read by every document generator (invoice, receipt, contract,
--  offer letter) so signature/bank details are set once, used
--  everywhere, and changeable without touching code.
-- =====================================================================

create table if not exists public.company_settings (
  id                 int primary key default 1,
  signature_data     text,       -- base64-encoded signature image
  signature_mimetype text,
  bank_name          text default 'OPay',
  account_name       text default 'Sulaiman Ibrahim Inuwa',
  account_number     text default '7080195042',
  updated_at         timestamptz not null default now(),
  constraint company_settings_singleton check (id = 1)
);

insert into public.company_settings (id) values (1) on conflict (id) do nothing;

drop trigger if exists company_settings_touch on public.company_settings;
create trigger company_settings_touch before update on public.company_settings
  for each row execute function public.touch_updated_at();

alter table public.company_settings enable row level security;

drop policy if exists company_settings_operator_all on public.company_settings;
create policy company_settings_operator_all on public.company_settings
  for all to authenticated using (public.is_operator()) with check (public.is_operator());

-- ---------------------------------------------------------------------
-- Public: read the non-sensitive fields needed to render documents and
-- the payment QR on the school portal / receipt downloads. Signature
-- is included since it must appear on documents the school downloads
-- too (invoices, receipts) — it is not secret, it is meant to be seen.
-- ---------------------------------------------------------------------
create or replace function public.get_company_settings()
returns table (
  signature_data text, signature_mimetype text,
  bank_name text, account_name text, account_number text
) language sql stable security definer set search_path = public as $$
  select signature_data, signature_mimetype, bank_name, account_name, account_number
  from public.company_settings where id = 1;
$$;

grant execute on function public.get_company_settings() to anon, authenticated;

-- Operator: update settings (signature and/or bank details).
create or replace function public.update_company_settings(
  p_signature_data text, p_signature_mimetype text,
  p_bank_name text, p_account_name text, p_account_number text
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_operator() then raise exception 'not authorised'; end if;
  update public.company_settings set
    signature_data = coalesce(p_signature_data, signature_data),
    signature_mimetype = coalesce(p_signature_mimetype, signature_mimetype),
    bank_name = coalesce(nullif(trim(p_bank_name),''), bank_name),
    account_name = coalesce(nullif(trim(p_account_name),''), account_name),
    account_number = coalesce(nullif(trim(p_account_number),''), account_number)
  where id = 1;
end; $$;

grant execute on function public.update_company_settings(text,text,text,text,text) to authenticated;

-- =====================================================================
--  Done.
-- =====================================================================
