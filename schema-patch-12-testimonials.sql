-- =====================================================================
--  PATCH 12 — testimonials (photos/videos of schools using our products)
--  Media files go to Supabase Storage this time (not base64-in-database,
--  which is fine for small PDFs/receipts but wrong for video). Applying
--  the lesson learned from the receipts bucket: the bucket AND its
--  storage policies are both created here, together, in one patch.
-- =====================================================================

create table if not exists public.testimonials (
  id             uuid primary key default gen_random_uuid(),
  school_name    text not null,
  quote          text,                        -- the testimonial text itself
  person_name    text,                        -- e.g. "Malam Ibrahim, Principal"
  media_type     text not null check (media_type in ('image','video_link')),
  media_path     text,                        -- Supabase Storage object path, for image type
  media_mimetype text,                        -- for image type
  video_url      text,                        -- external link (Google Drive, YouTube, etc.), for video_link type
  display_order  int not null default 0,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint testimonials_media_check check (
    (media_type = 'image' and media_path is not null) or
    (media_type = 'video_link' and video_url is not null)
  )
);

create index if not exists testimonials_active_order_idx on public.testimonials (is_active, display_order);

drop trigger if exists testimonials_touch on public.testimonials;
create trigger testimonials_touch before update on public.testimonials
  for each row execute function public.touch_updated_at();

alter table public.testimonials enable row level security;

drop policy if exists testimonials_operator_all on public.testimonials;
create policy testimonials_operator_all on public.testimonials
  for all to authenticated using (public.is_operator()) with check (public.is_operator());

-- ---------------------------------------------------------------------
-- Public: list active testimonials, in display order.
-- ---------------------------------------------------------------------
create or replace function public.list_active_testimonials()
returns table (
  id uuid, school_name text, quote text, person_name text,
  media_type text, media_path text, media_mimetype text, video_url text
) language sql stable security definer set search_path = public as $$
  select t.id, t.school_name, t.quote, t.person_name, t.media_type, t.media_path, t.media_mimetype, t.video_url
  from public.testimonials t
  where t.is_active = true
  order by t.display_order asc, t.created_at desc;
$$;

grant execute on function public.list_active_testimonials() to anon;

-- ---------------------------------------------------------------------
-- Storage bucket: testimonials-media. PUBLIC bucket (deliberately,
-- unlike receipts) — this content is meant to be shown openly on the
-- public homepage, so there is no reason to gate it behind signed URLs.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('testimonials-media', 'testimonials-media', true)
on conflict (id) do nothing;

-- Only operators (authenticated + is_operator()) may upload or delete.
drop policy if exists "testimonials_operator_upload" on storage.objects;
create policy "testimonials_operator_upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'testimonials-media' and public.is_operator());

drop policy if exists "testimonials_operator_delete" on storage.objects;
create policy "testimonials_operator_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'testimonials-media' and public.is_operator());

-- Anyone can read (the bucket is public, but an explicit SELECT policy
-- is still required for RLS-gated storage.objects reads to succeed).
drop policy if exists "testimonials_public_read" on storage.objects;
create policy "testimonials_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'testimonials-media');

-- =====================================================================
--  Done.
-- =====================================================================
