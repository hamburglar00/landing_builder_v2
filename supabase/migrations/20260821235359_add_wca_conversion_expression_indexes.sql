create index if not exists conversions_wca_external_currency_expr_idx
  on public.conversions (user_id, (coalesce(currency, 'ARS')), external_id)
  where external_id <> ''
    and coalesce(test_event_code, '') = '';

create index if not exists conversions_wca_promo_currency_expr_idx
  on public.conversions (user_id, (coalesce(currency, 'ARS')), promo_code)
  where promo_code <> ''
    and coalesce(test_event_code, '') = '';
