-- Optimize RLS policies without changing their access logic.
-- Supabase/Postgres can evaluate auth.uid() per row inside RLS policies.
-- Wrapping it as (select auth.uid()) lets Postgres initialize it once per query.

do $$
declare
  policy_record record;
  new_using text;
  new_check text;
  alter_statement text;
begin
  for policy_record in
    select
      n.nspname as schema_name,
      c.relname as table_name,
      p.polname as policy_name,
      pg_get_expr(p.polqual, p.polrelid) as using_expr,
      pg_get_expr(p.polwithcheck, p.polrelid) as check_expr
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('public', 'storage')
      and (
        pg_get_expr(p.polqual, p.polrelid) like '%auth.uid()%'
        or pg_get_expr(p.polwithcheck, p.polrelid) like '%auth.uid()%'
      )
  loop
    new_using := null;
    new_check := null;
    alter_statement := format(
      'alter policy %I on %I.%I',
      policy_record.policy_name,
      policy_record.schema_name,
      policy_record.table_name
    );

    if policy_record.using_expr is not null then
      new_using := replace(policy_record.using_expr, 'auth.uid()', '(select auth.uid())');
      alter_statement := alter_statement || format(' using (%s)', new_using);
    end if;

    if policy_record.check_expr is not null then
      new_check := replace(policy_record.check_expr, 'auth.uid()', '(select auth.uid())');
      alter_statement := alter_statement || format(' with check (%s)', new_check);
    end if;

    execute alter_statement;
  end loop;
end $$;
