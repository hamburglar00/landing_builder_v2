# Comprobar Meta y mantener la integración con NexoBet

Actualización del 8/11/2026. El formulario «Añadir pixel» prueba la conexión con ID y token, sin pedir un código por defecto. La prueba conserva el formulario, no lo guarda y elimina resultados anteriores al editar/cerrar/reabrir. Guardar se bloquea mientras se prueba la conexión.

La ruta propia `/api/meta/connection` verifica sesión no anónima y rol admin/client. Usa únicamente la identidad autenticada, mensajes filtrados, respuestas privadas sin caché y una limitación temporal por usuario e instancia. No expone tokens guardados ni usa una clave de servicio para leerlos.

La fuente común es `frontend/lib/meta/connection.server.ts`:

- El servidor genera un código TEST… y envía `ConnectionTest` a `/{pixel}/events`; sólo confirma éxito cuando Meta acepta exactamente un evento. No depende de lectura de metadatos, que puede rechazarse aunque funcione CAPI. No envía Lead, CompleteRegistration ni Purchase de comprobación.
- Si Meta rechaza explícitamente el código automático, aparece el campo manual y la guía de Administrador de eventos → píxel → Probar eventos. Tokens inválidos y errores de red no piden ese código. Editar ID/token elimina el código anterior y el resultado.
- El token usa Authorization, sin valores sensibles en URLs, logs ni mensajes del proveedor. El diagnóstico no usa datos personales reales ni reintenta automáticamente.

El SDK oficial documenta `test_event_code` en [EventRequest](https://github.com/meta/facebook-python-business-sdk/blob/main/facebook_business/adobjects/serverside/event_request.py). El 8/11 se comparó en Graph v25.0 el código real del usuario con otro generado: ambos respondieron HTTP 200 y `events_received: 1`. Pasó también el flujo automático final, sin recibir un código del cliente. Esta aceptación del código generado es evidencia empírica actual, no una garantía de contrato oficial permanente; por eso se conserva el fallback. La prueba confirma recepción CAPI, no atribución ni instalación del Pixel del navegador. El token no forma parte de archivos ni reportes.

## Actualización de ambos productos

Desde Builder, revisar diferencias con `node scripts/sync-nexobet-marketing.mjs`. Después de revisar la fuente, sincronizar con `--update --version=<siguiente-versión>` y verificar de nuevo. El renderer Template 9, marcas/recursos y comprobador servidor están fijados por hashes en NexoBet; las rutas, autenticación, cola y UI son adaptadores que requieren revisar ambos proyectos.

Procedimiento completo: `../NexoBet/docs/MODULOS_COMPARTIDOS.md` desde la carpeta de Builder. Una publicación de Builder no cambia automáticamente NexoBet y no deben copiarse secretos ni configuraciones privadas.

## Pruebas y publicación

Desde `frontend`:

```powershell
node node_modules/tsx/dist/cli.mjs --import ./tests/revalidation-server-loader.mjs --test tests/metaConnection.test.ts tests/metaConnectionRoute.test.ts
node scripts/meta-connection-ui-check.mjs
node node_modules/typescript/bin/tsc --noEmit
```

Resultado: ocho pruebas del comprobador/ruta, cuatro recorridos reales del formulario en Chromium/WebKit a 390/1440, regresión completa con 426 aprobadas y una omisión preexistente, y TypeScript aprobado. Los navegadores usan servicios simulados y cero requests externas. NexoBet publica su adaptador con las pruebas y evidencia reales del [informe del 8/11](../../NexoBet/docs/validation/meta-auto-connection-20261108.md).

Revalidación del lote el 8/11: 426 pruebas aprobadas y una omisión preexistente, TypeScript, cuatro recorridos del formulario Meta y 41 verificaciones de la tabla de bots. Se versionan la ruta y el formulario juntos; el estado de publicación se registra por separado. NexoBet ya publicó su propio adaptador usando el mismo comprobador. API2 continúa bajo el procedimiento del programador; este botón no necesita una migración de API2.

Publicado el 8/11 en `constructor.panelbotadmin.com` y `mkt.panelbotadmin.com`: despliegue `dpl_P69xUFUZNUopTtCm7EtsGvdSDLp6`, fuente `41d97227c990ad224a682690b84a0f893ca209e5`. Ambas pantallas de ingreso conservan PBAdmin; la ruta nueva rechaza solicitudes sin sesión y orígenes ajenos. Las comprobaciones públicas no enviaron eventos a Meta ni crearon cuentas. [Evidencia de cierre](validation/shared-improvements-20261108.json). Reversión de UI: promover `dpl_9L7EAMcFTmbhwDEL45p1D1p3ev8q`.
