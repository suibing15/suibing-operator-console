-- =====================================================================
--  PATCH 20 — complaints/disputes: schools submit from their portal,
--  operator manages and replies from the console. Simple threaded
--  conversation per complaint, with an open/resolved status.
-- =====================================================================

create table if not exists public.complaints (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools(id) on delete cascade,
  school_key   text not null,
  subject      text not null,
  status       text not null default 'open' check (status in ('open', 'resolved')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists complaints_status_idx on public.complaints (status, updated_at desc);

drop trigger if exists complaints_touch on public.complaints;
create trigger complaints_touch before update on public.complaints
  for each row execute function public.touch_updated_at();

alter table public.complaints enable row level security;

drop policy if exists complaints_operator_all on public.complaints;
create policy complaints_operator_all on public.complaints
  for all to authenticated using (public.is_operator()) with check (public.is_operator());

-- ---------------------------------------------------------------------
-- Messages within a complaint thread — either side can post one.
-- ---------------------------------------------------------------------
create table if not exists public.complaint_messages (
  id           uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  sender       text not null check (sender in ('school', 'operator')),
  body         text not null,
  by_email     text,
  created_at   timestamptz not null default now()
);

create index if not exists complaint_messages_complaint_idx on public.complaint_messages (complaint_id, created_at asc);

alter table public.complaint_messages enable row level security;

drop policy if exists complaint_messages_operator_all on public.complaint_messages;
create policy complaint_messages_operator_all on public.complaint_messages
  for all to authenticated using (public.is_operator()) with check (public.is_operator());

-- ---------------------------------------------------------------------
-- School: submit a new complaint (PIN-gated), with the opening message.
-- ---------------------------------------------------------------------
create or replace function public.submit_complaint(
  p_school_key text, p_pin text, p_subject text, p_message text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_school_id uuid; v_complaint_id uuid;
begin
  select s.id into v_school_id from public.schools s
   where s.school_key = lower(trim(p_school_key))
     and s.portal_pin_hash is not null
     and s.portal_pin_hash = extensions.crypt(trim(p_pin), s.portal_pin_hash);
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

grant execute on function public.submit_complaint(text, text, text, text) to anon;

-- ---------------------------------------------------------------------
-- School: list their own complaints, with message counts.
-- ---------------------------------------------------------------------
create or replace function public.list_school_complaints(p_school_key text, p_pin text)
returns table (
  id uuid, subject text, status text, created_at timestamptz, updated_at timestamptz, message_count int
) language plpgsql stable security definer set search_path = public as $$
declare v_school_id uuid;
begin
  select s.id into v_school_id from public.schools s
   where s.school_key = lower(trim(p_school_key))
     and s.portal_pin_hash is not null
     and s.portal_pin_hash = extensions.crypt(trim(p_pin), s.portal_pin_hash);
  if v_school_id is null then raise exception 'not authorised'; end if;

  return query
  select c.id, c.subject, c.status, c.created_at, c.updated_at,
         (select count(*)::int from public.complaint_messages m where m.complaint_id = c.id)
  from public.complaints c
  where c.school_id = v_school_id
  order by c.updated_at desc;
end; $$;

grant execute on function public.list_school_complaints(text, text) to anon;

-- ---------------------------------------------------------------------
-- School: read + post to a thread they own (PIN-gated, and the
-- complaint must actually belong to this school).
-- ---------------------------------------------------------------------
create or replace function public.get_complaint_thread(p_school_key text, p_pin text, p_complaint_id uuid)
returns table (
  id uuid, sender text, body text, created_at timestamptz
) language plpgsql stable security definer set search_path = public as $$
declare v_school_id uuid;
begin
  select s.id into v_school_id from public.schools s
   where s.school_key = lower(trim(p_school_key))
     and s.portal_pin_hash is not null
     and s.portal_pin_hash = extensions.crypt(trim(p_pin), s.portal_pin_hash);
  if v_school_id is null then raise exception 'not authorised'; end if;

  return query
  select m.id, m.sender, m.body, m.created_at
  from public.complaint_messages m
  join public.complaints c on c.id = m.complaint_id
  where m.complaint_id = p_complaint_id and c.school_id = v_school_id
  order by m.created_at asc;
end; $$;

grant execute on function public.get_complaint_thread(text, text, uuid) to anon;

create or replace function public.reply_to_complaint_as_school(
  p_school_key text, p_pin text, p_complaint_id uuid, p_message text
) returns void language plpgsql security definer set search_path = public as $$
declare v_school_id uuid; v_owner_id uuid;
begin
  select s.id into v_school_id from public.schools s
   where s.school_key = lower(trim(p_school_key))
     and s.portal_pin_hash is not null
     and s.portal_pin_hash = extensions.crypt(trim(p_pin), s.portal_pin_hash);
  if v_school_id is null then raise exception 'not authorised'; end if;
  if trim(p_message) = '' then raise exception 'message cannot be empty'; end if;

  select school_id into v_owner_id from public.complaints where id = p_complaint_id;
  if v_owner_id is distinct from v_school_id then raise exception 'not authorised for this complaint'; end if;

  insert into public.complaint_messages (complaint_id, sender, body)
  values (p_complaint_id, 'school', trim(p_message));

  update public.complaints set updated_at = now() where id = p_complaint_id;
end; $$;

grant execute on function public.reply_to_complaint_as_school(text, text, uuid, text) to anon;

-- ---------------------------------------------------------------------
-- Operator: reply to a complaint, optionally marking it resolved.
-- ---------------------------------------------------------------------
create or replace function public.reply_to_complaint_as_operator(
  p_complaint_id uuid, p_message text, p_by text, p_mark_resolved boolean default false
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_operator() then raise exception 'not authorised'; end if;
  if trim(p_message) = '' then raise exception 'message cannot be empty'; end if;

  insert into public.complaint_messages (complaint_id, sender, body, by_email)
  values (p_complaint_id, 'operator', trim(p_message), p_by);

  update public.complaints
     set updated_at = now(), status = case when p_mark_resolved then 'resolved' else status end
   where id = p_complaint_id;
end; $$;

grant execute on function public.reply_to_complaint_as_operator(uuid, text, text, boolean) to authenticated;

create or replace function public.set_complaint_status(p_complaint_id uuid, p_status text, p_by text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_operator() then raise exception 'not authorised'; end if;
  if p_status not in ('open', 'resolved') then raise exception 'invalid status'; end if;
  update public.complaints set status = p_status, updated_at = now() where id = p_complaint_id;
  insert into public.activity_log (school_id, school_key, event, detail, by_email)
  select school_id, school_key, 'complaint_' || p_status, 'Complaint marked ' || p_status, p_by
  from public.complaints where id = p_complaint_id;
end; $$;

grant execute on function public.set_complaint_status(uuid, text, text) to authenticated;

-- =====================================================================
--  Done.
-- =====================================================================
