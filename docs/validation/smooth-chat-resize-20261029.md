# Maximizar y restaurar el chat — 29/10/2026

## Cambio y alcance

Maximizar y restaurar usan una transformación visual de 420 ms con la misma curva continua de apertura/cierre. El iframe adopta su tamaño final una sola vez antes del movimiento. Se elimina la transición de altura que obligaba a reacomodar todo el chat durante cada cuadro.

Se conservan el alto maximizado aprobado (margen superior móvil de 8 px), ancho, anclaje inferior, paletas, iframe montado y apertura/compresión de 520 ms. Cambiar de dirección comienza en la posición visible; cerrar durante el cambio continúa hacia el botón. Una modificación nativa del viewport/teclado descarta la transformación anterior. Movimiento reducido omite la animación de tamaño.

Fuente común sincronizada en los cuatro gateways. Cada commit cambia únicamente `public/gateway-client.js` y `public/gateway-client.css`:

| Gateway | Commit pusheado | Deployment Vercel |
| --- | --- | --- |
| Rey de Ases | `7c6695c44177c32ee893b2633d6a9cd2e01447f9` | `dpl_H2C7CyEhc13TYmuHkJc9b9eg4w7A` |
| Ases del Norte | `0adc5662b2dd3d1fc460d76f6ef02fd650c8340b` | `dpl_FvxKCkxnpQJB2ZE2RvpNYzugFPa3` |
| Ganamos NET | `ea7191e3be40f271d8acaa6e942d22992c6acd32` | `dpl_EdPU8F3Uy8pRPLjg5NRZQnocoy24` |
| Ganamos+ | `89a51ed204d2cceb5b15de39b23bbfbb5f06011d` | `dpl_2DRpeeL5DTjzitdjTtExKq2wZJdi` |

## Verificación

- `node scripts/check-gateway-entry-ux.mjs`: 40 escenarios aprobados, cuatro gateways, Chromium/WebKit, móvil vertical/horizontal y escritorio. El fixture tiene 100 mensajes; se comprueban altura interna constante y tamaño visual intermedio durante maximización/restauración, borde inferior fijo, ausencia de saltos al invertir, cierre durante el cambio, viewport modificado durante el cambio, teclado, origen del mensaje, movimiento reducido y reutilización de iframe. Conserva las comprobaciones de apertura/cierre y paletas anteriores.
- Vitest de assets y paleta: 63 pruebas aprobadas (Rey 19, Ases 15, NET 15, Plus 14).
- `node scripts/sync-gateway-chat-motion.mjs --check`: fuente sincronizada en los cuatro.
- Fixtures con tráfico interceptado: sin cuentas ni dinero reales. No se certifican FPS ni barras del navegador de un iPhone físico.

## Publicación independiente

Los paquetes de UI se prepararon sobre las mismas bases productivas que [la publicación anterior](smooth-chat-motion-20261028.md): Rey `6dfaeb0`, Ases `299f3f2`, NET `a27b0a4`, Plus `ae1feef`. La comparación del árbol completo admite únicamente los dos assets y diferencias de terminación de línea de Windows. Así se conserva pendiente el lote funcional que depende de API2.

Las cuatro builds Vercel quedaron READY antes de promoverlas. La metadata `gatewayBaseCommit`/`githubCommitSha` identifica la base productiva y `releaseScope=chat-resize-ui` la superposición de UI; el commit fuente de cada asset figura en la tabla. No se desplegaron los cambios funcionales de ingreso ni API2.

Ganamos+ compiló la misma fuente aislada con OpenNext y se publicó también en su Worker con `--keep-vars`, conservando la configuración productiva. Worker activo `aa948630-296e-4cd9-86e5-1c80feb49878`, anterior `0a4fc8bb-8918-40f1-89cd-f49ca77156da`. No se modificó el relay.

Verificación pública posterior: los ocho assets y los cuatro `/api/health` devolvieron HTTP 200; los ocho hashes coincidieron con las fuentes probadas y los cuatro proyectos apuntan a los deployments de la tabla anterior.

| Dominio | JS SHA-256 | CSS SHA-256 |
| --- | --- | --- |
| `www.reydeases.fun` | `8a7db256233d19ec852de35c1ef077d8ad811a708e00d2204d7971c19460215d` | `7f22054c9da80d09c373ee9e05500307aae6c1e8920dec3186a2bfa9e164ea45` |
| `www.asesdelnorte.online` | `f8a75d9df83ecbe3b12b14c0492fbe763f1f8afc353e98a0eda8b72d18cb2b50` | `a6a3e2d8c56881d90ad4244dd6aeff44e4330c3a2426212688ddfcf9617192c7` |
| `www.ganamosnet.icu` | `e9b1059afcd5fb3c41fdd40e92c68ae2a5b5a3019689f2663b0e39caac690ce1` | `a6a3e2d8c56881d90ad4244dd6aeff44e4330c3a2426212688ddfcf9617192c7` |
| `ganamosnet.global` | `8d5cd1882db17f5a1ec616d62e14f4b41d6c82269010d72edea10c891ab81bd9` | `8ae42923ee54c96f06bd582195b9fff7c141563b74017e4c56fb9b0f5a56b09c` |

Fuentes y documentación comiteadas/pusheadas en `fix/template7-session-reentry`. No requiere migraciones ni despliegue de API2 para esta mejora de UI.
