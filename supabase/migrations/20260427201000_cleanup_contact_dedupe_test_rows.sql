-- Remove CONTACT rows generated while validating CONTACT dedupe on production.
-- Scope is intentionally narrow: goldencajeros + the synthetic phones/payload keys used by the test run.

delete from public.conversions c
using public.profiles p
where c.user_id = p.id
  and p.nombre = 'goldencajeros'
  and c.estado = 'contact'
  and c.phone in (
    '5491112345678',
    '5491199988877',
    '5491101010101',
    '549113331111',
    '549114442222',
    '549115553333'
  )
  and (
    c.contact_event_id like 'evt-contact-%'
    or c.promo_code like 'KOBE-%'
    or c.contact_payload_raw like '%evt-contact-%'
    or c.contact_payload_raw like '%KOBE-%'
  );

