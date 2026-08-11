-- Classify gerencia phones by assignment eligibility.
-- acquisition: can be selected by public CTA/landing assignment.
-- follow_up: "WhatsApp de venta"; active for tracking, excluded from assignment.

set statement_timeout = '10min';

alter table public.gerencia_phones
  add column if not exists assignment_role text;

update public.gerencia_phones
set assignment_role = 'acquisition'
where assignment_role is null
   or assignment_role not in ('acquisition', 'follow_up');

alter table public.gerencia_phones
  alter column assignment_role set default 'acquisition',
  alter column assignment_role set not null;

do $$
begin
  alter table public.gerencia_phones
    add constraint gerencia_phones_assignment_role_check
    check (assignment_role in ('acquisition', 'follow_up'));
exception
  when duplicate_object then
    null;
end $$;

comment on column public.gerencia_phones.assignment_role is
  'acquisition: eligible for automatic CTA assignment. follow_up: WhatsApp de venta, active for tracking but excluded from assignment.';

create index if not exists gerencia_phones_assignment_acquisition_idx
  on public.gerencia_phones (gerencia_id, kind, phone, messages_reset_at)
  where status = 'active'
    and assignment_role = 'acquisition';

comment on index public.gerencia_phones_assignment_acquisition_idx is
  'Supports public phone assignment while excluding follow-up/sales WhatsApps.';

do $$
declare
  v_signature regprocedure;
  v_ddl text;
  v_next text;
  v_replacements int;
  v_signatures regprocedure[] := array[
    'public.get_phone_for_landing(text)'::regprocedure,
    'public.get_phone_for_chatrace_client(text)'::regprocedure,
    'public.get_phone_for_whatsapp_cloud_api(uuid)'::regprocedure
  ];
begin
  foreach v_signature in array v_signatures loop
    select pg_get_functiondef(v_signature) into v_ddl;

    if v_ddl is null then
      raise exception 'Function % was not found', v_signature;
    end if;

    if position('assignment_role' in v_ddl) > 0 then
      continue;
    end if;

    v_next := v_ddl;
    v_replacements := 0;

    if v_next <> regexp_replace(
        v_next,
        'and[[:space:]]+gp\.kind[[:space:]]*=[[:space:]]*p\.phone_kind[[:space:]]+and[[:space:]]+gp\.phone[[:space:]]*=[[:space:]]*c\.telefono_asignado',
        'and gp.kind = p.phone_kind
                and gp.assignment_role = ''acquisition''
                and gp.phone = c.telefono_asignado',
        'g'
      ) then
      v_next := regexp_replace(
        v_next,
        'and[[:space:]]+gp\.kind[[:space:]]*=[[:space:]]*p\.phone_kind[[:space:]]+and[[:space:]]+gp\.phone[[:space:]]*=[[:space:]]*c\.telefono_asignado',
        'and gp.kind = p.phone_kind
                and gp.assignment_role = ''acquisition''
                and gp.phone = c.telefono_asignado',
        'g'
      );
      v_replacements := v_replacements + 1;
    end if;

    if v_next <> regexp_replace(
        v_next,
        'where[[:space:]]+gp\.gerencia_id[[:space:]]*=[[:space:]]*p\.gerencia_id[[:space:]]+and[[:space:]]+gp\.kind[[:space:]]*=[[:space:]]*p\.phone_kind',
        'where gp.gerencia_id = p.gerencia_id
            and gp.kind = p.phone_kind
            and gp.assignment_role = ''acquisition''',
        'g'
      ) then
      v_next := regexp_replace(
        v_next,
        'where[[:space:]]+gp\.gerencia_id[[:space:]]*=[[:space:]]*p\.gerencia_id[[:space:]]+and[[:space:]]+gp\.kind[[:space:]]*=[[:space:]]*p\.phone_kind',
        'where gp.gerencia_id = p.gerencia_id
            and gp.kind = p.phone_kind
            and gp.assignment_role = ''acquisition''',
        'g'
      );
      v_replacements := v_replacements + 1;
    end if;

    if v_next <> regexp_replace(
        v_next,
        'where[[:space:]]+gp\.gerencia_id[[:space:]]*=[[:space:]]*v_gerencia_id[[:space:]]+and[[:space:]]+gp\.status[[:space:]]*=[[:space:]]*''active''[[:space:]]+and[[:space:]]+gp\.kind[[:space:]]*=[[:space:]]*v_phone_kind',
        'where gp.gerencia_id = v_gerencia_id
          and gp.status = ''active''
          and gp.kind = v_phone_kind
          and gp.assignment_role = ''acquisition''',
        'g'
      ) then
      v_next := regexp_replace(
        v_next,
        'where[[:space:]]+gp\.gerencia_id[[:space:]]*=[[:space:]]*v_gerencia_id[[:space:]]+and[[:space:]]+gp\.status[[:space:]]*=[[:space:]]*''active''[[:space:]]+and[[:space:]]+gp\.kind[[:space:]]*=[[:space:]]*v_phone_kind',
        'where gp.gerencia_id = v_gerencia_id
          and gp.status = ''active''
          and gp.kind = v_phone_kind
          and gp.assignment_role = ''acquisition''',
        'g'
      );
      v_replacements := v_replacements + 1;
    end if;

    if v_replacements <> 3 then
      raise exception 'Unexpected function shape for %. Applied % replacement groups.', v_signature, v_replacements;
    end if;

    execute v_next;
  end loop;
end $$;

create or replace function public.invalidate_landing_phone_cache_for_assignment_role()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.assignment_role is not distinct from new.assignment_role then
    return new;
  end if;

  delete from public.landing_phone_cache cache
  using public.landings_gerencias lg
  where lg.landing_id = cache.landing_id
    and lg.gerencia_id = new.gerencia_id;

  return new;
end;
$$;

comment on function public.invalidate_landing_phone_cache_for_assignment_role() is
  'Invalidates constructor CTA phone cache when a phone changes between Captacion and WhatsApp de venta.';

drop trigger if exists gerencia_phones_assignment_role_cache_invalidation on public.gerencia_phones;
create trigger gerencia_phones_assignment_role_cache_invalidation
after update of assignment_role on public.gerencia_phones
for each row
execute function public.invalidate_landing_phone_cache_for_assignment_role();
