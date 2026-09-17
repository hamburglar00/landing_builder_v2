# Propuesta de commit de checkpoint — NO ejecutado

Mensaje sugerido:

```text
test(phase0): close safety baseline and reproducible local bootstrap

Record two complete 268-migration rebuilds, identical fingerprints and
446 passing characterization checks. Preserve known Lead/CAPI delivery
defects and security findings as explicit, uncorrected follow-up work.

Include the authorized historical recovery/sequence exceptions, isolated
bootstrap and pg_net native alignment, parity evidence and rollback plan.
Remove .env from tracking while preserving the local file and add a
sanitized .env.example. No production deployment or Phase 0C/1 changes.
```

## Archivos incluidos

El inventario exacto, sin globs ni archivos implícitos, es final-inventory.json:

Total: 173 rutas (168 nuevas, cuatro modificadas y una retirada del seguimiento). El índice actual contiene únicamente la retirada previa de .env; el resto no fue staged en este pase.

- **created**: todos los archivos nuevos de Fase 0 enumerados allí: .env.example, documentación/evidencia, scripts/phase0, supabase/bootstrap, cuatro tests frontend y dos tests SQL. Incluye esta propuesta y el inventario.
- **modified**: .gitignore y las tres migraciones históricas previamente autorizadas: 20260325201000_add_internal_id_to_conversions.sql, 20260427180000_remote_sync_placeholder.sql y 20260427190000_remote_sync_placeholder.sql. Las dos últimas son recuperación exacta y scheduler sanitizado, respectivamente. La corrección de secuencia preserva el resultado poblado. No hay cambios históricos nuevos en este cierre.
- **removedFromTracking**: .env, cuya retirada ya está en el índice. Solo se incluiría la eliminación del seguimiento; el archivo físico local permanece intacto y no se vuelve a añadir.

Se conserva la historia de diagnósticos fallidos como evidencia; closure.md y final-summary.json son el dictamen vigente. Los documentos de propuesta de Fase 0C/Fase 1 son planificación, no implementación ni autorización para ejecutarlas.

## Exclusiones y revisión previa a una ejecución futura

No incluir .env local, valores secretos, perfiles Chromium, directorios temporales, .next, node_modules, archivos ignorados ni datos reales. No usar git add -f, git add . o un staging global: un futuro operador debe seleccionar las rutas exactas del inventario y revisar cualquier cambio posterior antes de preparar el índice.

Las modificaciones productivas del handler, retries, payloads, identidades, atribución, monedas y frontend están fuera del checkpoint y no existen en el diff actual. Las tres excepciones SQL anteriores sí son cambios históricos autorizados: no se disimulan como documentación ni como una nueva reparación productiva.

Revisar la retirada de .env por nombre/estado y por la comprobación sanitizada. Evitar imprimir su diff de eliminación, que contiene el valor histórico. Este checkpoint no reescribe el historial ni elimina de él la antigua clave pública anon.

En esta formalización no se hizo staging adicional, commit, push, fetch, deploy ni llamada remota. El mensaje y la lista son únicamente una propuesta revisable. La instantánea del inventario no autoriza automáticamente archivos que aparezcan después.
