# Meta Pixel/CAPI: recibos y contexto del evento — 14/11/2026

## Estado y checkpoint

Implementación local autorizada por Leo después de revisar la propuesta. Sin push, publicación ni migraciones remotas de este lote. Las únicas escrituras externas de validación fueron cuatro eventos sintéticos en modo Test Events al píxel expresamente autorizado `989122687083119`; no se crearon conversiones en Builder ni operaciones de negocio.

Checkpoint verificable anterior a las modificaciones: `C:/Users/Leo/Desktop/V2/CURSOR/.checkpoints/meta-capi-hardening-20261114-212335`. Ocho proyectos originales y tres worktrees del lote anterior, once bundles verificados, parches binarios de working tree/índice y archivos nuevos no ignorados; 76 artefactos comprobados por SHA256, cero omisiones. Excluye dependencias, secretos ignorados y bases productivas. Su README describe recuperación en una carpeta independiente.

Una comparación posterior confirmó 34 comprobaciones sin diferencias en los ocho proyectos originales: HEAD, parches y bytes de archivos nuevos. [Evidencia](meta-capi-hardening-original-worktrees-20261114.json).

| Producto | Base aislada | Alcance |
| --- | --- | --- |
| Builder | `51a97467` | Receptor, retry, prueba CAPI, normalización, URL, dispatch Pixel y presentación de recibos |
| Clásico | `5d5420f` | Bundle compartido y dispatch React heredado, ambos con píxel explícito |
| NexoBet | `f1b5b3a` | Adaptadores propios, contratos puros versionados y migración privada de captura |
| Atrio | Sin cambios | Su webhook existente conserva procedencia y primer mensaje interno |
| Rey/Ases/NET/Ganamos+ | Sin cambios | Los cuatro pasan por el receptor compartido; SDK y Worker no cambian |

Se preserva la publicación de ingreso más reciente, incluyendo política por landing y presentación. Worktrees nuevos: `../landing-builder-meta-hardening`, `../landing-prueba-meta-hardening`, `../NexoBet-meta-hardening`. API2 no se modifica. El rediseño de identidad de Nexo por recorridos continúa expresamente fuera del lote.

## Contrato implementado

| Evento de Meta | action_source |
| --- | --- |
| Contact del CTA hacia WhatsApp | website |
| Lead de API2 por mensaje de WhatsApp | chat |
| Purchase confirmado del recorrido WhatsApp | chat |
| Lead/CompleteRegistration del CTA hacia Atrio | website |
| Purchase confirmado mediante el chat Atrio/Nexo | chat |

La decisión usa el sobre persistido del evento concreto, no el origen de adquisición de la fila. API2 legado se reconoce por LEAD/PURCHASE y bot_phone, sin origen incompatible; Atrio por su procedencia explícita. Sobres desconocidos/truncados y las integraciones secundarias conservan su ruta anterior. El retry Purchase ahora conserva ese sobre y source_platform. El campo histórico purchase_capi_route=website sigue identificando la ruta al píxel convencional frente al dataset Business Messaging; no sustituye a action_source del evento.

La landing del Contact vinculado es la URL de adquisición prioritaria. Una URL posterior de API2 no puede sustituirla por otra landing/dominio. Se conservan controles de propietario y un salto por vínculos existentes; sin contexto verificable no se inventa una URL externa. Para Meta, se retiran query/fragmentos sensibles, conservando únicamente el parámetro de ruta landing permitido. Los eventos chat omiten event_source_url: la landing no se presenta como ubicación de la compra. La evidencia publicitaria y el payload original siguen separados de esa URL de envío.

La entrega exige HTTP 2xx, JSON objeto válido, events_received numérico exactamente 1 y ausencia del campo error. Una recepción incierta no se marca enviado. El envío/retry al píxel conserva ID, fecha y monto; no reconstruye otra conversión. Las rutas secundarias Business Messaging no transportan event_id: ante 2xx ambiguo pasan a unconfirmed_meta_receipt, fuera de la selección automática, con indicación de revisión. No se agrega reenvío ciego a esa ruta. Su política preexistente para timeouts/errores explícitamente transitorios queda sin rediseñar.

FBC/FBP deben estar completos. Se preservan el instante original, mayúsculas del clic, índice de subdominio y apéndice del SDK. Segundos históricos completos se convierten al mismo instante en milisegundos; fragmentos sin fecha no reciben Date.now(). Se conservan las reglas de antigüedad FBC y tolerancia de reloj. El SDK oficial 1.3.1 continúa sin actualización ni sustitución.

Se corrigen errores demostrables de matching: no convertir texto o dígitos sueltos en una IP aparente; validar IPv4/IPv6 y direcciones mapeadas; preservar acentos UTF-8 en nombres/email e identidad opaca en external_id. No se inventa país para teléfonos. No se retiran IP compartidas sólo por frecuencia. La captura existente prioriza IP firmada y cabeceras observadas; no se modificó por conjetura.

PageView y CTA se dirigen con trackSingle al píxel configurado. Se mantienen el nombre estándar seleccionado y el mismo event_id Pixel/CAPI. Sin píxel propio no se emite hacia otro inicializado. Los hitos internos CTA → primer mensaje → compra/recompra y Estadísticas no cambian; el mensaje de Atrio no genera otro Lead publicitario. No se reescriben históricos ni se reenvían eventos ya aceptados.

## Evidencia

- Backend: 167 pruebas Deno de recorrido, identidad, aislamiento, cookies, origen, payload, URL y fechas. Typecheck de conversions, retry-failed-conversions y conversions-test.
- Recibos: 66 escenarios de handlers reales con DB/HTTP simulados, incluyendo respuestas vacías, malformadas, cantidades inválidas, errores y cuarentena Business Messaging. Recuperación al píxel con ID/fecha/payload idénticos.
- Recorrido completo: 20 escenarios con CTA T7/T8/T9, switches independientes, firma del mensaje interno, WhatsApp, identidad y primeras/repetidas compras.
- Purchase: 24 escenarios de los cuatro proveedores, primera/repetida/duplicado/retry, URL y cronología. Además 8 de admisión duradera, 49 de ingestión/reintentos, 8 de entrega diferida y 10 de fecha original; sin tráfico real.
- Navegador: 43 pruebas Builder y 7 clásico; 18 escenarios Chromium de asignación tardía/retorno/deduplicación T1–T6 de ambos motores. Dos pruebas adicionales de transportes y tres de prueba de IP.
- Aislamiento FBC: 208/208, 26 escenarios × cuatro runtimes T7/T8 clásico/constructor × Chromium/WebKit, con el SDK oficial real y transporte interceptado. Evidencia local del script existente: `.vercel/audit-fbc-20261031/scoped-browser-results.json` (el nombre del directorio es histórico).
- TypeScript Builder/clásico, generadores de assets, módulo Marketing Nexo y diff check correctos. Los cinco runtimes nuevos tienen nombres por contenido; no se eliminan los anteriores. Los cuatro SDK de gateway permanecen idénticos.
- Nexo tiene pruebas de adaptadores, navegador Chromium/WebKit, SQL PGlite aplicando su migración nueva y TypeScript; véase [su registro](../../NexoBet-meta-hardening/docs/validation/meta-capi-hardening-20261114.md). PGlite no certifica contención entre conexiones independientes.

Prueba real autorizada: Lead y Purchase chat, sin event_source_url, aceptados individualmente en v25.0 y v26.0 con HTTP 200 y events_received=1. Sólo external_id sintético hasheado; Purchase de prueba ARS 1. Tokens retenidos en memoria, fuera de código/logs. [Recibos y fbtrace_id](meta-capi-hardening-test-events-20261114.json). Confirma aceptación de esos payloads, no atribución o rendimiento de campañas. Graph permanece en v25.0 por defecto; no se migra automáticamente a v26.

Auditoría agregada de logs de siete días hasta el 15/11 00:28 UTC: 530 Contact, 742 Lead y 2.782 Purchase con recibo 1. Purchase incluía 878 IP, 360 distintas, ninguna compartida por más de un teléfono hasheado; cuatro IP de Lead tenían varios teléfonos. Ninguna coincidía con los patrones privados comprobados. Son filas de log, no conversiones únicas ni resultados atribuibles a campañas. No demuestra ausencia de problemas de IP fuera de esa muestra ni justifica retirar señales en masa.

## Publicación posterior y reversión

Revisar e integrar Builder preservando cualquier publicación concurrente. Publicar sus funciones conversions, retry-failed-conversions y conversions-test, y frontend desde main. Publicar clásico por separado. En Nexo aplicar primero `20261115002734_nexobet_meta_capi_hardening.sql` y luego su aplicación. Comprobar READY/dominos y recibos naturales por producto, sin simular operaciones monetarias. No necesitan despliegue nuevo Atrio, los cuatro gateways/Worker ni API2.

No hay migración Builder en este lote. Nexo modifica funciones, no reescribe las filas históricas: conserva permisos privados, URL de adquisición y cookie original de primera observación. Para revertir, recuperar las revisiones previas de código y las funciones Nexo documentadas en Git; no borrar recibos/identidades ni reemitir conversiones aceptadas. Los builds y comprobaciones de dominios productivos quedan para esa publicación; los tests locales no se presentan como un deployment.

## Fuentes técnicas

- [Meta: parámetros del evento y action_source](https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameters/server-event).
- [Meta: formato y primera observación FBC/FBP](https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameters/fbp-and-fbc/).
- [Meta: normalización de información del cliente](https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameters/customer-information-parameters).
- [Meta: eventos selectivos con varios píxeles](https://developers.facebook.com/documentation/meta-pixel/advanced#multipixels).
