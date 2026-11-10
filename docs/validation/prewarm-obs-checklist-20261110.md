# PREWARM-OBS — checklist de entrega

Corte documental: 10/11/2026 16:48 UTC. La implementación está integrada en worktrees del lote; el backend y Atrio están publicados. Los demás despliegues y el cierre global siguen pendientes. El registro persistente es [entry-roadmap.json](../optimization/entry-roadmap.json).

| Punto | Estado y evidencia | Cierre pendiente |
| --- | --- | --- |
| PRE-01: prewarm antes de CSS | Doce combinaciones T1–T6 × motores con CSS retenido, una sola consulta; bootstrap común T1–T9. | Publicación frontend y comprobación pública. |
| PRE-02: servidor/transporte | Cinco fases Edge y request UUID; CORS local Chromium/WebKit: 2 GET distintos con 1 OPTIONS final frente a 2 del baseline. Edge v27 ya publicada. | Muestras comparables para afirmar ahorro productivo o justificar optimización de DB. |
| PRE-03: caché | Guarda común de 90 s; fair/weighted_quota excluidos conforme al endpoint; sin modificar reservas/reparto/RPC. | Publicación frontend. |
| PRE-04: listo al clic | Readiness/outcome y espera efectiva; porcentaje por intento único, muestra/excluidos explícitos y clic→outbound. | Datos posteriores comparables; salida solicitada no demuestra WhatsApp abierto. |
| OBS-01: relojes | Navegación/BFCache separada de flow24h e intento; early/factory adoptan los mismos UUID. | Publicación restante. |
| OBS-02: correlación | UUID en solicitudes propias de landing, cuatro gateways, SSR/chat; Nexo T9 con ingesta nativa. | Publicación restante; granularidad interna nueva de API2 sigue local. |
| OBS-03: versiones | Landing release y emisor/component release separados; source desconocido conservado. | Muestra por cohortes; alias público no persistido. |
| OBS-04: chat y billetera | Chat utilizable independiente; resultado de billetera cerrado y visibilidad después de render. Atrio publicado. | Publicar/verificar módulo Nexo. |
| OBS-05: entrega | ACK por IDs, proof por pestaña, límites/dedup, pérdida acotada. Dos esquemas aplicados. | Publicación restante y observar cobertura; cierre/offline puede perder eventos. |
| REG-01: cierre conjunto | Checkpoint de diez repositorios; regresiones descritas abajo. | Matriz final, regresión global Nexo y publicación/verificación de cada producto. |

## Regresión verificada

- Builder: 492 aprobadas; clásico: 47 aprobadas. Tipos completos de ambos motores aprobados. Gateway Rey: 550 aprobadas y 11 omitidas por condiciones existentes; Ases: 475; NET: 481; Multi: 517. No se invocaron proveedores reales.
- Teléfono: 42/42, incluidos 18 escenarios Chromium de plantillas/errores y 21 VM/Edge; fixture CORS real Chromium/WebKit separado. Evidencia local Builder: `.local/prewarm-obs-20261110/phone-validation.md` y `phone-tests-final.log`.
- Contrato, collector, bootstrap, navegación y convivencia T7: 28 aprobadas. Backend Builder: 63. SQL PostgreSQL en memoria: 32 verificaciones de validación, roles y límites exactos 300/2000/3000 con dedup sin consumo repetido.
- Reporte de porcentaje listo al clic y clic→outbound: 23 verificaciones PostgreSQL en memoria (`scripts/test-entry-performance-report.mjs`); incluye adaptación a `nx_entry_funnel_events`, valores NULL/sin muestra, contexto incompleto y duplicados sin inflar el denominador.
- Nexo nativo: 17/17 con seis escenarios browser Chromium/WebKit, runtime disponible/tardío/ausente hasta salida. Informe en worktree Nexo: `.local/prewarm-obs-20261110/nexo-native-funnel-validation.md`. No reemplaza la suite global de Nexo ni demuestra ejecución real de proveedor/DB.
- Sincronizadores: cuatro pruebas de resolución de mapa; no apuntan a API2/Panel3. Worker: tres pruebas de headers internos conservados hacia servicios propios y excluidos del relay al casino; UUID nunca autoriza.
- La matriz integrada de 18 combinaciones por navegador, atribución y regresión global Nexo continúan bajo coordinación de integración. No se marcan aprobadas por inferencia.

## Nexo nativo: brecha cerrada en implementación

La landing propia T9 tenía un camino de alta distinto. Ahora tiene collector/RPC y tablas `nx_entry_funnel_events`/límites propios, con ownership `nx_landings.account_id`/`nx_accounts`; no usa la base de Builder. La migración `20261110163133_nexobet_entry_funnel_observability.sql` ya está aplicada. La landing conserva su dispositivo firmado, controles de origen, registro único y orden de Pixel/CAPI.

`vendor/entry-funnel.json` fija los cuatro módulos canónicos mediante SHA256 y un runtime con URL inmutable. El manifiesto observado referencia runtime `938cad58d5227e6232d2e4f81ff3d7ac43ccb5e9d979d328bf71196d4d38353d`. Los seis escenarios browser usaron ese asset generado, no un reemplazo ficticio de la factory. La publicación de la aplicación y la regresión global de Nexo no están cerradas en este corte.

## Backend y Atrio publicados

- Builder: `20261110163119_entry_funnel_navigation_delivery_observability.sql`; Nexo: `20261110163133_nexobet_entry_funnel_observability.sql`. RLS/roles comprobados; RPC sin EXECUTE para anon/authenticated. Evidencia: `CURSOR/.local/prewarm-obs-20261110/backend-rollout.json`.
- Edge `landing-phone` v27: OPTIONS 200/Max-Age600 y GET/POST de validación 400/no-store. Requisito previo al nuevo fetch default satisfecho. No se seleccionaron números reales durante el smoke.
- Observación posterior Edge v27, 16:31:51–16:46:00 UTC: 17 solicitudes correctas, todas con request UUID y owner/plan/select; cache sin muestra. Medianas total1102,7/owner403,4/plan238,1/select386,9 ms. Sin tráfico de selección de prueba nuestro; no prueba de usuarios humanos ni comparación de rendimiento contra otra cohorte.
- Atrio: main `7514116c8de28057fec70b3f36be427565ba0488`, READY `dpl_57haNjcq8cZ9Q28H4Hj7wqE8H8jv`, `https://www.atrio.website`. Públicas/login y `/embed/warm` 200. Evidencia: `CURSOR/.local/prewarm-obs-20261110/release-status-internal-chat.json`.
- Checkpoint previo: `V2/checkpoints/20261110T154506Z_pre-prewarm-obs`. API2/Panel3 sólo se respaldaron; sus cambios nuevos no se publican con este lote.

## Límites y seguimiento

No hay evidencia aún para afirmar menor p50/p95 productivo, superioridad de un motor ni cobertura completa de todos los clientes. Hace falta un corte posterior por motor/template/release/source comparable, incluyendo casos fríos. ResourceTiming, petición y fases internas se superponen; no sumar percentiles.

El porcentaje usa sólo la primera observación de teléfono por intento con contexto suficiente y readiness conocida. Muestra cero produce NULL; desconocidos, contextos excluidos y falta de outbound quedan visibles. Se separan bases/collector, landing y cohortes; el dominio/alias público no se conserva en la tabla y no se inventa.

Telemetría es best effort: sin runtime, sin red o al cerrar puede faltar incluso el informe de pérdida. Nexo puede completar el alta antes de que descargue el runtime; conserva trazas de contexto/servidor/gateway sin bloquear al cliente. Ingresos antiguos sin proof/ef no permiten reconstruir una pestaña histórica completa.

Rollback: conservar no-store de `landing-phone` en todos GET/POST/errores aunque se revierta la UI; los runtimes nuevos pueden permanecer en pestañas o assets cacheados con fetch default. No restaurar v26 sin preservar esa política. Las columnas aditivas tampoco deben borrarse para revertir código.

Las evaluaciones EXP-01/02/03 siguen separadas: dos fases clásicas y login combinado preparados pero apagados; documento único/precuentas/Redis/regiones requieren evaluación propia. No se habilitaron como efecto lateral de PREWARM-OBS.
