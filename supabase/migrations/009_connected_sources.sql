-- ============================================================
-- CB_09 / CB_12: Connected Sources framework + Airtable (v1)
--
-- connected_sources is deliberately source-agnostic (source_type
-- column, generic token/status fields) even though Airtable is the
-- only adapter being built right now — Pinterest and future sources
-- slot into the same table per the CB_09 adapter pattern, no schema
-- change required.
--
-- Token encryption: plain columns behind RLS, same protection model
-- as every other table in this schema (Supabase at-rest encryption +
-- RLS scoping to the owning subscription). No pgsodium/Vault for v1
-- — deliberate scope decision, not an oversight.
-- ============================================================

create table public.connected_sources (
  id               uuid        default gen_random_uuid() primary key,
  subscription_id  uuid        not null references public.subscriptions (id) on delete cascade,
  source_type      text        not null default 'airtable',
  access_token     text,
  refresh_token    text,
  token_expiry     timestamptz,
  status           text        not null default 'connected'
                                check (status in ('connected', 'reconnect_required')),
  base_id          text,
  base_name        text,
  table_id         text,
  table_name       text,
  column_mapping   jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- CB_12 edge case: "User connects the same Airtable base/table
-- combination twice — Dinder detects the duplicate and prevents it"
create unique index connected_sources_base_table_key
  on public.connected_sources (subscription_id, source_type, base_id, table_id);

alter table public.connected_sources enable row level security;

create policy "connected_sources_all_own"
  on public.connected_sources for all
  using (
    subscription_id in (
      select subscription_id from public.profiles where id = auth.uid()
    )
  );

create trigger connected_sources_set_updated_at
  before update on public.connected_sources
  for each row execute procedure public.set_updated_at();

-- Filter drawer selections — "on the subscription record" per CB_12,
-- array of connected_sources.id values currently toggled active.
alter table public.subscriptions
  add column if not exists active_connected_source_ids jsonb not null default '[]'::jsonb;
