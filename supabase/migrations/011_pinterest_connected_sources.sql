-- ============================================================
-- CB_09: Pinterest Connected Source support
--
-- Adds a generic `config` jsonb column for source-specific settings
-- that don't fit the Airtable-shaped flat columns (base_id, table_id,
-- column_mapping). Pinterest's only persisted setting is
-- `selected_board_ids` — an array of Pinterest board ids, per the
-- CB_09 policy that board names/counts/other metadata are never
-- stored: { selected_board_ids: string[] }.
--
-- Also replaces the Airtable-only uniqueness constraint with two
-- source-scoped indexes:
--   - Airtable: unique per (subscription, base_id, table_id), scoped
--     to source_type = 'airtable' — same protection as before, still
--     allows multiple base/table connections.
--   - Pinterest: unique per subscription, scoped to source_type =
--     'pinterest' — a subscription may hold at most one Pinterest
--     connection. The prior index didn't cover Pinterest at all
--     (base_id/table_id are null there, and Postgres treats nulls as
--     distinct in unique indexes), so nothing stopped duplicate
--     Pinterest rows before this migration.
-- ============================================================

alter table public.connected_sources
  add column if not exists config jsonb not null default '{}'::jsonb;

comment on column public.connected_sources.config is
  'Source-specific settings that do not fit the Airtable-shaped flat '
  'columns. Pinterest: { selected_board_ids: string[] }.';

drop index if exists connected_sources_base_table_key;

create unique index connected_sources_airtable_base_table_key
  on public.connected_sources (subscription_id, base_id, table_id)
  where source_type = 'airtable';

create unique index connected_sources_pinterest_key
  on public.connected_sources (subscription_id)
  where source_type = 'pinterest';
