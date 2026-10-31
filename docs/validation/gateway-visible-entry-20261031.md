# Inicio automático al llegar al chat — 31/10/2026

## Estado de la entrega

Implementación y verificación locales completadas. El usuario autorizó posteriormente aplicar la migración y desplegar el lote completo; la publicación está en curso. Retoma el pedido de inicio automático aprobado a las 12:06 de Argentina, recuperado del historial después del cierre de VS Code. El lote anterior de recuperación de ingreso sí estaba publicado y se documenta en `entry-recovery-20261031.md`.

## Comportamiento

- El padre espera el chat hidratado, el final de su animación, documento visible y transición retirada antes de anunciar visibilidad. Se validan origen, ventana y proveedor del mensaje entre padre e iframe. Una precarga cerrada no dispara el inicio.
- Atrio espera dos cuadros de render y solicita `visible_entry` usando exclusivamente la sesión firmada. No recibe identidad, mensaje, campaña ni datos bancarios elegidos por el navegador.
- La conversación nueva guarda un solo saludo argentino sin signos de apertura, seguido de la bienvenida configurada y los datos bancarios actuales. Se conservan las variables de bienvenida, incluida la consulta privada de clave cuando corresponde. Historial anterior no se reescribe. Si un cliente ya escribió durante la preparación de su bienvenida, prevalece ese intercambio real.
- `source=gateway_visible_entry` y `automatic=true` distinguen el saludo. El asesor ve un ícono de bot discreto junto al horario; también lo muestran otras automatizaciones identificadas por metadatos, sin inferir el origen a partir del texto.
- CONTACT conserva su disparador. LEAD se reserva al confirmar en servidor una llegada visible, con deduplicación por jugador y campaña y el payload persistido para reintentos. Una nueva campaña en una conversación antigua tiene evento y fecha nuevos. No depende del envío de un mensaje humano ni del éxito del proveedor bancario.
- El saludo no entra en el flujo del bot, notificaciones de mensaje humano, análisis de comprobantes, métricas de escritura/respuesta, reparto por conversaciones con mensaje humano ni ofrecimientos/recordatorios de instalación. Las visitas conservan su semántica anterior.
- Full Carga revalida los datos bancarios al llegar. Una tarjeta histórica sigue en el historial, pero no certifica que el CBU actual esté disponible. La deduplicación de tarjetas compara los datos actuales; no se introduce una caché de datos bancarios.
- Hasta tres solicitudes de inicio, cada una con doce segundos de límite incluyendo el cuerpo JSON, con pausas breves. Se cancelan al desmontar, se ignoran respuestas obsoletas y no se inicia otro intento estando oculto. El formulario de mensajes sigue utilizable.
- El SDK conserva su arranque diferido hasta la respuesta final de disponibilidad del chat/datos bancarios. La señal nueva `visibleEntry:true` evita que el gateway solicite por separado la tarjeta automática y permite retirar la transición antes del intercambio inicial.

## Archivos y alcance

- Atrio: `src/lib/gateway-visible-entry.ts`, `src/lib/client-visible-entry.ts`, `src/hooks/use-gateway-visible-entry.ts`, rutas del chat, bootstrap, contrato firmado, shell cliente, inbox asesor, clasificación de mensajes e integración/analíticas.
- Migración: `internal-chat/supabase/migrations/20261031150959_gateway_visible_entry.sql`. Agrega estado pendiente y primera llegada visible a conversación, índice único del inicio y RPC exclusivos de servicio. Actualiza las dos consultas de métricas/reparto para excluir la introducción automática. Conserva privilegios y políticas.
- Los cuatro gateways comparten visibilidad y transición. Se agregaron `scripts/sync-gateway-chat-visibility.mjs` y `scripts/check-gateway-chat-visibility.mjs` en Builder. Runtime T7/T8 y renderer clásico regenerados; assets anteriores conservados.
- Sin cambios en API2, Panel3, cuentas, saldos ni movimientos. El acceso directo de Atrio conserva su comportamiento. La misma implementación de Atrio sirve a Rey, Ases, NET y Multi Skin.

## Verificación

- Atrio: 69 pruebas focales y regresiones de entrada, LEAD/reintentos, bot, analíticas, instalación y recordatorios; TypeScript y lint de módulos nuevos correctos.
- SQL: doce grupos en PostgreSQL PGlite desechable, con orden estricto, reintentos, skin independiente, permisos, carrera con mensaje humano, datos bancarios y funciones reales de directorio/reparto. Docker respondió 500: PGlite no demuestra concurrencia entre conexiones independientes.
- Cuatro gateways: 103 pruebas de assets y transición. Builder/clásico: 35 pruebas de recursos compartidos. TypeScript correcto en los seis proyectos web.
- Navegador: 56 escenarios de los gateways y SDK en Chromium/WebKit; ocho escenarios adicionales con el shell React real, los tres temas, comprobación de origen/ventana, apertura/reapertura y una tarjeta histórica sin datos bancarios actuales confirmados.
- Burbuja real del asesor renderizada con/sin automatización: ícono, horario y recibos conservados. No hubo solicitudes reales de negocio, mensajes productivos ni eventos de prueba a Meta.
- Las simulaciones de navegador no certifican dispositivos físicos dentro de Facebook/Instagram. No se afirma build productivo Next/Worker ni despliegue de este lote.

## Orden de publicación cuando corresponda

1. Aplicar y comprobar la migración de Atrio antes de desplegar su código nuevo.
2. Publicar los cuatro gateways, incluido el Worker de Multi Skin, y los recursos compartidos de Builder/clásico. El padre nuevo conserva compatibilidad con el iframe anterior.
3. Publicar Atrio después de verificar el handshake de los cuatro padres. Un padre antiguo anuncia apertura detrás de la transición: publicar primero Atrio podría contar una llegada prematura.
4. Verificar los assets y el comportamiento público sin generar jugadores ni conversiones de prueba.

Para repetir el bloque principal de Atrio:

```powershell
node --experimental-strip-types --test tests/client-visible-entry.test.mjs tests/gateway-visible-entry.test.mjs tests/gateway-chat-bootstrap.test.mjs tests/gateway-visible-lead.test.mjs tests/advisor-automatic-badge.test.mjs tests/message-origin.test.mjs tests/advisor-analytics.test.mjs tests/client-install-offer.test.mjs tests/widget-reminders.test.mjs tests/meta-lead-retries.test.mjs tests/chat-sticker-integrations.test.mjs tests/external-request-settings.test.mjs
node tests/client-visible-entry.browser.mjs
npm run typecheck
```

La prueba SQL requiere `ATRIO_VISIBLE_ENTRY_PGLITE` apuntando al módulo local instalado de PGlite y `node --test tests/gateway-visible-entry-database.test.mjs`. Sin esa variable se omite expresamente; no debe contarse como SQL validado.
