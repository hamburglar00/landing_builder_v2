create or replace function public.set_conversions_from_meta_ads()
returns trigger
language plpgsql
as $function$
begin
  new.from_meta_ads := (
    coalesce(new.fbc, '') <> ''
    or coalesce(new.utm_campaign, '') <> ''
    or (
      lower(btrim(coalesce(new.source_platform, ''))) in (
        'chatrace',
        'whatsapp_cloud_api'
      )
      and btrim(coalesce(new.ctwa_clid, '')) <> ''
      and btrim(coalesce(new.ctwa_clid, '')) !~ '^\{\{.*\}\}$'
    )
    or (
      lower(btrim(coalesce(new.source_platform, ''))) = 'chatrace'
      and coalesce(new.promo_code, '') ~ '^[A-Za-z0-9]+-[A-Za-z0-9]+$'
    )
  );
  return new;
end;
$function$;

update public.conversions
set from_meta_ads = from_meta_ads
where lower(btrim(coalesce(source_platform, ''))) in (
    'chatrace',
    'whatsapp_cloud_api'
  )
  and btrim(coalesce(ctwa_clid, '')) <> ''
  and btrim(coalesce(ctwa_clid, '')) !~ '^\{\{.*\}\}$';
