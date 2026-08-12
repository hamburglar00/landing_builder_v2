do $$
declare
  v_sql text;
begin
  select pg_get_functiondef('public.get_whatsapp_cloud_api_inbox_threads(integer)'::regprocedure)
  into v_sql;

  v_sql := replace(v_sql, 'then ''vip''', 'then ''premium''');

  execute v_sql;
end $$;

comment on function public.get_whatsapp_cloud_api_inbox_threads(integer) is
  'Devuelve threads preparados para el Inbox de WhatsApp Cloud API con mensajes, asignacion y tag derivado de conversions.';
