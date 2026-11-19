-- Apply the same source filter before grouping, counting and paginating.
-- Keep advisors with no connections visible while their identity is still live.
do $migration$
declare
  definition text := pg_get_functiondef(
    'public.read_bots_directory_page_sorted(text,integer,text,text,boolean,boolean,text,text)'::regprocedure
  );
  source text := 'from public.atrio_clients where workspace_currency=p_workspace and p_include_atrio';
begin
  if strpos(definition,source)=0 then raise exception 'Unexpected Redirección directory source'; end if;
  execute replace(definition,source,source || ' and directory_retired_at is null');
end
$migration$;
