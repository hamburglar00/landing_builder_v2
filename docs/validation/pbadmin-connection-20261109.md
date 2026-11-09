# Conexión desde PBAdmin e inventario compartido — 09/11/2026

## Comportamiento

Atrio y LandingBuilder muestran el logo original del destino y «Conectando con…» mientras se completa el acceso desde PBAdmin. La animación suave respeta movimiento reducido; un error detiene la animación y ofrece reintento. El logo no recibe el código del ingreso por Referer. No se agrega demora artificial.

Builder conserva el protocolo y la sesión habituales. Atrio sirve primero la pantalla y completa el mismo canje de un solo uso mediante un POST del mismo origen. Las cookies y tokens siguen bajo control del servidor; la respuesta del POST sólo devuelve el destino. Se conserva el reintento de conciliación de inventario existente.

La sincronización de Builder reemplazaba el inventario completo de un asesor compartido. Ahora actualiza sólo la administración o gerencia consultada y conserva las otras. La limpieza de bots retirados respeta el mismo ámbito. No se eliminan recursos ni configuración de landings; se conservan nombres manuales y la moneda ARS/PYG. Las escrituras comparan la versión de inventario existente y reintentan ante concurrencia. La versión avanza incluso con dos escrituras en el mismo milisegundo y evita incluir un JSON grande en la URL. No hay migración ni nuevos permisos.

## Verificación local

- `node scripts/test-pbadmin-auth.mjs`: 18 escenarios con Auth, PostgreSQL y PostgREST descartables, incluidos vinculación de cuenta existente, aislamiento de cuentas, inventario compartido, limpieza por administración y actualización simultánea. Un asesor conserva más de cien bots extranjeros y el inventario propio actualizado, con URL de escritura menor de 2048 caracteres. Fallaba la conservación del asesor compartido antes del cambio.
- `tests/botsWorkspace.test.ts` y `tests/botsImportRoute.test.ts`: 17 pruebas aprobadas. TypeScript de Builder aprobado.
- `node scripts/test-pbadmin-connection.browser.mjs --atrio-root=../internal-chat-connect-transition`: 64 escenarios con los clientes/handler reales y servicios sintéticos; Chromium/WebKit, 320 y 1365 px, movimiento normal/reducido, éxito, acceso vencido, red interrumpida y fallo al guardar sesión. Verifica canje único, limpieza de URL, logo sin Referer, ausencia de desborde y errores JavaScript, y CTA de reintento en negrita.
- El POST de Atrio rechaza un origen ajeno antes de canjear el código. Un fallo de conciliación conserva la sesión válida y permite abrir el dashboard, como antes. No entrega tokens al navegador.
- Builds productivos de ambos proyectos aprobados con entorno sintético; Atrio también se compiló sobre la publicación de billetera/diagnóstico ya incorporada. La base de Atrio se actualizó además con el ajuste publicado de horarios/recibos de invitaciones, sin modificarlo.
- Codificación y `git diff --check` aprobados. Las pruebas no usan cuentas ni operaciones productivas.

## Alcance

Sólo la entrada privada de PBAdmin en Atrio/Builder y el inventario de Builder. El chat, widget, SDK, NexoBet y los cuatro gateways no cambian. Panel3 conserva localmente el icono Puzzle para Extensiones y queda para publicación por el programador. La consulta sobre instalación automática no produjo cambios en las invitaciones ni en el flujo de instalación. API2 no se modifica ni publica.

La publicación y el smoke público se registran al terminar. El smoke debe bloquear el POST de autenticación y usar códigos ficticios: verifica recursos, animación y recuperación de red sin crear sesiones, cuentas ni sincronizar inventarios reales. La integración con el backend no se presenta como una certificación de una versión de API2 aún no desplegada.
