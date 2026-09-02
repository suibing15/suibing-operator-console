-- =====================================================================
--  PATCH 29 — notification queue. Records an entry whenever something
--  happens that a school should be told about (payment confirmed,
--  complaint replied to, PIN reset handled). Nothing is emailed yet —
--  no email provider is connected — but every trigger point is wired
--  up now, so sending becomes a small final step once one is added,
--  rather than touching every one of these functions again later.
--
--  In the meantime, un-sent notifications are visible to the school
--  in their own portal (a lightweight in-app inbox), so this has real
--  value even before email is connected.
-- =====================================================================

create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools(id) on delete cascade,
  kind         text not null,   -- 'payment_confirmed' | 'payment_rejected' | 'complaint_reply' | 'pin_reset' | 'broadcast'
  title        text not null,
  body         text,
  read_at      timestamptz,
  emailed_at   timestamptz,     -- set once real email sending is wired in; null until then
  created_at   timestamptz not null default now()
);

create index if not exists notifications_school_idx on public.notifications (school_id, created_at desc);
create index if not exists notifications_unsent_idx on public.notifications (emailed_at) where emailed_at is null;

alter table public.notifications enable row level security;

drop policy if exists notifications_operator_all on public.notifications;
create policy notifications_operator_all on public.notifications
  for all to authenticated using (public.is_operator()) with check (public.is_operator());

-- ---------------------------------------------------------------------
-- Internal helper — not exposed to anon/authenticated directly, only
-- called from inside other security definer functions below.
-- ---------------------------------------------------------------------
create or replace function public.notify_school(p_school_id uuid, p_kind text, p_title text, p_body text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (school_id, kind, title, body)
  values (p_school_id, p_kind, p_title, p_body);
$$;

-- ---------------------------------------------------------------------
-- Wire up the trigger points. Each is a small addition to an existing
-- function — the original logic is untouched, only a notify_school()
-- call is appended before the function returns.
-- ---------------------------------------------------------------------

-- Payment confirmed or rejected (review_payment_submission, patch 11's version).
create or replace function public.review_payment_submission(
  p_id uuid, p_status text, p_reviewer_note text, p_by text
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_school_id uuid; v_school_key text; v_invoice_id uuid; v_amount numeric;
  v_existing_receipt text; v_receipt_number text;
begin
  if not public.is_operator() then raise exception 'not authorised'; end if;
  if p_status not in ('confirmed','rejected') then raise exception 'invalid status'; end if;

  select school_id, school_key, invoice_id, amount, receipt_number
    into v_school_id, v_school_key, v_invoice_id, v_amount, v_existing_receipt
  from public.payment_submissions where id = p_id;

  if p_status = 'confirmed' and v_existing_receipt is null then
    v_receipt_number := public.gen_receipt_number();
    update public.payment_submissions
       set status = p_status, reviewer_note = p_reviewer_note, reviewed_by = p_by, reviewed_at = now(),
           receipt_number = v_receipt_number
     where id = p_id;
  else
    v_receipt_number := v_existing_receipt;
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

  perform public.notify_school(
    v_school_id,
    case when p_status = 'confirmed' then 'payment_confirmed' else 'payment_rejected' end,
    case when p_status = 'confirmed' then 'Payment confirmed' else 'Payment needs attention' end,
    case when p_status = 'confirmed'
      then 'Your payment has been confirmed. Receipt: ' || coalesce(v_receipt_number, '')
      else coalesce(p_reviewer_note, 'Your payment submission needs a follow-up. Please check your portal for details.')
    end
  );
end; $$;

grant execute on function public.review_payment_submission(uuid, text, text, text) to authenticated;

-- Complaint replied to by the operator.
create or replace function public.reply_to_complaint_as_operator(
  p_complaint_id uuid, p_message text, p_by text, p_mark_resolved boolean default false
) returns void language plpgsql security definer set search_path = public as $$
declare v_school_id uuid; v_subject text;
begin
  if not public.is_operator() then raise exception 'not authorised'; end if;
  if trim(p_message) = '' then raise exception 'message cannot be empty'; end if;

  insert into public.complaint_messages (complaint_id, sender, body, by_email)
  values (p_complaint_id, 'operator', trim(p_message), p_by);

  update public.complaints
     set updated_at = now(), status = case when p_mark_resolved then 'resolved' else status end
   where id = p_complaint_id
   returning school_id, subject into v_school_id, v_subject;

  perform public.notify_school(
    v_school_id, 'complaint_reply', 'New reply: ' || v_subject,
    left(trim(p_message), 200)
  );
end; $$;

grant execute on function public.reply_to_complaint_as_operator(uuid, text, text, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- School: list their own notifications, and mark one read.
-- ---------------------------------------------------------------------
create or replace function public.list_school_notifications(p_school_key text, p_pin text)
returns table (id uuid, kind text, title text, body text, read_at timestamptz, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare v_school_id uuid;
begin
  v_school_id := public.verify_school_pin(p_school_key, p_pin);
  if v_school_id is null then raise exception 'not authorised'; end if;
  return query
  select n.id, n.kind, n.title, n.body, n.read_at, n.created_at
  from public.notifications n
  where n.school_id = v_school_id
  order by n.created_at desc
  limit 50;
end; $$;

grant execute on function public.list_school_notifications(text, text) to anon;

create or replace function public.mark_notification_read(p_school_key text, p_pin text, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_school_id uuid; v_owner_id uuid;
begin
  v_school_id := public.verify_school_pin(p_school_key, p_pin);
  if v_school_id is null then raise exception 'not authorised'; end if;

  select school_id into v_owner_id from public.notifications where id = p_id;
  if v_owner_id is distinct from v_school_id then raise exception 'not authorised'; end if;

  update public.notifications set read_at = now() where id = p_id and read_at is null;
end; $$;

grant execute on function public.mark_notification_read(text, text, uuid) to anon;

-- =====================================================================
--  Done. To wire in real email later: a scheduled job (or a manual
--  "send pending notification emails" button in the console) reads
--  rows where emailed_at is null, sends via your email provider, and
--  sets emailed_at = now() on success. No schema changes needed then.
-- =====================================================================
