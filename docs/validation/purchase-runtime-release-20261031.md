# Fecha original de compras y caché de atribución

Publicado el 31/10/2026. Una carga pendiente conserva ahora su fecha de confirmación al llegar tarde a Builder. El HTML público de Builder T1–6 también referencia un runtime con hash de contenido para evitar conservar un colector de atribución anterior en caché. [Incidente 126018](purchase126018-original-event-time-20261031.md) y [cobertura del runtime](public-runtime-cache-20261031.md).

## Versiones activas

| Servicio | Fuente | Publicación |
| --- | --- | --- |
| Atrio | `a7f7920483fc33ddc8abbbb075781cf4691b75cd` | `dpl_B4cnaRYgmv9Mqk1cWpP1G7feFcc6`, promovido y READY |
| Builder | `0bb42f5f3707ff279512d556d3742bd288eb696d` | `dpl_F9zRGrght255UTLB6LaLjt3zGaeo`, promovido y READY |
| Edge `conversions` | fuente comprometida en Builder | v172 ACTIVE, `verify_jwt=false`, SHA256 `4b535b399d804a2a7dfab3d810367b2063a18d6d8f6bc2b9e2550ebd309515bd` |

Se publicaron snapshots Git sin archivos de entorno. Edge se publicó y comprobó antes de promover Atrio. Sus diez archivos coinciden exactamente con el commit de Builder; antes de reemplazarlo, los nueve archivos de v171 coincidían con la base local. Los proyectos Vercel activos conservan los commits esperados.

La emisión y la entrega viven en el servicio único de Atrio: aplican a Rey de Ases, Ases del Norte, Ganamos NET y Multi Skin, tanto para cargas manuales como confirmaciones automáticas autorizadas. No hay adaptadores de proveedor que actualizar en este lote. Los gateways, el Worker de Ganamos+, API2 y la clásica no necesitan publicación por estos cambios. La clásica T1–6 ya sirve el colector mediante chunks con hash; sus programas T7/T8 y los de Builder no cambiaron.

## Verificación

- Builder: 46 pruebas Deno, `deno check` del entrypoint y diez comprobaciones aisladas de las funciones reales de entrada, selección temporal de PURCHASE y política CAPI. Una compra antigua conserva su fecha; siguen vigentes los filtros de origen y de siete días.
- Atrio: 19 casos únicos del lote, TypeScript y lint. Incluye el dispatcher real con HTTP sustituido, reintento 503 a 200 estable y rechazo de fechas ausentes, inválidas o calendariamente imposibles antes de cualquier request.
- Runtime: 29 pruebas, TypeScript, generadores y dos casos completos con caché HTTP real en Chromium/WebKit. El HTML nuevo evita el v6 cacheado y Contact/journey usan el contexto propio de landing, moneda y píxel.
- [Smoke público](purchase-runtime-public-20261031.json): cinco GET correctos, sin ejecutar JavaScript de producción. T5 referencia el nuevo asset; T7 conserva su runtime; el archivo nuevo coincide byte por byte con el local y mantiene caché immutable; la URL anterior y Atrio siguen disponibles.

No hubo migraciones, movimientos financieros, cuentas nuevas ni envíos de prueba a Meta. No se modificaron las filas históricas investigadas ni se invocó el dispatcher para reenviarlas. Los reintentos automáticos de la cola conservan su política existente. `created_at` continúa representando creación de fila; la fecha del hecho se conserva por separado. Los GET públicos y las pruebas aisladas no certifican un nuevo recorrido dentro de Instagram/Facebook en iPhone.

## Rollback

- Atrio anterior: `b425cad19affabe35e47bb231a0dbca23c56a1fd`, `dpl_F997FRE8JP3wUQpKrECrDUoK6iKh`.
- Builder anterior: `ec71dae22d514c7398ecd21160331af47a626bcf`, `dpl_FnpPnS4eJ94p1HcSnUNZRJjmH2Xs`.
- Edge anterior: v171, nueve archivos, SHA256 `1813628a434b7e6e633e172f362b6d9272219370ce3aaac37dafda126ab01cbd`, `verify_jwt=false`. El paquete se reconstruye desde la base de Builder `a941f6d` sin `event_time.ts` ni su import.
- No hay esquema que revertir. Se conservaron los assets y rutas públicas anteriores. Restaurar Builder anterior también restauraría su referencia fija v6: requiere considerar la caché del navegador.
