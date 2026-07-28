-- Persist the reporting currency alongside every conversion amount.
-- All historical data predates multi-currency reporting and is therefore ARS.

alter table public.conversions
  add column if not exists currency text;

update public.conversions
set currency = 'ARS'
where currency is null or btrim(currency) = '';

update public.conversions
set currency = upper(btrim(currency))
where currency is distinct from upper(btrim(currency));

alter table public.conversions
  alter column currency set default 'ARS',
  alter column currency set not null;

alter table public.conversions
  drop constraint if exists conversions_currency_iso_code_check;

alter table public.conversions
  add constraint conversions_currency_iso_code_check
  check (currency ~ '^[A-Z]{3}$');

create index if not exists idx_conversions_user_currency_created_at
  on public.conversions (user_id, currency, created_at desc);

comment on column public.conversions.currency is
  'Codigo ISO 4217 de la moneda resuelta al procesar la conversion (por ejemplo ARS o PYG).';

-- Make currency available by default in the conversion table, immediately
-- after the amount when that column is already present.
update public.conversions_config
set visible_columns = (
  select array_agg(x order by first_ord)
  from (
    select x, min(ord) as first_ord
    from (
      select x, (ord * 2)::bigint as ord
      from unnest(coalesce(visible_columns, array[]::text[]))
        with ordinality as t(x, ord)
      union all
      select
        'currency'::text,
        coalesce(
          (
            select (ord * 2 + 1)::bigint
            from unnest(coalesce(visible_columns, array[]::text[]))
              with ordinality as current_cols(col, ord)
            where col = 'valor'
            limit 1
          ),
          999999::bigint
        )
    ) ordered_columns
    group by x
  ) deduped
)
where coalesce(array_length(visible_columns, 1), 0) > 0
  and not (coalesce(visible_columns, array[]::text[]) @> array['currency']);
