-- =====================================================================
--  PATCH 22 — global broadcast banner: a single announcement the
--  operator can post, shown on public-facing pages (not the console,
--  not the school portal). Only ever one message live at a time.
-- =====================================================================

create table if not exists public.broadcast_banner (
  id           int primary key default 1,
  message      text,
  link_url     text,
  link_label   text,
  is_active    boolean not null default false,
  updated_at   timestamptz not null default now(),
  constraint broadcast_banner_singleton check (id = 1)
);

insert into public.broadcast_banner (id, is_active) values (1, false)
  on conflict (id) do nothing;

alter table public.broadcast_banner enable row level security;

drop policy if exists broadcast_banner_operator_write on public.broadcast_banner;
create policy broadcast_banner_operator_write on public.broadcast_banner
  for all to authenticated using (public.is_operator()) with check (public.is_operator());

-- ---------------------------------------------------------------------
-- Public read: only ever returns the message when it is actually
-- active, so pages don't need to duplicate the is_active check.
-- ---------------------------------------------------------------------
create or replace function public.get_broadcast_banner()
returns table (message text, link_url text, link_label text)
language sql stable security definer set search_path = public as $$
  select message, link_url, link_label
  from public.broadcast_banner
  where id = 1 and is_active = true and coalesce(trim(message), '') <> '';
$$;

grant execute on function public.get_broadcast_banner() to anon, authenticated;

-- ---------------------------------------------------------------------
-- Operator: set or clear the banner.
-- ---------------------------------------------------------------------
create or replace function public.set_broadcast_banner(
  p_message text, p_link_url text, p_link_label text, p_is_active boolean
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_operator() then raise exception 'not authorised'; end if;
  update public.broadcast_banner set
    message = nullif(trim(p_message), ''),
    link_url = nullif(trim(p_link_url), ''),
    link_label = nullif(trim(p_link_label), ''),
    is_active = p_is_active,
    updated_at = now()
  where id = 1;
end; $$;

grant execute on function public.set_broadcast_banner(text, text, text, boolean) to authenticated;

create or replace function public.get_broadcast_banner_admin()
returns table (message text, link_url text, link_label text, is_active boolean, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select message, link_url, link_label, is_active, updated_at
  from public.broadcast_banner where id = 1;
$$;

grant execute on function public.get_broadcast_banner_admin() to authenticated;

-- =====================================================================
--  Done.
-- =====================================================================
