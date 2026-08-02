alter table public.conversions
  add column if not exists form_fn text not null default '',
  add column if not exists form_ln text not null default '',
  add column if not exists form_email text not null default '',
  add column if not exists form_phone text not null default '';

comment on column public.conversions.form_fn is
  'Nombre ingresado por el visitante en el formulario opcional previo a WhatsApp.';
comment on column public.conversions.form_ln is
  'Apellido ingresado por el visitante en el formulario opcional previo a WhatsApp.';
comment on column public.conversions.form_email is
  'Email ingresado por el visitante en el formulario opcional previo a WhatsApp.';
comment on column public.conversions.form_phone is
  'Telefono ingresado por el visitante en el formulario opcional previo a WhatsApp, normalizado si es valido.';

update public.conversions_config
set visible_columns = (
  select array_agg(column_name order by first_position)
  from (
    select column_name, min(position) as first_position
    from unnest(
      coalesce(visible_columns, array[]::text[]) || array[
        'form_fn',
        'form_ln',
        'form_email',
        'form_phone'
      ]
    ) with ordinality as expanded(column_name, position)
    group by column_name
  ) deduplicated
)
where coalesce(array_length(visible_columns, 1), 0) > 0
  and not coalesce(visible_columns, array[]::text[]) @> array[
    'form_fn',
    'form_ln',
    'form_email',
    'form_phone'
  ];
