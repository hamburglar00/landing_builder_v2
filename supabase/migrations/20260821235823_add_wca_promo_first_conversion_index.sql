create index if not exists conversions_wca_user_promo_currency_expr_idx
  on public.conversions (user_id, promo_code, (coalesce(currency, 'ARS')))
  where promo_code <> ''
    and coalesce(test_event_code, '') = '';

create index if not exists conversions_wca_user_external_currency_expr_idx
  on public.conversions (user_id, external_id, (coalesce(currency, 'ARS')))
  where external_id <> ''
    and coalesce(test_event_code, '') = '';
