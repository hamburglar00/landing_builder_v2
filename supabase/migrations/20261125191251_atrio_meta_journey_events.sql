alter table public.conversions_pixel_configs
  add column send_atrio_view_content boolean not null default false,
  add column send_atrio_initiate_checkout boolean not null default false;

create table public.atrio_meta_journey_events (
  event_id text primary key check (event_id ~ '^[a-f0-9]{64}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  landing_id uuid not null references public.landings(id) on delete cascade,
  pixel_id text not null,
  event_name text not null check (event_name in ('ViewContent','InitiateCheckout')),
  event_time bigint not null,
  delivery_status text not null default 'pending' check (delivery_status in ('pending','sent','failed')),
  http_status integer,
  events_received integer
);
create index atrio_meta_journey_events_owner on public.atrio_meta_journey_events(user_id,event_time desc);
alter table public.atrio_meta_journey_events enable row level security;
revoke all on public.atrio_meta_journey_events from public, anon, authenticated;
grant select,insert,update,delete on public.atrio_meta_journey_events to service_role;

create table public.meta_purchase_delivery_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  conversion_id uuid references public.conversions(id) on delete set null,
  landing_id uuid references public.landings(id) on delete set null,
  landing_label text,
  operation_reference text,
  event_id text not null,
  amount numeric,
  currency text,
  purchase_type text check (purchase_type in ('first','repeat')),
  status text not null check (status in ('sent','failed')),
  meta_response jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index meta_purchase_delivery_history_owner_idx on public.meta_purchase_delivery_history (user_id, created_at desc);
create index meta_purchase_delivery_history_event_idx on public.meta_purchase_delivery_history (user_id,event_id);
alter table public.meta_purchase_delivery_history enable row level security;
revoke all on public.meta_purchase_delivery_history from public, anon, authenticated;
grant select on public.meta_purchase_delivery_history to authenticated;
grant select,insert on public.meta_purchase_delivery_history to service_role;
create policy meta_purchase_delivery_history_read on public.meta_purchase_delivery_history for select to authenticated
  using ((select auth.uid()) = user_id);
