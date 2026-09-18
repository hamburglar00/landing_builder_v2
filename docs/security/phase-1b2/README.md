# Fase 1B.2: aislamiento de settings.revalidate_secret

Estado: bloqueada antes de implementar. Base main: 31babbb9eec24afa37930fc616b6d97448b4c7e9. Inspección del 2026-09-18 UTC (2026-09-17 en Argentina). No hay migración 270 ni cambios de aplicación, permisos o lógica de negocio.

## Bloqueo acreditado y decisión necesaria

El flujo clásico envía desde el navegador el secreto a `{settings.url_base}/api/revalidate`. `url_base` es editable desde Configuración por un usuario authenticated con perfil admin. El objetivo de esta fase también impide que ese administrador reciba el secreto.

Trasladar sin más esa solicitud a un relay servidor conserva una vía de extracción: un admin puede elegir una URL que controle, guardar la configuración y pedir la revalidación; el relay enviaría allí el secreto. Validar sesión y rol no elimina esta dependencia del destino. Es una inferencia sobre el diseño propuesto, acreditada por los lectores y escritores actuales; no se ejecutó ese ataque ni se consultó ninguna configuración productiva.

Fijar destinos en el servidor o exigir una lista de orígenes confiables evita esa vía, pero limita las URLs configurables actuales. No está acreditado cuáles son todos los destinos legítimos ni que el receptor clásico desplegado ejecute la ruta de este repositorio. Los dominios por defecto del código son referencias de configuración, no una aprobación completa de destinos de salida. `ALLOWED_ORIGINS` controla CORS entrante y no acredita destinos de revalidación.

Se necesita decidir y acreditar:

1. Si los destinos de revalidación se administrarán exclusivamente en configuración del servidor, independientes de `settings.url_base`, o si una lista cerrada de orígenes aprobados limitará la URL editable. Deben quedar definidos los destinos legítimos de classic y constructor y el tratamiento de redirecciones; el navegador no podrá elegir un destino que reciba el secreto.
2. El contrato del receptor clásico que debe conservarse: si necesita seguir recibiendo el secreto entre servidores, quién administra ese receptor y cómo se coordinarán su autenticación y la rotación futura. No se necesita conocer el valor del secreto.

La instrucción del usuario exige detenerse ante una dependencia ambigua y documentar el bloqueo. Por eso no se creó una migración parcial ni se cambió solo el SELECT: eso rompería los editores, Tests y Configuración antes de disponer de un flujo servidor compatible.

## Lectores, escritores y exposición actual

El inventario completo acreditado en el repositorio está en [consumers.json](consumers.json), con archivo, líneas y hashes de fuentes. No certifica integradores externos ni configuración de despliegue.

| Consumidor | Uso acreditado |
| --- | --- |
| frontend/lib/settingsDb.ts | getSettings selecciona id, url_base, show_client_landing_preview y revalidate_secret explícitamente. updateSettings puede escribir URL, preview y secreto. |
| Admin / Configuración | Lee el secreto a estado React, puede mostrarlo en un input y lo envía al guardar. También edita url_base. |
| Admin / Tests | Lee el secreto y lo envía desde el navegador a la URL configurable; muestra el texto de respuesta remoto. |
| Editor admin y editor cliente | Leen el secreto a estado React y lo entregan a publishLandingChanges al guardar. |
| Listado admin y listado cliente | Solo usan url_base, pero reciben también el secreto porque llaman al mismo getSettings. |
| publishLandingChanges / publicUrls | Envían name y secret a classic o constructor. classic admite settings.url_base; constructor usa configuración pública de entorno o su default. |
| Next.js POST /api/revalidate | Recibe secret, compara REVALIDATE_SECRET del servidor o invoca verify_revalidate_secret usando la clave anon. No verifica sesión ni propiedad de la landing. Responde resultados de invalidación/calentamiento. |
| public.verify_revalidate_secret(text) | SECURITY DEFINER existente: compara el secreto y devuelve un booleano; ejecutable por anon/authenticated según el historial y Fase 1A. No devuelve el valor, pero es una superficie pública de comparación. |
| public.get_public_landing_routing() | SECURITY DEFINER existente: solo proyecta public_landing_runtime y public_landing_legacy_base_url. No proyecta el secreto. Sin llamada directa encontrada en las fuentes de aplicación inspeccionadas; no se presume que carezca de consumidores externos. |
| conversions: deriveEventSourceUrl | Lee únicamente url_base. Se identifica como dependencia que debe conservarse; el archivo y su lógica quedan intactos. |
| Fixture de pantallas de Fase 0 | Simula settings con un secreto vacío. Es evidencia de prueba, no un consumidor productivo. |

No se encontró select=* sobre settings en los consumidores directos del repositorio: el problema actual es que la proyección explícita incluye el secreto. Un atacante puede pedir esa columna o * por Data API mientras existan permisos efectivos.

La migración de preview incorporó una policy SELECT permisiva para todo authenticated; la migración posterior agregó el secreto a la misma tabla. El inventario de Fase 1A acredita SELECT de tabla y ausencia de ACL por columna. Admins conservan UPDATE/INSERT por RLS. Se trata de evidencia histórica y de fuentes: no se consultaron filas, catálogos ni grants productivos durante esta fase.

## Credenciales y bundles: alcance de la comprobación

El cliente del navegador usa NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY. La inspección estática revisó 206 fuentes frontend, 78 raíces use client y 121 módulos locales alcanzables. No encontró referencias a variables privadas en ese grafo ni nombres NEXT_PUBLIC de secretos, service_role o claves privadas. Las referencias a claves de servicio están en lib/supabase/server.ts y no resultaron alcanzables desde esas raíces. No se cambió ese helper compartido, usado por módulos fuera del alcance.

Esto no certifica los valores asignados en un despliegue ni un bundle ya generado. No se leyeron .env, valores de entorno, bundles existentes ni el secreto productivo. El build aislado con credenciales sintéticas y el escaneo de sus chunks están pendientes; no se afirma que hayan pasado.

## Documentación vigente revisada

RLS restringe filas; los grants deciden las operaciones accesibles. Una policy de lectura de settings no puede ocultar por sí sola una columna. [RLS de Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).

Un grant de tabla sigue habilitando una columna aunque se revoque su grant individual. La futura migración deberá retirar los privilegios amplios pertinentes y conceder explícitamente los campos permitidos. SELECT * puede fallar por falta de privilegio; los consumidores deben usar una proyección segura y tratar el error explícitamente. [Grants por columna](https://supabase.com/docs/guides/database/postgres/column-level-security).

La Data API respeta grants y RLS; las funciones requieren revisar EXECUTE y su modo de seguridad. No se supondrá que un RPC es privado por ejecutarse desde Next.js. [Seguridad de Data API](https://supabase.com/docs/guides/api/securing-your-api).

Se revisó el [changelog](https://supabase.com/changelog) y el [cambio de exposición por defecto](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically): afecta los grants automáticos de objetos nuevos; no retira los grants existentes de settings. Se revisó también la [restricción de OpenAPI con anon](https://supabase.com/changelog/42949-breaking-change-removing-access-to-openapi-spec-via-the-anon-key); no sustituye comprobar privilegios reales. La variante changelog.md no fue servida por la herramienta, por lo que se utilizó la página oficial HTML y sus anuncios.

## Implementación pendiente, sin ejecutar

Después de resolver el contrato de destinos se podrá crear la migración 270 con Supabase CLI, consultando primero su ayuda. Las 269 migraciones actuales y el manifiesto incremental no se modificaron. No se invocó la CLI ni se creó una migración vacía como marcador.

El diseño deberá retirar a PUBLIC/anon/authenticated el acceso pertinente al secreto a nivel tabla y columna; conservar lectura explícita no sensible y edición administrativa mínima; comprobar grants efectivos y RLS; y resolver el acceso del backend sin ampliar sus escrituras. La lectura url_base del backend existente debe conservarse sin editar conversions.

Los consumidores dejarán de recibir o enviar el secreto. Una ruta exclusivamente servidor verificará sesión y autorización sobre la acción y landing, derivará el destino de una fuente confiable y mantendrá el secreto fuera de respuestas, logs, errores y serialización de componentes. Debe impedir redirecciones que lo envíen a un destino no aprobado y proyectar respuestas propias sin reenviar cuerpos arbitrarios del receptor. La edición del secreto desde el navegador se retirará; su provisión y futura rotación serán operativas del servidor. No se propone añadir SECURITY DEFINER sin una necesidad demostrada.

El RPC verificador existente y el fallback del endpoint se revisarán junto con ese contrato. Revocar EXECUTE a anon aisladamente rompería el backend actual que usa ese mismo rol. No se cambian funciones ni se afirma que ese acceso esté resuelto.

## Pruebas y estado

Solo se completaron inspecciones de código, documentación, Git y hashes: main limpio al inicio, HEAD esperado, 269 archivos de migración registrados con hashes coincidentes, staging vacío y .env presente/ignorado/no rastreado.

No se ejecutaron pruebas de implementación. Permanecen pendientes: denegación SQL/Data API para anon y authenticated, columna explícita y SELECT *, grants efectivos, escritura mixta atómica, mínimo backend, consumidores seguros, respuestas sin secreto, bundle aislado, flujo administrativo con secreto sintético, reconstrucción completa 270/270, suites afectadas, TypeScript, build, ESLint y auditoría de la futura implementación. Las 536 comprobaciones de Fase 1B.1 no acreditan esta fase.

La auditoría documental de este bloqueo se registra por separado en audit.json. No cuenta como prueba de seguridad runtime, Data API, frontend o bundle.

## Rollout, rotación y rollback pendientes

No hay rollout ejecutable aprobado mientras falte el contrato de destinos/receptor. Después de implementarlo y probarlo localmente, el despliegue deberá coordinar la ruta servidor, los consumidores sin secreto y la restricción de grants para evitar que una versión vieja del navegador siga consultando la columna retirada. No se prepara ni ejecuta despliegue aquí.

Será necesario planificar la rotación del secreto durante el despliegue: el diseño actual lo entrega a sesiones authenticated, por lo que no puede considerarse confidencial por haberlo ocultado después. Esto no demuestra que alguien lo haya extraído. Primero se debe cerrar la exposición y coordinar todos los receptores; no se leyó, rotó ni reemplazó el valor actual.

No hay SQL ni aplicación que revertir en esta fase. El rollback de una implementación futura deberá conservar la prohibición de devolver el secreto al navegador y definir una alternativa operativa para revalidar mientras se revierte una versión incompatible. Restaurar SELECT/UPDATE amplio o la pantalla que muestra el valor reabriría la exposición y no se propone como reversión automática.

## Archivos conservados

Únicamente se agregan README.md, consumers.json, review.json y audit.json dentro de docs/security/phase-1b2/. Sin staging, commit, push, deploy, operaciones de Supabase remoto ni cambios de recursos Docker. No se tocaron conversions, eventos, teléfonos, secretos, TRUNCATE, cron ni otros hallazgos.
