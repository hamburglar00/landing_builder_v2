-- Add explicit purchase type for purchase classification in stats.
alter table public.conversions
add column if not exists purchase_type text;

-- Backfill repeat purchases first.
update public.conversions
set purchase_type = 'repeat'
where coalesce(purchase_event_id, '') <> ''
  and (
    coalesce(observaciones, '') ilike '%REPEAT%'
  );

-- Backfill remaining purchase events as first purchase.
update public.conversions
set purchase_type = 'first'
where coalesce(purchase_event_id, '') <> ''
  and coalesce(purchase_type, '') = '';

-- Keep constrained values while allowing null for non-purchase rows.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'conversions_purchase_type_check'
  ) then
    alter table public.conversions
    add constraint conversions_purchase_type_check
    check (purchase_type is null or purchase_type in ('first', 'repeat'));
  end if;
end $$;

create index if not exists idx_conversions_user_purchase_type
  on public.conversions (user_id, purchase_type);
