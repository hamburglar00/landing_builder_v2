# WhatsApp Cloud API

Implementacion inicial de landing conversacional oficial de Meta.

## Flujo

1. Un anuncio Click-to-WhatsApp abre el numero conectado a WhatsApp Cloud API.
2. Meta envia el webhook completo a `whatsapp-cloud-webhook`.
3. El webhook valida `X-Hub-Signature-256`, guarda el payload crudo en `whatsapp_cloud_api_webhook_events` y dispara `whatsapp-cloud-worker`.
4. El worker procesa mensajes entrantes, captura `referral.ctwa_clid`, crea contacto interno en `conversions`, asigna telefono con `get_phone_for_whatsapp_cloud_api` y responde por WhatsApp con `wa_link` + `promo_code`.
5. Si la derivacion se envio correctamente, incrementa `gerencia_phones.usage_count` como equivalente al CTA de una landing.
6. LEAD/PURCHASE siguen entrando por el endpoint existente `conversions`; el linaje se conserva por `promo_code` y source `whatsapp_cloud_api`.

## Supabase

Migracion principal:

- `supabase/migrations/20260810172000_whatsapp_cloud_api_module.sql`

Tablas principales:

- `whatsapp_cloud_api_configs`
- `whatsapp_cloud_api_gerencias`
- `whatsapp_cloud_api_webhook_events`
- `whatsapp_cloud_api_contacts`
- `whatsapp_cloud_api_attribution_sessions`
- `whatsapp_cloud_api_assignments`
- `whatsapp_cloud_api_outbound_messages`

Funciones:

- `whatsapp-cloud-webhook`: webhook publico de Meta, `verify_jwt = false`.
- `whatsapp-cloud-worker`: worker interno llamado con service role.
- `get_phone_for_whatsapp_cloud_api(p_config_id uuid)`: seleccion de telefono usando gerencias, pesos y criterio fair.
- `increment_gerencia_phone_usage(p_phone_id bigint)`: incremento atomico del contador de telefono cuando la derivacion sale OK.

## Secrets requeridos

- `META_APP_SECRET`: obligatorio para validar POST de Meta.
- `SERVICE_ROLE_KEY`: ya existe; usado para worker y escritura interna.
- `WHATSAPP_CLOUD_API_VERIFY_TOKEN`: opcional. Si no existe, el GET de verificacion usa `webhook_verify_token` guardado en la config.

## Decisiones

- `source_platform` canonico: `whatsapp_cloud_api`.
- El primer mensaje crea Contact interno por defecto, pero `send_contact_capi` queda apagado para no enviar Contact CAPI a Meta salvo opt-in.
- Si llega `ctwa_clid`, no se deduplica por ventana de 24h: se permite un nuevo recorrido publicitario A/B.
- Si no llega `ctwa_clid`, se deduplican mensajes recientes del mismo contacto para evitar reasignaciones por charla normal.

## Pendientes

- Cargar `META_APP_SECRET` antes de recibir webhooks reales.
- Crear una app Meta real, suscribir webhook y probar `messages` + `message_status`.
- Definir en una segunda etapa si LEAD/PURCHASE de `whatsapp_cloud_api` deben salir por Business Messaging CAPI con dataset/WABA propios.
