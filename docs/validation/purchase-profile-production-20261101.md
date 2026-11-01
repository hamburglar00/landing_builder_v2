# Purchase durable y paridad de Atrio — publicación 01/11/2026

Publicado con autorización explícita del usuario para commit, push, migración y despliegue. También se corrigió el perfil fuera del widget y su tema. El mensaje de error del comprobante no cambió; este lote no publica API2 ni ejecuta operaciones monetarias.

## Versiones

| Componente | Fuente | Producción |
| --- | --- | --- |
| Builder | `fd8b5b94e34a2279a3bf96b519a6d0f48dc0629c` | recepción durable y worker central |
| `conversions` | 12 archivos idénticos al commit | v174 ACTIVE, `verify_jwt=false`, SHA256 `d481bc111d16eac5a6a208d0925d6fae13155d8b16a80abb547b428eb9095ded` |
| `retry-failed-conversions` | 6 archivos idénticos al commit | v49 ACTIVE, `verify_jwt=false`, SHA256 `37ea7592e61c4b2c91271cfe1b82c22a24d134b31dab7e68e1dda1668ef2c1d7` |
| Atrio | `af9343090cbdb1d08739ebd05debf764574ccc1e` | `dpl_6G9Ekr8pMabyiwXxn9RugEUJnQPd`, READY y promovido |
| Cola/inbox | migración `20261101000753_durable_purchase_ingest_queue.sql` | aplicada; SHA256 `190d0a9e5bf66d68d7b6dedef61262bc690780b6aab2b71bac626af8162c4c15` |
| Índice de recuperación | migración `20261101152327_purchase_ingest_recovery_index.sql` | aplicada; SHA256 `9f74913d0974bec443a6b7eea2bb36687122272cbf5304c0a8c2fe7844925867` |

La cola fue creada sin importar filas anteriores. RLS habilitada, sin lectura anónima o de usuarios autenticados y RPC operativas exclusivas de servicio. El cron privado está activo cada minuto. El aviso informativo del advisor por RLS sin políticas en esta tabla es deliberado: no se abre una política pública para silenciarlo.

El orden fue esquema → retry v49 → conversions v174. La instancia antigua de retry observada cerró antes de activar la admisión. Atrio se construyó desde un snapshot Git sin archivos de entorno y se promovió tras READY. Los servicios únicos cubren Rey, Ases, NET y Multi Skin. Los cuatro SDK coinciden con el canónico; no se republicaron los gateways ni el Worker de Ganamos+ por este lote.

## Verificación e incidente detectado en producción

El primer Purchase real recibió 202 en 1011 ms después del guardado. El worker/cron autenticado respondió 200. En tráfico posterior, cinco recepciones de la ventana observada devolvieron 202 con un máximo de 1,85 s. Esto mide esas entregas, no constituye una garantía universal de latencia.

La validación productiva detectó una carencia del lote: la nueva consulta de recuperación por receptor y `purchase_event_id` no tenía un índice específico. En datos reales provocó `statement timeout`, retrasó trabajos y agotó los ocho intentos de un recibo. Los mocks del handler y la fixture inicial no detectaban esa diferencia de volumen/plan. Se agregó un índice no único `(user_id, purchase_event_id) INCLUDE(id) WHERE estado='purchase'`, conservando datos y reglas. EXPLAIN ANALYZE productivo verificó `Index Only Scan`, cero lecturas del heap y 20,934 ms totales, incluidos 17,665 ms para elegir el receptor del ejemplo. Una nueva prueba SQL usa 20.003 filas y comprueba el plan sin forzar el planner.

El recibo agotado fue revisado individualmente: se había aceptado después de activar esta cola, su claim estaba en error, no tenía conversión persistida ni evidencia de aceptación CAPI. Se reabrió solamente su metadata de reintento con guards de UUID, estado, intentos, fecha, hash, reserva y ausencia de conversión/otros trabajos activos. No se llamó al emisor ni se ejecutó una carga. Se guardó evidencia antes/después fuera del repositorio; payload, contexto, fecha original y Meta event ID permanecieron iguales.

El cron normal lo completó el 01/11 a las **15:27:04 UTC**, en un intento: exactamente una conversión y CAPI `enviado`. Comprobación independiente a las **15:30:46 UTC**: **249 recibos completados, cero queued/processing/failed**. El hash y el `event_time` del recibo recuperado coinciden con los originales. No se crearon eventos de prueba ni se reprodujeron conversiones anteriores para verificar la publicación.

Un HTTP 202 confirma persistencia, no entrega a Meta. Los fallos transitorios conservan el recibo y reintentan; ocho fallos quedan como `failed` para investigación, sin borrar datos. Es necesario observar esa cola: la implementación no promete entrega infalible ni un único request HTTP ante crons concurrentes. La deduplicación mantiene el mismo event ID. Los filtros CAPI existentes pueden omitir legítimamente un evento según configuración, origen o fecha.

## Pruebas

- Deno: 114 casos; typecheck de ambos entrypoints.
- Worker/retry: 49; aceptación: 9; handoff: 8; URL: 21; fechas: 10; diagnóstico: 7.
- SQL: 20 escenarios de cola y 4 del índice, más sus contenedores TAP. PGlite prueba transiciones, permisos y plan, sin certificar contención entre sesiones independientes.
- Atrio: imágenes 12 escenarios / 24 superficies; perfil 24 escenarios, Chromium/WebKit, móvil/escritorio y tres temas; diez pruebas focales de credenciales, quince regresiones de mensajes; TypeScript y ESLint.
- Smoke HTTP anónimo sobre `https://www.atrio.website`: login, Diana y formulario del bot 1045 en 200; CSS nuevo presente; credenciales sin sesión en 401, selector de cuenta u Origin ajeno en 403, todas sin caché; worker público sin autenticación en 401. No se ejecutó JavaScript productivo ni se revelaron credenciales para ese smoke.
- El dominio raíz conserva su 308 al canónico `www`. La conexión local al IP del apex agotó espera; se verificó el 308 usando otro edge y el canónico respondió normalmente. No se cambió DNS por este lote.

Evidencia privada local: `.codex/tmp/purchase-production-release-20261101/` (paquetes, fuentes anteriores, smoke y auditoría del recibo). Evidencia visual: `.vercel/chat-image-presentation-20261031/` y `.vercel/client-profile-parity-20261031/` en Atrio. No publicar entornos, secretos de scheduler, tokens ni credenciales con esos artefactos.

## Reversión

Conservar tabla, inbox link, índice y worker/cron mientras existan recibos aceptados. No volver sin más a las funciones v173/v48: eso dejaría el trabajo durable sin su consumidor o quitaría la exclusión CAPI. Si se revierte la admisión, mantener el consumidor compatible hasta vaciar la cola. Conservar IDs, fechas y payloads; no borrar reservas ni importar históricos para revertir.

Atrio anterior: `b7b1bb6` (documentación sobre fuente `a7f7920`), deployment `dpl_B4cnaRYgmv9Mqk1cWpP1G7feFcc6`. Fuentes Edge anteriores respaldadas: conversions v173, SHA256 `8316491ef1f3ffe626dfcf9750a2b34b977b3a79e6458ffe2ce288633b1d2101`; retry v48, SHA256 `914f1161c511022166e23647b5772bb890adb73ab1ccbc170cf88375da04b22a`.
