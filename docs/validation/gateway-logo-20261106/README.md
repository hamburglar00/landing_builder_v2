# Logos de ingreso más visibles

Los cuatro gateways comparten el logo con dimensiones objetivo de 1,5 veces las anteriores (360 px de ancho y altura adaptable a la pantalla). El ancho se limita al espacio disponible para conservar proporciones y no recortar los logos en móvil. Se redistribuye el espacio del encabezado y de la ayuda inferior, incluidas las dos columnas de horizontal.

La tarjeta mantiene exactamente sus dimensiones anteriores: comparación de 480 estados antes/después, sin diferencias de altura ni ancho. Se reutilizó `scripts/check-gateway-auth-fit.mjs` con registro de medidas: Chromium y WebKit, cuatro proveedores, diez tamaños de 320×480 a 1920×1080, ingreso genérico y por gerencia, registro y mensajes de error. Sin scroll vertical/horizontal; no se crean cuentas ni sesiones reales. TypeScript y sincronización del ingreso/SDK aprobados en los cuatro repositorios.

Capturas: [Rey de Ases en escritorio](rey-desktop.png), [Ganamos NET en móvil](ganamos-mobile.png) y [horizontal](ganamos-landscape.png). [Comparación de dimensiones](comparison.json).

Commits: Rey `3c0a124`, Ases `2373253`, Ganamos NET `ff4abcb`, Multi Skin `6eedd5d`. Publicación mediante los commits de Git y compilación limpia del Worker, conservando los bindings productivos. Sin cambios de autenticación, gerencias, finanzas, API2 ni Panel3; no requiere migraciones ni funciones Edge.

Publicado y comprobado en los cuatro dominios: [verificación pública](public.json), [deployments Vercel y versiones previas](deployments.json). El CSS servido en el ingreso genérico y por gerencia coincide con el compartido probado. Ganamos+ conserva su paleta específica de skin al entrar por gerencia. El 401 del ingreso genérico sin sesión es el contrato existente; con `Accept: text/html` sirve el formulario.

Cloudflare Ganamos+: versión `2efb7378-f003-41c5-a7cf-8ca7406f35ab`; anterior `123cb603-9661-48e0-b121-9646f5a09e4b`. Archivo limpio del commit, sin `.env` ni `.dev.vars`, objeto `production` de `next-env.mjs` vacío, seis pruebas del adaptador aprobadas y despliegue con `--keep-vars`. Para revertir, promover las versiones anteriores de Vercel y Worker; no cambiar datos ni configuración.
