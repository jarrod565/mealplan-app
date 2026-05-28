-- CB_01 extension: persist theme preference per subscription
alter table public.subscriptions
  add column theme_preference text not null default 'system'
    check (theme_preference in ('light', 'dark', 'system'));
