# FBC en una entrada directa a Diana — 31/10/2026

La conversión **125988**, registrada el 31/10 a las **14:54:39 ART**, reutilizó una FBC cuyo origen no está establecido. No se probó un clic publicitario del usuario. El colector auditado leía la cookie global `_fbc` al abrir `https://landing.panelbotadmin.com/diana` sin parámetros publicitarios; `from_meta_ads=true` no demuestra que esta apertura ni el origen del identificador hayan comenzado en un anuncio.

## Caso real y alcance de la conclusión

La revisión de producción de sólo lectura encontró que el timestamp interno del FBC corresponde al **08/08/2026 15:36:29.009 UTC**, unos **84,0959 días** antes de la conversión. El mismo par FBC/FBP aparece en **seis conversiones anteriores del mismo cliente Builder, goldencajeros**, entre el 14/08 y el 02/10. La URL guardada no tiene query y falta `utm_campaign`; los motores eliminan deliberadamente la query de `event_source_url`, por lo que ese campo no prueba cómo era la URL original. Los `external_id` y `atrio_id` anteriores no son los del registro actual: las cookies publicitarias identifican el contexto del navegador y no equivalen a una cuenta de Atrio.

El FBC del caso está dentro de la ventana de 90 días del normalizador de CAPI, pero cumplir esa ventana no acredita procedencia. La [investigación ampliada](fbc125988-origin-20261031.md) encontró el par exacto por primera vez el 14/08 en `/carlosds`, PYG y otro píxel, luego en `/bianca2` y finalmente en Diana. Las siete conversiones abarcan tres píxeles y dos monedas. Diana fue creada el 21/10 y ya recibió esa FBC ese mismo día. La FBC no aparece en otros clientes; la FBP por sí sola sí, con registros de pruebas anteriores. No está probado dónde se creó la FBC, quién la generó ni si provino de un anuncio o una prueba. La cookie original del dispositivo no fue inspeccionada ni alterada.

No se cambió la semántica de atribución en este lote. No se limpiaron cookies reales, corrigieron filas históricas, reemitieron conversiones ni enviaron eventos de prueba a producción. Los problemas adicionales reproducidos abajo **no son la causa demostrada de este LEAD**.

## Recorrido actual del dato

| Etapa | Comportamiento comprobado | Fuente |
| --- | --- | --- |
| Runtime común T7/T8 | `collectMetaTrackingParams` lee `_fbc` sin exigir `fbclid` en la URL actual. Sólo construye un FBC a partir del `fbclid` actual cuando no encuentra cookie. | `frontend/components/public-landing/PublicLandingRuntimeScript.tsx:442` |
| Clásica | El bundle generado conserva el mismo colector. La página Diana sirve T7 clásico. | `../landing-prueba-1/lib/template7/shared.cjs:4310` y lectura pública descrita abajo |
| SDK oficial 1.3.1 | Puede obtener el clic de la URL suministrada, URL actual o referrer. Conserva la cookie existente, escribe `path=/` e intenta el dominio registrable más amplio. Al releerla renueva su expiración por 90 días y mantiene su timestamp de creación. | `../landing-prueba-1/node_modules/meta-capi-param-builder-clientjs/shared/utils/cookieUtil.js:101`, `:129`, `:193` |
| Navegadores de Meta | `processAndCollectAllParams` también contempla un clic suministrado por Extended Browser Properties. No se atribuye este mecanismo al caso real ni se certificó con un dispositivo nativo. | `../landing-prueba-1/node_modules/meta-capi-param-builder-clientjs/capiParamBuilder/src/clientParamBuilder.js:41` |
| Landing y storage | `landing` selecciona la página y `landing_resolution` registra cómo se eligió; no redefine el origen de `_fbc`. La identidad y otros datos de localStorage usan namespace por landing/píxel, pero el FBC se lee desde la cookie global del dominio. | `frontend/lib/landing/resolution.ts`, `PublicLandingRuntimeScript.tsx:287` |
| Payload | Journey usa `from_meta_ads: !!tracking.fbc`; Contact transporta el FBC leído. Campaña/conjunto/anuncio se toman de la URL actual, no se reconstruyen desde la cookie. | `PublicLandingRuntimeScript.tsx:933`, `:1434`, `:1437` |
| Conversión | El trigger marca `from_meta_ads` ante FBC no vacío o `utm_campaign` no vacío, con reglas adicionales para CTWA/Chatrace. No valida edad del FBC ni prueba un clic actual. | `supabase/migrations/20260821220917_include_ctwa_in_meta_ads_origin.sql:6` |
| Envío CAPI | `normalizeFbc` comprueba formato y timestamp, admite hasta 90 días y hasta cinco minutos de reloj futuro. Un FBC vencido se omite del envío; esto no borra automáticamente el campo ni su indicador en la fila. | `supabase/functions/conversions/shared.ts:481`, `:522` |

La [documentación primaria del SDK de Meta](https://github.com/facebook/capi-param-builder/blob/main/client_js/README.md) confirma la lectura de FBC desde cookies, la consulta de URL/referrer y la recuperación opcional desde navegadores internos. Su [ejemplo oficial de persistencia](https://github.com/facebook/capi-param-builder/blob/main/nodejs/README.md#demo) conserva FBC/FBP al volver a la URL sin `fbclid`. La referencia canónica de parámetros es [FBP y FBC](https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/fbp-and-fbc/); su lectura directa devolvió HTTP 429 durante esta auditoría. Los detalles de la versión desplegada se verificaron contra el paquete local **1.3.1**, sin suponer que la rama actual del SDK sea idéntica.

## Reproducción aislada: 72/72 casos

Se ejecutaron nueve escenarios en **Chromium y WebKit**, para los cuatro recursos generados **T7 Builder, T7 clásico, T8 Builder y T8 clásico**: `9 × 2 × 4 = 72` comprobaciones aprobadas.

Se extrajeron las funciones reales de recolección del recurso generado y se ejecutó el SDK oficial local 1.3.1. Para observar el filtro CAPI se ejecutó el normalizador real con valores sintéticos válidos. Todos los requests del navegador fueron interceptados y respondidos localmente; no se ejecutó una conversión completa ni se llamó a endpoints de negocio. Se usaron contextos nuevos de navegador y cookies sintéticas de `example.com`.

| Escenario | Resultado |
| --- | --- |
| Entrada directa limpia | FBC vacío; indicador falso. |
| Cookie fresca de una visita previa, sin query actual | Conserva el FBC; indicador verdadero. |
| Cookie con creación hace 91 días, todavía almacenada | Conserva el timestamp viejo y renueva expiración; indicador verdadero en la recolección, FBC omitido por el normalizador CAPI. |
| `fbclid` nuevo con cookie anterior | El colector inmediato devuelve el clic anterior; tras procesar el SDK devuelve el clic nuevo. |
| Clic sólo en referrer | El SDK construye el FBC desde ese referrer; no requiere query en la página actual. |
| Visita previa a otra landing y luego entrada directa | El FBC anterior queda disponible en la nueva landing. |
| Visita previa a otro subdominio del mismo dominio registrable | Cookie `.example.com`, `path=/`; la nueva landing puede leer el FBC anterior. |
| Sólo FBP | No se convierte en FBC; indicador falso. |
| FBC sintético únicamente en localStorage | El colector no lo recupera; indicador falso. |

Esto verifica la recolección y persistencia de los identificadores, no la atribución final que Meta adjudique a una campaña, una conversión enviada ni el funcionamiento nativo de Facebook/Instagram en iPhone.

Evidencia local ignorada por Git:

- `.vercel/audit-fbc-20261031/audit.mjs`: reproducción aislada, sin destinos de negocio.
- `.vercel/audit-fbc-20261031/browser-results.json`: detalle de los 72 casos con identificadores sintéticos.
- `.vercel/audit-fbc-20261031/public-diana.json`: GET público de HTML y runtime, sin ejecutar JavaScript de producción.

La lectura pública de Diana devolvió HTTP 200 y confirmó `template=7`, `slug=diana`, SDK `/vendor/meta-capi-param-builder/1.3.1/clientParamBuilder.bundle.js` y runtime `/public-assets/template-entry/t7-classic-fa0bf5421260cbdc136f8409.js`. El runtime público coincide exactamente con el archivo local; SHA-256: `fa0bf5421260cbdc136f84097af00d5d8d86b27067e78fdba6301c4a359f7a85`.

## Riesgos separados del caso y propuestas pendientes

1. **Edad inconsistente entre informe y envío.** Una cookie renovada puede conservar un timestamp de más de 90 días. La fila continúa marcada como Meta aunque el envío omita ese FBC. Fue reproducido con 91 días; el caso real tiene 84 días y no presenta este vencimiento.
2. **Clic nuevo leído demasiado temprano.** Si existe una cookie vieja, la primera recolección la prefiere hasta que termina el procesamiento del SDK. Puede afectar el identificador del evento inmediato si ese procesamiento se demora o falla. El caso real no trae `fbclid` nuevo y no demuestra esta carrera.
3. **Alcance amplio de cookie.** La cookie compartida no lleva ownership de landing, workspace ni píxel. La reproducción prueba que puede cruzar slugs/subdominios. La investigación ampliada confirmó que la FBC del caso circuló entre landings, monedas y píxeles del mismo cliente; no encontró esa FBC en otros clientes. Eso no acredita un origen publicitario legítimo.
4. **Semántica del indicador.** Cualquier FBC no vacío o `utm_campaign` marca Meta según la regla actual. La aplicación no verifica una campaña/anuncio a partir de ese valor ni diferencia una apertura directa actual de una atribución histórica.

Antes de cambiar estas reglas, acordar qué debe expresar el informe: llegada actual, atribución histórica válida o ambas por separado. Una posible mejora sería registrar procedencia y alcance de la señal, aplicar la misma validación temporal al ingresar el dato y priorizar un `fbclid` actual frente a una cookie anterior. No eliminar `_fbc` automáticamente en entradas directas: eso descartaría la continuidad histórica que hoy se conserva. Estas propuestas quedan pendientes; esta auditoría no las implementa.
