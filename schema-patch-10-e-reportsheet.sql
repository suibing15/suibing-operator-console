-- =====================================================================
--  PATCH 10 — add "E-Reportsheet" as a new showcase product
--  Additive only. Inserts one row into the existing products table.
-- =====================================================================

insert into public.products (slug, name, tagline, description, benefits, icon_emoji, color_hex, category, apply_link, apply_product_key, display_order)
values (
  'e_reportsheet',
  'E-Reportsheet',
  'Clean, combined report sheets — ready to print, no manual formatting.',
  'We register your students and set up their classes, then grant your teachers secure access to manually enter scores and upload their signatures. From there, a clean, combined report sheet is generated automatically — with correct positioning calculated for you — so it is ready to print with no extra work on your end.',
  'We handle student and class registration for you' || chr(10) ||
  'Teachers enter scores directly, with signature upload' || chr(10) ||
  'Positions (class rank) calculated automatically, no manual sorting' || chr(10) ||
  'One clean, combined report sheet per student, ready to print' || chr(10) ||
  'No spreadsheet formulas or formatting headaches for your staff',
  '📋', '#0e7490', 'service', '/apply', 'e_reportsheet',
  (select coalesce(max(display_order), 0) + 1 from public.products)
)
on conflict (slug) do nothing;

-- =====================================================================
--  Done.
-- =====================================================================
