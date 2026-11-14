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
- Ambos builds remotos están READY, con entorno de producción y `--skip-domain`: no se promovieron dominios ni se publicó en main.
- Builder: `dpl_4YZDbo2i5GWCtkn2KTnVPLidFw2P`, código `b9691805`; clásico: `dpl_DAsP8TNkNMwWjyohXzg2CrMuCegp`, código `9b34df6f`.
- Smoke autenticado de `/l/diana`, `/l/atriopili`, `/l/asesdelnorte` en Builder y las tres rutas equivalentes del clásico: HTTP 200, formulario temprano y barra de progreso presentes. Assets públicos HTTP 200 con SHA256 coincidente con sus nombres: Builder `4f9032b0691643c3fde34f07`; clásico `6b54c7fcfe03b01e8c2e8919`. No equivale a completar un alta real.

## Matriz de los 16 puntos acordados

La numeración conserva la lista consolidada del usuario. «Verificado existente» significa que se revisó y preservó una capacidad que ya estaba implementada; no se cuenta otra vez como ahorro conseguido. Esta matriz describe el lote integrado, no acredita su promoción final.

| # | Mejora | Resultado y límite |
| --- | --- | --- |
| 1 | Acortar alta e ingreso | Incremental implementado: la política autorizada por landing viaja firmada en el handoff y elimina una consulta de configuración en el gateway. Vínculo y handoff ya corrían en paralelo. No se eliminan comprobaciones de identidad/cookie ni se afirma haber acelerado el alta del proveedor. |
| 2 | Optimizar clásico y constructor | Ambos adaptadores y pruebas actualizados. Constructor conserva la confirmación del bootstrap porque verifica que el navegador aceptó la identidad. La medición anterior de las tres landings era clásica: no demuestra que un motor sea más rápido que el otro. |
| 3 | Templates 7, 8 y 9 livianas | HTML temprano y formulario sin esperar React verificados. Se conservan recursos por hash y tracking. Recortar sólo DOM inalcanzable del runtime ahorraba 893–898 bytes gzip y no se adoptó como una supuesta mejora sustancial. |
| 4 | Interfaz estable durante la carga | Espacios de logo, tarjetas y formulario ya reservados; conservados. Las nuevas transiciones comparten geometría, tipografía y paleta de marca. Sin mostrar primero un formulario desarmado. |
| 5 | Adelantar trabajo mientras escribe | Verificado existente: precalentamiento por foco/escritura y únicamente destino elegido en T8. No se crean cuentas antes del CTA ni se anticipan todos los gateways. |
| 6 | Priorizar primer contacto | Verificado existente y en prototipo: compositor operativo, bienvenida, datos bancarios y selector Subir comprobante. Abrir el selector se probó con archivo ficticio sin subir nada ni modificar operaciones financieras. |
| 7 | Arranque liviano del widget | Herramientas secundarias ya diferidas. En el fixture del componente real no se descargan stickers, selector de emojis, promociones ni activación push en el primer contacto. El peso de ese fixture no es una medición de ahorro del build productivo. |
| 8 | Evaluar widget directo | Prototipo funcional ejecutado; no se adopta. Ambos montajes usan 119.469 bytes gzip de JS; tiempos locales inconsistentes. El montaje directo expone el bearer ficticio a un script del host y admite interferencia de CSS. Se conserva el iframe y su aislamiento. |
| 9 | Afinar carga progresiva | Casino y chat independientes, bienvenida antes de datos bancarios, ya existentes y preservados. El progreso sólo completa ante un hito confirmado, sin esperar recursos secundarios del casino. |
| 10 | Barra y transiciones uniformes | Implementado: barra indicativa por etapas y presentación compartida, adaptada a marca y motor. Sin porcentajes inventados, pausas decorativas ni finalizar por tiempo. Movimiento reducido y anchos móvil/escritorio comprobados. |
| 11 | Credenciales y redirección | Implementado por landing, ampliación aprobada: directo o credenciales + Continuar + ingreso automático tras X segundos. Nuevas en directo; existentes sin elección conservan el fallback global y modos históricos. Política validada en servidor, firmada, ligada al pase; no se confía en parámetros del navegador. |
| 12 | Historial por bloques | Implementado en Atrio/Nexo: bloques de 50, botón Ver mensajes anteriores y posición conservada. Inbox deja de descargar hasta 500 mensajes globales; obtiene la conversación seleccionada con RLS/sesión vigentes. |
| 13 | Sólo novedades y cambios | Implementación incremental por página: una huella permite omitir los mensajes si la página no cambió; una página modificada se reenvía completa. Reconcilia recibos, ediciones, borrados y rango expandido. No es un diario de cambios por mensaje ni reduce por sí mismo lecturas/CPU SQL. |
| 14 | Refrescos innecesarios del inbox | Implementado: agrupa ráfagas 150 ms, una consulta en vuelo y como máximo una reconciliación pendiente. Mantiene Realtime y respaldo adaptable; no adopta polling fijo de cuatro segundos. |
| 15 | Proveedor y regiones | Evaluados contratos y mediciones anteriores; no se movieron bases ni funciones por intuición. Se documenta abajo un ensayo acotado GRU para el ingreso clásico. Handoff/login de Rey merecen medición adicional; no se sustituyen interfaces del programador. |
| 16 | Velocidad y consumo antes/después | Tests de integración, prototipo y fixture de transferencia ejecutados. Página quieta reduce el cuerpo combinado 56–64 % en el fixture de chat; no se atribuye a todo el tráfico ni a CPU SQL. Alta/sesión completa antes/después no se repitió con cuentas reales: no se informa un ahorro en segundos de registro. |

Fuentes del lote de chat: Atrio `aa876f1` y Nexo `af1a26c`, sobre historial `b30b467`/`413d4bf`; prototipo `685fa31`. Evidencia detallada en `internal-chat/docs/validation/chat-message-sync-20261114.md` y `direct-widget-prototype-20261114.md`. Cada producto conserva base, identidad y adaptadores propios.

Servir las landings bajo el dominio del gateway sigue reservado para discutir sus requisitos aparte. No se migró el editor ni se cambió el dominio público en este lote. Meta, Conversiones de Builder, deduplicación y reglas financieras permanecen condiciones de todo el trabajo.

## Integración con main sin sobrescribir otra sesión

Fetch previo a promoción: Builder `origin/main` sigue en `03154f99525b884e4dc5fafb58111d7c36d58c52`; clásico en `f253160d8d078834a409832b3453c32cb1bb22ac`. Ambas referencias son ancestros de sus ramas aisladas; no tienen commits remotos exclusivos. Permiten avance fast-forward y preservan los commits ajenos publicados, incluida la separación de eventos Meta.

Antes del push, repetir fetch y comprobar ancestro. Si otra sesión avanzó main, integrar ese avance en el worktree aislado y repetir las comprobaciones afectadas; no usar force push, reset del checkout compartido ni sustitución del árbol. Esperar que los cuatro gateways lectores estén READY antes de promover emisores de la política híbrida. Publicación, dominios y Worker se registran por producto en el cierre general.

## Muestra HTTP sin crear cuentas

Una lectura de `/l/diana` por Builder y `/diana` por clásico en cada entorno, mediante curl con compresión y acceso autorizado al deployment. Las métricas excluyen el arranque del CLI y sí incluyen conexión/TLS desde este equipo. El candidato usa entorno de producción en una URL de deployment sin dominios promovidos. No es una medición en navegador, de primera pintura ni del alta.

| Motor / entorno | Estado | Caché observada | Edge / función | Primer byte | Total GET | Bytes transferidos del documento |
| --- | --- | --- | --- | ---: | ---: | ---: |
| Builder producción | 200 | MISS | gru1 / pdx1 | 1.799,28 ms | 1.809,42 ms | 17.437 |
| Builder candidato | 200 | STALE | gru1 / pdx1 | 368,08 ms | 369,02 ms | 18.017 |
| Clásico producción | 200 | MISS | gru1 / iad1 | 1.182,73 ms | 1.185,70 ms | 17.422 |
| Clásico candidato | 200 | MISS | gru1 / iad1 | 870,89 ms | 871,82 ms | 18.005 |

No se calcula una mejora porcentual: la caché no es comparable, no se controlaron arranques calientes/fríos, la conexión varió y sólo hay una muestra completa por combinación. Se detuvo la repetición al comprobar esas limitaciones. El documento crece unos 580 bytes comprimidos en esta respuesta por la nueva presentación; no se afirma haber reducido el HTML. Los assets se verificaron por estado HTTP y hash, sin atribuirles una aceleración por tiempo de descarga. Esta muestra confirma publicación del candidato y ubicación actual de las funciones, no que el ingreso completo sea más rápido.

## Evaluación de regiones y oportunidad concreta

La pasada de diagnóstico previa utilizó el motor clásico en las tres landings. Observó funciones del ingreso en IAD y gateways en GRU; la base de Builder está en Oregon. No equivale a medir el motor constructor, ni permite atribuir toda la espera a la distancia entre regiones.

El código actual de Builder ya establece `gru1` para `/api/template7/destination`, `/api/template7/prepare` y `/api/template7/preparations/account`; el resto usa `pdx1`. Bootstrap consume límites en la base de Builder antes de confirmar la identidad. Mover indiscriminadamente bootstrap, editor y base a São Paulo podría agregar viajes a Oregon y empeorar esas etapas.

Ensayo acotado recomendado, sin migrar bases: ejecutar el endpoint clásico de alta en una revisión de GRU y compararlo con su revisión actual, usando los mismos proveedores, condiciones de red y tipo de cuenta. La comparación debe separar `t7-context`, `t7-identity`, `t7-account`, `t7-link`, `t7-handoff`, `t7-finalize` y `t7-total`. Publicar esa ubicación sólo si mejora la mediana y el percentil alto del total sin empeorar errores, identidad ni recuperaciones. No cambiar regiones de todo el producto por un resultado aislado.

El punto de mayor interés en Rey es el handoff/login: en la muestra anterior, el handoff tomó 760 ms frente a 344–359 ms en Ases/Ganamos, y login 1.680 ms frente a unos 1.020 ms. Son observaciones de una pasada, no un beneficio garantizado de mover funciones. Rey además persiste el pase y coordina concurrencia; esas garantías se conservan.

La mejora concreta de este lote evita un viaje backend: cuando la landing tiene política propia, el gateway recibe la presentación firmada junto con el handoff y omite `/api/gateway/entry-settings`. Esa consulta antes corría en paralelo al login y tenía límite de 1.500 ms; por eso no se promete ahorrar 1.500 ms en cada ingreso. Las landings antiguas conservan el fallback global y sus modos históricos.

No se cambió ninguna región ni se activaron rutas experimentales para producir una mejora aparente. La carga progresiva existente, la preparación del chat paralela al login y el control de sesión continúan activos.
