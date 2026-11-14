# Integración aislada de ingreso — 14/11/2026

## Base y alcance

- Builder: base publicada `03154f99525b884e4dc5fafb58111d7c36d58c52`, rama `release/entry-performance-20261114` en `landing-builder-entry-performance-release`.
- Clásico: base publicada `f253160d`, rama homónima en `landing-classic-entry-performance-release`.
- Extracción de vista pura T8: `10be27ef`, integrada sin reescribir el trabajo de la otra sesión.
- Builder incorpora `e8eb8c37`, `55df9f18`, `6c3f56b4`, `31e28b31`. Clásico incorpora `a2a1063` y `5d5420f`.
- La integración no modifica los archivos de tracking de la base publicada. Conserva la separación reciente de eventos internos y entrega Meta del commit `bf4d1ad9`.
- Se regeneraron los activos únicamente en los worktrees aislados. Coinciden con los hashes de los activos revisados; se conservaron las URLs anteriores inmutables.

## Verificaciones de integración

- Builder: 114 pruebas aprobadas de alta, continuación/renovación, permisos de destino, política por landing, T7/8/9, activos por hash, evento Meta, atribución, cola de tracking y estadísticas del recorrido.
- Clásico: 13 pruebas aprobadas de alta, identidad, handoff y política por landing.
- Generador de activos, generador clásico y sincronización de transiciones: verificación correcta desde el árbol integrado.
- No se crearon usuarios reales ni se ejecutaron movimientos financieros.
- Los builds remotos se preparan con entorno de producción y `--skip-domain`: no asignan dominios ni publican en main automáticamente.

## Evaluación de regiones y oportunidad concreta

La pasada de diagnóstico previa utilizó el motor clásico en las tres landings. Observó funciones del ingreso en IAD y gateways en GRU; la base de Builder está en Oregon. No equivale a medir el motor constructor, ni permite atribuir toda la espera a la distancia entre regiones.

El código actual de Builder ya establece `gru1` para `/api/template7/destination`, `/api/template7/prepare` y `/api/template7/preparations/account`; el resto usa `pdx1`. Bootstrap consume límites en la base de Builder antes de confirmar la identidad. Mover indiscriminadamente bootstrap, editor y base a São Paulo podría agregar viajes a Oregon y empeorar esas etapas.

Ensayo acotado recomendado, sin migrar bases: ejecutar el endpoint clásico de alta en una revisión de GRU y compararlo con su revisión actual, usando los mismos proveedores, condiciones de red y tipo de cuenta. La comparación debe separar `t7-context`, `t7-identity`, `t7-account`, `t7-link`, `t7-handoff`, `t7-finalize` y `t7-total`. Publicar esa ubicación sólo si mejora la mediana y el percentil alto del total sin empeorar errores, identidad ni recuperaciones. No cambiar regiones de todo el producto por un resultado aislado.

El punto de mayor interés en Rey es el handoff/login: en la muestra anterior, el handoff tomó 760 ms frente a 344–359 ms en Ases/Ganamos, y login 1.680 ms frente a unos 1.020 ms. Son observaciones de una pasada, no un beneficio garantizado de mover funciones. Rey además persiste el pase y coordina concurrencia; esas garantías se conservan.

La mejora concreta de este lote evita un viaje backend: cuando la landing tiene política propia, el gateway recibe la presentación firmada junto con el handoff y omite `/api/gateway/entry-settings`. Esa consulta antes corría en paralelo al login y tenía límite de 1.500 ms; por eso no se promete ahorrar 1.500 ms en cada ingreso. Las landings antiguas conservan el fallback global y sus modos históricos.

No se cambió ninguna región ni se activaron rutas experimentales para producir una mejora aparente. La carga progresiva existente, la preparación del chat paralela al login y el control de sesión continúan activos.
