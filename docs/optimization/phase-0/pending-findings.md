# Hallazgos pendientes después del cierre de Fase 0

Estado: documentados y NO corregidos. El cierre formal de la línea base no autoriza ejecutar Fase 0C, Fase 1 ni cambios de seguridad. Los tests de caracterización aprobados describen el comportamiento actual, incluidos sus defectos.

## Integridad de conversiones y CAPI: futura Fase 0C, no iniciada

| Hallazgo | Evidencia observada localmente | Estado |
| --- | --- | --- |
| Duplicación concurrente de Lead | Ocho solicitudes simultáneas producen ocho envíos y ocho event_id distintos en ARS y PYG. | NO corregido. |
| Duplicación de reintentos CAPI | Cuatro workers envían cuatro veces el mismo evento Contact, Lead o Purchase, con un event_id compartido, en ambas monedas. | NO corregido; no hay exclusión mutua acreditada entre workers. |
| Procesamiento duplicado de Lead diferido | Una entrada procesada por cuatro workers produce cuatro conversiones, cuatro envíos y cuatro event_id distintos. Drenar la cola no demuestra procesamiento único. | NO corregido. |
| Pérdida de incrementos de reintentos | Contact y Lead pueden persistir retry_count=1 frente a cuatro requests concurrentes. | NO corregido. |
| Límites de cobertura | El harness ejecuta callbacks actuales en VM Node y PostgreSQL/PostgREST reales con esquema acotado. No prueba todo el runtime Edge, la carrera handler/retry ni deduplicación real de Meta. | Ampliación futura, no realizada en este cierre. |

Fuente: handler-concurrency-results.json, contracts.md y phase0c-concurrency-plan.md. El último es exclusivamente una propuesta. Las respuestas de Meta fueron simuladas; no se enviaron eventos reales. Ningún resultado justifica cambiar silenciosamente identidad, payload, atribución o reglas de negocio.

## Seguridad: revisión futura independiente, no iniciada

1. anon/authenticated tienen TRUNCATE sobre ar_name_inferred_sex, ar_phone_area_codes, cron_config y tracking_queue. RLS no bloquea TRUNCATE. Se reprodujo solo localmente con rollback; NO se revocó en producción ni se endureció únicamente local.
2. PUBLIC tiene permisos amplios sobre tablas y secuencia internas de net, incluidos TRUNCATE/MAINTAIN en tablas. La paridad con upstream/remoto NO acredita seguridad. No se corrigió este acceso.
3. El hook antiguo de instalación de pg_net permanece en la plataforma local. El bootstrap evita sus alteraciones exclusivamente al reinstalar nativamente la extensión; una futura operación de instalación/actualización fuera del runner requiere nueva validación. No se modificó el hook remoto.
4. El Bearer histórico del scheduler se clasificó como token personalizado y se encontró solo en el historial almacenado, sin referencias actuales en los lugares inspeccionados. No se acreditó vigencia externa ni se rotó. Su valor nunca se recuperó a artefactos. El seguimiento futuro conserva los límites y recomendación de phase0b-credential-inspection.json.
5. La higiene de .env sí está resuelta: archivo local intacto, ignorado y no rastreado, con clave pública JWT anon legada. Migrar a sb_publishable_ sigue siendo una recomendación futura NO implementada. No se reescribió el historial de Git; la retirada del índice no elimina versiones antiguas.
6. Los advisors locales no están disponibles en CLI 2.75.0. La auditoría estática, revisión de referencias y matriz de roles no se presentan como una auditoría integral de seguridad productiva.

Fuentes: bootstrap-net-access-matrix.json, bootstrap-validation.json, phase0b-schema-review.md, bootstrap-security-advisors.json y phase0b-credential-inspection.json.

## Conversiones y Audiencias: optimización futura, Fase 1 no iniciada

- Conversiones: revisar la carga por pestaña y evitar datasets innecesarios únicamente en una futura implementación autorizada. No se alteraron consultas, fetchers ni comportamiento del frontend.
- Audiencias: el timeout ARS sigue documentado como línea base/riesgo. No se afirma una causa definitiva sin evidencia suficiente ni se repitieron consultas pesadas para este cierre. Comparar ARS/PYG con el mismo procedimiento seguirá siendo obligatorio.
- Repetir mediciones integradas por pantalla contra el backend completo cuando esté disponible. Las muestras de navegador con API sintética no son latencias productivas ni del backend completo.
- Cualquier futura optimización deberá preservar rangos y p_as_of, monedas, empates/percentiles, usuarios sin actividad, filtros, resúmenes, orden y CSV. No se implementaron optimizaciones de RPC, índices, frontend o jobs.

Fuentes: baseline.md, screen-baseline.json, audience-diagnostics.json, production-explain.json y rollback-and-phase-1.md. La propuesta anterior se conserva sin ampliarla ni ejecutarla.

Ninguno de estos pendientes se presenta como reparado por el cierre de Fase 0. No quedan bloqueos de la reconstrucción aprobada; sí quedan defectos, riesgos y limitaciones para trabajos separados.
