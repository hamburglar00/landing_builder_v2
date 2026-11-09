# Bots: tabla compacta y uso MKT — 07/11/2026

## Diagnóstico

La consulta pública de API2 para la gerencia 274 devuelve `manager_id: 1051, usage: acquisition`, aunque la captura de Panel3 muestra WhatsApp de venta. Builder almacena ese mismo valor y `sync-phones` v31 contiene el lector de metadatos vigente: el problema se origina antes de Builder.

En API2, `applyPublishableManagerFilters` seleccionaba `phone_number`, pero no `whatsapp_usage`. El helper público usaba entonces `acquisition` por defecto. El modo de suscripción individual añadía el ID por separado; el modo anterior tampoco garantizaba el ID en los metadatos.

La corrección local selecciona `id` y `whatsapp_usage` sólo para MKT WhatsApp. Conserva los filtros de conexión, publicación, pertenencia y suscripción, así como los arrays anteriores. Los otros roles y Telegram no seleccionan este campo. No se consultó ni modificó el valor productivo de MySQL: la conexión de sólo lectura no superó la validación de certificados. El diagnóstico se apoya en la respuesta HTTP, el código y la reproducción aislada de la consulta.

## Interfaz

- Retirada la leyenda bajo los selectores. Los usos gestionados siguen bloqueados para edición en Builder.
- Menor separación entre columnas; teléfonos completos, estados, encabezados y fechas sin saltos de línea.
- Encabezados breves Mensajes, Históricos y Última sync., con nombres completos accesibles y en tooltip.
- La tabla entra completa a 1280 y 1348 px. A 390 px el desplazamiento queda dentro de su contenedor.

## Regresión y reproducción

API2, desde su raíz:

```powershell
node --import ./tests/helpers/atrio_confirmed_load_test_bootstrap.mjs --test tests/isolated/mkt_whatsapp_usage.test.ts
npm run typecheck
```

La prueba nueva ejecuta las consultas reales del repositorio con proyección de columnas simulada y datos sintéticos. Reproduce el fallo antes de la corrección y pasa después. Cubre ambas rutas, suscripción anterior/individual, venta/publicidad, exclusión por suscripción y separación de otros roles/canales. Las cuatro pruebas pasan y TypeScript no reporta errores. La red está bloqueada durante esta ejecución.

Builder, desde `frontend`:

```powershell
node node_modules/tsx/dist/cli.mjs --import ./tests/revalidation-server-loader.mjs --test tests/mktWhatsappUsage.test.ts tests/mktWhatsappSync.test.ts tests/whatsappDisplayPhone.test.ts
npx tsc --noEmit
node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3137
```

Con el servidor iniciado, desde la raíz de Builder:

```powershell
node scripts/test-unified-bots-browser.mjs
```

Siete pruebas de contrato/sincronización/formato y 41 verificaciones de navegador pasan. El navegador usa el frontend real con todos los servicios de negocio interceptados: no crea cuentas ni escribe datos productivos. Cubre 1348, 1280 y 390 px, uso de venta, bloqueos de edición, ausencia de leyenda, geometría real del texto, importación, administración y rutas anteriores. Capturas: `bots-table-20261107/`.

## Activación

Builder puede publicar el ajuste visual por separado. La clasificación del #1051 seguirá dependiendo del API2 publicado. El programador debe desplegar la corrección de API2, comprobar que el endpoint de la gerencia 274 devuelve el uso guardado y luego sincronizar esa gerencia en Builder (o esperar su cron). Ver `api2/docs/releases/20261107-mkt-whatsapp-usage.md`.

No requiere migración, importación inicial, funciones Edge ni cambios de Panel3/gateways. No se fuerza manualmente el valor en Builder, porque la siguiente sincronización lo volvería a sustituir.

## Publicación verificada

Builder publicado en `constructor.panelbotadmin.com` y `mkt.panelbotadmin.com`, despliegue `dpl_9L7EAMcFTmbhwDEL45p1D1p3ev8q` (anterior: `dpl_6wDxaBXzE8YQbAy6PEPvnG5GSCj2`). Compilación de producción aprobada. Tras promoverlo, las 41 verificaciones del navegador pasaron también contra el dominio público con servicios de negocio simulados; ambas páginas de login responden HTTP 200 y conservan Ingresar con PBAdmin. TypeScript local y control de codificación aprobados.

La comprobación final del API2 público sigue devolviendo `manager_id: 1051, usage: acquisition`: pendiente la publicación del programador. No se desplegaron API2 ni Panel3 ni se editaron datos reales. No hubo commit/push de este lote. Para revertir únicamente la UI se puede promover el despliegue anterior.
