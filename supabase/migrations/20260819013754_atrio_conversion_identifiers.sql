alter table public.conversions
  add column if not exists atrio_id text,
  add column if not exists atrio_client_id uuid,
  add column if not exists atrio_slug text,
  add column if not exists lead_atrio_id text,
  add column if not exists purchase_atrio_id text,
  add column if not exists registration_atrio_id text;

comment on column public.conversions.atrio_id is
  'Identificador unico del cliente en Atrio asociado al Contact del recorrido.';
comment on column public.conversions.atrio_client_id is
  'ID interno de atrio_clients usado por la landing al generar el Contact.';
comment on column public.conversions.atrio_slug is
  'Slug publico del webchat Atrio usado por la landing.';
comment on column public.conversions.lead_atrio_id is
  'Identificador Atrio informado por el evento LEAD entrante.';
comment on column public.conversions.purchase_atrio_id is
  'Identificador Atrio informado por el evento PURCHASE entrante.';
comment on column public.conversions.registration_atrio_id is
  'Identificador Atrio informado por el evento CompleteRegistration entrante.';

create index if not exists conversions_user_atrio_promo_idx
  on public.conversions (user_id, atrio_id, promo_code)
  where coalesce(atrio_id, '') <> ''
    and coalesce(promo_code, '') <> '';

create index if not exists conversions_user_atrio_phone_created_idx
  on public.conversions (user_id, atrio_id, phone, created_at desc)
  where coalesce(atrio_id, '') <> ''
    and coalesce(phone, '') <> '';

create index if not exists conversions_user_lead_atrio_phone_created_idx
  on public.conversions (user_id, lead_atrio_id, phone, created_at desc)
  where coalesce(lead_atrio_id, '') <> ''
    and coalesce(phone, '') <> '';

create index if not exists conversions_user_purchase_atrio_phone_created_idx
  on public.conversions (user_id, purchase_atrio_id, phone, created_at desc)
  where coalesce(purchase_atrio_id, '') <> ''
    and coalesce(phone, '') <> '';
