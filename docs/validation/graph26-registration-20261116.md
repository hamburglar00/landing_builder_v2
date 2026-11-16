# Graph v26 y altas confirmadas por fecha — 16/11/2026

Autorizado implementar, verificar y publicar. Base Builder main `3149d2b3`, comprobada contra producción `dpl_AkX9HnudAL5E1JyjGYtfa9r48C3v`. Nexo parte de `5fd72a3`, descendiente documental del runtime publicado `1071c1e` / `dpl_6zqAc7az7RGHMxNo5ME2tw6CVoyy`. No se integra trabajo de recorridos de otra sesión.

Checkpoint `../.checkpoints/graph26-registration-20261116-1424`: bundles verificados de Builder/Nexo y 27 worktrees con HEAD, parches binarios, índice y nuevos archivos no ignorados. No incluye secretos ignorados ni bases productivas.

La consulta añade conversiones vinculadas a altas confirmadas en el período, con correspondencia exacta propietario/landing/promo y asesor Atrio. Mantiene los filtros de visibilidad y ocultos y no traslada el CTA al nuevo día. La medición sigue separada de CompleteRegistration publicitario. Paginación y eliminación de duplicados incluidas; no se reescriben eventos históricos.

Graph: defaults de UI/configuración, receptor, retry y comprobador a v26. La migración actualiza sólo v25, vacíos/nulos y defaults de las dos tablas de configuración convencional. Versiones diferentes y WhatsApp Cloud API conservan sus pins. El test endpoint importa el shared actualizado. Pixel SDK, IDs, fecha, payload, event_source, filtro de origen y deduplicación mantienen su contrato.

Prueba real en píxel en desuso autorizado `989122687083119`, sólo Test Events e identidad sintética: seis solicitudes aceptadas con HTTP 200, events_received=1 y cabecera facebook-api-version=v26.0. Contact/Lead/CompleteRegistration website, Lead/Purchase chat y ConnectionTest. Ninguna fila de negocio creada; credenciales sólo en memoria. [Recibos](graph26-live-test-20261116.json).

Validación inicial: 38 pruebas frontend (5 regresiones de consulta incluidas), TypeScript Builder, 24 escenarios de handlers Purchase/retry en v26, 66 escenarios de recibos y 20 de recorridos/aislamiento. Nexo: pruebas propias del reporte por fecha y dispatch v26. Los tres bundles Edge previos coinciden íntegramente con main: 19/19, 14/14 y 8/8 archivos.

La tabla oficial de [versiones Graph](https://developers.facebook.com/docs/graph-api/changelog/versions/) enumera v26 publicada el 29/07/2026. Su changelog detallado respondió 429 en esta revisión; la aceptación y compatibilidad de nuestros contratos se comprueban con tráfico de prueba y handlers reales simulados. Esto no certifica atribución futura en campañas.

La compilación local con Vercel CLI falló por ENOSPC durante instalación, antes de crear candidato. Se retiraron únicamente dependencias temporales nuevas y la copia local de un audit anterior; se conserva el checkpoint. La publicación usará compilación remota de Vercel y comprobación READY antes de asignar dominios.

Publicado y comprobado. Builder comiteado y pusheado en main `bdb631951516a11e27d9045dfe90768ab685d86b`; migración aplicada `20261116144142_graph26_capi` y archivo local alineado con esa versión. Doce configuraciones base y veinte píxeles quedaron en v26, con sus defaults comprobados.

Funciones ACTIVE: conversions 182, retry-failed-conversions 58, conversions-test 19. Lectura posterior verifica exactamente 19/19, 14/14 y 8/8 archivos; verify_jwt=false y autenticación propia conservados. Petición interna sin firma con nombre receptor, cron sin secreto y test endpoint sin sesión: 401. Un sobre vacío sin receptor devuelve 400 por validación, comportamiento existente.

Frontend Builder final `dpl_GLiuw9A7aFfky9zqn7nS7BD8hqZh`, construido desde Git main bdb63195, READY y comprobado en constructor.panelbotadmin.com y mkt.panelbotadmin.com. Candidato previo `dpl_DtUxy3PmwCZS5cST7n53EUAvsUvV`, construido/remotamente probado y promovido, sustituido por el despliegue de main. Login 200 y prueba de conexión sin sesión 401.

Nexo `1182a2057b37f71ac697729ba24f1862e7cbd75d`, pusheado a fix/graph26-registration-20261116, deployment `dpl_5zf6F81G4uoqUG4KBPAay6Bjz4Sx` READY. Dominios nexobet.fun, www.nexobet.fun y nexobet-seven.vercel.app comprobados contra ese SHA. Login/warmup 200; chat sin sesión y bridge con slug válido sin firma 401. Sin migración Nexo. Los datos y la identidad del lote paralelo permanecen independientes.

Resultado final: 169 pruebas Deno, 64 frontend Builder, 45 Nexo, TypeScript y ambos builds remotos aprobados; 24 comprobaciones de handlers Purchase/retry v26, 66 de recibos y 20 de recorrido/aislamiento. Marketing 1.3.1: 24 pins; workspace 1.2.4: 60 pins. Una comparación final confirma 59 verificaciones de parches y archivos nuevos originales sin diferencias respecto del checkpoint.

Muestra natural posterior a la migración, desde 14:41:43 hasta 14:45:44 UTC: siete filas de recibo Purchase chat con events_received=1. No son siete conversiones únicas atribuibles en campañas. No se reenvían eventos históricos para comprobar el despliegue. [Evidencia de producción y reversión](graph26-production-20261116.json).

Lectura de control adicional con la función de consulta real y un cliente administrativo en memoria, sin escrituras: del 1/11 al 17/11, 40 altas confirmadas únicas, coincidentes con la comprobación SQL agregada. La primera lectura no completó la validación; una repetición sin cambios de código terminó correctamente. No se imprimieron datos de clientes ni claves.

Reversión: Builder dpl_AkX9HnudAL5E1JyjGYtfa9r48C3v; Nexo dpl_6zqAc7az7RGHMxNo5ME2tw6CVoyy. Respaldos de funciones previas en .vercel/graph26-edge-backup; conservar IDs/recibos y, si fuera necesario volver de versión, restituir v25 en los mismos campos/defaults sin alterar conversiones ni repetir envíos.
