-- =====================================================================
--  PATCH 13 — MFA backup/recovery codes
--  Supabase's native TOTP MFA has no built-in backup-code concept, so
--  we store our own: one-time codes, hashed (never plaintext), tied to
--  the signed-in operator, usable once each as an emergency fallback
--  if they lose their authenticator device.
-- =====================================================================

create table if not exists public.mfa_backup_codes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  code_hash   text not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists mfa_backup_codes_user_idx on public.mfa_backup_codes (user_id, used_at);

alter table public.mfa_backup_codes enable row level security;

-- A signed-in user may only ever see/manage their own backup codes.
drop policy if exists mfa_backup_codes_own on public.mfa_backup_codes;
create policy mfa_backup_codes_own on public.mfa_backup_codes
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Store a fresh batch of backup codes for the currently signed-in user.
-- Replaces any previous unused codes (so re-enrolling MFA invalidates
-- old backup codes rather than accumulating stale ones).
-- ---------------------------------------------------------------------
create or replace function public.store_mfa_backup_codes(p_codes text[])
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); c text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  delete from public.mfa_backup_codes where user_id = v_uid and used_at is null;
  foreach c in array p_codes loop
    insert into public.mfa_backup_codes (user_id, code_hash)
    values (v_uid, extensions.crypt(c, extensions.gen_salt('bf')));
  end loop;
end; $$;

grant execute on function public.store_mfa_backup_codes(text[]) to authenticated;

-- ---------------------------------------------------------------------
-- Redeem a backup code during login (called after password auth
-- succeeds, in place of a TOTP code). Marks the code used-once.
-- SECURITY DEFINER so it can check codes across the just-authenticated
-- session before full MFA verification completes.
-- ---------------------------------------------------------------------
create or replace function public.redeem_mfa_backup_code(p_user_id uuid, p_code text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select id into v_id from public.mfa_backup_codes
   where user_id = p_user_id and used_at is null
     and code_hash = extensions.crypt(trim(p_code), code_hash)
   limit 1;
  if v_id is null then return false; end if;
  update public.mfa_backup_codes set used_at = now() where id = v_id;
  return true;
end; $$;

grant execute on function public.redeem_mfa_backup_code(uuid, text) to anon, authenticated;

-- =====================================================================
--  Done.
-- =====================================================================
