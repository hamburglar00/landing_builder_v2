# Medición por intento y arranque del chat — 03/11/2026

Estado: implementación local, sin commit, push, migración productiva ni despliegue de este lote. Conserva el trabajo local anterior de Template 9.

## Cambios implementados

- Contrato de diagnóstico común para Builder, clásico y los cuatro gateways. `attempt_id` y `attempt_number` acompañan el contexto firmado existente. Son identificadores de observación: no autentican, no seleccionan asesor y no sustituyen las claves de idempotencia.
- Un CTA o un nuevo ingreso automático inicia un intento. Los reintentos de transporte conservan identidad, cuerpo, política de recuperación e intento; agregan `entry_retry`. Un nuevo CTA se distingue del anterior. `account_kind` proviene exclusivamente del `is_new` de API2: `new`, `existing` o sin dato.
- Navegación real: DNS, conexión, TLS cuando existe, espera de primera respuesta, descarga y tiempo hasta `responseEnd`. Se distinguen landing, preparación y página del gateway. Una conexión reutilizada puede informar cero; la ausencia de la API no se interpreta como cero. Conexión incluye TLS cuando corresponde: no sumar ambas.
- Tiempos existentes de destino (scope, resolución, fallback y total), bootstrap de identidad, contexto de Builder, resolución de jugador en Atrio, cuenta en API2, vínculo en Atrio y creación del handoff. Los headers numéricos permitidos de API2 añaden consulta local, creación, verificación y finalización cuando el emisor los ofrece. Si no llegan, no se inventan muestras.
- Login del gateway y confirmación de la sesión del navegador separados. Se conservan los hitos de iframe, bootstrap autenticado, bienvenida, banco y compositor utilizable. `casino_account_ready` indica que la respuesta de cuenta ya llegó; su instante puede incluir finalización/vínculo/handoff. Para aislar el alta usar `casino_account` y las subetapas del proveedor. El evento histórico `account_ready` no cambia su significado.
- Las métricas nuevas usan los lotes existentes: no hay una petición por fase, nombres parciales, credenciales, respuestas crudas, URLs, FBC, IP ni texto libre. Se conservan ownership, RLS, grants de servicio, deduplicación, retención, 20 eventos por lote, 200 por flujo y límite por minuto. El cliente limita su producción a 120 por documento. Varios reintentos pueden agotar estos límites; una muestra faltante no demuestra abandono.
- En preparación p1 se elimina el GET de contexto de diagnóstico: `/complete` ya lo devuelve. Los eventos previos esperan en memoria. El clásico conserva la lectura de su cookie. Esto no elimina ni reemplaza comprobaciones de cuenta o sesión.
- Atrio difiere el selector de emojis, el selector de stickers y las animaciones/modales de promociones hasta abrirlos. El proveedor de stickers, su contexto único, envíos e idempotencia permanecen en el módulo inicial. Se conserva la pestaña seleccionada. Una descarga fallida muestra un reintento y mantiene el compositor. Implementación única para widget, chat directo y los cuatro gateways.

Consulta reproducible: [entry-performance-report.sql](../../scripts/entry-performance-report.sql). Agrupa por intento y por cuenta nueva/recuperada; diferencia los intentos con reintentos observados. Las fases anidadas/paralelas y sus percentiles no se suman. El formulario y el tiempo de lectura/escritura del cliente se distinguen del tiempo de ingreso iniciado por el CTA.

## Qué información viaja y qué se puede reunir

| Tramo actual | Información necesaria | Tratamiento |
| --- | --- | --- |
| Navegador → Builder, HTML | Configuración efectiva publicada, marca, recursos y opciones | Configuración estable. |
| Builder → Atrio, destino | Landing, proveedor/tarjeta, asesores permitidos, pool y vínculo del navegador | Ya se precalcula y se reutiliza la promesa. La selección de un pool dinámico sigue siendo una decisión de Atrio. |
| Builder → Atrio, jugador | Destino elegido, identidad persistida, datos completados, promoción; devuelve jugador, gerencia/agencia y conexión | Resolver la cuenta exacta en el intento; no crear otra identidad por una caché. |
| Builder → API2 → casino | Jugador externo, gerencia/agencia, proveedor y nombre; devuelve cuenta nueva/recuperada | Resultado operativo en vivo. Los secretos del proveedor no se copian al navegador ni a un catálogo público. |
| Builder → Atrio y gateway | Vincular la cuenta y emitir el pase | Ya corren en paralelo. |
| Gateway → casino y Atrio | Ingreso/sesión del casino, chat autorizado y mensajes | Confirmaciones en vivo; recursos secundarios del chat ahora diferidos. |

Propuesta de catálogo privado, **no implementada como nueva autoridad en este lote**: mantener una proyección versionada de landing/tarjeta, proveedor/skin, configuración visual, asesor o pool autorizado, referencias de conexión/gerencia/agencia, orígenes gateway y opciones de ingreso. Los cambios de Builder, Atrio o API2 publicarían una actualización después de guardarse en su sistema de origen; una tarea periódica reconciliaría versiones omitidas. El intervalo debe elegirse con datos de volumen y frescura; un cron por sí solo no garantiza actualización inmediata.

Para llevar esa propuesta a código falta definir el propietario de cada dato, los puntos concretos de actualización y la política de versiones. No se creó un cron que relea todos los registros ni se reemplazó la resolución vigente por una copia que todavía no se sincroniza. Primero, estas métricas permiten cuantificar qué viajes de configuración explican la demora frente a creación/login del casino.

## Verificación local

- 60 pruebas focales de Builder: entrada, recuperación, cuerpo acotado, diagnóstico cerrado, headers permitidos y recursos generados.
- 13 pruebas de clásico: adaptadores, ingreso, identidad, atribución y las cuatro variantes del formulario rápido. Tipos de ambos motores sin errores.
- 67 pruebas por gateway, 268 en total: preparación, contexto/cookie, datos de diagnóstico, transición y sesión. Tipos de los cuatro sin errores.
- 25 verificaciones en PostgreSQL aislado (PGlite): payload anterior, fases/intentos, T9, deduplicación, límites, aislamiento de landing, permisos, constraint de intento completo y consulta de reporte. Sin conexiones a bases productivas.
- 6 escenarios Chromium/WebKit de T7/T8/T9: navegación real, nuevo intento, reintento, tipo de cuenta y privacidad. 8 escenarios previos del colector: captura temprana, reanudación, entrega repetida estable y cookie HttpOnly.
- 10 escenarios Chromium/WebKit del chat real: los cuatro gateways y chat directo, sin descarga de herramientas antes del compositor; emoji, stickers, pestaña persistida y promoción al abrirse. HTTP interceptado antes de navegar, sin eventos ni operaciones productivas.
- 18 pruebas de transporte/polling/stickers; 12 escenarios Chromium/WebKit de polling y 8 del ingreso visible, aprobados. La prueba de polling esperaba el DOM antes de enviar visibilidad; se corrigió para esperar `widget.ready`, como hace el padre real, y avanzar su reloj simulado durante la lectura inicial. No se modificó el controlador productivo de polling para resolver esa carrera del fixture. Se mantienen las verificaciones de cadencia, pausa, cierre, lectura y sesión inválida.
- Build de Atrio y Builder completados; build de Ganamos+ para Cloudflare completado con las cinco verificaciones de query del Worker. Sin despliegue. SDK canónico sin cambios: `a6bc5790f665e785d6c25263a8e4c21fff5d719071e4a536941ce43d7fab41df`.
- Comparación controlada con esbuild, mismo entry y dependencias: JavaScript inicial 427735 → 391966 bytes; gzip 125232 → 117105. Diferencia: 35769 bytes, 8127 gzip. El grafo inicial pasa de un archivo a cinco compartidos en ese empaquetador. No es una medición de transferencia de Next ni una garantía de segundos ganados. El build real de Next también emitió chunks separados para las herramientas; el efecto sobre tiempo real debe medirse después de publicar.

## Activación y límites

1. Revisar los cambios locales preexistentes de T9 junto con este lote; no publicar por accidente una selección parcial de archivos generados.
2. Aplicar primero las migraciones locales pendientes de Builder en orden, incluida `20261104003407_entry_attempt_timings.sql`, posterior a la migración de T9. Los payloads anteriores siguen siendo válidos. No reescribir ni reenviar conversiones históricas.
3. Publicar los colectores/productores de Builder y clásico coordinados con los cuatro gateways y el Worker de Ganamos+. Los recursos con hash previos se conservan para HTML ya emitido. Publicar Atrio para activar sus chunks diferidos.
4. Confirmar commits/deployments públicos y recoger cohortes reales nuevas antes de atribuir una mejora de segundos. La prueba aislada no certifica Instagram/Facebook en iPhone ni el casino real.

No hay cambios de API2, operaciones financieras, crédito/retiro, selección de asesor, configuración de Continuar ni eventos comerciales de Meta en este lote.
