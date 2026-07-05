-- ============================================================
-- CB_11: Meal History
-- One row per distinct meal per subscription, updated (not
-- duplicated) each time the meal appears in a generated
-- shopping list. Meal identity — and therefore the dedup key —
-- differs by source_type:
--   - spoonacular / pinterest: meal_id is stable across re-adds,
--     so it is the dedup key.
--   - url_import: meal_id is a synthetic, one-time value
--     generated at add time (see BasketPage.jsx addImportedMeal)
--     and is NOT stable across re-adds of the same recipe, so
--     destination_url is the dedup key instead.
-- Two partial unique indexes enforce this (a single composite
-- constraint can't express an either/or key).
-- ============================================================

create table public.meal_history (
  id              uuid        default gen_random_uuid() primary key,
  subscription_id uuid        not null references public.subscriptions (id) on delete cascade,
  meal_id         text,
  source_type     text        not null default 'spoonacular',
  title           text        not null,
  image_url       text,
  destination_url text,
  last_made_at    timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

-- Spoonacular / Pinterest: one record per (subscription, meal_id)
create unique index meal_history_meal_id_key
  on public.meal_history (subscription_id, meal_id)
  where source_type <> 'url_import';

-- URL imports: one record per (subscription, destination_url)
create unique index meal_history_destination_url_key
  on public.meal_history (subscription_id, destination_url)
  where source_type = 'url_import';

-- Pagination reads most-recent-first via range queries
create index meal_history_recency_idx
  on public.meal_history (subscription_id, last_made_at desc);

alter table public.meal_history enable row level security;

create policy "meal_history_all_own"
  on public.meal_history for all
  using (
    subscription_id in (
      select subscription_id from public.profiles where id = auth.uid()
    )
  );
