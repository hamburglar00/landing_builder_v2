-- Advertising origin belongs to the original journey. Unknown values remain NULL.
alter table public.conversions
  add column facebook text,
  add column portofolio text,
  add column cp text;

comment on column public.conversions.facebook is 'URL facebook value identifying the Facebook used for advertising.';
comment on column public.conversions.portofolio is 'URL portofolio value identifying the advertising portfolio.';
comment on column public.conversions.cp is 'URL cp value identifying the advertising account; stored as text to preserve IDs.';

-- Keep the established report, tenant scope and permissions; fail on unexpected drift.
do $$
declare definition text; original text;
begin
  select pg_get_functiondef('public.get_conversion_report(jsonb)'::regprocedure) into original;
  if position('''landing'',''campana''' in original) = 0
     or position('c.landing,c.campana' in original) = 0 then
    raise exception 'Unexpected get_conversion_report definition';
  end if;
  definition := replace(original, '''landing'',''campana''',
    '''landing'',''facebook'',''portofolio'',''cp'',''campana''');
  definition := replace(definition, 'c.landing,c.campana',
    'c.landing,c.facebook,c.portofolio,c.cp,c.campana');
  execute definition;

  select pg_get_functiondef('conversions_read.table_search(jsonb,text)'::regprocedure) into original;
  if position('''landing'',''campana''' in original) = 0 then
    raise exception 'Unexpected table_search definition';
  end if;
  definition := replace(original, '''landing'',''campana''',
    '''landing'',''facebook'',''portofolio'',''cp'',''campana''');
  if position('RETURN conversions_read.digits(r->>''phone'')=conversions_read.digits(q);' in definition) = 0 then
    raise exception 'Unexpected numeric table_search definition';
  end if;
  definition := replace(definition,
    'RETURN conversions_read.digits(r->>''phone'')=conversions_read.digits(q);',
    'RETURN conversions_read.digits(r->>''phone'')=conversions_read.digits(q)
      OR q=lower(conversions_read.trim(coalesce(r->>''facebook'','''')))
      OR q=lower(conversions_read.trim(coalesce(r->>''portofolio'','''')))
      OR q=lower(conversions_read.trim(coalesce(r->>''cp'','''')));');
  execute definition;
end $$;

-- Opt existing customized views into the three new fields, retaining their other choices.
-- The UI uses its canonical order: Landing, Facebook, Portofolio, Cuenta publicitaria, Campaña.
update public.conversions_config
set visible_columns = visible_columns || array(
  select key from unnest(array['facebook','portofolio','cp']) key
  where not key = any(visible_columns)
)
where coalesce(cardinality(visible_columns), 0) > 0;

notify pgrst, 'reload schema';
