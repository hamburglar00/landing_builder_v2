# Enlaces por gerencia: contrato de API2 corregido

## Causa y cambio

`GET /api/v1/bot/gateway/agencies/:id` y el ingreso devuelven los datos directamente mediante `apiRenderSuccess`, sin agregar `success: true`. El puente de Atrio exigía ese campo y convertía respuestas válidas en HTTP 503. La gerencia 286 tenía correctamente vinculados el bot MKT 1050 y su asesor; no faltaba configurar ese circuito.

Atrio ahora acepta un objeto de datos sin ese indicador. Conserva las verificaciones exactas de gerencia, plataforma, manager, asesor, cuenta y pertenencia; rechaza errores HTTP, fallos explícitos, cuerpos vacíos o inválidos, listas y respuestas demasiado grandes. La corrección también cubre la consulta de credenciales posterior al alta. No cambia el recorrido desde templates ni agrega llamadas o consultas.

## Validación

- La suite actualizada reprodujo el fallo antes de corregir el servicio: 16 pruebas fallaban.
- 94 pruebas aprobadas, sin omisiones: destino, ingreso y credenciales de los cuatro proveedores; provisión durable, preparación y recuperación existentes. Incluye respuestas malformadas, identidades ajenas y fallos explícitos, sin vinculación ante errores.
- TypeScript y ESLint de los archivos modificados aprobados. SDK y módulos comunes de ingreso sincronizados en los cuatro gateways.
- Antes de promover, se consultó el destino con el nuevo Atrio y API2 productivo: Rey 286, Ases del Norte 277, Ganamos NET 17 y Multi Skin 282 respondieron 200. La gerencia 17 en Rey se rechazó con 404.
- En producción, 16 comprobaciones de navegador: cuatro gateways, Chromium/WebKit y anchos 390/1365. Formulario de ingreso y alternancia de alta visibles, logos cargados, sin desbordes ni errores de JavaScript. Ganamos+ se verificó en su dominio servido por Cloudflare Worker.
- Las comprobaciones productivas no enviaron credenciales de jugadores ni crearon cuentas; verifican disponibilidad del circuito y formularios, no un ingreso o alta real de extremo a extremo. Los flujos que escriben se probaron con dependencias aisladas.
- El login de Atrio conserva «Ingresar con PBAdmin» y su redirección al autorizador de Panel3.

Comandos de pruebas en `internal-chat`:

```text
node --experimental-strip-types --test tests/gateway-agency.test.mjs tests/direct-bot-account.test.mjs tests/direct-bot-credentials.test.mjs tests/gateway-entry-preparation.test.mjs tests/gateway-returning-entry.test.mjs
npm run typecheck
npx --no-install eslint src/lib/gateway-agency.server.ts tests/gateway-agency.test.mjs
```

## Publicación

- Atrio: commit `b088a113ccbd415a010ed53c71823f9a8e507fc5`, pusheado en `fix/atrio-inbox-validation`.
- Vercel: `dpl_5yZn6MU9QYVHr2xAPEoEtgogPVt2`, compilado desde ese commit de Git, READY y promovido a `www.atrio.website`.
- Implementación única en Atrio, utilizada por los cuatro gateways. No hubo cambios de código/configuración ni nuevas publicaciones en gateways o Worker.
- Builder sólo recibe esta documentación. API2 y Panel3 no se modificaron, publicaron ni migraron. No requiere migraciones ni Edge Functions.
- Reversión: promover el deployment previo de Atrio `dpl_2F6RsNw8VBbbi38ozXeQ5fA3r6bh`; no tocar datos ni configuración de integraciones. Esa reversión volvería a introducir el bloqueo de enlaces por gerencia.

[Resultado público](production.json), [escritorio](rey-1365.png), [móvil](rey-390.png).
