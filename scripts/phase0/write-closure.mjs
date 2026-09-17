// Final report generated exclusively from local aggregate evidence.
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {root} from './local-runtime.mjs';
const folder=join(root,'docs/optimization/phase-0');
const read=f=>JSON.parse(readFileSync(join(folder,f),'utf8'));
const verification=read('verification-results.json'),screens=read('screen-baseline.json'),handler=read('handler-concurrency-results.json');
const replay=read('local-start-replay.json'),startup=read('local-start-diagnostic.json'),vector=read('vector-diagnostic.json');
if(!verification.completed)throw Error('Wait until the final verification run finishes');
const totals=verification.suites.reduce((a,s)=>({passed:a.passed+(s.passed??0),failed:a.failed+(s.failed??0),skipped:a.skipped+(s.skipped??0)}),{passed:0,failed:0,skipped:0});
const migrationsPassed=replay.migrations.filter(m=>m.status==='passed').length,failedMigration=replay.migrations.find(m=>m.status==='failed');
const migrationsNotRun=replay.migrationCount-replay.migrations.length;
const n=x=>Number(x).toLocaleString('es-AR',{maximumFractionDigits:1});
const suites=verification.suites.map(s=>`| ${s.name} | ${s.exitCode} | ${s.passed??'—'} | ${s.failed??s.errors??'—'} | ${s.skipped??'—'} |`).join('\n');
const rows=screens.reports.map(s=>`| ${s.screen} | ${s.currency} | ${s.load} | ${s.traffic?.static.requests??'no medido'} / ${s.traffic?.app.requests??'no medido'} / ${s.api.length} / ${s.traffic?.preflight.requests??'no medido'} / ${s.traffic?.external.requests??'no medido'} | ${n(s.api.reduce((a,r)=>a+r.bodyBytes,0))} / ${n(s.api.reduce((a,r)=>a+r.rows,0))} | ${n(s.transferredBytes)} | ${n(s.scriptDurationMs)} / ${n(s.taskDurationMs)} | ${n(s.elapsedMs)} |`).join('\n');
const responseRows=screens.reports.filter(s=>s.load==='first').map(s=>`| ${s.screen} | ${s.currency} | ${n(s.api.reduce((a,r)=>a+r.fixtureResponseMs,0)/s.api.length)} | ${n(s.responseMs.reduce((a,v)=>a+v,0)/s.responseMs.length)} | no disponible |`).join('\n');
const summary={verdict:'Fase 0 bloqueada',tests:totals,migrations:{passed:migrationsPassed,failed:failedMigration?1:0,notRun:migrationsNotRun,total:replay.migrationCount},screenSamples:screens.reports.length,screenSamplesValid:screens.reports.filter(s=>s.ready&&!s.errors.length&&!s.unknown.length).length,handlerCharacterizations:{passed:handler.passed,failed:handler.failed},reason:'Fresh migration replay fails before conversions exists; complete backend cannot be reconstructed without changing the migration baseline.',phase1Implemented:false};
const text=`# Fase 0: cierre final acotado

Fecha: 16 de septiembre de 2026. Rama main, HEAD a4e752cf58f628813d3979d598b60d480caaac8d. Los 19 archivos iniciales se conservan. No se modificó lógica productiva, migraciones originales, configuración del proyecto, índices, RLS, permisos, Edge Functions ni cron de producción. Sin commit, push, despliegue ni Fase 1. En esta continuación no se utilizó producción.

## Dictamen: Fase 0 bloqueada

El arranque dejó de ser un timeout opaco y las pruebas integrales tienen una alternativa reproducible. Sin embargo, el replay original desde cero falla en ${failedMigration?.file??'ver local-start-replay.json'}: ${failedMigration?.reason??'ver reporte'}. La tabla se crea más adelante, en 20260416100001_conversions.sql. Este problema de orden histórico pertenece al repositorio, no es solamente un bloqueo externo de Docker. No puede declararse que toda la reconstrucción local pasa. No se reordenaron, editaron, omitieron ni fabricaron migraciones para ocultarlo.

## Arranque local: diagnóstico reproducible

Docker ${startup.docker.version}, ${startup.docker.cpus} CPU, ${n(startup.docker.memoryBytes/1024**3)} GiB asignados. CLI 2.75.0, comandos y flags verificados con --help. Se comprobaron puertos, contenedores, estados y logs; no se tocaron pilas ajenas. No había conflicto en los puertos principales previstos antes de iniciar.

En el arranque en frío se observaron descargas/extracción de imágenes; se permitió una extensión de la espera por ese progreso. No se conserva un tiempo frío exacto válido. Un intento diagnóstico simultáneo encontró interferencia entre stacks temporales y fue descartado; luego se detuvo la pila propia antes de repetir. El diagnóstico completo con imágenes disponibles termina con error de salud en ${n(startup.bootstrap.elapsedMs)} ms, sin alcanzar migraciones ni seeds. No se atribuye retrospectivamente todo el timeout histórico a una sola etapa sin logs de aquella ejecución.

Vector ${vector.image} intenta conectar a host.docker.internal:2375. El log confirma que no puede listar contenedores por Connection refused (os error 111); se observaron ${vector.restarts} reinicios, sin OOM. El puerto 2375 no tenía listener. No se habilitó la API TCP Docker ni se cambió su configuración. Evidencia: vector-diagnostic.json y local-start-diagnostic.json.

La alternativa CLI sin Vector/Logflare arrancó en 81.195 ms. El bootstrap solo DB del pase que sí ejecutó el replay arrancó en ${n(replay.bootstrap.elapsedMs)} ms, bajo el límite de 180 s. Es una alternativa explícita, no la afirmación de que todos los servicios estén sanos. Los intentos intermedios corrigieron problemas del harness de privilegios/autenticación local; un cleanup Docker también agotó su timeout. No se usaron credenciales remotas. El diagnóstico guarda etapas y hashes de cada SQL sin conservar logs crudos ni secretos.

Reproducir desde la raíz: node scripts/phase0/diagnose-local-start.mjs; o --without-observability; o --database-only. Cada ejecución crea un proyecto temporal sin vínculo remoto, .env ni seeds. Antes de cargar SQL desconecta la DB de la red exterior, la conecta a una red interna, desactiva cron únicamente allí y valida postgres/unix-socket/off. El administrador local usa la contraseña del contenedor recién creado solo en memoria.

Hay ${replay.migrationCount} SQL y un README, no 269 SQL. Resultado real: ${migrationsPassed} migraciones aprobadas, ${failedMigration?1:0} fallida, ${migrationsNotRun} no alcanzadas. La fallida es la número ${replay.migrations.length}. No se continuará intentando la misma historia fallida. El runner devuelve fallo cuando no completa el replay; los hashes y el primer error están en local-start-replay.json. migration-replay.json se conserva como diagnóstico histórico anterior.

## Último pase de todas las suites

| Suite | Exit | Aprobadas | Fallidas/errores | Omitidas |
| --- | ---: | ---: | ---: | ---: |
${suites}

Pruebas: ${totals.passed} aprobadas, ${totals.failed} fallidas y ${totals.skipped} omisión en comandos. La integración omitida en el comando frontend se ejecuta y aprueba por separado sobre PostgREST local: no es una cobertura pendiente ni se suma dos veces como aprobada. SQL/pgTAP suma 111; integración Data API 1; frontend 99; Deno 41; collector 5; concurrencia SQL/colas 22; handler/CAPI ${handler.passed}. TypeScript y ESLint no se cuentan como tests individuales. ESLint registra ${verification.suites.find(s=>s.name==='eslint')?.errors} errores y ${verification.suites.find(s=>s.name==='eslint')?.warnings} advertencias preexistentes. Build final: ver build-results.json.

Las migraciones se reportan por separado: agregar sus ${migrationsPassed} aprobaciones al total de tests inflaría la cobertura. Hay una comprobación de reconstrucción fallida aunque las pruebas de caracterización pasen. Los fallos de preparación del harness no se suman al último pase exitoso ni se presentan como defectos corregidos del producto.

## Concurrencia integral y garantías reales

Se ejercitan completos los callbacks HTTP de conversions y retry-failed-conversions y sus imports actuales. Requests HTTP reales en loopback; Supabase JS real; PostgreSQL/PostgREST reales en contenedores descartables. Meta se sustituye por transporte controlado y todo otro destino externo se rechaza. Se conservan hashes de las fuentes productivas. El runtime inyecta Deno.serve y entorno en una VM Node y transpila TypeScript sin modificarlo: no reproduce el aislamiento Edge ni todas las policies/triggers del esquema completo.

${handler.passed} caracterizaciones aprobadas, ${handler.failed} fallidas. Incluyen ocho solicitudes simultáneas por tipo y moneda, claims Purchase, replay, fallos HTTP 503/red, cuatro workers CAPI concurrentes, recuperación, backoff de cinco minutos, límite de seis intentos Contact y procesamiento concurrente de Lead diferido. Las barreras retienen respuestas para garantizar solapamiento; no son solo llamadas secuenciales rápidas.

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

${screens.reports.length} muestras: Inicio, Conversiones, Audiencias, Landings, Editor y Teléfonos; ARS/PYG; primera carga y recarga. Mismos datos sintéticos, fecha y procedimiento, build real y páginas sin modificar, Chromium nuevo por muestra. No hay backend completo validado, por lo que no se atribuyen tiempos de fixtures al servidor. Las mediciones integradas DB/API quedan pendientes; no se inventan valores.

Categorías: estáticos = assets de Next/imágenes/fuentes; app = HTML/RSC/otros requests locales de Next; API = llamadas sin OPTIONS; preflight = OPTIONS. Bytes HTTP provienen de CDP. JSON cuenta bytes UTF-8 sintéticos y filas lógicas recibidas (incluidos metadatos/config), no usuarios únicos. El JSON también guarda bytes por categoría. Se bloquea HTTP externo y se excluyen frames WebSocket. La categor?a otro origen incluye eventos Network fuera del origen local y no implica una transferencia HTTP externa: Audiencias registra uno con cero bytes y sin destinos HTTP externos en blockedExternal. El total de requests es de eventos Network, no exclusivamente HTTP.

| Pantalla | Moneda | Carga | Requests estáticos/app/API/preflight | JSON bytes / filas | HTTP bytes | JS / tareas ms | Ventana ms |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: |
${rows}

Tiempos medios de respuesta de la primera carga; NO percentiles ni tiempos de Supabase:

| Pantalla | Moneda | API simulada/CDP ms | Recursos HTTP ms | Backend DB/API real |
| --- | --- | ---: | ---: | --- |
${responseRows}

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

El intento anterior de borrar %TEMP%\\phase0-browser-nsxAob fue rechazado por la revisión automática. No se reintentó ni se evadió esa política. El intento de navegador detenido dejó también %TEMP%\\phase0-browser-PypJSp. Con todos los procesos que los utilicen cerrados, el usuario puede abrir %TEMP% en el Explorador y eliminar únicamente esas carpetas. Las rutas absolutas se informan en la respuesta, sin incorporarlas a fixtures/scripts. Si Windows indica que están en uso, esperar o reiniciar antes de eliminarlas. No se borra ningún perfil habitual del usuario.

Rollback: no hay cambios productivos que revertir. Se mantiene rollback-and-phase-1.md, incluida la advertencia de que revertir código no deshace envíos CAPI. No hacer reset --hard ni clean -fd para descartar artefactos de Fase 0.
`;
writeFileSync(join(folder,'closure.md'),text);
writeFileSync(join(folder,'final-summary.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary));
