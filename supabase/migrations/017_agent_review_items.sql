-- ============================================================
-- CB_17: Aldi Cart Agent — Needs Review list
--
-- The only piece of CB_17 that touches Supabase. The agent prompt itself
-- is never persisted (deterministic function of the current shopping
-- list, regenerated fresh each time) and the agent's run/matches are
-- never visible to Dinder — v1 has no return channel from Claude in
-- Chrome, so rows here are entered manually by the user after reading
-- the agent's report in its own chat.
-- ============================================================

create table public.agent_review_items (
  id              uuid        primary key default gen_random_uuid(),
  subscription_id uuid        not null references public.subscriptions(id) on delete cascade,
  item_name       text        not null,
  quantity        text,
  status          text        not null default 'pending'
                              check (status in ('pending', 'meijer', 'skipped')),
  created_at      timestamptz not null default now()
);

alter table public.agent_review_items enable row level security;

create policy "agent_review_items_all_own"
  on public.agent_review_items for all
  using (
    subscription_id in (
      select subscription_id from public.profiles where id = auth.uid()
    )
  );
