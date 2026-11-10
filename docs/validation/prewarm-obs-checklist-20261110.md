# PREWARM-OBS — checklist de entrega

Corte documental: 10/11/2026 19:33 UTC. Implementación, regresión y publicación de PREWARM-OBS cerradas: backend, Builder, clásico, Atrio, Nexo, los cuatro gateways Vercel y Worker Ganamos+ están publicados y verificados. La comparación productiva de velocidad requiere muestras equivalentes posteriores. El registro persistente es [entry-roadmap.json](../optimization/entry-roadmap.json).

| Punto | Estado y evidencia | Seguimiento |
| --- | --- | --- |
| PRE-01: prewarm antes de CSS | Doce combinaciones T1–T6 × motores con CSS retenido, una sola consulta; bootstrap común T1–T9. Ambos motores publicados y assets verificados. | Sin pendiente de implementación/publicación en estos motores; resultado productivo por comparar. |
| PRE-02: servidor/transporte | Cinco fases Edge y request UUID; CORS local Chromium/WebKit: 2 GET distintos con 1 OPTIONS final frente a 2 del baseline. Edge v27 ya publicada. | Muestras comparables para afirmar ahorro productivo o justificar optimización de DB. |
| PRE-03: caché | Guarda común de 90 s; fair/weighted_quota excluidos conforme al endpoint; sin modificar reservas/reparto/RPC. Publicada en ambos motores. | Observación posterior; no ampliar caché individual. |
| PRE-04: listo al clic | Ambos motores publicados; readiness/outcome, espera efectiva y denominador por intento. Primera ingesta clásica confirmada abajo. | Datos posteriores comparables; salida solicitada no demuestra WhatsApp abierto. |
| OBS-01: relojes | Navegación/BFCache separada de flow24h e intento; early/factory adoptan los mismos UUID. Ocho frontends Vercel y Worker publicados. | Sin pendiente de entrega; observar cobertura. |
| OBS-02: correlación | UUID en solicitudes propias de landing, cuatro gateways Vercel/Worker, Atrio y Nexo T9 con ingesta nativa. | Sin pendiente en este alcance; granularidad interna nueva de API2 sigue local. |
| OBS-03: versiones | Landing release y emisor/component release separados; primeras releases nuevas ingeridas, source desconocido conservado. | Muestra comparable por cohortes; alias público no persistido. |
| OBS-04: chat y billetera | Chat utilizable independiente; resultado de billetera cerrado y visibilidad después de render. Atrio y Nexo publicados. | Observar cobertura posterior. |
| OBS-05: entrega | ACK por IDs, proof por pestaña, límites/dedup, pérdida acotada. Dos esquemas aplicados, ocho frontends Vercel y Worker publicados. | Observar cobertura; cierre/offline puede perder eventos. |
| REG-01: cierre conjunto | Checkpoint de diez repositorios; matriz36, atribución50, unidades/tipos y 37 etapas consolidadas de Nexo aprobadas. Todas las publicaciones verificadas. | Sin pendiente de entrega; comparación productiva posterior separada. |

## Regresión verificada

- Builder: 492 aprobadas; clásico: 47 aprobadas. Tipos completos de ambos motores aprobados. Gateway Rey: 550 aprobadas y 11 omitidas por condiciones existentes; Ases: 475; NET: 481; Multi: 517. No se invocaron proveedores reales.
- Teléfono: 42/42, incluidos 18 escenarios Chromium de plantillas/errores y 21 VM/Edge; fixture CORS real Chromium/WebKit separado. Evidencia local Builder: `.local/prewarm-obs-20261110/phone-validation.md` y `phone-tests-final.log`.
- Contrato, collector, bootstrap, navegación y convivencia T7: 28 aprobadas. Backend Builder: 63. SQL PostgreSQL en memoria: 32 verificaciones de validación, roles y límites exactos 300/2000/3000 con dedup sin consumo repetido.
- Reporte de porcentaje listo al clic y clic→outbound: 23 verificaciones PostgreSQL en memoria (`scripts/test-entry-performance-report.mjs`); incluye adaptación a `nx_entry_funnel_events`, valores NULL/sin muestra, contexto incompleto y duplicados sin inflar el denominador.
- Nexo nativo: 17/17 con seis escenarios browser Chromium/WebKit, runtime disponible/tardío/ausente hasta salida. Informe en worktree Nexo: `.local/prewarm-obs-20261110/nexo-native-funnel-validation.md`. No reemplaza la suite global de Nexo ni demuestra ejecución real de proveedor/DB.
- Sincronizadores: cuatro pruebas de resolución de mapa; no apuntan a API2/Panel3. Worker: tres pruebas de headers internos conservados hacia servicios propios y excluidos del relay al casino; UUID nunca autoriza.
- Matriz integrada: 36/36 escenarios, T1–T9 × ambos motores × Chromium/WebKit, con HTML/assets generados y tráfico interceptado. Atribución: 50/50 escenarios, cuatro proveedores, resolución por ruta/parámetro/automática. Conserva Pixel/CAPI, event_id compartido y deduplicación al repetir.
- Siete sincronizadores y tres generadores comprobados después de integrar `origin/main`; cuatro typechecks de gateways y compilaciones remotas de ambos motores aprobados. Los cambios concurrentes de interfaz/ordenamiento se conservaron.
- Nexo: 37 etapas consolidadas aprobadas (20 de checks/PostgreSQL y 17 de navegador), sin atribuir el resultado a una sola invocación completa. El tramo inicial usó Atrio `7514116`; la integración final conserva el trabajo concurrente `042b47f`, fija Atrio `bd71604` y revalida 303 módulos, diez pins, nueve fixtures, tipos y checks afectados. La etapa final repitió 80 páginas, build productivo y cuatro casos HTTPS (84/84); además aprobaron ocho casos de la nueva tarjeta y 20 de PWA. Los fallos iniciales y sus diagnósticos se conservaron, sin omitir casos para aprobar. Evidencia: `CURSOR/.local/prewarm-obs-20261110/nexo-regression-consolidated-37.json` y `nexo-final-source-hashes.json`.
- Límite público de Nexo: siete pruebas nuevas atraviesan el proxy y el collector. Antes de corregirlo, cuatro reproducían el bloqueo 401 de visitantes; ahora la ruta exacta `/api/entry-funnel` alcanza su validación, las rutas vecinas/cuenta siguen protegidas y los rechazos de origen/payload/RPC se conservan. Suite afectada: 23 aprobadas; TypeScript completo aprobado. Evidencia: `CURSOR/.local/prewarm-obs-20261110/nexo-proxy-validation.json`.
- Revisión independiente del merge: sin bloqueos en controles del asesor, aislamiento del collector/RPC, cron, runtime ni archivos sensibles. El primer preview detectó que Windows había convertido el salto final de tres assets a CRLF. La subida se corrigió a los bytes LF exactos de Git, sin cambiar SHA ni lógica y sin relajar la comparación; el segundo preview comprobó hash/immutable y los límites públicos. La evidencia de transporte enlazada al consolidado conserva hashes anteriores, posteriores y blobs Git.

## Nexo nativo: brecha cerrada en implementación

La landing propia T9 tenía un camino de alta distinto. Ahora tiene collector/RPC y tablas `nx_entry_funnel_events`/límites propios, con ownership `nx_landings.account_id`/`nx_accounts`; no usa la base de Builder. La migración `20261110163133_nexobet_entry_funnel_observability.sql` ya está aplicada. La landing conserva su dispositivo firmado, controles de origen, registro único y orden de Pixel/CAPI.

`vendor/entry-funnel.json` fija los cuatro módulos canónicos mediante SHA256 y un runtime con URL inmutable. El manifiesto observado referencia runtime `938cad58d5227e6232d2e4f81ff3d7ac43ccb5e9d979d328bf71196d4d38353d`. Los seis escenarios browser usaron ese asset generado, no un reemplazo ficticio de la factory. La regresión global consolidada y la publicación de Nexo están cerradas; el dominio productivo sirve ese mismo hash exacto.

## Backend y publicaciones verificadas

- Builder: `20261110163119_entry_funnel_navigation_delivery_observability.sql`; Nexo: `20261110163133_nexobet_entry_funnel_observability.sql`. RLS/roles comprobados; RPC sin EXECUTE para anon/authenticated. Evidencia: `CURSOR/.local/prewarm-obs-20261110/backend-rollout.json`.
- Edge `landing-phone` v27: OPTIONS 200/Max-Age600 y GET/POST de validación 400/no-store. Requisito previo al nuevo fetch default satisfecho. No se seleccionaron números reales durante el smoke.
- Observación posterior Edge v27, 16:31:51–16:46:00 UTC: 17 solicitudes correctas, todas con request UUID y owner/plan/select; cache sin muestra. Medianas total1102,7/owner403,4/plan238,1/select386,9 ms. Sin tráfico de selección de prueba nuestro; no prueba de usuarios humanos ni comparación de rendimiento contra otra cohorte.
- Atrio: la entrega inicial `7514116` quedó READY en `dpl_57haNjcq8cZ9Q28H4Hj7wqE8H8jv`. La revisión final `bd71604da050f61fb63e2d81a3334c30f1e1a319`, descendiente directo, quedó READY a las 18:48:20.539 UTC en `dpl_8vWb6DfC2bA2dALusxp4Z3DNP6Nh`; alias `https://www.atrio.website` verificado. Sólo retira un export de datos no permitido en un wrapper de ruta Next; GET/headers y los 22.776 bytes JSON conservan el SHA256 anterior. Catorce contratos, typegen y TypeScript aprobados. Evidencias: `CURSOR/.local/prewarm-obs-20261110/atrio-openapi-production.json` y `atrio-openapi-public-smoke.json`.
- Checkpoint previo: `V2/checkpoints/20261110T154506Z_pre-prewarm-obs`. API2/Panel3 sólo se respaldaron; sus cambios nuevos no se publican con este lote.

| Producto | Commit funcional | Deployment Vercel READY |
| --- | --- | --- |
| Builder | `39f2be4` | `dpl_HCob1FULurBmNTZurkNDEsfmV5mt` |
| Clásico | `fdc90b8` | `dpl_DwBGfx4CHSeQU94Rotbtmce3wu1H` |
| Atrio | `bd71604` | `dpl_8vWb6DfC2bA2dALusxp4Z3DNP6Nh` |
| NexoBet | `0eb8d60` | `dpl_AwpMmkyNgBhGkF1Vsws1ZBrcgeTu` |
| Rey de Ases | `b0bd698` | `dpl_DZwEphVnJHWEz8o7Ug6imSxcvLaP` |
| Ases del Norte | `9a82b3c` | `dpl_2fQZB22WMsrioZJt6usgfNo5URZ2` |
| Ganamos NET | `b0374b7` | `dpl_CwTZcTvmgv9Q4HL2SyVCyRocydxx` |
| Ganamos+ — Vercel | `0504cb3` | `dpl_BGAGdyvStUyrU7dJ5YxszoZes2UM` |

La tabla identifica las revisiones funcionales de PREWARM-OBS. Antes del cierre documental se integró por fast-forward el avance concurrente de Builder `4d61ca2` (directorio y animación del login), conservando los cuatro módulos de ingreso idénticos a `39f2be4`. El commit posterior que cierra estos tres documentos no añade cambios de código; su SHA, deployment y verificación de los dos aliases de Builder se registran en `CURSOR/.local/prewarm-obs-20261110/final-documentation-release.json`. Para comparar cohortes, distinguir la etiqueta de release de los cambios funcionales efectivamente presentes.

Builder quedó READY a las 17:01:30.933 UTC y clásico a las 17:03:03.626 UTC. Sus tres aliases y los aliases de los gateways se comprobaron por deployment/SHA. Los 21 GET estáticos de los motores verificaron cinco JS nuevos, CSS y JS anterior por dominio: HTTP 200, SHA256 exacto y caché immutable. Los cuatro `gateway-client.js` públicos también coinciden. Esas solicitudes fueron sintéticas: no ejecutaron JavaScript, Pixel ni selección de números. Evidencias en `CURSOR/.local/prewarm-obs-20261110/landing-integration-final.json`, `landing-assets-production.json`, `gateway-release-summary.json` y `gateway-public-assets.json`.

`constructor.panelbotadmin.com` es alias del panel Builder; los enlaces públicos que genera la aplicación usan `mkt.panelbotadmin.com/l/<slug>`. La variable productiva que podría sustituir esa base está ausente. No se amplió la lista de orígenes por el mero hecho de compartir deployment.

Nexo `0eb8d60a8d885def3ac070c809c78f023dad3bec` quedó READY a las 19:31:17.837 UTC, con alias `nexobet.fun` verificado. Conserva Atrio `bd71604`, tres componentes de notificaciones con pin explícito `27a9b73` y los cuatro módulos de Builder `39f2be4`. Preview y producción aprobaron cinco GET seguros cada uno: login/manifiesto 200, runtime exacto e immutable, collector anónimo 405 y cron sin autorización 401. Se verificó la presencia de `CRON_SECRET` en producción, sin ejecutar el cron autenticado ni operaciones de negocio. Evidencias: `nexo-production.json`, `nexo-smoke-preview.json`, `nexo-smoke-production.json` y `nexo-production-push.json` en `CURSOR/.local/prewarm-obs-20261110`.

Worker Ganamos+ se compiló desde el checkout autorizado del mismo commit `0504cb3`, tras resolver la limitación Windows del worktree con junction. Publicado a las 18:46:45.083832 UTC: deployment `5acfaa4a-c5d1-487c-838e-faeece8d0427`, versión `0a69b884-d403-4e8c-8a17-c9d4defe671d` al 100 %. `ganamosnet.global` y el hostname workers.dev respondieron health 200 y sirvieron el asset con SHA256 exacto; se conservaron los 23 bindings anteriores y se añadió la release diagnóstica. Evidencias: `worker-after-release.json`, `worker-safe-smoke-after-release.json` y `worker-bindings-comparison.json` en `CURSOR/.local/prewarm-obs-20261110`. No quedan publicaciones funcionales pendientes en este lote.

## Primera ingesta posterior: cobertura inicial

Ventana 17:01:31–aproximadamente 17:07 UTC, filtrada por las releases nuevas `39f2be4`/`fdc90b8`. Sólo se observaron clásico T2/T5, entorno production:

| source | Navegaciones | Clics con observación de teléfono | Listo al clic | Espera restante observada | Salidas solicitadas | Pérdidas reportadas |
| --- | ---: | ---: | --- | --- | ---: | ---: |
| `unknown` | 4 | 1 | 1 de 1 | 0 ms, una observación | 1 | 0 |
| `synthetic` | 2 | 0 | Sin muestra | Sin muestra | 0 | 0 |

Persistieron navigation UUID, readiness, espera restante y request UUID; las releases antiguas y nuevas permanecen separadas. Esto confirma ingesta, sin demostrar una mejora de velocidad. `unknown` no prueba tráfico humano; no hay muestra constructor en este corte. Cero pérdidas reportadas no demuestra cero pérdidas. No se crearon cuentas, asignaron números ni enviaron eventos Meta para esta comprobación. Fuente: `CURSOR/.local/prewarm-obs-20261110/frontend-first-production-observations.json`.

Corte ampliado 17:03:04–17:59:39 UTC de la nueva release clásica T2/T5: `source=unknown` registra 55 navegaciones y 11 intentos únicos; los 11 tienen readiness y salida observadas, y siete llegaron al clic con teléfono listo. La cohorte `synthetic` permanece separada: dos navegaciones, cero intentos. Este intervalo se solapa con el anterior: no se suman ambas muestras. Sigue sin haber cohorte nueva de constructor/T7–T9 ni baseline equivalente para comparar velocidad. No se generó tráfico de selección ni Meta para la lectura. Fuente: `CURSOR/.local/prewarm-obs-20261110/frontend-production-175939-observations.json`.

Seguimiento de logs Edge 17:03:04–19:02:13 UTC: 171 solicitudes con outcome `ok` y 125 preflight, todas con request UUID; p50 de ejecución de las correctas: 1.278,3 ms. Ese corte no contiene otros outcomes, pero no garantiza cobertura total ni ausencia de fallos de red. Son solicitudes registradas, no personas confirmadas ni una comparación equivalente de velocidad. No se generaron solicitudes de selección para comprobarlo. Fuente: `CURSOR/.local/prewarm-obs-20261110/phone-production-followup.json`.

## Límites y seguimiento

No hay evidencia aún para afirmar menor p50/p95 productivo, superioridad de un motor ni cobertura completa de todos los clientes. Hace falta un corte posterior por motor/template/release/source comparable, incluyendo casos fríos. ResourceTiming, petición y fases internas se superponen; no sumar percentiles.

El porcentaje usa sólo la primera observación de teléfono por intento con contexto suficiente y readiness conocida. Muestra cero produce NULL; desconocidos, contextos excluidos y falta de outbound quedan visibles. Se separan bases/collector, landing y cohortes; el dominio/alias público no se conserva en la tabla y no se inventa.

Telemetría es best effort: sin runtime, sin red o al cerrar puede faltar incluso el informe de pérdida. Nexo puede completar el alta antes de que descargue el runtime; conserva trazas de contexto/servidor/gateway sin bloquear al cliente. Ingresos antiguos sin proof/ef no permiten reconstruir una pestaña histórica completa.

Rollback: conservar no-store de `landing-phone` en todos GET/POST/errores aunque se revierta la UI; los runtimes nuevos pueden permanecer en pestañas o assets cacheados con fetch default. No restaurar v26 sin preservar esa política. Las columnas aditivas tampoco deben borrarse para revertir código.

Las evaluaciones EXP-01/02/03 siguen separadas: dos fases clásicas y login combinado preparados pero apagados; documento único/precuentas/Redis/regiones requieren evaluación propia. No se habilitaron como efecto lateral de PREWARM-OBS.
