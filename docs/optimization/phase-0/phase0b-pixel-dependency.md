# Dependencia de pixel_id descubierta durante el replay

Después de corregir la secuencia, el intento registrado en `bootstrap-missing-pixel-dependency-attempt.json` aprobó 54 migraciones y falló en la posición 55, versión `20260330193500`, SQLSTATE 42703: la columna `conversions.pixel_id` todavía no existía. Su transacción se revirtió y su versión no se registró.

El único proveedor de esa columna en la cadena es `20260426007000_conversions_add_pixel_id.sql`. La creadora de conversions no la incluye. El consumidor usa la columna en el backfill a meta_pixel_id incluso cuando no hay filas, porque PostgreSQL resuelve el nombre al analizar la sentencia.

Se añadió la arista proveedor-consumidor al manifiesto y la dependencia del proveedor sobre `20260417090000`, que crea visible_columns. Se adelanta el archivo completo, conservando su SHA256, bajo la estrategia de dependencias ya autorizada. No se cambia, recorta ni omite ningún statement histórico.

El proveedor también actualiza visible_columns. Para no decidir sobre datos existentes, el runner exige explícitamente que conversions y conversions_config estén vacías antes de adelantarlo; guarda solo los booleanos de esa comprobación. Si alguna tiene filas, aborta y exige revisión. No se permite usar este procedimiento sobre una base poblada, y no se afirma que dos backfills sean conmutativos sobre datos arbitrarios.

Esta es una corrección del manifiesto local/CI, no una nueva excepción de contenido SQL. Las tres excepciones de hashes siguen siendo la recuperación exacta de 20260427180000, la sanitización de 20260427190000 y la expresión setval de 20260325201000.

Los resultados del orden corregido y los controles de tablas vacías están en `bootstrap-validation.json`. El intento fallido se conserva como evidencia y no cuenta como reconstrucción completa.

## Revisión posterior: geo_source y lead_payload_raw

El siguiente replay aprobó 100 migraciones y falló en `20260424222000`, SQLSTATE 42703, por geo_source ausente. Evidencia: `bootstrap-missing-geo-dependency-attempt.json`. Su proveedor completo es `20260426140000`.

Antes de volver a ejecutar se revisaron las referencias a columnas añadidas en migraciones posteriores dentro del tramo restante. Se identificó también `20260424224500`, cuyo backfill usa lead_payload_raw, creada por `20260426004000`. Se añadió esa dependencia antes del intento siguiente; no se presenta como un error observado en ejecución.

Ambos proveedores incluyen actualizaciones de visible_columns; dependen de su creadora y tienen las mismas barreras de conversions/conversions_config vacías. Se conservan íntegros los tres archivos proveedores y los tres consumidores. No se cambia cómo se asigna geo_source, cómo se vincula conversion_inbox ni cómo se eligen conversiones. Ninguna corrección de SQL histórico adicional se deriva de estas aristas.

La revisión léxica no sustituye la ejecución completa ni demuestra conmutatividad con datos. El bootstrap aborta antes de adelantar cualquiera de estos proveedores si las tablas afectadas no están vacías. Los resultados de cada barrera se registran por reconstrucción.

## Consumidor anterior a la eliminación de test_event_code

El intento siguiente aprobó 108 migraciones y falló en `20260426000000`, con SQLSTATE 42703. El backfill todavía inserta conversions_config.test_event_code, eliminada por `20260323183000`. No se trata de recrear una columna obsoleta ni de omitirla del INSERT.

Git acredita que el backfill se incorporó en `8e3f5e0`, el 22 de marzo, y la eliminación en `b4d8bb8`, el 23 de marzo. Su requisito funnel_premium_threshold se incorporó en `e57994e`, el 16 de marzo. Se registra la dependencia de la eliminación sobre el consumidor previo, y las del consumidor sobre visible_columns y el proveedor completo de funnel_premium_threshold. Ningún SQL histórico se modifica.

Antes del backfill adelantado deben estar vacías profiles y conversions_config. Así no hay clientes, configuraciones ni elección de valores heredados. Si aparecen filas, el runner aborta para pedir revisión. El resultado final mantiene eliminada test_event_code. Las redefiniciones posteriores de funnel_contacts conservan su orden.

Evidencia del fallo: `bootstrap-obsolete-column-attempt.json`. El mensaje histórico del runner mostraba solo la parte `relation conversions_config does not exist`; SQLSTATE 42703 indica columna inexistente. Se corrigió únicamente el filtro de diagnóstico para conservar también el nombre de columna cuando PostgreSQL informa `column ... of relation ... does not exist`, sin devolver SQL ni valores. El intento no se reescribe retrospectivamente.
