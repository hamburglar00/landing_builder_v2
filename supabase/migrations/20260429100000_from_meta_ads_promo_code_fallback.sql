create or replace function public.set_conversions_from_meta_ads()
returns trigger
language plpgsql
as $$
begin
  new.from_meta_ads := (
    coalesce(new.fbc, '') <> ''
    or coalesce(new.promo_code, '') ~ '^[A-Za-z0-9]+-[A-Za-z0-9]+$'
  );
  return new;
end;
$$;

comment on column public.conversions.from_meta_ads is
  'True cuando la conversion trae fbc, o como fallback cuando promo_code tiene formato valido TAG-SUFIX.';

update public.conversions
set from_meta_ads = (
  coalesce(fbc, '') <> ''
  or coalesce(promo_code, '') ~ '^[A-Za-z0-9]+-[A-Za-z0-9]+$'
);
