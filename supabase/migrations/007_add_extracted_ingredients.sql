-- Add persisted extracted ingredients for URL-imported basket items
alter table public.basket_items
  add column if not exists extracted_ingredients jsonb,
  add column if not exists extracted_at timestamptz;

alter table public.basket_items enable row level security;

-- No policies needed beyond the existing basket_items policy; clients
-- that can update their subscription's basket already have access.
