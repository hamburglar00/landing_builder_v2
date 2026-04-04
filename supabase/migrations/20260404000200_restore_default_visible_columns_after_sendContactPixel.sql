-- Restore default visible columns when empty/null after sendContactPixel rename.
update public.conversions_config
set visible_columns = array[
  'phone','email','fn','ln','ct','st','zip','country',
  'contact_event_id','contact_event_time','sendContactPixel','contact_payload_raw',
  'lead_event_id','lead_event_time','lead_payload_raw',
  'purchase_event_id','purchase_event_time','purchase_payload_raw',
  'timestamp','estado','valor','observaciones','external_id','test_event_code',
  'meta_pixel_id','telefono_asignado','promo_code'
]::text[]
where coalesce(array_length(visible_columns, 1), 0) = 0;
