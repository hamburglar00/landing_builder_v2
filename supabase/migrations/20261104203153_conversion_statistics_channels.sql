-- Snapshot the receiving channel at the time of a visit. Do not backfill history
-- from a landing's current destination: the owner may have changed it since then.
alter table public.conversion_journey_starts
  add column if not exists journey_destination text
  check (journey_destination in ('whatsapp', 'atrio'));

create or replace function public.capture_journey_destination()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_destination text;
begin
  if new.source_platform = 'whatsapp_cloud_api' then
    new.journey_destination := 'whatsapp';
  elsif new.source_platform = 'landing' then
    select coalesce(l.config->>'ctaDestination', l.config->'templateConfigs'->coalesce(l.config->>'template', 'template1')->>'ctaDestination', 'whatsapp')
      into v_destination
      from public.landings l
      where l.id = new.landing_id and l.user_id = new.user_id;
    new.journey_destination := case when v_destination in ('whatsapp', 'atrio') then v_destination else null end;
  else
    new.journey_destination := null;
  end if;
  return new;
end;
$$;
revoke all on function public.capture_journey_destination() from public, anon, authenticated;
create trigger capture_journey_destination
before insert on public.conversion_journey_starts
for each row execute function public.capture_journey_destination();
comment on column public.conversion_journey_starts.journey_destination is
  'Receiving channel captured on insertion. Null for unclassified historical visits; independent of source_platform.';

-- Date filters query milestones attached after the original insertion as well.
create index if not exists conversions_stats_contact_time_idx on public.conversions (contact_event_time, user_id);
create index if not exists conversions_stats_lead_time_idx on public.conversions (lead_event_time, user_id);
create index if not exists conversions_stats_registration_time_idx on public.conversions (registration_event_time, user_id);
create index if not exists conversions_stats_purchase_time_idx on public.conversions (purchase_event_time, user_id);

-- Successful Atrio registrations are distinct from a CTA's chosen Meta event.
create table public.conversion_account_registrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  landing_id uuid not null references public.landings(id) on delete cascade,
  promo_code text not null check (length(promo_code) between 1 and 128),
  provider_account_id uuid not null,
  agency_id integer,
  created_at timestamptz not null default now(),
  unique (user_id, provider_account_id)
);
create index conversion_account_registrations_lookup_idx
  on public.conversion_account_registrations (user_id, landing_id, promo_code);
create index conversion_account_registrations_landing_idx
  on public.conversion_account_registrations (landing_id);
alter table public.conversion_account_registrations enable row level security;
revoke all on public.conversion_account_registrations from public, anon, authenticated;
grant select on public.conversion_account_registrations to authenticated;
grant all on public.conversion_account_registrations to service_role;
create policy conversion_account_registrations_owner_read on public.conversion_account_registrations
  for select to authenticated using ((select auth.uid()) = user_id);
create policy conversion_account_registrations_admin_read on public.conversion_account_registrations
  for select to authenticated using (exists(select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
comment on table public.conversion_account_registrations is
  'Internal confirmed new-account outcomes from the validated server entry. No credentials, no Meta events, no historical inference.';
