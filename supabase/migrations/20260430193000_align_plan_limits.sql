alter table public.client_subscriptions
  alter column max_landings set default 1;

alter table public.client_subscriptions
  alter column max_phones set default 2;

update public.client_subscriptions
set
  max_landings = case plan_code
    when 'starter' then least(max_landings, 1)
    when 'plus' then least(max_landings, 2)
    when 'pro' then least(max_landings, 4)
    when 'premium' then least(max_landings, 6)
    else max_landings
  end,
  max_phones = case plan_code
    when 'starter' then least(max_phones, 2)
    when 'plus' then least(max_phones, 5)
    when 'pro' then least(max_phones, 10)
    when 'premium' then least(max_phones, 20)
    else max_phones
  end
where plan_code in ('starter', 'plus', 'pro', 'premium');
