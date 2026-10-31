# Inicio automático al llegar al chat — 31/10/2026

## Estado de la entrega

Implementación, migración y publicación completadas con autorización del usuario. Los siete proyectos Vercel están publicados, junto al Worker de Multi Skin. Retoma el pedido de inicio automático aprobado a las 12:06 de Argentina, recuperado del historial después del cierre de VS Code. El lote anterior se documenta en `entry-recovery-20261031.md`. El manifest de esta entrega, con commits, despliegues, hashes y rollback, está en `gateway-visible-entry-release-20261031.json`.

## Comportamiento

- El padre espera el chat hidratado, el final de su animación, documento visible y transición retirada antes de anunciar visibilidad. Se validan origen, ventana y proveedor del mensaje entre padre e iframe. Una precarga cerrada no dispara el inicio.
- Atrio espera dos cuadros de render y solicita `visible_entry` usando exclusivamente la sesión firmada. No recibe identidad, mensaje, campaña ni datos bancarios elegidos por el navegador.
- La conversación nueva guarda un solo saludo argentino sin signos de apertura, seguido de la bienvenida configurada y los datos bancarios actuales. Se conservan las variables de bienvenida, incluida la consulta privada de clave cuando corresponde. Historial anterior no se reescribe. Si un cliente ya escribió durante la preparación de su bienvenida, prevalece ese intercambio real.
- `source=gateway_visible_entry` y `automatic=true` distinguen el saludo. El asesor ve un ícono de bot discreto junto al horario; también lo muestran otras automatizaciones identificadas por metadatos, sin inferir el origen a partir del texto.
- CONTACT conserva su disparador. LEAD se reserva al confirmar en servidor una llegada visible, con deduplicación por jugador y campaña y el payload persistido para reintentos. Una nueva campaña en una conversación antigua tiene evento y fecha nuevos. No depende del envío de un mensaje humano ni del éxito del proveedor bancario. Después de responder al chat, `after` conserva también el reintento inmediato de una entrega fallida; reutiliza el payload, evento y fecha originales, sin esperar un mensaje humano ni el proceso diario.
- El saludo no entra en el flujo del bot, notificaciones de mensaje humano, análisis de comprobantes, métricas de escritura/respuesta, reparto por conversaciones con mensaje humano ni ofrecimientos/recordatorios de instalación. Las visitas conservan su semántica anterior.
- Full Carga revalida los datos bancarios al llegar. Una tarjeta histórica sigue en el historial, pero no certifica que el CBU actual esté disponible. La deduplicación de tarjetas compara los datos actuales; no se introduce una caché de datos bancarios.
- Hasta tres solicitudes de inicio, cada una con doce segundos de límite incluyendo el cuerpo JSON, con pausas breves. Se cancelan al desmontar, se ignoran respuestas obsoletas y no se inicia otro intento estando oculto. El formulario de mensajes sigue utilizable.
- El SDK conserva su arranque diferido hasta la respuesta final de disponibilidad del chat/datos bancarios. La señal nueva `visibleEntry:true` evita que el gateway solicite por separado la tarjeta automática y permite retirar la transición antes del intercambio inicial.

## Archivos y alcance

- Atrio: `src/lib/gateway-visible-entry.ts`, `src/lib/client-visible-entry.ts`, `src/hooks/use-gateway-visible-entry.ts`, rutas del chat, bootstrap, contrato firmado, shell cliente, inbox asesor, clasificación de mensajes e integración/analíticas.
- Migración: `internal-chat/supabase/migrations/20261031154810_gateway_visible_entry.sql`, aplicada en el proyecto Supabase `didrpwkdqizivfbapofx` y alineada con su versión registrada. Agrega estado pendiente y primera llegada visible a conversación, índice único del inicio y RPC exclusivos de servicio. Actualiza las dos consultas de métricas/reparto para excluir la introducción automática. Conserva privilegios y políticas.
- Los cuatro gateways comparten visibilidad y transición. Se agregaron `scripts/sync-gateway-chat-visibility.mjs` y `scripts/check-gateway-chat-visibility.mjs` en Builder. Runtime T7/T8 y renderer clásico regenerados; assets anteriores conservados.
- Sin cambios en API2, Panel3, cuentas, saldos ni movimientos. El acceso directo de Atrio conserva su comportamiento. La misma implementación de Atrio sirve a Rey, Ases, NET y Multi Skin.

## Verificación

- Atrio: 71 pruebas focales y regresiones de entrada, LEAD/reintentos, bot, analíticas, instalación y recordatorios; TypeScript y lint de módulos nuevos correctos. Incluye dos pruebas de la ruta real para recuperación del LEAD después de responder y rechazo sin sesión sin programar trabajo.
- SQL: doce grupos en PostgreSQL PGlite desechable, con orden estricto, reintentos, skin independiente, permisos, carrera con mensaje humano, datos bancarios y funciones reales de directorio/reparto. Docker respondió 500: PGlite no demuestra concurrencia entre conexiones independientes.
- Cuatro gateways: 103 pruebas de assets y transición. Builder/clásico: 35 pruebas de recursos compartidos. TypeScript correcto en los seis proyectos web.
- Navegador: 56 escenarios de los gateways y SDK en Chromium/WebKit; ocho escenarios adicionales con el shell React real, los tres temas, comprobación de origen/ventana, apertura/reapertura y una tarjeta histórica sin datos bancarios actuales confirmados.
- Burbuja real del asesor renderizada con/sin automatización: ícono, horario y recibos conservados. No hubo solicitudes reales de negocio, mensajes productivos ni eventos de prueba a Meta.
- Las simulaciones de navegador no certifican dispositivos físicos dentro de Facebook/Instagram. La comprobación pública de esta publicación es HTTP y de artefactos; no ejecuta un recorrido autenticado con una cuenta real.

## Publicación y comprobaciones productivas

1. Migración aplicada antes de activar Atrio. Verificados columnas, índice único, cuatro RPC `SECURITY INVOKER` ejecutables solo por `service_role`, RLS conservado y exclusión del saludo en directorio/reparto. Las llamadas con identidad nula devolvieron nulo sin escribir datos de negocio. Los avisos de seguridad anteriores y posteriores coinciden: no aparecieron hallazgos nuevos.
2. Cuatro gateways publicados primero, incluido Worker Multi Skin al 100% con variables conservadas y relay intacto. Los doce hashes públicos de JS/CSS coinciden y los seis endpoints de salud devuelven 200.
3. Builder y clásico publicados con dieciséis archivos actuales/anteriores verificados por SHA-256 y caché immutable. Cuatro HTML de Diana y su override referencian los runtimes nuevos. Se corrigió la exportación de Git en Windows para impedir conversión CRLF; clásico se reconstruyó desde el mismo commit con bytes LF canónicos.
4. Atrio compilado en Vercel con TypeScript correcto y promovido después de los padres. El proyecto conserva Fluid Compute y un límite predeterminado de 300 segundos, compatible con el trabajo de entrega/reintento posterior a la respuesta.
5. `www.atrio.website` apunta al deployment exacto indicado abajo. Login devuelve 200; GET del chat, POST `visible_entry` sin sesión y cron sin token devuelven 401. El chat conserva `no-store`, `no-referrer`, `nosniff` y no emite cookies. Estas comprobaciones no crean cuentas, mensajes ni conversiones de prueba.

| Componente | Commit publicado | Deployment Vercel |
| --- | --- | --- |
| Atrio | `2692837` | `dpl_4WnAFuMje9Gy5pc5u3mdmXjdyqWg` |
| Builder | `65ccee6` | `dpl_7PfWqHygAURBe4eTbbGiAzwgqDXu` |
| Clásico | `2eeef16` | `dpl_BFCrHisruyB8b5rM1vFbHXHAYCBh` |
| Rey de Ases | `c21811d` | `dpl_6DuipzypQsV9vQWfBa9y2raC7zf9` |
| Ases del Norte | `581c139` | `dpl_HG3qznBqM5bhhhLsRNxC2646xYju` |
| Ganamos NET | `fa0788f` | `dpl_HDWEQiNeDBisyQd5yPNWDSqYd4ST` |
| Multi Skin | `35a33f5` | `dpl_BBK67i7u64sZ7sYnFkY7oBJsfRSP` |

Worker Multi Skin: versión `7addcd00-4b51-4140-8c1a-003ebdcd6a3c`, deployment `3119329b-524a-437f-9a7b-f3718c9f4d8a`, tráfico 100%. Los commits de cierre documental posteriores no cambian los binarios publicados.

Si se requiere rollback, retirar primero la aplicación nueva de Atrio y después los padres; los deployments anteriores están en el manifest. La migración es compatible con la aplicación anterior: conservarla y los mensajes ya persistidos, sin borrar historial ni revertir columnas de forma destructiva.

Para repetir el bloque principal de Atrio:

```powershell
node --experimental-strip-types --test tests/client-visible-entry.test.mjs tests/gateway-visible-entry.test.mjs tests/gateway-visible-entry-route.test.mjs tests/gateway-chat-bootstrap.test.mjs tests/gateway-visible-lead.test.mjs tests/advisor-automatic-badge.test.mjs tests/message-origin.test.mjs tests/advisor-analytics.test.mjs tests/client-install-offer.test.mjs tests/widget-reminders.test.mjs tests/meta-lead-retries.test.mjs tests/chat-sticker-integrations.test.mjs tests/external-request-settings.test.mjs
node tests/client-visible-entry.browser.mjs
npm run typecheck
```

La prueba SQL requiere `ATRIO_VISIBLE_ENTRY_PGLITE` apuntando al módulo local instalado de PGlite y `node --test tests/gateway-visible-entry-database.test.mjs`. Sin esa variable se omite expresamente; no debe contarse como SQL validado.
