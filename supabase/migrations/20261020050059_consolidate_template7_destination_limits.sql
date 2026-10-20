-- One service-only request preserves the existing IP/device quotas and reads
-- the already-hardened owner/workspace context. No account or assignment writes.
create or replace function public.resolve_template7_limited_destination_context(
  p_landing_id uuid,
  p_landing_slug text,
  p_ip_bucket_key text,
  p_device_bucket_key text,
  p_consume_device_on_ip_denial boolean default true
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_ip_allowed boolean;
  v_device_allowed boolean := false;
begin
  if p_ip_bucket_key is null or p_device_bucket_key is null
     or p_ip_bucket_key !~ '^[0-9a-f]{64}$'
     or p_device_bucket_key !~ '^[0-9a-f]{64}$'
     or p_ip_bucket_key = p_device_bucket_key
     or p_consume_device_on_ip_denial is null then
    raise exception 'invalid destination rate limit keys';
  end if;

  -- Keep the exact existing 60/IP/minute and 6/device/minute buckets.
  -- Consume in a consistent lock order to avoid cross-device deadlocks.
  v_ip_allowed := public.consume_template7_rate_limit(p_ip_bucket_key, 60, 60);
  -- Constructor previously consumed both in parallel; classic short-circuited
  -- the device bucket when IP was denied. Preserve both established behaviors.
  if p_consume_device_on_ip_denial or v_ip_allowed is true then
    v_device_allowed := public.consume_template7_rate_limit(p_device_bucket_key, 6, 60);
  end if;
  if v_ip_allowed is distinct from true or v_device_allowed is distinct from true then
    return jsonb_build_object('allowed', false, 'landing', null, 'blocked', true, 'advisors', '[]'::jsonb);
  end if;

  return public.resolve_template7_destination_context(p_landing_id, p_landing_slug)
    || jsonb_build_object('allowed', true);
end;
$$;

revoke all on function public.resolve_template7_limited_destination_context(uuid, text, text, text, boolean)
  from public, anon, authenticated;
grant execute on function public.resolve_template7_limited_destination_context(uuid, text, text, text, boolean)
  to service_role;

comment on function public.resolve_template7_limited_destination_context(uuid, text, text, text, boolean) is
  'Internal Template 7 destination scope: consumes the unchanged server-HMAC IP/device warm quotas and reads trusted landing context in one database request.';
