# Resultado: candidato de períodos cortos retirado

El ensayo local del 29/09/2026 falló en **Mes**, administrador global, ARS:
HTTP 500, SQLSTATE `57014`, 8.415,2 ms hasta recibir el error. El statement tenía
un presupuesto de 8.000 ms. No entregó resumen ni métricas. Se aplicó la condición
de corte solicitada para Hoy/Semana/Mes: se retiró el candidato, sin probar otra
arquitectura ni avanzar a hosted. **Ningún preset usa una ruta nueva; ningún
máximo de días está acreditado.**

La implementación productiva de todos los períodos, incluidos Máximo, fechas
null y personalizados extensos, permanece byte a byte sin cambios en esta rama.
El límite experimental de 90 días del prototipo era exclusivamente un techo de
ensayo; no fue una decisión de elegibilidad ni una capacidad demostrada.

## Recuperación y preservación

- Rama: `feature/statistics-short-periods-20260925`, creada desde main local
  `f828a66c70879725bbabe8f4fa55de22c8317493`.
- El checkpoint `docs(conversions): add sanitized DBA statistics review` ya
  existía en ese HEAD. Sus siete archivos en
  [el paquete DBA](../../review/conversion-statistics-dba-20260925/current-production-flow.md)
  coincidieron byte a byte con el commit; no se editaron ni se volvieron a commitear.
- Sobrevivieron el prototipo SQL generado mediante CLI, dos archivos del harness
  y `measurements.json`. El intento del 25/09 había reconstruido 280 migraciones
  y cargado un fixture sintético, pero falló con `42501` al configurar roles
  locales. No contenía muestras de rendimiento. Su limpieza había terminado;
  se conserva el registro en `previousAttempts` del JSON.
- Se corrigió la administración de roles locales usando `supabase_admin` dentro
  del contenedor propio y la resolución DNS usando el nombre del contenedor.
  Los errores de infraestructura están separados de la falla de producto.
- La base desechable ya no existía: fue necesario reconstruirla, sin repetir
  benchmarks acreditados. Los 280 blobs históricos se verificaron contra sus
  hashes del manifiesto en Git, evitando diferencias de checkout CRLF. Las
  definiciones de 35 funciones se alinearon **sólo localmente** con la captura DBA
  para no confundir el replay histórico con el catálogo instalado.

## Qué se ensayó

Un wrapper `public.get_conversion_statistics_short(jsonb)` que exigía ambas fechas
finitas, orden correcto y rango menor que 90×24 horas, antes de delegar en el RPC
instalado `public.get_conversion_report`. Mantenía `SECURITY INVOKER`, JWT de
usuario mediante PostgREST/Data API y RLS; no usaba service role para las lecturas.
La optimización propuesta frente a la UI vigente era recibir métricas preparadas
en servidor en lugar de conversiones paginadas para cálculo en el navegador.
No se conectó la interfaz antes de aprobar esta admisión SQL.

No se reactivaron los nombres globales del candidato 278 para este ensayo. El
replay local de la historia incluyó 278 y su compensación 280; eso no constituyó
una migración ni reactivación hosted. El prototipo nuevo fue creado con
`supabase migration new conversion_statistics_short_periods`, versión
`20260925174017`, siguiente archivo después de 280. Se aplicó sólo en la base
desechable y se eliminó del árbol al fallar, sin registrarlo en el manifiesto de
incrementales ni en un ledger remoto.

Fixture: 122.445 conversiones sintéticas, 81.630 ARS y 40.815 PYG; 13.836 starts,
dos tenants más un administrador, 27 landings y 266 campañas. La distribución es
una aproximación sintética, no una copia de datos comerciales. PostgreSQL 17.6,
PostgREST v14.1, CLI 2.75.0; cron apagado, base aislada, API local con credenciales
efímeras en memoria, Max Rows 1.000 y tope temporal de 512 MB por rol. La red de
la base no tuvo salida externa. La API se publicó únicamente en loopback.

## Muestras progresivas

Reloj de comparación fijo: `2026-09-29T15:00:00.000Z`, zona
`America/Argentina/Buenos_Aires`. Fechas inclusivas. Cada fila es **una muestra**;
no se presentan medianas ni se acreditan tres muestras donde no existen.
El tiempo incluye respuesta HTTP y parseo JSON en el harness, no renderizado de
una pantalla ni un EXPLAIN de cada statement interno.

| Preset | From UTC | To UTC | Tiempo HTTP | Resultado / comparación inicial |
| --- | --- | --- | ---: | --- |
| Hoy | 2026-09-29T03:00:00.000Z | 2026-09-30T02:59:59.999Z | 894,0 ms | 200; 693 valores comparados, 0 diferencias |
| Ayer | 2026-09-28T03:00:00.000Z | 2026-09-29T02:59:59.999Z | 1.600,0 ms | 200; 525 valores comparados, 0 diferencias |
| Esta semana | 2026-09-28T03:00:00.000Z | 2026-09-30T02:59:59.999Z | 1.384,7 ms | 200; 908 valores comparados, 0 diferencias |
| Este mes | 2026-09-01T03:00:00.000Z | 2026-10-01T02:59:59.999Z | 8.415,2 ms | 500 / 57014; no resultado comparable |

Esta semana abarca **dos días** en la fecha del ensayo; no acredita siete días.
Este mes abarca los 30 días del preset, incluido el día futuro restante, como la
UI vigente. No se sustituyó por un rango móvil de 30 días.

La comparación usó fórmulas extraídas de Git en
`f8ed2986ff584ee107f4f5ce18ce708b1548273d`, con clock fijo, datos del mismo fixture
obtenidos vía Data API, moneda y orden productivos. Comparó los escalares
originales, buckets de charts y dimensiones. Excluyó registros crudos de top
contactos, arrays auxiliares y tendencia de presentación. Por tanto, **no acredita
la equivalencia integral de la futura pantalla**. No se persistieron filas ni
valores personales, tampoco del fixture.

Los guards locales rechazaron null/null, falta de `to`, rango invertido y rango
por encima del techo con `22023`, antes del acceso a conversiones. La prueba
null/null fue sólo del guard; no ejecutó el cálculo de Máximo del candidato.

| Gate | Estado final |
| --- | --- |
| Resumen ≤5 s | Falla en Mes: no entrega resumen |
| Consulta individual ≤8 s | El límite de statement cancela Mes; no aprueba |
| Pantalla completa ≤12 s | No ejecutada; no hubo integración UI |
| Cero diferencias integrales | No acreditado; comparación inicial parcial sin diferencias en tres rangos |
| RLS / aislamiento con usuario normal | Pendiente al corte; usar JWT/invoker no sustituye esa prueba |
| Cero cálculo de negocio en navegador | No acreditado para una ruta nueva; UI no modificada |
| Tres muestras en límite elegido | No aplica: no se eligió ni acreditó límite |

No se ejecutaron Mes pasado, personalizados 7/31/60/90, PYG ni usuario normal
después del corte. Tampoco Preview, objetos hosted temporales, usuarios hosted
ni sesiones hosted. No se repitió Máximo del candidato diferido: su fallo previo
null/null ya estaba acreditado. No se ejecutaron nuevos EXPLAIN/BUFFERS.

## Retiro y estado final

Se eliminaron únicamente la migración candidata y los tres scripts de ensayo
creados en esta rama. Sus hashes y la definición SQL retirada se conservan como
evidencia documental en [measurements.json](measurements.json). Se verificó la
limpieza de los contenedores, redes y volumen propios. El contenedor ajeno
`codex-p8-mysql`, ya detenido antes del ensayo, permaneció intacto.

Quedan sin commit tres documentos: este informe,
[cross-join-review.md](cross-join-review.md) y [measurements.json](measurements.json).
No quedaron cambios de aplicación, migraciones, manifiestos ni staging. No hubo
push, deploy, promoción, modificación de Edge Functions, escrituras remotas,
eventos externos ni escrituras en datos comerciales. El estado remoto informado
por el usuario se toma como referencia; no se volvió a consultar ni modificar.

Validación de cierre: inventario, hashes del checkpoint, referencias locales,
JSON, SQL/PLpgSQL de la definición retirada, UTF-8, revisión de secretos/PII y
whitespace. El JSON registra el detalle de validación y limpieza. El paquete DBA
preexistente conserva sus cinco avisos de whitespace ya documentados; no se
alteró para corregirlos. Los tres documentos nuevos pasan `git diff --check`
mediante comparación no-index y el árbol tracked no tiene diferencias.
