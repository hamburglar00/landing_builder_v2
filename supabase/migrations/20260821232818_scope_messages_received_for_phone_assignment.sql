set statement_timeout = '10min';

do $$
declare
  v_ddl text;
  v_next text;
begin
  select pg_get_functiondef('public.get_phone_for_landing(text)'::regprocedure)
  into v_ddl;

  if v_ddl is null then
    raise exception 'Function public.get_phone_for_landing(text) was not found';
  end if;

  v_next := v_ddl;

  v_next := regexp_replace(
    v_next,
    'where c\.user_id = p\.owner_user_id[[:space:]]+and c\.lead_event_id <> ''''',
    'where c.user_id = p.owner_user_id
            and c.landing_id = v_landing_id
            and c.lead_event_id <> ''''',
    'g'
  );

  v_next := regexp_replace(
    v_next,
    'where c\.user_id = v_owner_user_id[[:space:]]+and c\.telefono_asignado = gp\.phone[[:space:]]+and c\.lead_event_id <> ''''',
    'where c.user_id = v_owner_user_id
            and c.landing_id = v_landing_id
            and c.telefono_asignado = gp.phone
            and c.lead_event_id <> ''''',
    'g'
  );

  execute v_next;
end $$;

do $$
declare
  v_ddl text;
  v_next text;
begin
  select pg_get_functiondef('public.get_phone_for_chatrace_client(text)'::regprocedure)
  into v_ddl;

  if v_ddl is null then
    raise exception 'Function public.get_phone_for_chatrace_client(text) was not found';
  end if;

  v_next := v_ddl;

  v_next := regexp_replace(
    v_next,
    'where c\.user_id = p\.owner_user_id[[:space:]]+and c\.lead_event_id <> ''''',
    'where c.user_id = p.owner_user_id
            and lower(coalesce(c.source_platform, '''')) = ''chatrace''
            and c.lead_event_id <> ''''',
    'g'
  );

  v_next := regexp_replace(
    v_next,
    'where c\.user_id = v_owner_user_id[[:space:]]+and c\.telefono_asignado = gp\.phone[[:space:]]+and c\.lead_event_id <> ''''',
    'where c.user_id = v_owner_user_id
            and lower(coalesce(c.source_platform, '''')) = ''chatrace''
            and c.telefono_asignado = gp.phone
            and c.lead_event_id <> ''''',
    'g'
  );

  execute v_next;
end $$;
