# Fluidez del chat en escritorio — 30/10/2026

Publicado en los cuatro gateways, incluido el Worker público de Multi Skin. El usuario informó saltos al abrir/cerrar Ganamos NET en Chrome de escritorio, incluso después de Ctrl+F5; en móvil funciona bien. El mensaje sin negrita no llevaba formato, según su aclaración.

## Ajuste

La ventana cerrada pasaba a tamaño cero en todos los dispositivos. En escritorio, volver a abrirla redimensionaba el iframe y obligaba a las burbujas reales de Atrio a medir nuevamente texto y metadatos. Además, el desenfoque de pantalla completa resultó costoso en la comparación de escritorio.

- Escritorio, a partir de 641 px con hover y puntero fino: se conserva el tamaño interno de la ventana cerrada. Sigue oculta, inert, fuera del foco y sin interceptar clics; la animación visible continúa hacia el botón. El fondo conserva su oscurecimiento y prescinde del desenfoque de pantalla completa.
- Pantallas compactas y dispositivos touch: conservan la superficie cerrada de tamaño cero y el desenfoque original, también en móvil horizontal de más de 640 px.
- Se mantienen las animaciones de apertura/cierre de 520 ms, su curva, maximizar/restaurar a 420 ms, altura maximizada, teclado, inversión rápida, iframe montado y movimiento reducido.

El único archivo de aplicación modificado es `public/gateway-client.css` en cada gateway. La lógica JavaScript, Atrio, API2 y Panel3 conservan sus versiones. No requiere migraciones ni el despliegue del programador.

## Evidencia

Comparación controlada de Ganamos NET anterior (`980fc68d`) frente al ajuste (`9d5a0d3f`): Chromium headless, viewport 1920×1080, CPU ralentizada cuatro veces, cien instancias reales de `ChatTextMessageBubble`, tres reaperturas medidas por versión. Tráfico interceptado con fixtures locales.

| Medición | Versión anterior | Ajuste |
| --- | --- | --- |
| Muestras intermedias por apertura | 8, 5, 5 | 24, 25, 24 |
| Mayor intervalo entre muestras, mediana de los tres ciclos | 217 ms | 50 ms |
| Layouts durante la apertura | 4 por ciclo | 1 por ciclo |
| Tiempo de layout por apertura | 40–89 ms | 0–1 ms |
| Eventos de resize del iframe entre cierre y reapertura | Presentes | Ninguno |

Es una medición sintética comparativa; no representa los FPS garantizados del equipo físico del usuario. Los datos completos están en [la evidencia JSON](desktop-chat-motion-20261030.json).

Validación completada:

- `node scripts/check-desktop-chat-layout.mjs`: 16 escenarios con cien burbujas reales, cuatro gateways, Chromium/WebKit y escritorio/touch horizontal. Comprueba que el iframe de escritorio no se redimensione al cerrar/reabrir, que el chat oculto permita clics al casino, que se conserve la misma instancia y que touch mantenga su tamaño cero y desenfoque.
- `node scripts/check-gateway-entry-ux.mjs`: 40 escenarios de ingreso, apertura/cierre, maximización/restauración, inversión rápida, cierre durante resize, viewport/teclado, paletas, movimiento reducido y reutilización de iframe. La expectativa de cierre distingue ahora layout interno de escritorio y superficie touch.
- Vitest de assets: Rey 15, Ases 11, NET 11, Multi Skin 10; 47 aprobadas.
- `node scripts/sync-gateway-chat-motion.mjs --check`: fuente común sincronizada en los cuatro.
- Las cuatro builds Vercel y la build OpenNext terminaron correctamente.

## Publicación

Fuentes comiteadas y pusheadas en `fix/template7-session-reentry`. Cada commit funcional modifica solamente el CSS del widget:

| Gateway | Commit | Deployment Vercel promovido |
| --- | --- | --- |
| Rey de Ases | `4aaf6bf436df4ad92c807fd7301528f7caeed743` | `dpl_9EwAz8TcCrL1EDyJoA4CfbT9qNDn` |
| Ases del Norte | `a6c2ee09e25b1b7f88cee52cc02807d606293287` | `dpl_2KBpgf8nTiMDMQsVvpZq8wAxXHRi` |
| Ganamos NET | `9d5a0d3f2c046fee21103b495fab03b94e503479` | `dpl_33PM7xhKF3fw8nDZsffo6HyyUJVp` |
| Ganamos+/Multi Skin | `0452e69eb80a4a4a51131381e1e2d363b859730b` | `dpl_AxpZMDG4sCRB78wn19wmqJFdTDaw` |

Se verificaron READY, metadata de commit y promociones de Vercel. Los dominios de Rey, Ases y NET apuntan a los despliegues nuevos. Cloudflare sirve Multi Skin con la versión `76a4e446-5ad7-4547-94b4-897e1959e97f` al 100%, anterior `e8c25ad7-e32c-4bd2-bcb5-6a3c18ffc3c3`; se conservaron variables y secretos con `--keep-vars`. El relay privado no requirió cambios.

Verificación pública posterior: cuatro health correctos y doce respuestas de assets con SHA-256 idéntico al local, incluyendo la URL exacta del CSS con su query existente bajo user agents de escritorio y móvil. El JavaScript público conserva su hash anterior. No se crearon cuentas ni enviaron mensajes, comprobantes, movimientos financieros o eventos publicitarios deliberados para probar el cambio.

Los despliegues anteriores y la evidencia de publicación se conservan en el JSON. El comportamiento físico de la PC del usuario debe contrastarse con esta versión ya publicada.
