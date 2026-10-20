-- Recorded at landing entry; NULL preserves unknown historical acquisition.
alter table public.conversions add column landing_resolution text
  constraint conversions_landing_resolution_check
  check (landing_resolution in ('url_parameter', 'path', 'automatic'));

comment on column public.conversions.landing_resolution is
  'Original landing selection: url_parameter, path or automatic; NULL when not captured.';

-- Extend the established projection and search without changing tenant scope or ACLs.
do $$
declare definition text; original text;
begin
  select pg_get_functiondef('public.get_conversion_report(jsonb)'::regprocedure) into original;
  if position('''landing'',''facebook''' in original) = 0
     or position('c.landing,c.facebook' in original) = 0 then
    raise exception 'Unexpected get_conversion_report definition';
  end if;
  definition := replace(original, '''landing'',''facebook''', '''landing'',''landing_resolution'',''facebook''');
  definition := replace(definition, 'c.landing,c.facebook', 'c.landing,c.landing_resolution,c.facebook');
  execute definition;

  select pg_get_functiondef('conversions_read.table_search(jsonb,text)'::regprocedure) into original;
  if position('''landing'',''facebook''' in original) = 0
     or position($needle$RETURN position(q in lower(coalesce(hay,'')))>0;$needle$ in original) = 0 then
    raise exception 'Unexpected table_search definition';
  end if;
  definition := replace(original, '''landing'',''facebook''', '''landing'',''landing_resolution'',''facebook''');
  definition := replace(definition,
    $needle$RETURN position(q in lower(coalesce(hay,'')))>0;$needle$,
    $replacement$RETURN position(q in lower(coalesce(hay,'') || ' ' || CASE r->>'landing_resolution'
      WHEN 'url_parameter' THEN 'Parámetro URL'
      WHEN 'path' THEN 'Ruta'
      WHEN 'automatic' THEN 'Automática'
      ELSE 'Sin dato' END))>0;$replacement$);
  execute definition;
end $$;

-- Follow the existing Landing visibility; do not enable hidden advertising columns.
update public.conversions_config
set visible_columns = array_append(visible_columns, 'landing_resolution')
where 'landing' = any(visible_columns) and not 'landing_resolution' = any(visible_columns);

notify pgrst, 'reload schema';
