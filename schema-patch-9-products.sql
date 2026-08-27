-- =====================================================================
--  PATCH 9 — products table (console-managed showcase content)
--  Fully additive. Lets the operator add/edit/reorder/toggle products
--  shown on the public showcase page, with zero code changes needed.
-- =====================================================================

create table if not exists public.products (
  id             uuid primary key default gen_random_uuid(),
  slug           text unique not null,       -- url-safe key, e.g. "bucket", "ssms"
  name           text not null,               -- e.g. "SUIBING Bucket"
  tagline        text,                        -- short one-liner
  description    text,                        -- longer paragraph
  benefits       text,                        -- rich-ish text; frontend renders line breaks as bullets
  icon_emoji     text default '📦',           -- simple emoji icon, no image upload needed
  color_hex      text default '#1B2A4A',      -- accent colour for the card
  category       text default 'product',      -- e.g. 'product', 'service'
  apply_link     text default '/apply',       -- where clicking "Learn more / Apply" goes
  apply_product_key text,                     -- optional: pre-fills the /apply form's product dropdown
  display_order  int not null default 0,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists products_active_order_idx on public.products (is_active, display_order);

drop trigger if exists products_touch on public.products;
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();

alter table public.products enable row level security;

drop policy if exists products_operator_all on public.products;
create policy products_operator_all on public.products
  for all to authenticated using (public.is_operator()) with check (public.is_operator());

-- ---------------------------------------------------------------------
-- Public: list only active products, in display order. No auth needed
-- — this is what the showcase page reads.
-- ---------------------------------------------------------------------
create or replace function public.list_active_products()
returns table (
  slug text, name text, tagline text, description text, benefits text,
  icon_emoji text, color_hex text, category text, apply_link text, apply_product_key text
) language sql stable security definer set search_path = public as $$
  select p.slug, p.name, p.tagline, p.description, p.benefits,
         p.icon_emoji, p.color_hex, p.category, p.apply_link, p.apply_product_key
  from public.products p
  where p.is_active = true
  order by p.display_order asc, p.name asc;
$$;

grant execute on function public.list_active_products() to anon;

-- ---------------------------------------------------------------------
-- Seed the five products already known from company profile, so the
-- showcase isn't empty on first load. Operator can edit/reorder/
-- deactivate any of these afterward — this is a starting point only.
-- ---------------------------------------------------------------------
insert into public.products (slug, name, tagline, description, benefits, icon_emoji, color_hex, category, apply_link, apply_product_key, display_order)
values
  ('bucket', 'SUIBING Bucket', 'School records, safe in one place.',
   'A browser-based platform for managing student records, results, and reporting — no installation required, accessible from any device with a web browser.',
   'Passwordless magic-link login for staff' || chr(10) ||
   'Each school''s data fully isolated and secure' || chr(10) ||
   'Generate professional report sheets in minutes' || chr(10) ||
   'Export your data any time, on your terms',
   '🗂️', '#1B2A4A', 'product', '/apply', 'bucket', 1),

  ('ssms', 'Suibing School Management Software (SSMS)', 'Complete school administration, plus computer-based testing.',
   'A full school management system covering student and teacher records, class and subject management, attendance, and a built-in CBT engine for digital examinations — with a dedicated parent portal.',
   'Run examinations digitally with automatic marking' || chr(10) ||
   'Parents track their child''s progress in real time' || chr(10) ||
   'Automatic, error-free report sheet generation' || chr(10) ||
   'Already powering a live school today',
   '🏫', '#2E4372', 'product', '/apply', 'ssms', 2),

  ('e_examiner', 'E-Examiner Contract', 'Outsource your entire examination process to us.',
   'Send us your objective questions, and we handle setup, student registration, computer-based delivery, marking, and report generation — end to end.',
   'No CBT infrastructure needed on your side' || chr(10) ||
   'Professional, error-free marking and reporting' || chr(10) ||
   'Frees your staff to focus on teaching' || chr(10) ||
   'Recommended alongside pen-and-paper CA for balanced learning',
   '📝', '#0f7a3d', 'service', '/apply', 'e_examiner', 3),

  ('ledger', 'SuibingLedger', 'Fees, admissions, and report sheets, securely managed.',
   'Handles report sheet generation, registration and fee payment recording, student admission, and teacher-to-class assignment, with strict access control down to the classroom level.',
   'Teachers only see their own assigned classes' || chr(10) ||
   'Track fee payments and admissions in one place' || chr(10) ||
   'Security-first design protects student data' || chr(10) ||
   'Built specifically for how Nigerian schools operate',
   '📒', '#b7791f', 'product', '/apply', 'ledger', 4),

  ('tracker', 'Tracker', 'Simple daily expense tracking, for individuals.',
   'A personal finance companion for tracking your daily spending — built for individuals who want a clear picture of where their money goes, without the complexity of full accounting software.',
   'Log expenses in seconds, from your phone' || chr(10) ||
   'See spending patterns at a glance' || chr(10) ||
   'No institutional setup required — just for you' || chr(10) ||
   'Free your budget from guesswork',
   '💰', '#c0392b', 'product', '/apply', 'tracker', 5)
on conflict (slug) do nothing;

-- =====================================================================
--  Done.
-- =====================================================================
