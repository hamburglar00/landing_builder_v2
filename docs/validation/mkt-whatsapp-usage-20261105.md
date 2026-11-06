# Uso de WhatsApp MKT — 5 de noviembre de 2026

## Contrato y alcance
API2 guarda `managers.whatsapp_usage` (`acquisition` o `follow_up`). Alta/edición solo MKT WhatsApp; clientes antiguos pueden omitirlo sin resetearlo. `random-contact` por gerencia y administración conserva los arrays y añade `mkt.whatsapp_details` con phone, manager_id y usage. El directorio privado y Atrio propagan `whatsapp_usage`; la reconciliación detecta su edición.

Builder `sync-phones` consume metadatos completos y valida contradicciones antes de escribir. Sin metadatos conserva el campo existente, incluso ante ediciones manuales concurrentes: los upserts heredados omiten el campo. Se preservan contadores y estado manual. Los teléfonos de venta no consumen asignaciones publicitarias. `pbadmin_manager_id` indica cuándo el uso ya depende de PBAdmin; UI y trigger impiden editarlo desde Builder. Otros tipos y fuentes manuales siguen editables.

## Importación inicial simplificada
Revisión de solo lectura del 05/11/2026, 22:50 AR: 571 registros MKT en Builder; 150 MKT WhatsApp en API2, 111 coincidentes y siete bots de venta. Hay 39 bots sin antecedente que quedan publicitarios. Dos registros históricos de venta de Builder sin bot actual se conservan allí.

El usuario aprobó incorporar esta captura en la migración de API2. Los datos están en `scripts/data/mkt_whatsapp_usage_20261105.mjs`, con IDs, hashes y usos; sin números de teléfono en texto plano ni claves. La migración funciona sin red ni archivos externos, no caduca, valida la identidad antes de escribir y no reimporta al repetir un lote aplicado. Ver API2 `docs/releases/20261105-deploy.md`.

El endpoint `/api/pbadmin/mkt-whatsapp-usage`, sus helpers y la clave de exportación se retiran. Los cambios de uso hechos en Builder después de esta captura deben incorporarse antes del despliegue; tras desplegar, se administra en PBAdmin.

## Validación
- Tipos TypeScript: API2, Panel3, Builder y Atrio; Deno check de sync-phones.
- API2: contratos públicos/directorio, validación de rol/canal, captura incorporada, identidad modificada y datos corruptos; edición MKT por marketing y regresiones de cambios de canal Atrio.
- MySQL 8.4 desechable: nueve migraciones en orden, importación por gerencia operativa de compra, default, otros tipos intactos, repetición sin deshacer una edición posterior.
- Builder: pruebas de sincronización real del handler, importación, compatibilidad y permisos. Se retiraron las pruebas del exportador eliminado.
- PostgreSQL desechable: migración conserva datos; servicio modifica clasificación; JWT de usuario no cambia identidad/uso gestionado; estado manual y usos no gestionados siguen editables.
- Atrio: 7 pruebas del directorio privado y su whitelist.
- Panel3: 6 verificaciones Playwright contra el frontend real, anchos 390/1440, edición/payload, campo oculto en Atrio y default en alta. Todas las peticiones de negocio interceptadas; cero escrituras productivas.

## Publicación
Migración de Builder `20261106011727_pbadmin_mkt_whatsapp_usage.sql` aplicada (mismo SQL probado). Edge `sync-phones` v31 desplegada, autenticación anterior conservada. API2/Panel3 quedan para el programador. No requiere cambios ni despliegues en gateways.
