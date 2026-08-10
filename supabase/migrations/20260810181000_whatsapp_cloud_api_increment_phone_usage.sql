-- Increment phone usage for WhatsApp Cloud API assignments.
-- This is the Cloud API equivalent of a public landing CTA click.

create or replace function public.increment_gerencia_phone_usage(p_phone_id bigint)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.gerencia_phones
  set usage_count = coalesce(usage_count, 0) + 1
  where id = p_phone_id;
$$;

comment on function public.increment_gerencia_phone_usage(bigint) is
  'Incrementa usage_count de gerencia_phones de forma atomica para asignaciones server-side.';

revoke all on function public.increment_gerencia_phone_usage(bigint) from public, anon, authenticated;
grant execute on function public.increment_gerencia_phone_usage(bigint) to service_role;
