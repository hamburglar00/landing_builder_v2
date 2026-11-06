# Uso de WhatsApp MKT — 5 de noviembre de 2026

## Contrato y alcance
API2 guarda `managers.whatsapp_usage` (`acquisition` o `follow_up`). Alta/edición solo MKT WhatsApp; clientes antiguos pueden omitirlo sin resetearlo. `random-contact` por gerencia y administración conserva los arrays y añade `mkt.whatsapp_details` con phone, manager_id y usage. El directorio privado y Atrio propagan `whatsapp_usage`; la reconciliación detecta su edición.

Builder `sync-phones` consume metadatos completos y valida contradicciones antes de escribir. Sin metadatos conserva el campo existente, incluso ante ediciones manuales concurrentes: los upserts heredados omiten el campo. Se preservan contadores y estado manual. Los teléfonos de venta no consumen asignaciones publicitarias. `pbadmin_manager_id` indica cuándo el uso ya depende de PBAdmin; UI y trigger impiden editarlo desde Builder. Otros tipos y fuentes manuales siguen editables.

## Importación inicial
Revisión de solo lectura: 150 MKT WhatsApp en API2; 111 coinciden por teléfono y gerencia, 39 quedan publicitarios por defecto. Seis bots actuales tienen venta; dos registros de venta históricos de Builder no coinciden con bots actuales y se conservan allí. Sin contradicciones. Es un inventario inicial: el programador debe exportar un snapshot fresco antes del paso 9, siguiendo API2 `docs/releases/20261105-deploy.md`.

El endpoint privado `/api/pbadmin/mkt-whatsapp-usage` utiliza el secreto de Extensiones, pagina sin límite de 1000 y devuelve hashes SHA-256, gerencia y uso. El snapshot expira a las 24 h, se valida antes del primer DDL del lote y no se vuelve a importar tras registrar la migración.

## Validación
- Tipos TypeScript: API2, Panel3, Builder y Atrio; Deno check de sync-phones.
- API2: contratos públicos/directorio, validación de rol/canal, snapshots contradictorios/vencidos; edición MKT por marketing y regresiones de cambios de canal Atrio.
- MySQL 8.4 desechable: nueve migraciones en orden, importación por gerencia operativa de compra, default, otros tipos intactos, repetición sin deshacer una edición posterior.
- Builder: 26 pruebas de sincronización real del handler, importación, compatibilidad, permisos y exportación de más de 1000 registros.
- PostgreSQL desechable: migración conserva datos; servicio modifica clasificación; JWT de usuario no cambia identidad/uso gestionado; estado manual y usos no gestionados siguen editables.
- Atrio: 7 pruebas del directorio privado y su whitelist.
- Panel3: 6 verificaciones Playwright contra el frontend real, anchos 390/1440, edición/payload, campo oculto en Atrio y default en alta. Todas las peticiones de negocio interceptadas; cero escrituras productivas.

## Publicación
Migración de Builder `20261106011727_pbadmin_mkt_whatsapp_usage.sql` aplicada (mismo SQL probado). Edge `sync-phones` v31 desplegada, autenticación anterior conservada. API2/Panel3 quedan para el programador. No requiere cambios ni despliegues en gateways.
