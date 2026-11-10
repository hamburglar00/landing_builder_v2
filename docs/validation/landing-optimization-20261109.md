# Optimización de landings, chat y gateways — 9/11/2026

## Alcance y protección del estado anterior

Lote autorizado para las nueve plantillas en los motores constructor y clásico, el widget compartido de Atrio/NexoBet y los cuatro gateways. API2 y Panel3 permanecen exclusivamente locales. No se modifican algoritmos de comprobantes, suscripciones, cargas, retiros, asignación de billetera ni saldos. No se crean jugadores ni conversiones productivas como prueba.

Checkpoint anterior a los cambios: `C:/Users/Leo/Desktop/V2/checkpoints/2026-11-09_222409_pre-optimizacion`. Bundles Git, veinte worktrees, configuraciones locales y 14.759 archivos verificados para diez repositorios. `LEEME-RESTAURACION.txt` describe la recuperación. No es un backup completo de las bases productivas. `database/*-before-optimization.json` agrega snapshots de las funciones, triggers y restricciones afectadas en Builder, Atrio y Nexo.

La rama de trabajo es `fix/landing-performance-20261109`. La entrega establece `main` como referencia estable de cada producto, conservando otras ramas y worktrees. Se incorporaron las correcciones concurrentes de Builder `5f426a7` y `96d187e`; el trabajo ajeno se conserva.

## Cambios

- El middleware clásico sólo resuelve la ruta. Las nueve plantillas usan HTML canónico cacheable en una ruta ISR, con configuración dentro del límite de caché. Los parámetros de campaña e identidad se leen en el navegador, nunca se incorporan al HTML compartido. Se conservan overrides de landing, errores 404, solicitudes HEAD y el adaptador de identidad clásico.
- JavaScript y CSS con nombres basados en contenido, minificación del programa final y manifiestos separados de nombres/código. Se conservan URLs antiguas para documentos cacheados. El clásico mantiene Analytics y Speed Insights mediante los SDK vanilla instalados.
- Derivadas de imágenes públicas compartidas, variantes responsivas, dimensiones/prioridad y fallback al original. Se respetan URLs privadas/externas y las marcas estáticas de T9. T4/T5 muestran su contenido sin esperar cortinas o revelados.
- La publicación invalida primero y calienta la página mediante una segunda solicitud después de recibir la respuesta. Calentar dentro del handler invalidante podía dejar la página nuevamente fría al finalizar la solicitud. Se mantienen destinos fijos, validación de nombres, autenticación y protección SSRF.
- Telemetría común para T1–T9: disponibilidad del CTA, navegación solicitada, etapas, errores, reintentos y tiempos; motor, SHA de la landing, entorno, procedencia declarada y estrategia. Datos históricos sin procedencia permanecen desconocidos. No se incluyen credenciales, nombres, texto libre de errores ni datos bancarios.
- Precarga de recursos del widget desde el contexto del gateway; se retira la precarga cruzada de la landing que no aprovechaba la misma partición de caché del navegador. La configuración estática del warm debe apuntar al backend correspondiente; la selección real de backend continúa autorizada por la sesión.
- Atrio/Nexo: bienvenida persistida y compositor utilizables antes de completar la consulta bancaria, mediante NDJSON negociado y fallback JSON. La burbuja bancaria conserva su identidad. CSS del embed separado del panel; SDK de Supabase de push diferido hasta necesitarlo.
- Invalidación de preparaciones sólo para los asesores afectados, incluidos dueño anterior/nuevo de una relación, con índice por asesor y sin cambiar vencimiento, permisos ni consulta bancaria.
- API2 local: preservación de cabeceras de diagnóstico `Server-Timing`/`Retry-After` en afinidad de cluster. Commit local `b640ff64`; sin push ni despliegue.

Pixel y CAPI mantienen el orden de carga, disparadores, atribución e identidad de eventos. El clásico conserva sus compatibilidades `_fbp`, `external_id`/`eid` y selección automática. Los tests interceptan Meta y los receptores; no generan eventos comerciales reales.

Nexo consume el módulo de chat Atrio 1.7.0, fijado al commit `59f6935`, con ocho exclusiones anteriores documentadas en `NexoBet/docs/validation/widget-optimization-20261109.md`. Su landing propia usa HTML privado con cookie cifrada: no se le aplica ISR público. Los 24 archivos de marketing compartido con Builder no cambian; no se presenta el renderer público de Builder como si fuera el de Nexo.

## Opciones preparadas y límites

El clásico dispone del protocolo opaco en dos fases para T7–T9, apagado por defecto y con fallback al ingreso anterior. Activarlo requiere compartir la clave de preparación existente con Builder y verificar los destinos. En la revisión, esa clave existe como variable sensible en Builder y está ausente en clásico; no se afirma haber verificado igualdad de valores ocultos.

El login combinado dentro de `/complete` permanece apagado (`GATEWAY_EARLY_SESSION_ENABLED=0`). No equivale a un trabajo durable en segundo plano. Rey dispone de lease persistido; Ases/NET/Multi todavía requieren coordinación durable entre instancias para una anticipación de login más amplia.

Se conserva la navegación `/prepare` → `/entry`. No se implementó sustitución de HTML ni un documento único sin bootstrap autenticado/CSP/SDK coordinados. Tampoco se habilitan cuentas precreadas, altas antes del CTA, Redis o cambios globales de región. Son decisiones independientes que requieren evidencia adicional, no optimizaciones que se puedan dar por activadas mediante este lote.

Regiones observadas antes del despliegue: Builder `destination`/`prepare` en `gru1`, `start`/`warm` en `pdx1`; clásico en `iad1`; gateways de preparación/login/sesión en `gru1`. No se deduce la región efectiva sólo del valor predeterminado del proyecto Vercel.

## Evidencia y mediciones

Evidencia de trabajo: `C:/Users/Leo/Desktop/V2/CURSOR/.local/optimization-20261109` y `.local/optimization-20261109` dentro de Atrio/Nexo. Builder: 467 unitarios aprobados, dos omitidos explícitamente (Data API requiere fixture; el navegador de imágenes se ejecutó separadamente). TypeScript aprobado. Clásico: 45 unitarios y build aprobados. El smoke HTTP local confirmó MISS→HIT, HTML idéntico entre campañas, overrides, HEAD, 404, recursos inmutables y publicación con invalidación→warm→HIT. PostgreSQL descartable: 93 comprobaciones nuevamente aprobadas con el nombre definitivo de migración.

Antes de los últimos ajustes del bootstrap, la matriz de navegador completó 74 escenarios en Chromium/WebKit: las 18 combinaciones de plantilla/motor, repetición sin duplicación, overrides clásicos, identidad previa, Pixel bloqueado, abandono temprano y ausencia de teléfono. Después de los ajustes se repitieron las 36 combinaciones con HTML y assets finales y volvieron a pasar. El helper completo se trasladó al runtime cacheable T1–T6; el bootstrap temprano se redujo a 5.066 bytes / 2.067 gzip, preservando abandono, fallo del asset y contexto/IDs para adopción. Once pruebas VM cubren esa transición y privacidad.

La revisión final detectó y corrigió dos fallbacks: fondos CSS T4/T5 sin recuperación y rotativas que podían volver a elegir una derivada fallida al inicializarse el runtime. Ocho escenarios Chromium verificaron solicitudes reales acotadas: una imagen en éxito y derivada+original al recuperar; rotar no reintenta derivadas ya fallidas. Se mantienen las animaciones restantes y la protección de URLs/atribución. Los 36 escenarios aislados del helper de telemetría también volvieron a aprobar después de mover la factory al runtime estático.

Gateways: 1.991 pruebas aprobadas y tres casos de base omitidos explícitamente; TypeScript en los cuatro; ocho pruebas Worker y 25 del emisor clásico. Los cuatro previews remotos compilaron; Multi validó por separado Next, OpenNext y Wrangler `--dry-run`. Un preview no acredita producción.

Widget real: diez escenarios por producto, incluyendo bienvenida progresiva, visibilidad, compositor, datos bancarios e idempotencia. CSS comparado con el mismo compilador: Atrio 22.872 → 14.051 bytes gzip (-38,6%); Nexo 28.038 → 16.884 (-39,8%). Estas cifras excluyen fuentes/CSS adicional y no representan el total descargado en producción.

Los runtimes cacheables T7/T8 reducen aproximadamente 28% su tamaño gzip contra el checkpoint `3725beb`. `scripts/measure-template-entry-payload.mjs` compara fixtures iguales y recursos reales del commit anterior; T1–T6 clásicos no tienen comparación de HTML equivalente porque antes usaban una página React. No confundir ahorro de bytes con segundos de latencia.

Lectura de los siete días previos a esta publicación: T9/Rey, 15 intentos completos de cuentas nuevas, mediana 7.077 ms y p90 8.845,8 ms hasta chat utilizable. T7/NET, sólo dos observaciones completas, mediana 10.864 ms. Seis clics T9/Rey sin tramo completo no prueban abandono. No hay procedencia suficiente para separar pruebas de clientes ni versiones: son una referencia histórica con limitaciones, no un benchmark controlado.

Para comparar después: `scripts/entry-performance-report.sql`, separando motor, SHA, entorno, muestra sintética/desconocida, proveedor, cuenta nueva/existente, reintento y estrategia. Las fases que se solapan no se suman. `outbound_requested` indica intención de navegación; no prueba que WhatsApp abrió o recibió un mensaje.

## Publicación verificada de chat y gateways

Se hizo fast-forward de `main` y push sin force, preservando worktrees y ramas anteriores. Los cinco deployments Vercel quedaron READY y sus dominios resuelven al commit indicado: Atrio `07da684`, Rey `148c397`, Ases `d38a5ff`, NET `b8d7f77` y Ganamos+ `effcb5b`. El SDK público coincide con los blobs Git de los cuatro.

Ganamos+ también se reconstruyó con OpenNext desde `effcb5b`: build, TypeScript, seis comprobaciones de query encoding y ejecución real workerd aprobados. Worker `fd394f8b-9985-4177-aa8e-9410d6b0fa41` activo al 100%; health, BUILD_ID y recursos comprobados en `ganamosnet.global` y workers.dev. Se preservaron variables con `--keep-vars`; la opción experimental permanece desactivada. Evidencia: `production-five-vercel.json` y `worker/production-worker-final.json` en el directorio local de validación.

Se agregaron exclusiones explícitas de archivos `.env*`, logs y estado local a las cargas Vercel que las necesitaban: la CLI no aplica las reglas de `.gitignore`. No se incluyen secretos ni snapshots privados en las fuentes del deployment.

## Base de datos publicada

Se aplicaron individualmente las tres migraciones revisadas, sin ejecutar pendientes ajenos: Builder `20261110025708_entry_funnel_all_templates_provenance`, Atrio `20261110025716_gateway_chat_preparation_scope` y Nexo `20261110025722_gateway_chat_preparation_scope`. La verificación confirmó las cinco columnas de diagnóstico, rechazo de un lote inválido, ejecución del RPC restringida a servicio y cuatro triggers por fila/índice por asesor en cada backend de chat. `anon` y `authenticated` no pueden ejecutar el RPC ni la función privada de invalidación. No hubo escritura de cuentas, conversiones o movimientos financieros de prueba.

## Reversión

Restaurar el código/alias al deployment anotado en `production-reference.json`, sin borrar trabajo posterior. Las nuevas columnas de diagnóstico admiten NULL y los consumidores anteriores siguen funcionando: conservar el schema ampliado durante un rollback para no rechazar ni perder eventos nuevos de T1–T6. La función anterior de invalidación de preparaciones está guardada en el checkpoint; restaurarla sólo si fuera necesario. Mantener flags experimentales apagados. Los snapshots privados no se incorporan a Git ni al despliegue.
