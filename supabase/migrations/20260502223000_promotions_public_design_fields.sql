-- Extra editable copy fields for the public promotion landing.
alter table public.promotions
  add column if not exists ticker_text text not null default 'Sorteo exclusivo',
  add column if not exists prize_description text not null default 'en fichas de casino',
  add column if not exists participation_steps text[] not null default array[]::text[],
  add column if not exists cta_label text not null default 'Quiero participar';

update public.promotions
set
  ticker_text = coalesce(nullif(trim(ticker_text), ''), 'Sorteo exclusivo'),
  prize_description = coalesce(nullif(trim(prize_description), ''), 'en fichas de casino'),
  cta_label = coalesce(nullif(trim(cta_label), ''), 'Quiero participar'),
  participation_steps = coalesce(participation_steps, array[]::text[]);
