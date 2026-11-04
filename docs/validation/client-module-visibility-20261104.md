# Visibilidad de secciones del constructor — 04/11/2026

Implementación incluida en el checkpoint `027d4db` (`checkpoint/constructor-pre-bots-20261104`). El 04/11 el usuario autorizó su publicación junto con Bots: migración aplicada y funciones `list-clients`, `create-client` y `update-client` publicadas. El estado final de las webs se registra en [la entrega](../release/bots-template9-20261104/README.md). La unificación del directorio se documenta en [Bots](unified-bots-20261104/README.md).

## Comportamiento

- Planes no figura en los menús de cliente y superadmin ni en la precarga de rutas del cliente.
- Superadmin → Clientes → Administrar permite guardar WhatsApp API, Seguimientos y Notificaciones por cliente, junto con Atrio, Kommo y Chatrace. El formulario de alta usa los mismos controles.
- Los seis módulos y Logs parten apagados ante datos ausentes o al crear una cuenta sin habilitaciones explícitas. Inbox, agente IA, Promociones y permisos de plantillas conservan sus valores por defecto apagados.
- Los valores ya guardados se conservan. La migración no actualiza masivamente las cuentas existentes: cambia valores por defecto y agrega Notificaciones, inicialmente apagada.
- El layout del cliente aplica el control existente al menú, precarga y acceso directo a Notificaciones. El superadmin conserva sus propias secciones e integraciones mediante su contexto explícito.
- Ocultar una sección no detiene sus integraciones ni tareas de fondo. Se conservan las reglas de suscripción.

## Verificación

- `npx tsx --import ./tests/revalidation-server-loader.mjs --test tests/clientModules.test.ts`: siete pruebas correctas.
- `node scripts/security/client-module-defaults-tests.mjs`, con `PGLITE_MODULE` apuntando al módulo local: PostgreSQL aislado comprueba valores por defecto, preservación de opciones anteriores y timestamps, actualización parcial independiente, Logs, aislamiento RLS y ausencia de escritura por cliente/anon.
- `deno check supabase/functions/list-clients/index.ts supabase/functions/create-client/index.ts supabase/functions/update-client/index.ts`: correcto.
- `npx tsc --noEmit` y `npm run build` desde `frontend`: correctos.
- `node scripts/test-client-module-visibility-browser.mjs`: pruebas Chromium con tamaños de escritorio (1280 px) y móvil (390 px), Auth/REST/Edge sintéticos, sin solicitudes a Supabase real ni creación de cuentas. Comprueba opciones iniciales, guardado desde superadmin, conservación de sus integraciones, menús visibles/ocultos, ausencia de Planes y redirección por URL de secciones ocultas. Cada contexto y navegador se cierra al terminar, incluso ante errores.
- `git diff --check` y revisión de encoding: correctos. `git fetch origin` confirmó cero commits pendientes en ambos sentidos antes de finalizar.

## Publicación pendiente

1. Aplicar `supabase/migrations/20261104134536_client_module_visibility_opt_in.sql` en Builder.
2. Publicar `list-clients`, `create-client` y `update-client`, incluyendo `_shared/client-module-permissions.ts`.
3. Publicar el frontend del constructor. El nuevo campo debe existir antes de estas publicaciones.

Este lote no requiere cambios en Atrio, los gateways ni API2.
