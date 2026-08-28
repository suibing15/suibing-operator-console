-- =====================================================================
--  PATCH 21 — bulk-clear resolved complaints, so the operator can keep
--  the Support queue tidy without deleting them one at a time. Only
--  ever touches complaints already marked 'resolved' — never open ones.
-- =====================================================================

create or replace function public.clear_resolved_complaints(p_by text)
returns int language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  if not public.is_operator() then raise exception 'not authorised'; end if;

  select count(*) into v_count from public.complaints where status = 'resolved';

  delete from public.complaints where status = 'resolved';
  -- complaint_messages cascade automatically via the foreign key.

  insert into public.activity_log (event, detail, by_email)
  values ('complaints_cleared', v_count || ' resolved complaint(s) cleared', p_by);

  return v_count;
end; $$;

grant execute on function public.clear_resolved_complaints(text) to authenticated;

-- =====================================================================
--  Done.
-- =====================================================================
