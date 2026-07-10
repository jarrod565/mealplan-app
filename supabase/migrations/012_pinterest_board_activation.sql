-- ============================================================
-- CB_09: Pinterest board-level activation
--
-- The For You filter drawer now shows one toggle per Pinterest board
-- instead of one per connection — a subscription holds at most one
-- Pinterest connected_sources row (connected_sources_pinterest_key,
-- migration 011) but that row can have many selected boards, so
-- connection-level active/inactive tracking isn't granular enough.
--
-- Mirrors active_connected_source_ids (migration 009) exactly: a flat
-- jsonb array on the subscription record, read/written the same way
-- via updateSubscription, just scoped to Pinterest board ids instead
-- of connected_sources row ids. A Pinterest connection with none of
-- its selected boards present here is treated as fully inactive.
-- ============================================================

alter table public.subscriptions
  add column if not exists active_pinterest_board_ids jsonb not null default '[]'::jsonb;

comment on column public.subscriptions.active_pinterest_board_ids is
  'Pinterest board ids currently toggled on in the For You filter drawer. '
  'Board-level equivalent of active_connected_source_ids — a board with no '
  'entry here is inactive, and a Pinterest connection with none of its '
  'selected boards active is treated as fully inactive (no cards fetched).';
