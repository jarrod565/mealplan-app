-- ============================================================
-- Airtable connection flow fixes: cached field schema so Remap
-- can pre-populate the mapping UI from Supabase alone, with no
-- Airtable API call until Save.
-- ============================================================

alter table public.connected_sources
  add column if not exists cached_fields jsonb;

comment on column public.connected_sources.cached_fields is
  'Airtable table field list ([{id, name, type}]) captured the last time the '
  'schema was fetched live. Lets Remap pre-populate column dropdowns from '
  'Supabase alone, without an Airtable API call.';
