# Altas, widget y Kobe — entrega para despliegue 28/10/2026

El usuario autorizó commit/push de todo el lote. API2 y las dos migraciones se despliegan primero por el programador; luego se publica el lote funcional web. Los apartados de preparación local conservan el contexto anterior.

Acuerdo vigente: recuperación breve y posibilidad de cuentas huérfanas, una sola cuenta vinculada al navegador. Reemplaza la política anterior de conservar indefinidamente un candidato incierto. Se conserva el lote local previo de reconocimiento de navegador, estado privado y transiciones.

- API2: recuperar brevemente; si no confirma, archivar el candidato y usar otra variante. Primer éxito sin consultas extra. Sustitución y vínculo con exclusión SQL y protección contra callbacks tardíos. Historial cifrado; nunca sustituir una cuenta completa. Dos migraciones aditivas y entrega por Git al programador.
- Widget: compresión de 720 a **520 ms**, opacity al final y fallback de cierre de **560 ms**. Maximizado móvil con margen superior de **32 px**, frente a 64 px; respeta safe area y teclado. Apertura 520 ms, ancho, restauración y movimiento reducido conservados.
- Movimiento sincronizado en `public/gateway-client.js` y `gateway-client.css` de Rey, Ases, NET y Plus. Publicación independiente posterior autorizada por el usuario: [UI en producción](widget-ui-production-20261028.md), con Vercel y Worker de Plus; la recuperación de cuentas espera al despliegue de API2.
- Kobe: bloqueo histórico del 21/10 comprobado, con saldo/depósitos del proveedor 0 y bono local consumido sin acreditar. Se preparó una conciliación específica, validada y de solo lectura por defecto; **no se aplicó en producción**. El crédito automático futuro de Atrio NET usa API sin fallback ni reintentos de dinero; el bono se registra tras confirmar el crédito.

Entrega al programador y comandos: [API2 — altas y Kobe](../../../../../../Documents/GitHub/api2/docs/validation/atrio-safe-entry-kobe-20261028.md). Ruta local: `C:/Users/Leo/Documents/GitHub/api2/docs/validation/atrio-safe-entry-kobe-20261028.md`.

## Comprobaciones

- `node scripts/sync-gateway-chat-motion.mjs --check`: cuatro fuentes iguales.
- También `sync-entry-recovery.mjs --check` y `sync-preparation-page.mjs --check`: aprobados, preservando el lote previo.
- `node scripts/check-gateway-entry-ux.mjs`: **40 escenarios** aprobados en Chromium/WebKit, cuatro gateways, móvil vertical/horizontal y escritorio. Verifica altura, restauración, compresión de 520 ms, contenido visible, reversión rápida, iframe reutilizado, paso de toques estando cerrado, reduced motion, colores y CTA de ingreso.
- Pruebas de assets/preparación/ruta: Rey **36**, Ases **32**, NET **32**, Plus **31**; todas aprobadas.
- API2: 132 pruebas de entrada, 22 MySQL de provisión, 64 financieras aisladas, 9 MySQL de cola/concurrencia y 5 MySQL de conciliación aprobadas; TypeScript aprobado. Las pruebas financieras usan fixtures, sin dinero real.
- Las herramientas de navegador interceptaron todo el negocio. No certifican los controles reales de Safari en un iPhone; revisar esa presentación en dispositivo después del despliegue.

Publicación funcional pendiente: API2 y las dos migraciones por el programador primero; luego la recuperación de cuentas en Atrio/ambos motores/cuatro gateways, con Worker de Plus. La UI independiente ya está comiteada, pusheada y publicada; no incluye la lógica local de recuperación ni los cambios financieros.
