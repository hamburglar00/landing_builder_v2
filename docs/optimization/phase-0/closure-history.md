# Fase 0: cierre final acotado

<!-- phase0b-pg-net-current:start -->
## Estado vigente después de resolver pg_net

Fase 0B cerrada. Dos reconstrucciones de 268/268, fingerprints iguales, 446 comprobaciones distintas aprobadas y cero diferencias pendientes. pg_net 0.19.5 se instala nativamente en la base local vacía; sus funciones y permisos coinciden con remoto. Detalle: phase0b-bootstrap-report.md y phase0b-pg-net-resolution.md. No se inició Fase 0C ni Fase 1.

Los resultados inferiores son antecedentes históricos; no reemplazan este dictamen.
<!-- phase0b-pg-net-current:end -->


## Estado histórico: compatibilidad post-hist?rica

La capa post-hist?rica de RLS fue autorizada e implementada. Dos reconstrucciones de 268/268 con fingerprints id?nticos, 324 pruebas existentes y 67 escenarios nuevos aprobados (391 distintos). El bloqueo restante es exclusivamente la seguridad de net.http_get/http_post: ejecuci?n, search_path y ACL locales difieren de remoto. No se normaliz? ni modific? esa seguridad. Ver phase0b-bootstrap-report.md y phase0b-net-security-pending.md.

## Historial de continuaciones anteriores


## Estado histórico de esta continuaci?n

Fase 0B: dos reconstrucciones completas de 268/268, fingerprints id?nticos; 324 pruebas aprobadas, 0 fallidas. .env retirado del ?ndice e ignorado sin modificar sus bytes; secuencia vac?a corregida con autorizaci?n. El cierre sigue bloqueado por 20 diferencias estructurales revisadas, incluidas 11 de seguridad (RLS, funci?n/event trigger y grants) fuera de la excepci?n mec?nica. No se modific? producci?n. Ver phase0b-bootstrap-report.md, phase0b-schema-review.md y bootstrap-final-summary.json. Las secciones hist?ricas inferiores no sustituyen este estado.

## Historial de informes anteriores


## Dictamen vigente tras implementar Fase 0B

Fase 0B bloqueada. La excepción de sanitización fue autorizada y aplicada; el Bearer no se guardó ni mostró. El runner y el manifiesto están implementados. Dos intentos limpios aprobaron 35 migraciones y fallaron en la posición 36, `20260325201000`, por setval(0) sobre una secuencia cuyo mínimo es 1. Las 232 restantes de cada intento no se ejecutaron. No hay esquema completo, fingerprints finales ni diff integral válido. No se editó esa migración ni se insertaron fixtures para ocultar el error.

Revalidación actual: 299 comprobaciones existentes y 19 nuevas aprobadas; 0 fallidas en suites; una omisión en el comando frontend cuya integración pasó separadamente. TypeScript y build pasan; ESLint: 0 errores, 18 advertencias. Las reconstrucciones fallidas se reportan aparte. Solo cambiaron los dos placeholders autorizados; sin escrituras remotas, deploy, commit, push, Fase 0C o Fase 1. Detalle e inventario: `phase0b-bootstrap-report.md`, `bootstrap-final-summary.json` y `artifact-audit.json`.

La inspección remota READ ONLY encontró el token personalizado únicamente en el ledger histórico, sin coincidencias en cron, funciones, Vault, vistas o las diez tablas de configuración actuales. No se comprobó vigencia en servicios externos ni se rotó ninguna credencial.

Las secciones siguientes conservan los estados anteriores; no reemplazan este dictamen vigente.

## Actualización: implementación de Fase 0B bloqueada en la recuperación

Tras la autorización del bootstrap local/CI, se recuperaron en memoria las dos versiones históricas y se acreditaron sus hashes. `20260427190000` contiene una credencial Bearer literal. No se mostró ni guardó su valor, y ambos placeholders siguen intactos. `phase0b-recovery-decision.md` presenta una adaptación parametrizada para aprobación; `phase0b-recovery-provenance.json` conserva únicamente procedencia y metadata segura.

En este intento hubo exclusivamente consultas remotas READ ONLY de historial y metadata. No hubo escrituras remotas ni locales de base de datos. Reconstrucciones completas: 0; suites reejecutadas: ninguna. Los resultados siguientes pertenecen al pase anterior. No existe todavía un runner de bootstrap aprobado en ejecución ni un diff integral; Fase 0B continúa bloqueada. Los 268 SQL originales no se modificaron. Sin deploy, commit, push, Fase 0C ni Fase 1.

## Informe del pase anterior

Fecha: 16 de septiembre de 2026. Rama main, HEAD a4e752cf58f628813d3979d598b60d480caaac8d. Los 19 archivos iniciales se conservan. No se modificó lógica productiva, migraciones originales, configuración del proyecto, índices, RLS, permisos, Edge Functions ni cron de producción. Sin commit, push, despliegue ni Fase 1. En esta continuación no se utilizó producción.

## Dictamen: Fase 0 bloqueada

El arranque dejó de ser un timeout opaco y las pruebas integrales tienen una alternativa reproducible. Sin embargo, el replay original desde cero falla en 20260323201000_conversions_add_test_event_code.sql:  relation "public.conversions" does not exist. La tabla se crea más adelante, en 20260416100001_conversions.sql. Este problema de orden histórico pertenece al repositorio, no es solamente un bloqueo externo de Docker. No puede declararse que toda la reconstrucción local pasa. No se reordenaron, editaron, omitieron ni fabricaron migraciones para ocultarlo.

## Arranque local: diagnóstico reproducible

Docker 29.7.2, 8 CPU, 6,7 GiB asignados. CLI 2.75.0, comandos y flags verificados con --help. Se comprobaron puertos, contenedores, estados y logs; no se tocaron pilas ajenas. No había conflicto en los puertos principales previstos antes de iniciar.

En el arranque en frío se observaron descargas/extracción de imágenes; se permitió una extensión de la espera por ese progreso. No se conserva un tiempo frío exacto válido. Un intento diagnóstico simultáneo encontró interferencia entre stacks temporales y fue descartado; luego se detuvo la pila propia antes de repetir. El diagnóstico completo con imágenes disponibles termina con error de salud en 135.600 ms, sin alcanzar migraciones ni seeds. No se atribuye retrospectivamente todo el timeout histórico a una sola etapa sin logs de aquella ejecución.

Vector public.ecr.aws/supabase/vector:0.28.1-alpine intenta conectar a host.docker.internal:2375. El log confirma que no puede listar contenedores por Connection refused (os error 111); se observaron 13 reinicios, sin OOM. El puerto 2375 no tenía listener. No se habilitó la API TCP Docker ni se cambió su configuración. Evidencia: vector-diagnostic.json y local-start-diagnostic.json.

La alternativa CLI sin Vector/Logflare arrancó en 81.195 ms. El bootstrap solo DB del pase que sí ejecutó el replay arrancó en 65.083 ms, bajo el límite de 180 s. Es una alternativa explícita, no la afirmación de que todos los servicios estén sanos. Los intentos intermedios corrigieron problemas del harness de privilegios/autenticación local; un cleanup Docker también agotó su timeout. No se usaron credenciales remotas. El diagnóstico guarda etapas y hashes de cada SQL sin conservar logs crudos ni secretos.

Reproducir desde la raíz: node scripts/phase0/diagnose-local-start.mjs; o --without-observability; o --database-only. Cada ejecución crea un proyecto temporal sin vínculo remoto, .env ni seeds. Antes de cargar SQL desconecta la DB de la red exterior, la conecta a una red interna, desactiva cron únicamente allí y valida postgres/unix-socket/off. El administrador local usa la contraseña del contenedor recién creado solo en memoria.

Hay 268 SQL y un README, no 269 SQL. Resultado real: 28 migraciones aprobadas, 1 fallida, 239 no alcanzadas. La fallida es la número 29. No se continuará intentando la misma historia fallida. El runner devuelve fallo cuando no completa el replay; los hashes y el primer error están en local-start-replay.json. migration-replay.json se conserva como diagnóstico histórico anterior.

## Último pase de todas las suites

| Suite | Exit | Aprobadas | Fallidas/errores | Omitidas |
| --- | ---: | ---: | ---: | ---: |
| collector | 0 | 5 | 0 | 0 |
| deno | 0 | 41 | 0 | 0 |
| frontend | 0 | 99 | 0 | 1 |
| typescript | 0 | — | — | — |
| sql-and-integration | 0 | 112 | 0 | 0 |
| concurrency | 0 | 22 | 0 | 0 |
| eslint | 0 | — | 0 | — |
| handler-concurrency | 0 | 20 | 0 | 0 |

Pruebas: 299 aprobadas, 0 fallidas y 1 omisión en comandos. La integración omitida en el comando frontend se ejecuta y aprueba por separado sobre PostgREST local: no es una cobertura pendiente ni se suma dos veces como aprobada. SQL/pgTAP suma 111; integración Data API 1; frontend 99; Deno 41; collector 5; concurrencia SQL/colas 22; handler/CAPI 20. TypeScript y ESLint no se cuentan como tests individuales. ESLint registra 0 errores y 18 advertencias preexistentes. Build final: ver build-results.json.

Las migraciones se reportan por separado: agregar sus 28 aprobaciones al total de tests inflaría la cobertura. Hay una comprobación de reconstrucción fallida aunque las pruebas de caracterización pasen. Los fallos de preparación del harness no se suman al último pase exitoso ni se presentan como defectos corregidos del producto.

## Concurrencia integral y garantías reales

Se ejercitan completos los callbacks HTTP de conversions y retry-failed-conversions y sus imports actuales. Requests HTTP reales en loopback; Supabase JS real; PostgreSQL/PostgREST reales en contenedores descartables. Meta se sustituye por transporte controlado y todo otro destino externo se rechaza. Se conservan hashes de las fuentes productivas. El runtime inyecta Deno.serve y entorno en una VM Node y transpila TypeScript sin modificarlo: no reproduce el aislamiento Edge ni todas las policies/triggers del esquema completo.

20 caracterizaciones aprobadas, 0 fallidas. Incluyen ocho solicitudes simultáneas por tipo y moneda, claims Purchase, replay, fallos HTTP 503/red, cuatro workers CAPI concurrentes, recuperación, backoff de cinco minutos, límite de seis intentos Contact y procesamiento concurrente de Lead diferido. Las barreras retienen respuestas para garantizar solapamiento; no son solo llamadas secuenciales rápidas.

Hallazgos que NO se corrigieron:

- Contact: ocho duplicados produjeron una conversión y un envío, en ARS/PYG.
- Purchase con transacción común: un claim, una compra y un envío. El replay no reenvía y no queda processing al finalizar.
- Lead simultáneo: ocho envíos sobre una sola conversión. El handler sigue procesando aunque el insert de inbox choque con la restricción única.
- Reintentos CAPI: cuatro workers envían cuatro veces el mismo event_id para Contact, Lead y Purchase en ambas monedas. No hay exclusión mutua del worker. La respuesta simulada no demuestra deduplicación real de Meta.
- Contadores retry Contact/Lead: cuatro envíos pueden persistir retry_count=1 por actualizaciones concurrentes basadas en el mismo valor leído.
- Lead diferido: se observaron cuatro conversiones y cuatro event_id distintos al procesar concurrentemente una sola entrada. La cola termina drenada, pero eso no implica procesamiento único. El intercalado exacto se registra en handler-concurrency-results.json.
- Después de recuperar un fallo y guardar enviado, el siguiente pase deja de enviar; se mantiene la identidad de CAPI durante los reintentos de un evento persistido.

Los tests verdes son caracterización de estos resultados, no una certificación de envío único. Los riesgos de duplicación requieren una fase separada de integridad de conversiones/CAPI. No se inventó una regla ni se aplicó una corrección productiva. Las 22 pruebas previas de SQL/colas siguen cubriendo reservas, contadores atómicos, claims y colas WhatsApp/tracking; su éxito no se extrapola al worker CAPI.

## Mediciones actualizadas de las seis pantallas

24 muestras: Inicio, Conversiones, Audiencias, Landings, Editor y Teléfonos; ARS/PYG; primera carga y recarga. Mismos datos sintéticos, fecha y procedimiento, build real y páginas sin modificar, Chromium nuevo por muestra. No hay backend completo validado, por lo que no se atribuyen tiempos de fixtures al servidor. Las mediciones integradas DB/API quedan pendientes; no se inventan valores.

Categorías: estáticos = assets de Next/imágenes/fuentes; app = HTML/RSC/otros requests locales de Next; API = llamadas sin OPTIONS; preflight = OPTIONS. Bytes HTTP provienen de CDP. JSON cuenta bytes UTF-8 sintéticos y filas lógicas recibidas (incluidos metadatos/config), no usuarios únicos. El JSON también guarda bytes por categoría. Se bloquea HTTP externo y se excluyen frames WebSocket. La categor?a otro origen incluye eventos Network fuera del origen local y no implica una transferencia HTTP externa: Audiencias registra uno con cero bytes y sin destinos HTTP externos en blockedExternal. El total de requests es de eventos Network, no exclusivamente HTTP.

| Pantalla | Moneda | Carga | Requests estáticos/app/API/preflight | JSON bytes / filas | HTTP bytes | JS / tareas ms | Ventana ms |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| inicio | ARS | first | 36 / 61 / 6 / 6 / 0 | 1.018 / 6 | 554.579 | 300,9 / 1.347 | 9.453,2 |
| inicio | ARS | reload | 36 / 61 / 6 / 6 / 0 | 1.018 / 6 | 554.579 | 135,4 / 603,5 | 5.103,9 |
| conversiones | ARS | first | 36 / 61 / 30 / 30 / 0 | 747.065 / 1.250 | 1.305.436 | 567,2 / 2.007,8 | 6.231 |
| conversiones | ARS | reload | 36 / 61 / 30 / 30 / 0 | 747.065 / 1.250 | 1.305.436 | 496,7 / 1.204,6 | 6.998,2 |
| audiencias | ARS | first | 37 / 61 / 31 / 31 / 1 | 781.467 / 1.450 | 1.353.478 | 580,9 / 2.481 | 7.735,8 |
| audiencias | ARS | reload | 37 / 61 / 31 / 31 / 1 | 781.467 / 1.450 | 1.353.478 | 155,7 / 612,8 | 3.334,2 |
| landings | ARS | first | 36 / 63 / 7 / 7 / 0 | 1.407 / 7 | 555.191 | 208 / 836,7 | 3.750,5 |
| landings | ARS | reload | 36 / 63 / 7 / 7 / 0 | 1.407 / 7 | 555.191 | 150,7 / 448 | 3.577,5 |
| editor | ARS | first | 40 / 65 / 24 / 24 / 0 | 3.368 / 16 | 600.221 | 186,8 / 899,7 | 6.147,9 |
| editor | ARS | reload | 40 / 65 / 24 / 24 / 0 | 3.368 / 16 | 600.221 | 147,3 / 447,5 | 2.821,5 |
| telefonos | ARS | first | 37 / 61 / 10 / 10 / 0 | 5.156 / 28 | 575.570 | 182,7 / 697,8 | 2.874,9 |
| telefonos | ARS | reload | 37 / 61 / 10 / 10 / 0 | 5.156 / 28 | 575.570 | 93,3 / 410,7 | 3.103,4 |
| inicio | PYG | first | 36 / 61 / 6 / 6 / 0 | 1.018 / 6 | 554.579 | 179 / 741 | 3.170,5 |
| inicio | PYG | reload | 36 / 61 / 6 / 6 / 0 | 1.018 / 6 | 554.579 | 90,8 / 384,7 | 3.363 |
| conversiones | PYG | first | 36 / 61 / 30 / 30 / 0 | 747.065 / 1.250 | 1.305.436 | 253,5 / 915,9 | 3.412,1 |
| conversiones | PYG | reload | 36 / 61 / 30 / 30 / 0 | 747.065 / 1.250 | 1.305.436 | 168,5 / 510,1 | 3.059,3 |
| audiencias | PYG | first | 37 / 61 / 31 / 31 / 1 | 781.467 / 1.450 | 1.353.478 | 275,6 / 1.050,9 | 3.384,9 |
| audiencias | PYG | reload | 37 / 61 / 31 / 31 / 1 | 781.467 / 1.450 | 1.353.478 | 147,7 / 632,4 | 3.664,7 |
| landings | PYG | first | 36 / 63 / 7 / 7 / 0 | 1.407 / 7 | 555.191 | 170,6 / 687,9 | 3.166,9 |
| landings | PYG | reload | 36 / 63 / 7 / 7 / 0 | 1.407 / 7 | 556.497 | 109,3 / 368,1 | 2.561,2 |
| editor | PYG | first | 40 / 65 / 24 / 24 / 0 | 3.368 / 16 | 600.221 | 134,7 / 621,4 | 2.854,6 |
| editor | PYG | reload | 40 / 65 / 24 / 24 / 0 | 3.368 / 16 | 600.221 | 102,2 / 370 | 2.826 |
| telefonos | PYG | first | 37 / 61 / 10 / 10 / 0 | 5.156 / 28 | 575.570 | 150,6 / 589,6 | 2.598,2 |
| telefonos | PYG | reload | 37 / 61 / 10 / 10 / 0 | 5.156 / 28 | 575.570 | 95,6 / 373 | 2.804,3 |

Tiempos medios de respuesta de la primera carga; NO percentiles ni tiempos de Supabase:

| Pantalla | Moneda | API simulada/CDP ms | Recursos HTTP ms | Backend DB/API real |
| --- | --- | ---: | ---: | --- |
| inicio | ARS | 37,6 | 391,8 | no disponible |
| conversiones | ARS | 71,5 | 159,8 | no disponible |
| audiencias | ARS | 80,7 | 271,5 | no disponible |
| landings | ARS | 10 | 78,9 | no disponible |
| editor | ARS | 10,5 | 114,4 | no disponible |
| telefonos | ARS | 6,1 | 48,7 | no disponible |
| inicio | PYG | 6,4 | 59,1 | no disponible |
| conversiones | PYG | 34,7 | 65,3 | no disponible |
| audiencias | PYG | 18,6 | 51,3 | no disponible |
| landings | PYG | 4,8 | 65,9 | no disponible |
| editor | PYG | 4,4 | 38,8 | no disponible |
| telefonos | PYG | 2,4 | 37 | no disponible |

La ventana incluye 1,5 s de inactividad para capturar precargas; no es TTI/LCP. CPU JS/tareas son contadores del navegador. Host compartido, algunas muestras coinciden con diagnóstico local, sin control estadístico de carga/caché ni p95. No inferir una ventaja de ARS/PYG de muestras únicas. El primer intento adicional de navegador se detuvo al quedar esperando CDP; se añadió un límite al debugger y selección de la pestaña about:blank. Las 24 muestras completas posteriores son las que figuran aquí.

Operaciones principales: Inicio carga RPC de resumen/cache y tarjetas; Conversiones carga filas/journeys/config/filtros y calcula estadísticas; Audiencias carga compradores y ejecuta mapper/reglas/ranking/resumen además de los datasets de su contenedor; Landings carga listado/settings; Editor carga landing/asignaciones/gerencias/Atrio/pixels y genera formulario/preview; Teléfonos carga gerencias/teléfonos/phone_metrics y agrupa contadores. No se guarda una landing ni se envían CTA/eventos productivos. CSV tiene oráculos de generación, pero no se midió su descarga real en pantalla.

## ARS y riesgos reclasificados

Se conserva el timeout ARS de producción de 12 s del 15 de septiembre. Esta continuación no ejecutó consultas productivas. El EXPLAIN previo sin ANALYZE señala raw_purchases como mayor costo estimado, pero no prueba qué nodo consumió el tiempo real. La comparación sintética previa usó iguales cantidades y parámetros: a 42.449 compradores, ARS 3.066,006 ms y PYG 5.601,351 ms, 10.480.783 bytes JSON cada una. Eso no reproduce la distribución/RLS productivos ni demuestra resolución del timeout.

- Requisito pendiente de cierre: reconstrucción local de la historia SQL. El primer error está probado; requiere un alcance específico para resolver el baseline de migraciones sin cambiar historia desplegada a ciegas. No se autoriza aquí reordenarla.
- Infraestructura local: compatibilidad Vector/Docker Desktop y salud de observabilidad. Ya existe alternativa de pruebas reproducible con DB/PostgREST aislados; no se seguirá intentando el stack completo indefinidamente.
- Fase futura de integridad conversiones/CAPI: duplicados Lead, reintentos sin claim, contadores perdidos y cola diferida con nuevas identidades. Prioridad alta por el efecto externo. Probar además caídas entre aceptación y persistencia, timeouts ambiguos y rutas WhatsApp/Chatrace completas.
- Fase futura de Audiencias: diagnóstico temporal representativo de ARS, percentiles y equivalencia completa. ARS por sí solo NO bloquea Fase 0.
- Fase futura de mediciones integradas: las seis pantallas contra el backend reconstruido, datos representativos, RLS/Auth completos, caché caliente/fría, WebSocket y distribución de latencia. No extrapolar cifras sintéticas.
- Fase 1 propuesta: se conserva únicamente la documentación previa sobre diferir descargas del contenedor de Audiencias. No se inició ni implementó. Las correcciones de integridad no se mezclan con esa propuesta.

## Archivos, datos y limpieza

Los 19 originales están conservados. Se agregaron diagnóstico de arranque, esquema/runtime/runner de handler y reportes locales; se actualizaron verificador, clasificador de tráfico, helper de navegador, contratos, baseline, rollback, README y generador de cierre. Inventario exhaustivo y hashes: artifact-audit.json. La revisión no debe confundirse con garantizar seguridad de toda la aplicación: abarca los artefactos de esta fase.

Fixtures con emails example.invalid, teléfonos sintéticos y configuración ficticia. Tokens/passwords locales efímeros solo en memoria. No se guardan datos personales reales, secretos, credenciales productivas ni rutas absolutas de usuario. La ruta de perfiles se expresa aquí con %TEMP% para mantener portabilidad.

El intento anterior de borrar %TEMP%\phase0-browser-nsxAob fue rechazado por la revisión automática. No se reintentó ni se evadió esa política. El intento de navegador detenido dejó también %TEMP%\phase0-browser-PypJSp. Con todos los procesos que los utilicen cerrados, el usuario puede abrir %TEMP% en el Explorador y eliminar únicamente esas carpetas. Las rutas absolutas se informan en la respuesta, sin incorporarlas a fixtures/scripts. Si Windows indica que están en uso, esperar o reiniciar antes de eliminarlas. No se borra ningún perfil habitual del usuario.

Rollback: no hay cambios productivos que revertir. Se mantiene rollback-and-phase-1.md, incluida la advertencia de que revertir código no deshace envíos CAPI. No hacer reset --hard ni clean -fd para descartar artefactos de Fase 0.
