do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'conversions'
      and column_name = 'send_contact_pixel'
  ) then
    alter table public.conversions
      rename column send_contact_pixel to "sendContactPixel";
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'conversions'
      and column_name = 'sendContactPixel'
  ) then
    comment on column public.conversions."sendContactPixel" is
      'Indica si la landing envio Contact via Pixel (true/false)';
  end if;
end
$$;

update public.conversions_config
set visible_columns = (
  select array_agg(case when x = 'send_contact_pixel' then 'sendContactPixel' else x end)
  from unnest(coalesce(visible_columns, array[]::text[])) as t(x)
)
where coalesce(visible_columns, array[]::text[]) @> array['send_contact_pixel'];

