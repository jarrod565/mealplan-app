-- ============================================================
-- CB_13: Grocery Lists (saved staples per store, pulled into the
-- current week's shopping list)
--
-- grocery_lists / grocery_list_items are a persistent layer, separate
-- from shopping_lists / shopping_list_items (CB_07), which stay fully
-- ephemeral and are wiped + recreated on every generateShoppingList()
-- call — pulling a saved list does not change that; pulled items are
-- lost on the next regenerate, same as any other item on the current
-- list (decision confirmed 2026-07-16, not covered by the brief).
-- ============================================================

create table public.grocery_lists (
  id              uuid        primary key default gen_random_uuid(),
  subscription_id uuid        not null references public.subscriptions(id) on delete cascade,
  name            text        not null,
  sort_order      integer     not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index grocery_lists_subscription_name_key
  on public.grocery_lists (subscription_id, lower(name));

create table public.grocery_list_items (
  id              uuid        primary key default gen_random_uuid(),
  grocery_list_id uuid        not null references public.grocery_lists(id) on delete cascade,
  name            text        not null,
  quantity        text,
  created_at      timestamptz not null default now()
);

alter table public.grocery_lists      enable row level security;
alter table public.grocery_list_items enable row level security;

create policy "grocery_lists_all_own"
  on public.grocery_lists for all
  using (
    subscription_id in (
      select subscription_id from public.profiles where id = auth.uid()
    )
  );

create policy "grocery_list_items_all_own"
  on public.grocery_list_items for all
  using (
    grocery_list_id in (
      select id from public.grocery_lists
      where subscription_id in (
        select subscription_id from public.profiles where id = auth.uid()
      )
    )
  );

create trigger grocery_lists_set_updated_at
  before update on public.grocery_lists
  for each row execute procedure public.set_updated_at();

-- Origin tag for items pulled from a saved list onto the current
-- shopping list ("from Aldi" badge per CB_13). Nullable — items
-- generated from recipe ingredients or added manually have no origin.
alter table public.shopping_list_items
  add column if not exists source_list_name text;
