-- ============================================================
-- CB_02: Dietary Preferences
-- ============================================================

-- Add dietary_restrictions array to the subscriptions table.
-- Empty array = no restrictions (full catalog shown).
alter table public.subscriptions
  add column dietary_restrictions text[] not null default '{}';
