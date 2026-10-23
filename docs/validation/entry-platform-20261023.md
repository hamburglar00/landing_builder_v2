# Transiciones de acceso — 23/10/2026

Se conserva la espera configurada en Atrio, de hasta 60 segundos, pero su UI no
muestra una cuenta regresiva. El aviso es «Vas a ingresar automáticamente.».
El temporizador utiliza el tiempo restante completo y Continuar puede adelantar
el ingreso sin repetir autenticación. La confirmación de sesión sigue siendo
obligatoria.

Las etapas usan «Ingresando a la plataforma», «Continuar a la plataforma» y
«Tu sesión en la plataforma está lista». La creación de cuenta y la conexión
con el asesor conservan sus etapas reales. El texto secundario se simplifica;
las descripciones y errores mantienen un mínimo de 12 px, con saltos de línea
centrados y equilibrados. El CTA se adapta al ancho de pantalla. Se preservan
los logos grandes y los colores de cada marca.

Fuentes comunes: `preparation-page.ts`, `transition-layout.ts` y
`gateway-entry-transition.ts` de Rey. `sync-entry-transition.mjs` incluye ahora
también el layout. Se sincronizan los cuatro gateways y el módulo público del
constructor. El renderer generado del clásico se actualiza desde Builder.

Validación realizada:

- 72 pruebas unitarias existentes de preparación y conexión entre los cuatro
  gateways: espera de 4 y 60 segundos, adelanto, autenticación única, fallo y
  recuperación, origen del iframe y datos de carga reales.
- 40 casos de ingreso y movimiento del widget en Chromium/WebKit, incluidos
  ambos motores; 32 de SDK y notificaciones pospuestos y cuatro de hidratación.
- Revisión visual de 80 estados con renderers, temas y logos reales, usando
  respuestas locales: 320×568, 390×844, 844×390 y 1366×768. Creación, tarjeta
  de usuario, creación sobre la landing, conexión y error de conexión. Sin
  scroll horizontal, botones recortados, párrafos menores a 12 px ni contador.
  Capturas y métricas en `.vercel/validation-entry-platform/`.

Las pruebas no crean jugadores, mensajes ni operaciones financieras productivas.
Ganamos+ se valida en presentación y protocolo; su alta PBAdmin sigue pendiente
de integración propia.
