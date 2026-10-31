# Recuperación de ingreso y diagnóstico por etapa — 31/10/2026

## Alcance

Ambos motores de Template 7/8, Atrio y los cuatro gateways (Rey, Ases, NET y Multi Skin, incluido Cloudflare). No cambia API2, Panel3, Contact ni operaciones financieras.

- Bootstrap fallido admite un nuevo intento deduplicado; destino tiene un máximo de 12 s incluyendo el cuerpo. Se cancelan solicitudes sustituidas y se ignoran respuestas tardías.
- Al restaurar una página desde el historial se rehabilita el formulario sin perder nombre, selección o identidad. La prueba despacha `pageshow.persisted`; no certifica que todos los navegadores nativos usen BFCache.
- `/resume` acota a 12 s la comprobación de sesión y la lectura de vuelta de la cookie, conservando el retorno previamente autorizado.
- El gateway captura un recibo de recuperación sólo después de validar un pase vigente. Es cifrado, HttpOnly, ligado al origen y a un nonce de la pestaña; dura 30 minutos absolutos y no se prolonga al reintentar. Esta duración no es una espera para crear cuentas.
- Renovar emite un pase nuevo para la misma cuenta, asesor y skin. Rey comprueba el binding existente; los otros adaptadores revalidan el payload. No se llama a creación de cuentas. Un pase vencido por sí solo no autoriza recuperación.
- Renovar el iframe exige una sesión actual y la identidad firmada del iframe anterior. Cambiar de cuenta, asesor, origen o skin es rechazado, incluso si el jugador Multi Skin es compartido.
- La verificación diferida de Rey comprueba el usuario esperado. Timeouts, fallos de red/proveedor y persistencia se registran como pendientes; un rechazo inequívoco o una identidad distinta revoca la sesión.
- La telemetría separa iframe, bootstrap, bienvenida y datos de carga; errores con etapa, categoría y HTTP cerrados. `duration_ms` mide la operación; `elapsed_ms` sigue midiendo desde el comienzo del recorrido. Bootstrap y bienvenida pueden solaparse y no deben sumarse.

## Validación

- Landings: 34 casos nuevos Chromium/WebKit, 44 regresiones anteriores, 58 pruebas Builder y 36 clásicas; tipos correctos. Se reprodujo y corrigió también el bloqueo de Volver después de otro fallo de bootstrap en T8.
- Gateways: 461 pruebas focales (Rey 136, Ases 108, NET 108 y Multi Skin 109), TypeScript y sincronización correctos en los cuatro. Matriz nueva de recuperación: 40/40; matriz anterior adaptada: 64/64 en Chromium/WebKit. HTTP simulado, sin creación de cuentas ni operaciones con proveedores.
- Assets finales regenerados, sincronizados y verificados con 8 smoke de navegador. Build Cloudflare completo y 5 pruebas del parche de codificación de parámetros aprobados.
- Recibo y renovación de chat: 28 pruebas entre los cuatro gateways con firmas reales y cookies cifradas; sin consultas a proveedores. Auditoría independiente sin sustitución de identidad ni extensión del plazo.
- Atrio: 9 pruebas y tipos correctos. Collector: 6 pruebas y 8 escenarios de navegador. No se enviaron contactos de prueba a Meta.
- Base: ambos SQL completos en PGlite PostgreSQL 18.6, 10 grupos de validación. La conexión única no prueba concurrencia ni cron; Docker estaba indisponible y no se modificó.
- Producción: transacción reversible comprobó inserción de duración/etapa, rechazo de campos libres y permisos del RPC. Se confirmó rollback sin eventos de prueba persistidos.

No equivale a E2E en dispositivos físicos dentro de Facebook/Instagram. El E2E real de cuenta Multi Skin sigue sujeto al despliegue/configuración de API2 previamente pendiente; este lote no lo declara terminado.

## Migración y publicación

Builder: `supabase/migrations/20261031131638_entry_funnel_chat_diagnostics.sql`, aplicada por MCP como versión `20261031132341` (`entry_funnel_chat_diagnostics`). Amplía eventos y agrega `error_stage` y `duration_ms`; conserva RLS, permisos exclusivos de servicio, retención, deduplicación y límites. Advisors: sólo aviso informativo esperado de RLS sin políticas en las dos tablas privadas para clientes; no se agregaron permisos públicos.

Atrio: commit `8c7f72414d279ecc8b4ad96db8dc93bd834132d5`, deployment `dpl_HVcJjArhPJpuXZC4G1jgFtCc6YdG`, promovido y READY.

La eliminación de una dependencia temporal aislada de PGlite fue rechazada por revisión automática (`blocked by policy`). Se conservaron los archivos; no se intentó eludir el bloqueo. Las compilaciones web se realizan en Vercel para limitar el uso de disco local.
