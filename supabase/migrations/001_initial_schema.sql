-- ============================================================
-- CB_01: Authentication & Subscription
-- ============================================================

-- Subscriptions: one row per household. All subscription-level
-- data (dietary prefs, basket, favorites, hidden, shopping list)
-- references this table via subscription_id.
create table public.subscriptions (
  id                   uuid        default gen_random_uuid() primary key,
  stripe_customer_id   text        unique,
  subscription_tier    text        not null default 'free'
                                   check (subscription_tier in ('free', 'premium')),
  default_serving_size integer     not null default 2,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Profiles: one row per auth.users row, links a Supabase auth
-- identity to a household subscription.
create table public.profiles (
  id               uuid        references auth.users (id) on delete cascade primary key,
  subscription_id  uuid        references public.subscriptions (id) on delete set null,
  created_at       timestamptz not null default now(),
  last_sign_in_at  timestamptz
);

-- ── Row Level Security ────────────────────────────────────────

alter table public.subscriptions enable row level security;
alter table public.profiles      enable row level security;

-- Profiles: authenticated user can read/update their own row
create policy "profiles_select_own"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid());

-- Subscriptions: authenticated user can read/update the
-- subscription belonging to their profile
create policy "subscriptions_select_own"
  on public.subscriptions for select
  using (
    id in (
      select subscription_id from public.profiles where id = auth.uid()
    )
  );

create policy "subscriptions_update_own"
  on public.subscriptions for update
  using (
    id in (
      select subscription_id from public.profiles where id = auth.uid()
    )
  );

-- ── Triggers ─────────────────────────────────────────────────

-- Auto-create a subscription + profile when a new user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  new_subscription_id uuid;
begin
  insert into public.subscriptions (subscription_tier, default_serving_size)
  values ('free', 2)
  returning id into new_subscription_id;

  insert into public.profiles (id, subscription_id, last_sign_in_at)
  values (new.id, new_subscription_id, now());

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Auto-update subscriptions.updated_at on any update
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute procedure public.set_updated_at();
