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

## Entrega y comprobación pública

- Builder: código `fae8b14e5385ed799d2bd90cf50f49dc859b5aca`, comiteado y pusheado a `origin/main`. Vercel generó `dpl_9cnrSxDVPmJyp28deTYmDRZyxPUC`, READY, `landing-builder-v2-k259-io67zawcq-juanclouds-projects.vercel.app`. Ambos dominios públicos apuntaron a ese despliegue al comprobarlos.
- Atrio: código `0c3140e` sobre `4dd8ee2`, comiteado y pusheado a `origin/fix/atrio-inbox-validation`. Candidato `dpl_BySAVF7pS5Pp8SQw3rJrnJQng8rL`, READY, `internal-chat-1s6q6r892-juanclouds-projects.vercel.app`; se verificó el HTML del callback con HTTP 200 antes de promoverlo y luego se comprobó `www.atrio.website`.
- Los checkouts principales incorporaron ambos commits sin perder los cambios locales de otras tareas. Panel3 conserva su entrega local para el programador. No hubo migraciones, cambios de variables ni publicación de API2, Panel3, NexoBet o gateways.
- Pasaron 24 comprobaciones públicas: tres dominios, Chromium/WebKit, 320/1365 px y movimiento normal/reducido. Se verificaron HTTP 200, Referrer-Policy, logo descargado sin Referer, animación accesible, limpieza de query, ausencia de desborde y errores JavaScript, interrupción de red y CTA de reintento en negrita. El POST se bloqueó en el navegador antes de salir; no se crearon sesiones/cuentas ni sincronizaron inventarios reales.

Evidencia: [64 escenarios locales](pbadmin-connection-20261109/local-results.json), [24 públicos sin POST real](pbadmin-connection-20261109/public-results.json), [Builder móvil](pbadmin-connection-20261109/builder-mobile.png) y [Atrio escritorio](pbadmin-connection-20261109/atrio-desktop.png). Los despliegues de documentación posteriores conservan el mismo runtime; los IDs anteriores identifican la entrega funcional comprobada. La integración con el backend no se presenta como una certificación de una versión de API2 aún no desplegada.
