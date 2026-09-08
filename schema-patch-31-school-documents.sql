-- =====================================================================
--  PATCH 31 — custom documents sent to a specific school, downloadable
--  from that school's own portal. The generated PDF itself (as
--  base64) is stored per document — same pattern already used for
--  payment receipts and signatures, so no new storage approach is
--  introduced here.
-- =====================================================================

create table if not exists public.school_documents (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools(id) on delete cascade,
  title        text not null,
  file_data    text not null,   -- base64-encoded PDF
  file_name    text not null,
  sent_by      text,
  created_at   timestamptz not null default now()
);

create index if not exists school_documents_school_idx on public.school_documents (school_id, created_at desc);

alter table public.school_documents enable row level security;

drop policy if exists school_documents_operator_all on public.school_documents;
create policy school_documents_operator_all on public.school_documents
  for all to authenticated using (public.is_operator()) with check (public.is_operator());

-- ---------------------------------------------------------------------
-- Operator: send a document to a school. Also raises a notification
-- (reusing the notifications infrastructure from patch 29) so it's
-- visible the same way a payment confirmation or complaint reply is.
-- ---------------------------------------------------------------------
create or replace function public.send_school_document(
  p_school_id uuid, p_title text, p_file_data text, p_file_name text, p_by text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_school_key text;
begin
  if not public.is_operator() then raise exception 'not authorised'; end if;
  if trim(p_title) = '' or trim(p_file_data) = '' then raise exception 'title and file are required'; end if;

  select school_key into v_school_key from public.schools where id = p_school_id;
  if v_school_key is null then raise exception 'school not found'; end if;

  insert into public.school_documents (school_id, title, file_data, file_name, sent_by)
  values (p_school_id, trim(p_title), p_file_data, p_file_name, p_by)
  returning id into v_id;

  insert into public.activity_log (school_id, school_key, event, detail, by_email)
  values (p_school_id, v_school_key, 'document_sent', 'Document sent: ' || trim(p_title), p_by);

  perform public.notify_school(p_school_id, 'document', 'New document: ' || trim(p_title), 'A new document has been shared with you. Open it from Invoices & Documents.');

  return v_id;
end; $$;

grant execute on function public.send_school_document(uuid, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- School: list documents sent to them (metadata only — not the file
-- data, so the list stays fast; the file is fetched separately when
-- they actually download one, same pattern as payment receipts).
-- ---------------------------------------------------------------------
create or replace function public.list_school_documents(p_school_key text, p_pin text)
returns table (id uuid, title text, file_name text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare v_school_id uuid;
begin
  v_school_id := public.verify_school_pin(p_school_key, p_pin);
  if v_school_id is null then raise exception 'not authorised'; end if;
  return query
  select d.id, d.title, d.file_name, d.created_at
  from public.school_documents d
  where d.school_id = v_school_id
  order by d.created_at desc;
end; $$;

grant execute on function public.list_school_documents(text, text) to anon;

create or replace function public.get_school_document(p_school_key text, p_pin text, p_id uuid)
returns table (title text, file_data text, file_name text)
language plpgsql security definer set search_path = public as $$
declare v_school_id uuid;
begin
  v_school_id := public.verify_school_pin(p_school_key, p_pin);
  if v_school_id is null then raise exception 'not authorised'; end if;
  return query
  select d.title, d.file_data, d.file_name
  from public.school_documents d
  where d.id = p_id and d.school_id = v_school_id;
end; $$;

grant execute on function public.get_school_document(text, text, uuid) to anon;

-- =====================================================================
--  Done.
-- =====================================================================
