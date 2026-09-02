-- =====================================================================
--  PATCH 27 — add the product/service description to payment
--  receipts, so it's immediately clear what a receipt is for, not
--  just which school it belongs to. Pulls the description from the
--  matched invoice's line items when the payment is tied to one;
--  falls back to a generic label for payments not linked to a
--  specific invoice (general/ad-hoc payments).
-- =====================================================================

drop function if exists public.get_payment_receipt(text, text, text);

create or replace function public.get_payment_receipt(p_school_key text, p_pin text, p_receipt_number text)
returns table (
  receipt_number text, school_name text, invoice_number text, amount numeric,
  payment_date date, note text, confirmed_at timestamptz, description text
) language plpgsql security definer set search_path = public as $$
declare v_school_id uuid;
begin
  v_school_id := public.verify_school_pin(p_school_key, p_pin);
  if v_school_id is null then raise exception 'not authorised'; end if;

  return query
  select
    p.receipt_number, s.name, p.invoice_number, p.amount, p.payment_date, p.note, p.reviewed_at,
    coalesce(
      -- Join item descriptions from the matched invoice's line items,
      -- e.g. "SUIBING Bucket subscription (3 months)" — comma-joined
      -- in case an invoice covers more than one line item.
      (
        select string_agg(item ->> 'description', ', ')
        from public.invoices i, jsonb_array_elements(i.line_items) as item
        where i.id = p.invoice_id
      ),
      'General payment'
    ) as description
  from public.payment_submissions p
  join public.schools s on s.id = p.school_id
  where p.school_id = v_school_id and p.receipt_number = p_receipt_number and p.status = 'confirmed';
end; $$;

grant execute on function public.get_payment_receipt(text, text, text) to anon;

NOTIFY pgrst, 'reload schema';

-- =====================================================================
--  Done.
-- =====================================================================
