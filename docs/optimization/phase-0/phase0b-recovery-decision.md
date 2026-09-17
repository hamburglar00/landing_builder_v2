# Recuperación autorizada: bloqueo por credencial literal

## Decisión posterior aplicada

El usuario autorizó expresamente la variante parametrizada propuesta abajo. Se recuperaron los seis statements de `20260427180000` y se reemplazó `20260427190000` con la variante sanitizada, sin conservar el Bearer ni URL productiva literal. Procedencia y hashes: `phase0b-recovery-provenance.json`. La inspección segura está en `phase0b-credential-inspection.json`. El bloqueo actual ya no es esta decisión: es setval(0) en otra migración, según `phase0b-bootstrap-report.md`. El contenido inferior conserva la propuesta original para trazabilidad.

Fecha: 2026-09-16. La implementación local/CI fue autorizada; esta revisión encontró una incompatibilidad entre restaurar literalmente la historia y no guardar secretos. No se implementó el bootstrap ni se reemplazó ningún placeholder. No es un fallo de autenticación ni falta de procedencia: ambos contenidos históricos se recuperaron y acreditaron en memoria.

## Evidencia verificada

Se consultaron exclusivamente las dos versiones autorizadas de `supabase_migrations.schema_migrations` en una transacción READ ONLY con statement_timeout de 8 s y lock_timeout de 1 s. También se consultaron metadatos del cron y la función actual, sin comandos ni valores sensibles. No hubo escrituras remotas ni llamadas HTTP de negocio.

- `20260427180000`, nombre remoto `tracking_queue`: seis statements, MD5 de ledger `6bbd4ef6d971e9e2a9d24db227844990`. Define tabla, dos índices, función y trigger. Los seis aparecen en `20260629190000_constructor_tracking_queue.sql`, normalizando espacios. El cuerpo de la función coincide con el actual remoto: MD5 `9b1889f56258bf9d6554213c05019c76`.
- `20260427190000`, nombre remoto `tracking_retry_scheduler`: un bloque DO, MD5 de ledger `34162945f0a3ae6cf9cd926cdf9b588f`. Programa HTTP mediante pg_cron/pg_net y contiene una autorización Bearer literal. Su valor no se mostró ni se guardó. No se probó si la credencial todavía funciona.
- Ambos hashes coinciden con los registrados durante el diagnóstico anterior. La serialización es `array_to_string(statements, LF)` sin CR; no equivale al hash de un archivo SQL reconstruido con terminadores.
- El cron actual usa `public.cron_retry_tracking_queue()`; esa transición figura en `20260629190000`. Su horario actual `3-59/5 * * * *` está explicado por `20260805214000_stagger_frequent_cron_jobs.sql`. Por eso el cron histórico no es idéntico al actual, sin que eso pruebe un drift inexplicable.
- El RLS actual de tracking_queue está habilitado; los seis statements originales no lo habilitan. Sigue pendiente acreditar el efecto/procedencia de ensure_rls al reconstruir el esquema completo.

Los resultados sin secretos están en `phase0b-recovery-provenance.json`. No se guardaron cuerpos SQL crudos del scheduler, URL productiva ni la credencial. No se exportaron filas de aplicación.

## Excepción concreta propuesta, todavía NO aplicada

Para poder versionar una variante segura del placeholder `20260427190000_remote_sync_placeholder.sql`, se propone sustituir exclusivamente los literales de URL y autorización por parámetros locales. El resto de la estructura recuperada permanece igual:

```sql
do $$
begin
  if exists (select 1 from cron.job where jobname = 'tracking-retry-every-5m') then
    perform cron.unschedule('tracking-retry-every-5m');
  end if;

  perform cron.schedule(
    'tracking-retry-every-5m',
    '*/5 * * * *',
    $job$
    select net.http_post(
      url := current_setting('phase0.tracking_retry_url', true),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('phase0.tracking_retry_token', true)
      ),
      body := '{"limit":50}'::jsonb
    );
    $job$
  );
end;
$$;
```

Este bloque es una propuesta revisable, no un archivo ejecutable ni SQL aplicado. No debe ejecutarse manualmente ni en producción. El runner futuro mantendría cron deshabilitado y la DB sin salida de red; los parámetros no se resolverían con datos productivos. No se propone activar este job ni cambiar configuración productiva.

La variante conserva la estructura del scheduler, pero **no es una recuperación literal ni tendrá el mismo checksum remoto**. Necesita aprobación específica porque la autorización vigente permite recuperar y verificar historia, no sustituir silenciosamente su contenido. Se conservarían el hash del original y el de la variante, con la transformación explícita en la procedencia. La migración posterior de junio seguiría reemplazando el job como lo hace hoy.

Si esta excepción no se aprueba, ambos placeholders permanecen sin cambios y la Fase 0B queda bloqueada. No se ejecutarán 267 migraciones, no se simulará que un SELECT 1 reproduce el scheduler y no se marcará su versión como aplicada sin ejecutar la definición correspondiente.

## Estado de validación

Docker local responde: 29.7.2, 8 CPU, 7205425152 bytes asignados. Rama y HEAD permanecen en main/a4e752cf58f628813d3979d598b60d480caaac8d. Se verificó ayuda de Supabase CLI 2.75.0, sin actualizarla. No se creó ni eliminó ninguna base o contenedor en este intento.

Reconstrucciones limpias: 0 ejecutadas. Suites de aplicación: no reejecutadas; los resultados de 299 aprobaciones siguen siendo históricos, no validación de un bootstrap nuevo. Manifiesto ejecutable, runner, diff integral y dos fingerprints siguen pendientes. Los 268 SQL se mantienen intactos. No hubo deploy, commit, push, Fase 0C ni Fase 1.

Decisión solicitada: autorizar esta adaptación local documentada, o detener Fase 0B conservando los placeholders. No se presupone una respuesta por el tiempo transcurrido.
