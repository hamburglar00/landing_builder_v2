# Formato de WhatsApp en Atrio — 28/10/2026

El componente compartido `ChatMessageText` presenta negrita, cursiva, tachado, monoespaciado, código en línea, viñetas, numeración y citas. Conserva los enlaces y sus restricciones existentes; utiliza elementos React con texto escapado, sin HTML de mensajes. Los marcadores de formato no alteran URLs ni texto dentro del código. La actualización también presenta los mensajes históricos sin modificar sus registros.

Sintaxis: [Centro de ayuda de WhatsApp](https://faq.whatsapp.com/539178204879377/?cms_platform=web&locale=es_LA). Negrita usa un asterisco a cada lado, como los mensajes de API2 de la captura del usuario.

## Pruebas

- `node --experimental-strip-types --test tests/chat-message-links.test.mjs` en Atrio: 11 pruebas de enlaces, reglas y combinaciones, credenciales del bot, delimitadores incompletos, código literal, listas, citas, URL con marcadores, conservación de datos y texto no ejecutable.
- `node scripts/check-chat-formatting.mjs` en Builder: 12 escenarios Chromium/WebKit, temas Atrio/WhatsApp/página, anchos 360/1280 y burbujas entrantes/salientes. Componente de burbuja y CSS reales: formato visible, enlaces, copia, contención y ausencia de superposición de horarios, también al actualizar texto.
- TypeScript, ESLint y revisión visual de las capturas. Solicitudes y mensajes ficticios; sin mensajes reales, cuentas ni operaciones financieras.

## Publicación

Publicado Atrio desde `77a4dd8778b8f5f18205342564fea398b1340d52` en `fix/atrio-inbox-validation`. Despliegue Vercel activo: `dpl_9X7nawLCjoSEZZwptN9by4w5NA4T`, compilación READY y SHA coincidente. Se preparó desde un archivo de Git del commit exacto y se promovió después de confirmar que producción seguía en `dpl_683DiXAWuLbgwjFEr8mKQupQAric`, disponible para rollback.

Solo Atrio necesita despliegue de aplicación. Se verificó que la configuración de producción de Rey de Ases, Ases del Norte, Ganamos NET y Ganamos+ utiliza `https://www.atrio.website` como origen del chat. El Worker de Plus conserva esa integración; no requiere otra compilación por este cambio del iframe remoto. Builder contiene documentación y la prueba de navegador (`0df7cf6`), sin cambios de aplicación en este lote.

[Comprobación pública](chat-formatting-public-20261028.json): `/embed/warm` referencia el JS y CSS con los estilos nuevos y los cuatro dominios sirven el puente de chat. Se verificó además el despliegue activo mediante Vercel. Solo GET de recursos públicos; no se ejecutaron mensajes, tracking ni operaciones reales.
