-- =====================================================================
--  PATCH 24 — SECURITY: extend brute-force protection (added for
--  school_portal_login in patch 23) to every other function that
--  independently checks a school PIN. Each of the 10 functions below
--  was an equally usable channel for guessing a PIN, since none had
--  any rate limiting of their own.
--
--  IMPORTANT: run schema-patch-23-pin-bruteforce-protection.sql
--  BEFORE this one — it creates the portal_login_attempts table that
--  verify_school_pin() below depends on.
--
--  Every function body below is copied EXACTLY from its live source
--  (submit_payment, list_school_payments, list_school_invoices_portal,
--  list_school_activity_portal, get_payment_receipt from earlier
--  patches; change_school_pin, submit_complaint, list_school_complaints,
--  get_complaint_thread, reply_to_complaint_as_school from patches 18
--  and 20) with ONLY the inline crypt() check replaced by a call to
--  the shared verify_school_pin() helper. No other logic, column, or
--  return shape has changed.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Shared verifier: does the lockout check + crypt comparison + attempt
-- logging in one place. Returns the matching school's id, or null if
-- the key/PIN is wrong OR the school_key is currently locked out.
-- Not granted to anon/authenticated directly — only callable from
-- inside other security definer functions in this file.
-- ---------------------------------------------------------------------
create or replace function public.verify_school_pin(p_school_key text, p_pin text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_key text := lower(trim(p_school_key));
  v_recent_failures int;
  v_school_id uuid;
begin
  select count(*) into v_recent_failures
  from public.portal_login_attempts
  where school_key = v_key and succeeded = false and created_at > now() - interval '15 minutes';

  if v_recent_failures >= 8 then
    raise exception 'Too many failed attempts for this school. Please wait 15 minutes before trying again.';
  end if;

  select s.id into v_school_id from public.schools s
   where s.school_key = v_key
     and s.portal_pin_hash is not null
     and s.portal_pin_hash = extensions.crypt(trim(p_pin), s.portal_pin_hash);

  insert into public.portal_login_attempts (school_key, succeeded)
  values (v_key, v_school_id is not null);

  return v_school_id;
end; $$;

-- ---------------------------------------------------------------------
-- The 10 functions below, each re-pointed at verify_school_pin().
-- ---------------------------------------------------------------------

create or replace function public.submit_payment(
  p_school_key text, p_pin text, p_invoice_number text, p_amount numeric,
  p_payment_date date, p_note text,
  p_receipt_data text, p_receipt_mimetype text, p_receipt_filename text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_school_id uuid; v_invoice_id uuid; v_new_id uuid;
begin
  v_school_id := public.verify_school_pin(p_school_key, p_pin);
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

create or replace function public.list_school_payments(p_school_key text, p_pin text)
returns table (
  id uuid, invoice_number text, amount numeric, payment_date date, note text,
  receipt_data text, receipt_mimetype text, receipt_filename text,
  status text, reviewer_note text, created_at timestamptz
) language plpgsql stable security definer set search_path = public as $$
declare v_school_id uuid;
begin
  v_school_id := public.verify_school_pin(p_school_key, p_pin);
  if v_school_id is null then raise exception 'not authorised'; end if;

  return query
  select p.id, p.invoice_number, p.amount, p.payment_date, p.note,
         p.receipt_data, p.receipt_mimetype, p.receipt_filename,
         p.status, p.reviewer_note, p.created_at
  from public.payment_submissions p
  where p.school_id = v_school_id
  order by p.created_at desc;
end; $$;

create or replace function public.list_school_invoices_portal(p_school_key text, p_pin text)
returns table (
  invoice_number text, invoice_type text, line_items jsonb, currency text,
  subtotal numeric, total numeric, notes text, status text, issued_at timestamptz
) language plpgsql stable security definer set search_path = public as $$
declare v_school_id uuid;
begin
  v_school_id := public.verify_school_pin(p_school_key, p_pin);
  if v_school_id is null then raise exception 'not authorised'; end if;

  return query
  select i.invoice_number, i.invoice_type, i.line_items, i.currency,
         i.subtotal, i.total, i.notes, i.status, i.issued_at
  from public.invoices i
  where i.school_id = v_school_id
  order by i.issued_at desc;
end; $$;

create or replace function public.list_school_activity_portal(
  p_school_key text, p_pin text, p_from date default null, p_to date default null
) returns table (event text, detail text, amount numeric, at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare v_school_id uuid;
begin
  v_school_id := public.verify_school_pin(p_school_key, p_pin);
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

create or replace function public.get_payment_receipt(p_school_key text, p_pin text, p_receipt_number text)
returns table (
  receipt_number text, school_name text, invoice_number text, amount numeric,
  payment_date date, note text, confirmed_at timestamptz
) language plpgsql stable security definer set search_path = public as $$
declare v_school_id uuid;
begin
  v_school_id := public.verify_school_pin(p_school_key, p_pin);
  if v_school_id is null then raise exception 'not authorised'; end if;

  return query
  select p.receipt_number, s.name, p.invoice_number, p.amount, p.payment_date, p.note, p.reviewed_at
  from public.payment_submissions p
  join public.schools s on s.id = p.school_id
  where p.school_id = v_school_id and p.receipt_number = p_receipt_number and p.status = 'confirmed';
end; $$;

create or replace function public.change_school_pin(
  p_school_key text, p_current_pin text, p_new_pin text
) returns void language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_key text;
begin
  if length(trim(p_new_pin)) < 4 then raise exception 'New PIN must be at least 4 characters'; end if;

  v_id := public.verify_school_pin(p_school_key, p_current_pin);
  if v_id is not null then select s.school_key into v_key from public.schools s where s.id = v_id; end if;
  if v_id is null then raise exception 'current PIN is incorrect'; end if;

  update public.schools
     set portal_pin_hash = extensions.crypt(trim(p_new_pin), extensions.gen_salt('bf'))
   where id = v_id;

  insert into public.activity_log (school_id, school_key, event, detail)
  values (v_id, v_key, 'portal_pin_changed_by_school', 'School changed their own portal PIN');
end; $$;

create or replace function public.submit_complaint(
  p_school_key text, p_pin text, p_subject text, p_message text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_school_id uuid; v_complaint_id uuid;
begin
  v_school_id := public.verify_school_pin(p_school_key, p_pin);
  if v_school_id is null then raise exception 'not authorised'; end if;
  if trim(p_subject) = '' or trim(p_message) = '' then raise exception 'subject and message are required'; end if;

  insert into public.complaints (school_id, school_key, subject)
  values (v_school_id, lower(trim(p_school_key)), trim(p_subject))
  returning id into v_complaint_id;

  insert into public.complaint_messages (complaint_id, sender, body)
  values (v_complaint_id, 'school', trim(p_message));

  insert into public.activity_log (school_id, school_key, event, detail)
  values (v_school_id, lower(trim(p_school_key)), 'complaint_submitted', 'Complaint submitted: ' || trim(p_subject));

  return v_complaint_id;
end; $$;

create or replace function public.list_school_complaints(p_school_key text, p_pin text)
returns table (
  id uuid, subject text, status text, created_at timestamptz, updated_at timestamptz, message_count int
) language plpgsql stable security definer set search_path = public as $$
declare v_school_id uuid;
begin
  v_school_id := public.verify_school_pin(p_school_key, p_pin);
  if v_school_id is null then raise exception 'not authorised'; end if;

  return query
  select c.id, c.subject, c.status, c.created_at, c.updated_at,
         (select count(*)::int from public.complaint_messages m where m.complaint_id = c.id)
  from public.complaints c
  where c.school_id = v_school_id
  order by c.updated_at desc;
end; $$;

create or replace function public.get_complaint_thread(p_school_key text, p_pin text, p_complaint_id uuid)
returns table (
  id uuid, sender text, body text, created_at timestamptz
) language plpgsql stable security definer set search_path = public as $$
declare v_school_id uuid;
begin
  v_school_id := public.verify_school_pin(p_school_key, p_pin);
  if v_school_id is null then raise exception 'not authorised'; end if;

  return query
  select m.id, m.sender, m.body, m.created_at
  from public.complaint_messages m
  join public.complaints c on c.id = m.complaint_id
  where m.complaint_id = p_complaint_id and c.school_id = v_school_id
  order by m.created_at asc;
end; $$;

create or replace function public.reply_to_complaint_as_school(
  p_school_key text, p_pin text, p_complaint_id uuid, p_message text
) returns void language plpgsql security definer set search_path = public as $$
declare v_school_id uuid; v_owner_id uuid;
begin
  v_school_id := public.verify_school_pin(p_school_key, p_pin);
  if v_school_id is null then raise exception 'not authorised'; end if;
  if trim(p_message) = '' then raise exception 'message cannot be empty'; end if;

  select school_id into v_owner_id from public.complaints where id = p_complaint_id;
  if v_owner_id is distinct from v_school_id then raise exception 'not authorised for this complaint'; end if;

  insert into public.complaint_messages (complaint_id, sender, body)
  values (p_complaint_id, 'school', trim(p_message));

  update public.complaints set updated_at = now() where id = p_complaint_id;
end; $$;


-- ---------------------------------------------------------------------
-- Re-affirm grants (CREATE OR REPLACE preserves existing grants when
-- the signature is unchanged, but stating them again is harmless and
-- removes any doubt).
-- ---------------------------------------------------------------------
grant execute on function public.submit_payment(text, text, text, numeric, date, text, text, text, text) to anon;
grant execute on function public.list_school_payments(text, text) to anon;
grant execute on function public.list_school_invoices_portal(text, text) to anon;
grant execute on function public.list_school_activity_portal(text, text, date, date) to anon;
grant execute on function public.get_payment_receipt(text, text, text) to anon;
grant execute on function public.change_school_pin(text, text, text) to anon;
grant execute on function public.submit_complaint(text, text, text, text) to anon;
grant execute on function public.list_school_complaints(text, text) to anon;
grant execute on function public.get_complaint_thread(text, text, uuid) to anon;
grant execute on function public.reply_to_complaint_as_school(text, text, uuid, text) to anon;

-- =====================================================================
--  IMPORTANT: dismiss_portal_warning and request_pin_reset are
--  intentionally left as-is. dismiss_portal_warning only flips a
--  boolean and reveals nothing sensitive on failure. request_pin_reset
--  doesn't check a PIN at all (that's the point — it's the recovery
--  path for someone who's forgotten it), so there's nothing to brute
--  force there; it already only requires the school_key.
-- =====================================================================

-- =====================================================================
--  Done.
-- =====================================================================
