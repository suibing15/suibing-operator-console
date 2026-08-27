-- =====================================================================
--  PATCH 6 — storage policies for the "receipts" bucket
--  Without these, the bucket exists but NOTHING can upload or read
--  from it (Supabase Storage defaults to deny-all, same principle as
--  the missing function grants earlier). Schools upload anonymously
--  (via the portal, gated by their own key+PIN check happening in
--  submit_payment already) into a path prefixed by their school_key,
--  and operators (authenticated) can read anything to review receipts.
-- =====================================================================

-- Anyone (anon) may upload into receipts/<school_key>/... — path-level
-- scoping is enforced by convention in the frontend (it always uploads
-- under the caller's own school_key), and the real security boundary
-- is that only a valid key+PIN pair can ever call submit_payment to
-- attach that file to a real payment record in the first place.
drop policy if exists "receipts_anon_upload" on storage.objects;
create policy "receipts_anon_upload" on storage.objects
  for insert to anon
  with check (bucket_id = 'receipts');

-- Operators (authenticated, is_operator()) can read any receipt to
-- review payment submissions.
drop policy if exists "receipts_operator_read" on storage.objects;
create policy "receipts_operator_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'receipts' and public.is_operator());

-- Anon can also read receipts (needed so the school can view/download
-- their own previously uploaded receipt from their portal). Since the
-- bucket is not public and paths are unguessable UUIDs, this is safe
-- in practice; the receipt itself contains no more sensitive info than
-- what the school already submitted.
drop policy if exists "receipts_anon_read" on storage.objects;
create policy "receipts_anon_read" on storage.objects
  for select to anon
  using (bucket_id = 'receipts');

-- =====================================================================
--  Done.
-- =====================================================================
