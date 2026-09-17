# Fase 0B cerrada

Fecha: 2026-09-17. Rama main; HEAD a4e752cf58f628813d3979d598b60d480caaac8d. Cierre limitado al bootstrap reproducible local/CI. No se inició Fase 0C ni Fase 1. No hubo escrituras remotas, deploy, commit ni push.

## pg_net resuelto

Ambos entornos tienen PostgreSQL 17.6 y pg_net 0.19.5. El hook antiguo del arranque CLI local aplicaba SECURITY DEFINER, search_path y ACL de versiones anteriores. La instalación nativa de la versión disponible, en una base vacía propia y aislada, reproduce ahora exactamente las funciones y permisos remotos. No se editaron funciones ni archivos internos de la extensión. No fue necesaria la opción de compatibilidad manual. Diagnóstico completo, fuentes, límites y matriz: phase0b-pg-net-resolution.md.

El bootstrap usa DROP/CREATE EXTENSION sin CASCADE, con event_triggers=false solo dentro de esa transacción y restauración automática a on. Las 268 migraciones corren con los triggers activos. La capa RLS post-histórica previamente autorizada se conserva y su referencia coincide íntegramente. No se modificaron migraciones históricas en esta continuación.

## Dos reconstrucciones

- Ejecución 1: 268/268; arranque 34341 ms; replay 447006 ms; RLS 61/61; pg_net 46/46; idempotencia 1/1.
- Ejecución 2: 268/268; arranque 34701 ms; replay 346792 ms; RLS 61/61; pg_net 46/46; idempotencia 1/1.

Fingerprint bruto idéntico: fb5a310693c0aeb8e0825bb09c1bf33aa26aa1e108d1b78e9938c1819a793671.
Fingerprint compuesto idéntico (esquema, plataforma y seguridad net): 182bbc25af1c91fc8e275513ec1cb564fb031fb9091e98caf357ce6ed4b902b5.

Cron.launch_active_jobs=off; ninguna solicitud HTTP de las pruebas se confirmó. En ambas bases quedaron cero filas en cola, cero respuestas de red y ninguna columna de instrumentación. Se eliminaron todos los contenedores, redes y volúmenes de los runners. Las definiciones cron conservan su active histórico, pero no se ejecutan con el interruptor global apagado.

## Comparación estructural

8 diferencias enumeradas y acreditadas; cero pendientes: cuatro órdenes físicos de columnas, tres objetos de pg_graphql local ya revisados y el hook antiguo de instalación de plataforma, documentado individualmente. El namespace de pg_net también quedó idéntico; no necesita normalización. Las doce funciones miembro y todos los privilegios efectivos de los cinco roles coinciden. No hay exclusiones genéricas. Detalle íntegro: phase0b-schema-review.md y bootstrap-schema-diff.json.

## Pruebas

- collector: 5 aprobadas, 0 fallidas.
- deno: 41 aprobadas, 0 fallidas.
- frontend: 99 aprobadas, 0 fallidas.
- sql-and-integration: 112 aprobadas, 0 fallidas.
- concurrency: 22 aprobadas, 0 fallidas.
- handler-concurrency: 20 aprobadas, 0 fallidas.
- bootstrap-safety.test.mjs: 19 aprobadas, 0 fallidas.
- bootstrap-compatibility.test.mjs: 6 aprobadas, 0 fallidas.
- bootstrap-net.test.mjs: 8 aprobadas, 0 fallidas.
- Secuencia: 6/6.
- Acceso RLS: 61/61 por reconstrucción.
- Acceso pg_net: 46/46 por reconstrucción.
- Idempotencia de instalación: 1/1 por reconstrucción.

Total: 446 comprobaciones distintas aprobadas (391 existentes y 55 nuevas), cero fallidas y cero pruebas únicas omitidas. Las 108 comprobaciones RLS/net/idempotencia se ejecutaron en ambas reconstrucciones: 554 ejecuciones totales, sin contar replays ni verificaciones de build/comparador. La omisión del comando frontend es la integración que pasó separadamente; se cuenta una vez.

TypeScript y build: exit 0. Build: 73928 ms. ESLint: cero errores y 18 advertencias preexistentes. Advisors locales no disponibles en CLI 2.75.0 según su ayuda real; no se los presenta como una prueba aprobada.

## Riesgos y alcance

TRUNCATE de anon/authenticated en ar_name_inferred_sex, ar_phone_area_codes, cron_config y tracking_queue permanece como hallazgo de la futura fase de seguridad. También se documentan los permisos PUBLIC sobre las relaciones internas de net. Paridad no significa seguridad: no se endureció solo local ni se modificó producción.

El hook antiguo sigue en la plataforma local y podría reaplicar las alteraciones en una futura reinstalación fuera del runner; esa operación exige revalidación. El bootstrap y comparador rechazan cambios no acreditados. El cierre no acredita el stack Supabase completo, latencias productivas ni deduplicación real de Meta. Los pendientes previos de concurrencia pertenecen a Fase 0C; el diagnóstico de ARS y mediciones pendientes, a la futura fase de Audiencias/rendimiento. No se implementó ninguna.

Los 19 archivos originales se conservan. .env sigue físicamente intacto, ignorado y retirado del índice por autorización previa. La auditoría final y los hashes están en artifact-audit.json; el inventario de esta continuación en bootstrap-pg-net-file-changes.json. No se copiaron credenciales ni datos productivos.

Los perfiles Chromium previos no se tocaron. Las carpetas temporales de configuración del bootstrap se conservan; no son servicios ni volúmenes de base en ejecución. No se intentó eludir ninguna política de limpieza.
