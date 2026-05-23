-- Shopping list tables — persisted by CB_07; created here so CB_06 edge functions can reference them.

create table if not exists public.shopping_lists (
  id              uuid        primary key default gen_random_uuid(),
  subscription_id uuid        not null references public.subscriptions(id) on delete cascade,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.shopping_list_items (
  id               uuid        primary key default gen_random_uuid(),
  shopping_list_id uuid        not null references public.shopping_lists(id) on delete cascade,
  name             text        not null,
  quantity         numeric,
  unit             text,
  category         text        not null default 'Other',
  is_custom        boolean     not null default false,
  is_checked       boolean     not null default false,
  sort_order       integer     not null default 0,
  created_at       timestamptz not null default now()
);

alter table public.shopping_lists      enable row level security;
alter table public.shopping_list_items enable row level security;

create policy "Users access own shopping lists"
  on public.shopping_lists for all
  using (
    subscription_id = (
      select subscription_id from public.profiles where id = auth.uid()
    )
  );

create policy "Users access own shopping list items"
  on public.shopping_list_items for all
  using (
    shopping_list_id in (
      select id from public.shopping_lists
      where subscription_id = (
        select subscription_id from public.profiles where id = auth.uid()
      )
    )
  );

create trigger set_shopping_lists_updated_at
  before update on public.shopping_lists
  for each row execute procedure public.set_updated_at();
