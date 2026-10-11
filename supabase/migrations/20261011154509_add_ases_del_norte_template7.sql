do $$
declare
  v_definition text;
  v_before text := 'v_provider not in (''rey_de_ases'', ''multi_skin'')';
  v_after text := 'v_provider not in (''rey_de_ases'', ''multi_skin'', ''ases_del_norte'')';
begin
  select pg_get_functiondef(
    'public.resolve_template7_start_context(uuid,text,uuid,text,text,text,text,text)'::regprocedure
  ) into v_definition;
  if position(v_before in v_definition) = 0 then
    raise exception 'resolve_template7_start_context provider validation was not found';
  end if;
  execute replace(v_definition, v_before, v_after);
end;
$$;
