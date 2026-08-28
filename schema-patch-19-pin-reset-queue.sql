-- =====================================================================
--  PATCH 19 — PIN reset requests as a proper trackable queue, visible
--  as a notification badge in the console, dismissible once handled.
--  (activity_log alone had no "handled" state, so the badge could
--  never clear even after the operator reset the PIN.)
-- =====================================================================

create table if not exists public.pin_reset_requests (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools(id) on delete cascade,
  school_key   text not null,
  note         text,
  status       text not null default 'pending' check (status in ('pending', 'resolved')),
  resolved_by  text,
  resolved_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists pin_reset_requests_status_idx on public.pin_reset_requests (status, created_at desc);

alter table public.pin_reset_requests enable row level security;

drop policy if exists pin_reset_requests_operator_all on public.pin_reset_requests;
create policy pin_reset_requests_operator_all on public.pin_reset_requests
  for all to authenticated using (public.is_operator()) with check (public.is_operator());

-- ---------------------------------------------------------------------
-- Replace request_pin_reset to also insert into the trackable queue
-- (keeps the existing activity_log entry too, for the school's own
-- audit trail visibility).
-- ---------------------------------------------------------------------
create or replace function public.request_pin_reset(p_school_key text, p_contact_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_key text;
begin
  select s.id, s.school_key into v_id, v_key from public.schools s
   where s.school_key = lower(trim(p_school_key));
  if v_id is null then raise exception 'school not found'; end if;

  insert into public.activity_log (school_id, school_key, event, detail)
  values (v_id, v_key, 'portal_pin_reset_requested',
    'School requested a PIN reset via the portal login screen.' ||
    coalesce(' Note: ' || p_contact_note, ''));

  insert into public.pin_reset_requests (school_id, school_key, note)
  values (v_id, v_key, p_contact_note);
end; $$;

grant execute on function public.request_pin_reset(text, text) to anon;

-- ---------------------------------------------------------------------
-- Operator: mark a request resolved (e.g. after setting a new PIN).
-- ---------------------------------------------------------------------
create or replace function public.resolve_pin_reset_request(p_id uuid, p_by text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_operator() then raise exception 'not authorised'; end if;
  update public.pin_reset_requests
     set status = 'resolved', resolved_by = p_by, resolved_at = now()
   where id = p_id;
end; $$;

grant execute on function public.resolve_pin_reset_request(uuid, text) to authenticated;

-- =====================================================================
--  Done.
-- =====================================================================
