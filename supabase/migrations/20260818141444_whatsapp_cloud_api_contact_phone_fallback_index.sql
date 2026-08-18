create index if not exists conversions_wca_contact_phone_fallback_idx
  on public.conversions (
    user_id,
    phone,
    assigned_gerencia_id,
    telefono_asignado,
    created_at desc
  )
  where estado = 'contact'
    and source_platform = 'whatsapp_cloud_api';
