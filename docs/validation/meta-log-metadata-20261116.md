# Metadatos del transporte Meta CAPI — 16/11/2026

Pedido explícito: implementar y publicar Builder; NexoBet se trabaja en otra sesión. Base origin/main `5eb793df`, que conserva Graph v26 y los cambios de CDN/arranque publicados después. Checkpoint `../.checkpoints/builder-meta-log-20261116-1554`: bundle verificado y 15 worktrees con HEAD, parches binarios, índice y archivos nuevos no ignorados. No incluye dependencias/secretos ignorados ni base productiva.

Tres campos opcionales nuevos en conversion_logs:

- meta_api_version: versión de la respuesta facebook-api-version válida; fallback a versión solicitada en la ruta. Sólo el identificador vN.N, sin URL/token.
- meta_http_status: respuesta HTTP real. NULL en fallos de red sin respuesta.
- meta_attempt: ordinal HTTP dentro de esa ejecución; main 1–3, cada ejecución posterior de cron comienza en 1. Los contadores durables preexistentes de la cola permanecen separados.

Se incluyen éxitos, errores, respuestas inciertas, reintentos transitorios y fallos de red de los emisores principal y programado. No se cambia la decisión de envío, recibos estrictos, cuarentena Business Messaging, IDs, fechas ni payload Meta. El detalle de éxito refleja el HTTP real, sin texto fijo 200. No se rellenan filas históricas. El endpoint de prueba no persistía logs de negocio y no requiere publicación.

Admin y cliente consultan y muestran los tres campos bajo el mensaje del log. Filas antiguas no muestran metadatos inventados. No se sincronizan fuentes ni se publica Nexo por indicación expresa. Clásico y los cuatro gateways/Worker utilizan el backend único de Builder: sin cambios en sus transportes/SDK.

Validación: 29 escenarios de handlers reales con DB/HTTP simulados para los cuatro eventos, 201/202, 429, recepción incierta y fallos de red; cron Contact/Lead/Purchase preserva sus contadores e identidad. 66 regresiones de recibos/cuarentena, 20 de recorridos/aislamiento, 172 Deno, 8 UI y TypeScript. No se enviaron eventos de prueba a Meta ni se crearon conversiones de negocio.

Preflight Edge: conversions 182 (19/19 archivos) y retry-failed-conversions 58 (14/14) coinciden exactamente con la base revisada. Respaldos en .vercel/meta-log-backup. Migración aditiva sin default ni backfill, conserva RLS y permisos. Aplicar antes de los emisores y del frontend.

Publicado: commit `7cb86ad083d3c12d2e08823c8ae8573ed69b169b`, pusheado a main conservando la revisión productiva `5eb793df`. Migración `20261116160158_meta_transport_log_metadata` aplicada antes de los emisores/frontend; tipos y nulabilidad comprobados. Cero filas anteriores a la publicación con metadatos rellenados. RLS sigue activo y los avisos de seguridad son idénticos al preflight al excluir su fecha de observación.

Funciones ACTIVE y fuentes verificadas después del despliegue: conversions 183 (20/20) y retry-failed-conversions 59 (15/15), verify_jwt=false conservado. Receptor interno sin firma y cron sin secreto devuelven 401. No se cambió conversions-test, que no persiste logs de negocio.

Frontend: candidato construido con entorno productivo `dpl_CWjGayxuriafnvysSuytZ9J1MRQG`, comprobado con login 200 y prueba de conexión sin sesión 401. Despliegue final desde Git main `dpl_BzGbHiA4eeD39dycbrjrLLu24eeN`, READY. constructor.panelbotadmin.com y mkt.panelbotadmin.com apuntan a ese deployment/SHA y responden 200. Los bundles publicados de /dashboard/conversiones y /admin/conversiones contienen el nuevo detalle técnico.

Muestra natural entre 16:03:20 y 16:04:55 UTC: un Contact, un Lead y dos Purchase con respuesta events_received=1 y los campos v26.0, HTTP 200 e intento 1. Son filas de recibo, no resultados atribuibles de campañas. Las pruebas de cron/errores se hicieron con IO simulado; no se forzaron reintentos reales ni se enviaron eventos sintéticos a Meta.

Cuatro verificaciones de parches y archivos nuevos del checkout original coinciden con el checkpoint. Evidencia consolidada: [producción](meta-log-production-20261116.json).

Reversión: frontend previo `dpl_HizrvUYxyv2fadsSs6dTBwzVKh6k`; restaurar fuentes Edge 182/58 desde .vercel/meta-log-backup si fuera necesario. Las columnas opcionales pueden conservarse: no borrar logs ni reemitir conversiones aceptadas. NexoBet no fue modificado ni publicado por esta sesión.
