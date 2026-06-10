update public.conversion_inbox ci
set promo_code = c.promo_code
from public.conversions c
where ci.conversion_id = c.id
  and ci.action = 'LEAD'
  and coalesce(ci.promo_code, '') = ''
  and coalesce(c.promo_code, '') ~ '^[A-Za-z0-9]+-[A-Za-z0-9]+$';
