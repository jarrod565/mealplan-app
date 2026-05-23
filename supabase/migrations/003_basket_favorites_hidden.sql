-- ============================================================
-- CB_03 / CB_04 / CB_05: Basket, Favorites, Hidden
-- All three tables reference subscription_id (not user_id) per
-- the shared-account model established in CB_01.
-- ============================================================

-- ── Basket ───────────────────────────────────────────────────
-- One row per meal per subscription. Persists across sessions
-- until the user removes meals or generates a shopping list.

create table public.basket_items (
  id              uuid        default gen_random_uuid() primary key,
  subscription_id uuid        not null references public.subscriptions (id) on delete cascade,
  meal_id         text        not null,
  name            text        not null,
  photo_url       text,
  prep_time       integer,
  servings        integer,
  difficulty      text,
  added_at        timestamptz not null default now(),
  unique (subscription_id, meal_id)
);

alter table public.basket_items enable row level security;

create policy "basket_items_all_own"
  on public.basket_items for all
  using (
    subscription_id in (
      select subscription_id from public.profiles where id = auth.uid()
    )
  );

-- ── Favorites ────────────────────────────────────────────────
-- Star-saved meals. Independent of basket and swipe outcomes.
-- CB_04 builds the dedicated screen on top of this table.

create table public.favorites (
  id              uuid        default gen_random_uuid() primary key,
  subscription_id uuid        not null references public.subscriptions (id) on delete cascade,
  meal_id         text        not null,
  name            text        not null,
  photo_url       text,
  prep_time       integer,
  favorited_at    timestamptz not null default now(),
  unique (subscription_id, meal_id)
);

alter table public.favorites enable row level security;

create policy "favorites_all_own"
  on public.favorites for all
  using (
    subscription_id in (
      select subscription_id from public.profiles where id = auth.uid()
    )
  );

-- ── Hidden (Never Pile) ───────────────────────────────────────
-- Permanently dismissed meals. Excluded from swipe deck at
-- session start. Dismissal reason stored for future AI use.
-- CB_05 builds the dedicated screen on top of this table.

create table public.hidden_meals (
  id              uuid        default gen_random_uuid() primary key,
  subscription_id uuid        not null references public.subscriptions (id) on delete cascade,
  meal_id         text        not null,
  meal_name       text        not null,
  photo_url       text,
  dismissed_at    timestamptz not null default now(),
  reason          text,
  unique (subscription_id, meal_id)
);

alter table public.hidden_meals enable row level security;

create policy "hidden_meals_all_own"
  on public.hidden_meals for all
  using (
    subscription_id in (
      select subscription_id from public.profiles where id = auth.uid()
    )
  );
