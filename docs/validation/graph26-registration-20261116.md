# Graph v26 y altas confirmadas por fecha — 16/11/2026

Autorizado implementar, verificar y publicar. Base Builder main `3149d2b3`, comprobada contra producción `dpl_AkX9HnudAL5E1JyjGYtfa9r48C3v`. Nexo parte de `5fd72a3`, descendiente documental del runtime publicado `1071c1e` / `dpl_6zqAc7az7RGHMxNo5ME2tw6CVoyy`. No se integra trabajo de recorridos de otra sesión.

Checkpoint `../.checkpoints/graph26-registration-20261116-1424`: bundles verificados de Builder/Nexo y 27 worktrees con HEAD, parches binarios, índice y nuevos archivos no ignorados. No incluye secretos ignorados ni bases productivas.

La consulta añade conversiones vinculadas a altas confirmadas en el período, con correspondencia exacta propietario/landing/promo y asesor Atrio. Mantiene los filtros de visibilidad y ocultos y no traslada el CTA al nuevo día. La medición sigue separada de CompleteRegistration publicitario. Paginación y eliminación de duplicados incluidas; no se reescriben eventos históricos.

Graph: defaults de UI/configuración, receptor, retry y comprobador a v26. La migración actualiza sólo v25, vacíos/nulos y defaults de las dos tablas de configuración convencional. Versiones diferentes y WhatsApp Cloud API conservan sus pins. El test endpoint importa el shared actualizado. Pixel SDK, IDs, fecha, payload, event_source, filtro de origen y deduplicación mantienen su contrato.

Prueba real en píxel en desuso autorizado `989122687083119`, sólo Test Events e identidad sintética: seis solicitudes aceptadas con HTTP 200, events_received=1 y cabecera facebook-api-version=v26.0. Contact/Lead/CompleteRegistration website, Lead/Purchase chat y ConnectionTest. Ninguna fila de negocio creada; credenciales sólo en memoria. [Recibos](graph26-live-test-20261116.json).

Validación inicial: 38 pruebas frontend (5 regresiones de consulta incluidas), TypeScript Builder, 24 escenarios de handlers Purchase/retry en v26, 66 escenarios de recibos y 20 de recorridos/aislamiento. Nexo: pruebas propias del reporte por fecha y dispatch v26. Los tres bundles Edge previos coinciden íntegramente con main: 19/19, 14/14 y 8/8 archivos.

La tabla oficial de [versiones Graph](https://developers.facebook.com/docs/graph-api/changelog/versions/) enumera v26 publicada el 29/07/2026. Su changelog detallado respondió 429 en esta revisión; la aceptación y compatibilidad de nuestros contratos se comprueban con tráfico de prueba y handlers reales simulados. Esto no certifica atribución futura en campañas.

La compilación local con Vercel CLI falló por ENOSPC durante instalación, antes de crear candidato. Se retiraron únicamente dependencias temporales nuevas y la copia local de un audit anterior; se conserva el checkpoint. La publicación usará compilación remota de Vercel y comprobación READY antes de asignar dominios.

Pendiente al momento de este registro: validación final, commits/push, migración, funciones y frontend por producto. La evidencia de cierre se añadirá después de verificar producción.
