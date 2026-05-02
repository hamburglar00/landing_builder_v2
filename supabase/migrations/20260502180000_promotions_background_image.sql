-- Optional public background image for promotion landing.

alter table public.promotions
  add column if not exists background_image_url text not null default '';
