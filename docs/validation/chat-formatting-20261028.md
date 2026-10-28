# Formato de WhatsApp en Atrio — 28/10/2026

El componente compartido `ChatMessageText` presenta negrita, cursiva, tachado, monoespaciado, código en línea, viñetas, numeración y citas. Conserva los enlaces y sus restricciones existentes; utiliza elementos React con texto escapado, sin HTML de mensajes. Los marcadores de formato no alteran URLs ni texto dentro del código. La actualización también presenta los mensajes históricos sin modificar sus registros.

Sintaxis: [Centro de ayuda de WhatsApp](https://faq.whatsapp.com/539178204879377/?cms_platform=web&locale=es_LA). Negrita usa un asterisco a cada lado, como los mensajes de API2 de la captura del usuario.

## Pruebas

- `node --experimental-strip-types --test tests/chat-message-links.test.mjs` en Atrio: 11 pruebas de enlaces, reglas y combinaciones, credenciales del bot, delimitadores incompletos, código literal, listas, citas, URL con marcadores, conservación de datos y texto no ejecutable.
- `node scripts/check-chat-formatting.mjs` en Builder: 12 escenarios Chromium/WebKit, temas Atrio/WhatsApp/página, anchos 360/1280 y burbujas entrantes/salientes. Componente de burbuja y CSS reales: formato visible, enlaces, copia, contención y ausencia de superposición de horarios, también al actualizar texto.
- TypeScript, ESLint y revisión visual de las capturas. Solicitudes y mensajes ficticios; sin mensajes reales, cuentas ni operaciones financieras.

## Publicación

Pendiente de registrar la publicación y comprobación pública. Solo Atrio necesita despliegue de aplicación. Los cuatro gateways conservan su chat remoto compartido; Ganamos+ también lo utiliza desde su dominio servido por Worker. Builder contiene documentación y la prueba de navegador.
