# Gateways: formulario sin desbordes

El formulario de ingreso y registro adapta sus espacios a la altura disponible. Conserva márgenes exteriores y usa dos columnas en pantallas horizontales bajas. No se fuerza `overflow: hidden` en el documento: los controles permanecen accesibles. Los inputs mantienen 16 px y los botones, al menos 44 px de alto.

El fondo combina el color de cada marca con negro mediante degradados orgánicos. Se reemplazó el texto por «Tu plataforma y tu asesor, en el mismo lugar.» y se aplicaron mayúsculas a los CTA, incluidos sus estados de espera y recuperación tras error. Se mantienen logos transparentes, paletas por skin y todos los contratos de ingreso.

## Verificación

- `scripts/check-gateway-auth-fit.mjs`: 480 comprobaciones aprobadas en Chromium y WebKit, cuatro proveedores, diez tamaños: 320×480, 320×568, 390×664, 430×932, 568×320, 667×375, 844×390, 1024×600, 1365×635 y 1920×1080.
- Incluye ingreso genérico, ingreso por gerencia, registro y sus mensajes de error. Se comprobaron los límites verticales/horizontales del documento, margen exterior de la tarjeta, visibilidad de logos, alternancia de contraseña y mayúsculas. Transporte completamente aislado, sin cuentas reales.
- 52 pruebas de ingreso/gerencia y TypeScript aprobadas en cada gateway (208 pruebas en total). Módulos canónicos y SDK sincronizados.
- Capturas con datos ficticios: [escritorio](ganamos-desktop.png), [móvil](ganamos-mobile.png), [horizontal](ganamos-landscape.png).
- Producción se comprueba sólo mediante GET, comparando el CSS servido con la fuente probada y verificando el texto. El 401 del formulario sin sesión es el estado HTTP existente esperado, no un fallo del despliegue.

## Publicación

Commits: Rey `f94a3c4`, Ases `1c317a7`, Ganamos NET `3404de0`, Multi Skin `6205c17`. Los cuatro están comiteados, pusheados y promovidos en Vercel; [deployments y versiones previas](deployments.json). Builder sólo recibe pruebas y documentación, sin cambios de aplicación.

Ganamos+ quedó publicado también en Cloudflare: versión `123cb603-9661-48e0-b121-9646f5a09e4b` al 100 %, validada primero en preview. Build limpio sin valores de entorno incorporados y seis pruebas del adaptador aprobadas; bindings productivos conservados. Versión anterior: `2bbbb66d-91da-4f73-b4d1-aae7b8e285ed`. La [verificación pública final](public.json) confirma CSS idéntico a la fuente probada y texto nuevo en los cuatro dominios y en el deployment Vercel de Multi Skin.

API2 y Panel3 siguen intactos en local. No requiere migraciones ni Edge Functions. La revisión no altera recuperación, creación, permisos, tracking ni el widget de Atrio. Ante una reversión, promover el deployment anterior y la versión anterior del Worker; no cambiar la base de datos.
