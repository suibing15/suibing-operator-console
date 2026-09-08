-- =====================================================================
--  PATCH 32 — allow selecting and deleting invoices from the school
--  portal, primarily for testing/cleanup during setup. School-side,
--  gated by PIN like every other portal action. A payment already
--  confirmed against an invoice is NOT deleted — deleting the invoice
--  only detaches it (the payment/receipt record and its history stay
--  intact), so a real, already-paid transaction can never quietly
--  disappear this way.
-- =====================================================================

create or replace function public.delete_school_invoices(p_school_key text, p_pin text, p_invoice_numbers text[])
returns int language plpgsql security definer set search_path = public as $$
declare
  v_school_id uuid;
  v_deleted int;
begin
  v_school_id := public.verify_school_pin(p_school_key, p_pin);
  if v_school_id is null then raise exception 'not authorised'; end if;
  if p_invoice_numbers is null or array_length(p_invoice_numbers, 1) is null then
    raise exception 'no invoices selected';
  end if;

  -- Detach (not delete) any payment submissions referencing these
  -- invoices, so a payment record — and its receipt, if confirmed —
  -- is never lost as a side effect of tidying up invoices.
  update public.payment_submissions
     set invoice_id = null
   where school_id = v_school_id
     and invoice_number = any(p_invoice_numbers);

  delete from public.invoices
   where school_id = v_school_id
     and invoice_number = any(p_invoice_numbers);
  get diagnostics v_deleted = row_count;

  insert into public.activity_log (school_id, school_key, event, detail)
  values (v_school_id, lower(trim(p_school_key)), 'invoices_deleted_by_school',
    v_deleted || ' invoice(s) deleted by school: ' || array_to_string(p_invoice_numbers, ', '));

  return v_deleted;
end; $$;

grant execute on function public.delete_school_invoices(text, text, text[]) to anon;

-- =====================================================================
--  Done.
-- =====================================================================
