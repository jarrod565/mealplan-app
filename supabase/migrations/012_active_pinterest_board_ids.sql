alter table public.subscriptions
  add column if not exists active_pinterest_board_ids text[] not null default '{}';
