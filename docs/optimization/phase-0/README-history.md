# Fase 0: red de seguridad

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


## Estado histórico de Fase 0B

Bootstrap y manifiesto implementados; los dos placeholders fueron recuperados/sanitizados con autorización. Comando canónico: `node scripts/phase0/run-bootstrap-validation.mjs`. Documentación operativa: `supabase/bootstrap/README.md`, relativa a la raíz del repositorio. Informe: `phase0b-bootstrap-report.md`.

Fase 0B bloqueada por `20260325201000`: setval(0) en una tabla vacía. Dos intentos limpios: 35 migraciones aprobadas, 1 fallida y 232 no alcanzadas en cada uno. No hay fingerprints finales ni comparación integral local/remota. Las 299 comprobaciones existentes y 19 nuevas pasan; TypeScript/build/ESLint pasan. No hubo escrituras remotas ni otra migración histórica modificada. Las secciones siguientes describen etapas anteriores.

## Fase 0B: diagnóstico y diseño, reparación pendiente de aprobación

Actualización: la implementación del bootstrap fue autorizada. La recuperación detectó una credencial literal en el scheduler histórico y quedó detenida antes de reemplazar los placeholders. La decisión específica y una propuesta sin secretos están en `phase0b-recovery-decision.md`. No hay todavía un comando canónico nuevo disponible; no ejecutar los runners futuros del plan como si ya existieran.

Leer `phase0b-migration-repair-plan.md` para la causa comprobada, comparación de las 268 versiones locales/remotas, alternativas y propuesta única de bootstrap local/CI. El grafo está en `phase0b-dependency-graph.md` y sus evidencias en los JSON `phase0b-*`. `phase0c-concurrency-plan.md` contiene solo la planificación futura de Lead/CAPI.

Esta continuación consultó exclusivamente metadata remota en transacciones READ ONLY y no ejecutó migraciones ni modificó lógica productiva. La reparación no está implementada: el dictamen anterior de Fase 0 bloqueada sigue vigente. Los comandos de runners futuros en el plan son una propuesta para aprobación, no herramientas ya disponibles. Para regenerar el análisis estático sin conectarse a Supabase: `node scripts/phase0/analyze-migration-dependencies.mjs`.

## Cierre final acotado

El dictamen vigente y los totales finales están en closure.md. Esta continuación no utiliza producción. Los archivos originales siguen conservados. El directorio de migraciones contiene 268 SQL y un README: las referencias anteriores a 269 migraciones eran un conteo de archivos, no de scripts ejecutables.

Comandos adicionales, desde la raíz:

```powershell
node scripts/phase0/diagnose-local-start.mjs
node scripts/phase0/diagnose-local-start.mjs --without-observability
node scripts/phase0/diagnose-local-start.mjs --database-only
node scripts/phase0/run-handler-concurrency.mjs
node scripts/phase0/run-verification.mjs
node scripts/phase0/run-screen-benchmark.mjs
node scripts/phase0/write-closure.mjs
node scripts/phase0/audit-artifacts.mjs
```

El diagnóstico usa opciones verificadas con la ayuda de CLI 2.75.0. Cada intento crea un proyecto temporal sin .env, enlace remoto ni seeds. El bootstrap es previo a las migraciones: al completarlo se aísla su DB de la red exterior, se desactiva cron exclusivamente allí y se recorren TODOS los SQL originales en orden, deteniéndose ante el primer error. No modifica ni saltea migraciones. Las variantes que excluyen observabilidad o inician solo DB son alternativas explícitas, no un stack completo validado.

El bloqueo de Vector está documentado en vector-diagnostic.json: el servicio intenta llegar a la API Docker por host.docker.internal:2375, sin listener disponible. No se habilitó ese puerto ni se cambió Docker. Se guardan categorías de logs y estados; no logs crudos que puedan contener claves. Los contenedores de otros trabajos no se tocan.

La suite integral usa HTTP real en loopback, PostgREST/PostgreSQL reales y callbacks completos actuales. Todas las llamadas externas pasan por un transporte simulado que rechaza destinos inesperados. Los tests caracterizan también defectos reales de duplicación: leer contracts.md antes de interpretar sus aprobaciones como garantía de envío único. El esquema acotado no sustituye la historia completa de migraciones.

Las nuevas mediciones distinguen static (assets), app (HTML/RSC/otros requests de Next), API, preflight y externos bloqueados. Las respuestas API siguen siendo sintéticas mientras no exista backend completo validado; su duración no es latencia de DB. La primera carga y recarga de ARS/PYG usan el mismo procedimiento.


Fecha inicial: 15 de septiembre de 2026. Revalidación y ampliación: 16 de septiembre de 2026. Repositorio `landing-builder`.

**Estado de cierre:** consultar `closure.md` y los resultados JSON de esta carpeta. Los 19 archivos iniciales se conservan. Se ampliaron las herramientas locales, concurrencia y mediciones; ninguna Fase 1 está implementada. El resultado histórico de abajo no sustituye la ejecución actual ni demuestra un replay integral de migraciones.
Base: `main`, HEAD y referencia local `origin/main` en `a4e752cf58f628813d3979d598b60d480caaac8d`; árbol limpio al comenzar. No se hizo fetch: no se afirma haber comprobado cambios remotos posteriores.

Esta fase agrega únicamente pruebas, herramientas locales de medición y documentación. No modifica archivos de aplicación, migraciones existentes, funciones desplegadas, índices, RLS, cron ni configuración. Sin despliegues, commit o push. Producción se consultó mediante Supabase MCP con transacciones de solo lectura y límites de ejecución; no se invocaron asignaciones de teléfono, CAPI, refrescos de caché ni escrituras.

Leer:

- `contracts.md`: contratos observados y diferencias que una optimización debe conservar.
- `baseline.md`: resultados, métodos, límites y cobertura pendiente.
- `rollback-and-phase-1.md`: criterios de paridad, rollback y siguiente cambio propuesto.
- `production-statistics.json`: métricas agregadas y huellas de funciones, sin consultas originales ni identificadores personales.

## Reproducir

Desde `frontend`:

```powershell
npm.cmd test
npx.cmd tsc --noEmit --incremental false
```

Desde `infra/meta-ip-collector`:

```powershell
npm.cmd test
```

Desde la raíz:

```powershell
deno test supabase/functions/conversions/*_test.ts supabase/functions/builder-config/*_test.ts
node scripts/phase0/run-local-contracts.mjs
node scripts/phase0/run-browser-benchmark.mjs
```

La integración Data API se omite en el `npm test` normal si faltan sus dos variables locales. El runner Docker la ejecuta expresamente con 1.205 compradores ficticios y un máximo de 1.000 filas de PostgREST. No necesita claves de producción.

El runner crea una base nueva, red interna, contenedores de nombre aleatorio, contraseña y JWT efímeros. Solo PostgREST se publica en un puerto aleatorio de `127.0.0.1`; la base no publica puertos. La API tiene además interfaz bridge porque Docker Desktop no publica puertos en una red exclusivamente interna. En `finally` se eliminan solo los recursos creados por esa ejecución, incluidos sus volúmenes anónimos. Nunca se ejecuta `docker system prune` ni se toca otra pila local.

Se usan imágenes existentes PostgreSQL 17.6.1.063 y PostgREST v14.1. El esquema de dependencias es mínimo y explícito: auth, conversiones y sus permisos de prueba. Se cargan SIN EDITAR las migraciones reales de claims, audiencias y configuraciones. Esto prueba sus funciones y restricciones; NO es un replay de todo el esquema ni demuestra paridad completa de RLS/triggers de producción.

El benchmark utiliza las funciones reales del frontend, compiladas con esbuild ya disponible vía tsx, dentro de Chromium local con perfil temporal. No accede al sitio ni a Supabase. Puede indicarse otro ejecutable con `PHASE0_BROWSER`. Sus personas sintéticas usan `example.invalid` y teléfonos no operativos.

## Inventario de archivos nuevos

- Documentación: este README, contracts.md, baseline.md, rollback-and-phase-1.md, production-statistics.json y deployed-edge-manifest.json, todos en esta carpeta.
- Tests frontend: phase0AudiencePipeline.test.ts, phase0HomeContracts.test.ts, phase0LandingContracts.test.ts y phase0PhoneHandlers.test.ts, en frontend/tests.
- Tests SQL: phase0_audience_boundaries.test.sql y phase0_purchase_claims.test.sql, en supabase/tests.
- Herramientas: run-local-contracts.mjs, local-schema.sql, run-browser-benchmark.mjs, audience-benchmark.ts, browser-observer.js, production-statistics.sql y measure-audience.sql, en scripts/phase0.

Total: 19 archivos nuevos; cero archivos preexistentes modificados. Las definiciones productivas siguen en sus ubicaciones originales.

Ese total describe la entrega inicial. El inventario ampliado, con rutas relativas y hashes, está en `artifact-audit.json`. Los scripts añadidos no cambian configuración ni dependencias del producto.

## Revalidación ampliada del 16 de septiembre

Desde la raíz, con Docker local encendido:

```text
node scripts/phase0/run-verification.mjs
node scripts/phase0/run-migration-replay.mjs
node scripts/phase0/run-audience-diagnostics.mjs
node scripts/phase0/audit-artifacts.mjs
```

`run-verification` recrea desde cero el esquema sintético y las seis migraciones de contratos, ejecuta pgTAP e integración, recrea otra base para concurrencia y ejecuta frontend, Deno, collector, TypeScript y ESLint completo. Un error de infraestructura conserva exit code no cero aunque las aserciones anteriores hayan pasado; no interpretar `passed` aislado como suite completa.

`run-migration-replay` intenta primero provisionar una base oficial con la CLI en un directorio temporal sin vínculo remoto, `.env` ni seed. Solo después de verificar la identidad y aislar la red intentaría las 268 migraciones originales ordenadas. El estado real, incluyendo un eventual bloqueo anterior a la primera migración, queda en `migration-replay.json`. No salta migraciones para presentar un éxito artificial.

Todas las escrituras SQL se envían a contenedores descartables creados por la ejecución. Se verifica que el endpoint Docker es local, la base usa socket local o loopback, la red de PostgreSQL es interna y no acepta una URL de base externa. `local-runtime` desactiva la ejecución de cron exclusivamente en el contenedor sintético. PostgREST publica solamente un puerto aleatorio de loopback. Los passwords y JWT se generan en memoria y no se persisten en informes. Se eliminan únicamente recursos propios; no se toca otra pila Docker.

Para pantallas, generar primero un build sintético. En PowerShell, desde `frontend`:

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54399'
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY = 'synthetic-local'
$env:NEXT_TELEMETRY_DISABLED = '1'
node node_modules/next/dist/bin/next build
```

Luego, desde la raíz: `node scripts/phase0/run-screen-benchmark.mjs`. En otros shells configurar las mismas variables de proceso; no editar `.env` ni `next.config`. Chromium se descubre mediante ubicaciones estándar de la plataforma o `PHASE0_BROWSER`, sin rutas de usuario incorporadas al repositorio. El benchmark usa las páginas y layout reales del build, con transporte sintético interceptado y sin llamadas a producción. Cada muestra tiene un navegador nuevo; una recarga incluye una precarga no medida. Ver límites de medición en `screen-baseline.json`.

`explain-audience-readonly.sql` es el único nuevo diagnóstico destinado a producción: transacción READ ONLY, timeout de 8 s, EXPLAIN sin ANALYZE del SELECT interno, sin ejecutar la RPC ni devolver identidades, filtros SQL, datos o credenciales. Los costos estimados de `production-explain.json` no son milisegundos.

## Mediciones de producción

`scripts/phase0/production-statistics.sql` permite observar costos acumulados sin ejecutar las operaciones costosas. `measure-audience.sql` mide exclusivamente la RPC de lectura verificada, con usuario contextual y rol authenticated; solo devuelve tiempo, cantidad y bytes. Usar el MCP y conservar únicamente el resultado agregado final; el resultado intermedio de `set_config` no debe guardarse.

El timeout ARS observado en esta fase es un límite de seguridad, no una invitación a aumentar el timeout o hacer pruebas de carga. Para comparaciones exactas usar fixtures congelados; un `p_as_of` fijo no impide que ingresen compras retroactivas entre mediciones.

`scripts/phase0/browser-observer.js` se puede pegar en DevTools antes de navegar dentro del panel y detener con `phase0.stop()`. Solo devuelve agregados de recursos y long tasks; nunca cuerpos, parámetros, cabeceras ni almacenamiento del usuario. No guarda HAR. Los bytes cero pueden significar falta de Timing-Allow-Origin o caché; no deben interpretarse automáticamente como respuesta vacía. El observador no calcula cantidad de filas JSON ni mide por sí solo CPU de una función específica.

Para una pantalla real: mismo usuario/rol y moneda, mismo período, misma acción, anotar estado de caché, versión del navegador y carga del equipo; medir carga inicial, edición de regla y descarga por separado. No generar clics CTA ni webhooks sintéticos en producción. En landings, observar tráfico real ya autorizado o usar entorno local.
