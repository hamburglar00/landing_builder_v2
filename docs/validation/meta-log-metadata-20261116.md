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

Pendiente registrar: versión de migración aplicada, verificación posterior de esquema/funciones, commit/push a main, build productivo y dominios READY, muestra natural y reversión.
