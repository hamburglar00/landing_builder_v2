# Eventos canónicos del CTA de Atrio

## Problema y comportamiento

El CTA de T7/T8/T9 podía entregar Lead o CompleteRegistration a Meta conservando `estado=contact`, el resultado en `contact_status_capi` y observaciones CONTACT. El receptor ahora registra el milestone real y el resultado CAPI en sus columnas correspondientes. La tabla, el PDF y su selector incluyen CompleteRegistration.

La captura original permanece en `contact_event_id`, `contact_event_time` y `contact_payload_raw` para conservar atribución y deduplicación. Es una captura, no una entrega adicional Contact; su estado CAPI queda vacío. Los contadores de reintento de Contact continúan controlando esa misma captura para los dos eventos seleccionables. Los reintentos leen el switch de CompleteRegistration y guardan el resultado en la columna canónica sin cambiar ID/fecha.

Las métricas de Atrio mantienen la diferencia entre solicitar acceso, escribir un mensaje humano y crear una cuenta confirmada. El milestone publicitario del CTA no inventa los otros dos. WhatsApp T1–T6, Purchase, operaciones financieras, reglas de origen, preferencias CAPI e identidad de eventos conservan su funcionamiento.

## Alcance compartido

- Builder: fuente canónica; receptor, reintentos, vista/exportación y reparación de datos.
- Atrio y los cuatro gateways: cubiertos por el receptor único; fixtures de T7/T8/T9 para Rey, Ases del Norte, Ganamos NET y Ganamos+. Sin código ni publicación propios en este lote.
- NexoBet: revisión del adaptador de marketing. Ya persiste el nombre real y reutiliza su ID en la outbox; no reproduce la discrepancia. Marketing 1.2.0 conserva sus 24 archivos fijados. Pruebas de su pipeline aislado; no requiere actualización de copia ni deploy.
- API2 y Panel3: sin cambios ni despliegues.

## Migraciones y reparación

1. `20261110021406_atrio_cta_canonical_event_history.sql`: admitir `registration` y crear auditoría privada con RLS y sin acceso anon/authenticated.
2. Publicar el receptor y retry worker revisados, conservando su configuración de autenticación.
3. `20261110022534_normalize_atrio_cta_event_history.sql`: reparación con locks por fila. Sólo capturas v1 de Atrio, con ID coincidente; no reinterpretar la configuración actual de una landing. Un envío aceptado exige payload CAPI con nombre/ID exactos y respuesta positiva. Guardar los campos anteriores, conservar compras posteriores y excluir milestones distintos o entregas no comprobadas. No genera solicitudes HTTP ni reemite eventos aceptados.

La consulta previa identificó 17 candidatos de `atriopili`: 15 aceptados por Meta como Lead y 2 omitidos por origen. Los IDs, payloads de captura, fechas, píxel, FBC, identidad y datos de compra no se sustituyen.

## Validación

El harness `scripts/test-atrio-cta-events.mjs` ejecuta handlers reales con Postgres/PostgREST desechables, cron desactivado y Meta interceptado. Verifica migración reversible/idempotente, evidencia insuficiente, colisiones, compras preservadas, 24 combinaciones de template/proveedor/evento, omisiones, reintentos estables y los seis templates WhatsApp. No accede a datos o servicios de producción.

Resultados locales: 35 verificaciones del harness, 6 contratos Deno, 28 pruebas de metricas/presentacion y 21 de NexoBet, todas aprobadas. Tipos y lint aprobados. La compilacion local encontro ENOSPC; verificar la compilacion en Vercel antes de dar la publicacion por terminada.

Pruebas adicionales: Deno del contrato CTA; métricas y presentación; tipos/lint/build de frontend; comparación del código Edge desplegado con la base revisada; comprobación de marketing fijado y pruebas del adaptador de NexoBet. La validación productiva usa lecturas, sin conversiones sintéticas.

## Publicación

Pendiente de completar con commit, versiones Edge, despliegue y conteos posteriores a la reparación.

## Reversión

La auditoría `private.atrio_cta_event_corrections.previous_fields` conserva sólo los campos anteriores a la reparación. Una reversión debe compararlos con el estado actual y no sobrescribir compras u otros eventos ocurridos después. No revertir indiscriminadamente filas completas ni eliminar la auditoría. No reemitir eventos para revertir clasificación. Conservar `registration` permitido mientras existan filas que lo utilicen.
