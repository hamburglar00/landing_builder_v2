do $$
declare
  v_function text;
  v_updated text;
begin
  select pg_get_functiondef('public.get_whatsapp_cloud_api_inbox_threads_page(integer, integer, text)'::regprocedure)
    into v_function;

  v_updated := replace(
    v_function,
    $needle$
     and c.external_id = lc.external_id
     and coalesce(c.test_event_code, '') = ''
$needle$,
    $replacement$
     and c.external_id = lc.external_id
     and c.external_id <> ''
     and coalesce(c.test_event_code, '') = ''
$replacement$
  );

  v_updated := replace(
    v_updated,
    $needle$
    from limited_contacts lc
    join latest_assignment la on la.contact_id = lc.id
    join public.conversions c
      on c.user_id = lc.user_id
     and coalesce(c.currency, 'ARS') = lc.workspace_currency
     and la.promo_code <> ''
     and c.promo_code = la.promo_code
     and coalesce(c.test_event_code, '') = ''
$needle$,
    $replacement$
    from latest_assignment la
    join limited_contacts lc on lc.id = la.contact_id
    join lateral (
      select c.*
      from public.conversions c
      where c.user_id = lc.user_id
        and coalesce(c.currency, 'ARS') = lc.workspace_currency
        and c.promo_code = la.promo_code
        and c.promo_code <> ''
        and coalesce(c.test_event_code, '') = ''
    ) c on la.promo_code <> ''
$replacement$
  );

  if v_updated = v_function then
    raise exception 'Inbox RPC was not updated by migration 20260821235712';
  end if;

  execute v_updated;

  select pg_get_functiondef('public.get_whatsapp_cloud_api_contacts_page(integer, integer, text)'::regprocedure)
    into v_function;

  v_updated := replace(
    v_function,
    $needle$
     and c.external_id = pc.external_id
     and coalesce(c.test_event_code, '') = ''
$needle$,
    $replacement$
     and c.external_id = pc.external_id
     and c.external_id <> ''
     and coalesce(c.test_event_code, '') = ''
$replacement$
  );

  v_updated := replace(
    v_updated,
    $needle$
    from paged_contacts pc
    join latest_assignment la on la.contact_id = pc.id
    join public.conversions c
      on c.user_id = pc.user_id
     and coalesce(c.currency, 'ARS') = pc.workspace_currency
     and la.promo_code <> ''
     and c.promo_code = la.promo_code
     and coalesce(c.test_event_code, '') = ''
$needle$,
    $replacement$
    from latest_assignment la
    join paged_contacts pc on pc.id = la.contact_id
    join lateral (
      select c.*
      from public.conversions c
      where c.user_id = pc.user_id
        and coalesce(c.currency, 'ARS') = pc.workspace_currency
        and c.promo_code = la.promo_code
        and c.promo_code <> ''
        and coalesce(c.test_event_code, '') = ''
    ) c on la.promo_code <> ''
$replacement$
  );

  if v_updated = v_function then
    raise exception 'Contacts RPC was not updated by migration 20260821235712';
  end if;

  execute v_updated;
end;
$$;

comment on function public.get_whatsapp_cloud_api_inbox_threads_page(integer, integer, text) is
  'Devuelve una pagina de threads del Inbox de WhatsApp Cloud API. Optimizada para leer mensajes y conversiones solo de la pagina solicitada.';

comment on function public.get_whatsapp_cloud_api_contacts_page(integer, integer, text) is
  'Devuelve contactos de WhatsApp Cloud API paginados con estado comercial derivado. Optimizada para conversiones indexables.';
