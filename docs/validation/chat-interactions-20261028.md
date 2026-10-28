# Interacciones y tamaño del chat — 28/10/2026

El cliente y el asesor pueden reaccionar y responder con una cita. La separación es 3 px entre mensajes consecutivos del mismo emisor y 6 px al cambiar de emisor. El widget agrega Maximizar/Restaurar entre Perfil y Cerrar; mantiene el ancho y respeta el teclado. La apertura conserva 520 ms; el cierre usa 720 ms con desvanecimiento final.

## Implementación

- Atrio mantiene una única presentación y control de gestos para el cliente y las dos vistas del inbox. Pulsación prolongada/contexto para las seis reacciones; deslizamiento horizontal o botón para responder. El desplazamiento vertical cancela el gesto. Las vistas previas de las citas interpretan el formato de WhatsApp sin crear enlaces anidados dentro de botones.
- Reacciones y citas viajan en `messages.metadata` con los mecanismos existentes de lectura y Realtime. No hay tablas nuevas ni nuevas suscripciones. Una reacción es una actualización atómica por participante; no cambia el último mensaje, sus contadores ni genera actividad de mensaje, tracking o respuestas automáticas.
- La cita se genera en el servidor, se limita a la misma conversación y conserva una vista previa de hasta 240 caracteres. No permite referencias a avisos internos, mensajes del sistema o invitaciones. Los adjuntos pueden recibir una respuesta de texto citada.
- El gateway usa exclusivamente el jugador y conversación del token firmado. El asesor usa `auth.uid()` y la jerarquía existente. Los RPC legacy anónimos solo acceden al chat sin cuenta vinculada de su slug/device. Las funciones privilegiadas nuevas viven en `chat_private`, fuera de los schemas expuestos; las fachadas públicas son `SECURITY INVOKER`. Un trigger evita falsificar citas y reacciones mediante escrituras ordinarias a la tabla.
- El movimiento y la acción de tamaño del padre se sincronizan con `scripts/sync-gateway-chat-motion.mjs`. Se mantiene la validación de origen y ventana del iframe, inversión rápida, `inert`, movimiento reducido y su adaptación al teclado. La versión del cliente compartida pasa a `chat-interactions-1`.

## Validación

- `internal-chat`: TypeScript y ESLint sin errores; 4 pruebas del handler real del gateway con dependencias aisladas; 11 pruebas de formato/enlaces y 3 pruebas del servidor de respuestas rápidas.
- `tests/chat-interactions-database.test.mjs`: PostgreSQL 17 desechable, roles reales anon/authenticated/service_role, fachadas y SQL de la migración real. Verifica dos actores concurrentes, cambio/eliminación de reacciones, persistencia, conservación de metadatos, límites por conversación, denegación de mensajes internos y de cuentas de gateway al acceso legacy, bloqueo de falsificaciones y rollback de respuestas inválidas.
- `scripts/check-chat-interactions.mjs`: 12 escenarios Chromium/WebKit × tres temas × móvil/escritorio, usando los componentes completos de cliente y asesor. Dos ventanas, HTTP simulado, interacción en iframe, botón Maximizar/Restaurar, geometría 3/6 px, pulsación prolongada, cancelación vertical, deslizamiento, fallo/reintento de reacción, ambos participantes y recarga con citas. [Resultados](chat-interactions-browser-20261028.json).
- `scripts/check-gateway-entry-ux.mjs`: 40 escenarios con los renderizadores y assets reales de los cuatro gateways; confirma tamaño/restauración sin cambiar ancho, rechazo de solicitudes desde la ventana del proveedor, cierre visible durante la compresión, paso de toques, inversión rápida, movimiento reducido, paletas y transiciones. [Resultados](chat-interactions-gateways-20261028.json).
- Se conservan 32 escenarios de arranque diferido de SDK/notificaciones y 4 escenarios de hidratación/horarios. Pasan los tests de assets de los cuatro gateways (15/11/11/10) y las verificaciones de sincronización de movimiento, SDK, instalación, apariencia e ingreso.
- Las pruebas de navegador usan punteros simulados y no certifican el gesto físico ni las barras nativas de un iPhone. No se crean cuentas, mensajes, conversiones, notificaciones ni operaciones financieras reales durante la validación.

## Base de datos

Aplicada y verificada en Atrio `didrpwkdqizivfbapofx`: `20261028193637_chat_reactions_and_replies.sql`. Es aditiva, sin reescritura de mensajes existentes. Verificados permisos de las tres fachadas, bloqueo de helpers y presencia del trigger. La auditoría de seguridad conserva exactamente los avisos previos (6 RLS sin policy, 11 RPC anónimos privilegiados, 23 RPC autenticados privilegiados y protección de claves filtradas desactivada), sin hallazgos nuevos por este lote.

No cambia API2 ni depende del despliegue del programador.

## Publicación

Publicación terminada. [Evidencia pública, hashes de assets y versiones anteriores](chat-interactions-public-20261028.json).

| Aplicación | Commit | Despliegue activo |
|---|---|---|
| Atrio | `a5797cd` | `dpl_JAKyjAkeMzjwbgTaXZ8iH4LghU1y` |
| Rey de Ases | `aeaabb6` | `dpl_BcEMBvQXSURHuDgSVcL38MFDFWSA` |
| Ases del Norte | `21d988a` | `dpl_B5mqizKNZaHhXMbR8yhcf6MPyoeL` |
| Ganamos NET | `0f93e38` | `dpl_J5T1GaG9pSFKX8Qa4ZUqE555zcNz` |
| Ganamos+ Vercel | `1e838fe` | `dpl_H34yfDk2crK4HuKvxafxDGP8sR97` |

Worker público de Ganamos+: `747d0181-8b2b-431c-93c8-832f7858eed7`; anterior `02d76cdd-3b34-4846-9117-a231cb60bce3`. Se conservan variables y secretos con `--keep-vars`. Compilación OpenNext y arranque del Worker correctos.

Los cinco proyectos de Vercel confirman el despliegue activo y el SHA esperado. Los ocho assets JS/CSS descargados de los cuatro dominios públicos coinciden exactamente con las fuentes publicadas. El embed público de Atrio sirve el chunk nuevo `1rwlf5oy2kj-9.js` y los estilos nuevos, con los controles de tamaño, reacciones y respuestas. La vista autenticada del asesor pertenece al mismo despliegue verificado por SHA; no se inició una sesión real para esta comprobación pública.

Atrio se publicó en `fix/atrio-inbox-validation`; los gateways, en `fix/template7-session-reentry`. Builder solo recibe pruebas, sincronización y documentación (`7e51063` y el cierre de esta publicación); no requiere otro despliegue de su aplicación. Árboles locales limpios y ramas pusheadas.
