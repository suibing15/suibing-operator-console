-- =====================================================================
--  PATCH 25 — let an existing operator add another operator's email
--  to the operators table, so a second person can be granted console
--  access without needing direct database access. This only grants
--  the ROLE (adds them to the allow-list); the person being added
--  must still separately have (or create) a real Supabase Auth
--  account with that exact email before they can actually sign in.
-- =====================================================================

create or replace function public.add_operator(p_email text, p_full_name text, p_by text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_operator() then raise exception 'not authorised'; end if;
  if trim(p_email) = '' then raise exception 'email is required'; end if;

  insert into public.operators (email, full_name)
  values (lower(trim(p_email)), nullif(trim(p_full_name), ''))
  on conflict (email) do update set full_name = coalesce(excluded.full_name, public.operators.full_name);

  insert into public.activity_log (event, detail, by_email)
  values ('operator_added', lower(trim(p_email)) || ' added as an operator', p_by);
end; $$;

grant execute on function public.add_operator(text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- List current operators (for display in the console).
-- ---------------------------------------------------------------------
create or replace function public.list_operators()
returns table (email text, full_name text, created_at timestamptz)
language sql security definer set search_path = public as $$
  select email, full_name, created_at from public.operators order by created_at asc;
$$;

grant execute on function public.list_operators() to authenticated;

-- ---------------------------------------------------------------------
-- Remove an operator — deliberately blocks removing yourself, so this
-- can never be used (accidentally or otherwise) to lock every operator
-- out of the console.
-- ---------------------------------------------------------------------
create or replace function public.remove_operator(p_email text, p_by text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_operator() then raise exception 'not authorised'; end if;
  if lower(trim(p_email)) = lower(trim(p_by)) then
    raise exception 'You cannot remove your own operator access.';
  end if;

  delete from public.operators where email = lower(trim(p_email));

  insert into public.activity_log (event, detail, by_email)
  values ('operator_removed', lower(trim(p_email)) || ' removed as an operator', p_by);
end; $$;

grant execute on function public.remove_operator(text, text) to authenticated;

-- =====================================================================
--  Done.
-- =====================================================================
