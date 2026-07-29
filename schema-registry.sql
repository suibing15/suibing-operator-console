-- =====================================================================
--  SUIBING BUCKET  -  OPERATOR REGISTRY  (central control)
--  Runs in a SEPARATE Supabase project that only YOU (the operator) own.
--  It never holds any school's student data. It tracks each school's
--  status, subscription, activity history, and last-reported counts, and
--  provides the "is this school active?" check the school apps call.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- OPERATORS  (who may sign in to the console). Seed yourself.
-- ---------------------------------------------------------------------
create table if not exists public.operators (
  id         uuid primary key default gen_random_uuid(),
  email      text unique not null,
  full_name  text,
  created_at timestamptz not null default now()
);

insert into public.operators (email, full_name)
values ('suibing15@gmail.com', 'SUIBING Operator')  -- <<< EDIT if needed
on conflict (email) do nothing;

create or replace function public.is_operator()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.operators o
    where lower(o.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- ---------------------------------------------------------------------
-- SCHOOLS  (one row per registered school)
--   school_key : a short unique code you assign (e.g. 'assalam'),
--                used by that school's app to identify itself.
--   status     : 'active' | 'disabled'
--   paid_until : subscription date; a school past this can be disabled.
--   students_count / records_count : last values the school app reported.
-- ---------------------------------------------------------------------
create table if not exists public.schools (
  id             uuid primary key default gen_random_uuid(),
  school_key     text unique not null,
  name           text not null,
  contact_person text,
  contact_email  text,
  app_url        text,
  plan           text not null default 'standard',
  status         text not null default 'active' check (status in ('active','disabled')),
  registered_on  date not null default current_date,
  paid_until     date,
  students_count int not null default 0,
  records_count  int not null default 0,
  counts_updated timestamptz,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists schools_status_idx on public.schools (status);
create index if not exists schools_key_idx on public.schools (school_key);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists schools_touch on public.schools;
create trigger schools_touch before update on public.schools
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- ACTIVITY LOG  (operator-level history for each school)
--   event: 'registered' | 'disabled' | 'enabled' | 'payment_recorded'
--          | 'paid_until_changed' | 'note'
-- ---------------------------------------------------------------------
create table if not exists public.activity_log (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid references public.schools(id) on delete cascade,
  school_key  text,
  event       text not null,
  detail      text,
  amount      numeric(12,2),        -- for payment events (NGN)
  at          timestamptz not null default now(),
  by_email    text
);

create index if not exists activity_school_idx on public.activity_log (school_id, at desc);

-- ---------------------------------------------------------------------
-- RLS: only operators can read/write the registry from the console.
-- ---------------------------------------------------------------------
alter table public.operators   enable row level security;
alter table public.schools     enable row level security;
alter table public.activity_log enable row level security;

drop policy if exists operators_read on public.operators;
create policy operators_read on public.operators
  for select to authenticated using (public.is_operator());

drop policy if exists schools_all on public.schools;
create policy schools_all on public.schools
  for all to authenticated using (public.is_operator()) with check (public.is_operator());

drop policy if exists activity_all on public.activity_log;
create policy activity_all on public.activity_log
  for all to authenticated using (public.is_operator()) with check (public.is_operator());

-- ---------------------------------------------------------------------
-- PUBLIC STATUS CHECK  (called by each school app on login)
--   Given a school_key, returns whether it is active. No auth needed,
--   but it reveals nothing sensitive - only active true/false, name,
--   and paid_until so the school app can show a polite lock screen.
-- ---------------------------------------------------------------------
create or replace function public.school_status(p_key text)
returns table (active boolean, name text, paid_until date)
language sql stable security definer set search_path = public as $$
  select (s.status = 'active') as active, s.name, s.paid_until
  from public.schools s
  where s.school_key = p_key;
$$;

grant execute on function public.school_status(text) to anon;

-- ---------------------------------------------------------------------
-- COUNTS HEARTBEAT  (called by each school app to report its totals)
--   Keeps isolation: the registry never reads the school DB; the school
--   app pushes its own counts here. Only updates the two count columns.
-- ---------------------------------------------------------------------
create or replace function public.report_counts(
  p_key text, p_students int, p_records int
) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.schools
     set students_count = greatest(p_students, 0),
         records_count  = greatest(p_records, 0),
         counts_updated = now()
   where school_key = p_key;
end;
$$;

grant execute on function public.report_counts(text, int, int) to anon;

-- ---------------------------------------------------------------------
-- Helper: record a payment (updates paid_until AND logs it) in one call.
--   p_months is usually 3. Adds to the later of today or current paid_until.
-- ---------------------------------------------------------------------
create or replace function public.record_payment(
  p_school uuid, p_amount numeric, p_months int, p_by text
) returns date
language plpgsql security definer set search_path = public as $$
declare base date; newpaid date; k text;
begin
  if not public.is_operator() then raise exception 'not authorised'; end if;
  select school_key, greatest(coalesce(paid_until, current_date), current_date)
    into k, base from public.schools where id = p_school;
  newpaid := base + (p_months || ' months')::interval;
  update public.schools set paid_until = newpaid where id = p_school;
  insert into public.activity_log (school_id, school_key, event, detail, amount, by_email)
    values (p_school, k, 'payment_recorded',
            'Paid ' || p_months || ' month(s); new paid-until ' || newpaid, p_amount, p_by);
  return newpaid;
end;
$$;

-- =====================================================================
--  Done. Operator registry ready: operators, schools, activity_log,
--  plus school_status(), report_counts(), record_payment().
-- =====================================================================
