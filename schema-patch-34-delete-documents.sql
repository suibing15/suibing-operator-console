-- =====================================================================
--  PATCH 34 — allow selecting and deleting custom documents sent to a
--  school (the ones sent via the console's Custom Document builder),
--  from the school portal — for testing/cleanup, matching the invoice
--  delete pattern already in place (patch 32).
--
--  The activity_log entry recorded when a document was originally
--  sent (event: 'document_sent') is deliberately NEVER touched here —
--  school_documents has no foreign key relationship to activity_log,
--  so deleting a document cannot cascade into or remove its log
--  entry by construction, not just by care in this function. A
--  separate 'document_deleted' entry is added so the deletion itself
--  is also on record.
-- =====================================================================

create or replace function public.delete_school_documents(p_school_key text, p_pin text, p_document_ids uuid[])
returns int language plpgsql security definer set search_path = public as $$
declare
  v_school_id uuid;
  v_deleted int;
  v_titles text;
begin
  v_school_id := public.verify_school_pin(p_school_key, p_pin);
  if v_school_id is null then raise exception 'not authorised'; end if;
  if p_document_ids is null or array_length(p_document_ids, 1) is null then
    raise exception 'no documents selected';
  end if;

  select string_agg(title, ', ') into v_titles
  from public.school_documents
  where id = any(p_document_ids) and school_id = v_school_id;

  delete from public.school_documents
   where id = any(p_document_ids) and school_id = v_school_id;
  get diagnostics v_deleted = row_count;

  insert into public.activity_log (school_id, school_key, event, detail)
  values (v_school_id, lower(trim(p_school_key)), 'document_deleted_by_school',
    v_deleted || ' document(s) deleted by school: ' || coalesce(v_titles, ''));

  return v_deleted;
end; $$;

grant execute on function public.delete_school_documents(text, text, uuid[]) to anon;

-- =====================================================================
--  Done.
-- =====================================================================
