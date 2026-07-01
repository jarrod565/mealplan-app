-- Add URL import metadata columns to basket_items so imported recipes can be saved
alter table public.basket_items
  add column if not exists source_type text,
  add column if not exists destination_url text,
  add column if not exists title text,
  add column if not exists image_url text,
  add column if not exists source_domain text;
