-- A phone may have thousands of historical availability references. Their
-- existing ON DELETE SET NULL actions remain intact, but work must be bounded
-- so each invoker transaction finishes within PostgREST's statement timeout.
create function public.delete_inactive_workspace_phone_batch(p_workspace text)
returns integer language plpgsql security invoker set search_path = '' as $$
declare affected integer;
begin
  if auth.uid() is null or p_workspace is null or p_workspace not in ('ARS','PYG') then
    raise exception 'Invalid workspace';
  end if;
  delete from public.gerencia_phones p
  where p.status <> 'active' and p.id in (
    select target.id from public.gerencia_phones target
    join public.gerencias g on g.id = target.gerencia_id
    where target.status <> 'active' and g.workspace_currency = p_workspace
    order by target.id limit 25
  );
  get diagnostics affected = row_count;
  return affected;
end $$;
revoke all on function public.delete_inactive_workspace_phone_batch(text) from public, anon;
grant execute on function public.delete_inactive_workspace_phone_batch(text) to authenticated;
