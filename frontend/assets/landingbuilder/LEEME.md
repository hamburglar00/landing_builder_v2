# Kit de marca Landing Builder

## La marca

- **Isotipo:** un cohete despegando. Representa lanzar una campaña: la landing que sale disparada cuando la publicás en Meta.
- **Logotipo:** "LandingBuilder" todo junto, en Inter Display Bold. "Landing" va en blanco y "Builder" en verde lima. Está convertido a trazos, así que no depende de tener la fuente instalada.

## Colores

| Uso | Color |
|---|---|
| Verde lima (cuerpo del cohete, "Builder", fondo del ícono) | `#8EE04E` |
| Verde medio (aletas y tobera) | `#5FA833` |
| Verde claro (llama) | `#D3F4B8` |
| Blanco ("Landing") | `#FFFFFF` |
| Fondo del panel | `#0A0F12` · tarjetas `#0E1418` |
| Versión para fondo claro: cohete y "Builder" | `#3E9A12` · aletas `#2A6A0A` · "Landing" `#0B1410` |

## Qué hay en el kit

| Archivo | Para qué |
|---|---|
| `logo/landingbuilder-logo-dark` | Logo horizontal para fondos oscuros. Es el uso principal, en el panel. |
| `logo/landingbuilder-logo-light` | Logo horizontal para fondos claros: documentos, mails, presentaciones. |
| `logo/landingbuilder-logo-white` · `-black` | Una sola tinta. El negro funciona muy bien sobre el verde lima. |
| `logo/landingbuilder-logo-vertical-*` | Cohete arriba y nombre abajo, en las mismas cuatro versiones. Para la pantalla de inicio de sesión o espacios cuadrados. |
| `logo/landingbuilder-isotipo-*` | Solo el cohete. Para el menú lateral colapsado, avatares o la foto de perfil en redes. |
| `app/app-icon.svg` · `app-icon-1024.png` | Ícono de app con esquinas redondeadas. |
| `app/app-icon-square.svg` | Ícono cuadrado: iOS y las tiendas redondean solas. |
| `app/icon-maskable.svg` | Con más margen, para Android (recorta en círculo o gota). |
| `web/favicon.svg` · `favicon.ico` · `favicon-16/32/48.png` | Pestaña del navegador. |
| `web/apple-touch-icon.png` | Acceso directo en iPhone (180 px). |
| `web/icon-192.png` · `icon-512.png` · `icon-maskable-512.png` | App instalable (PWA). |
| `web/site.webmanifest` | Nombre, íconos y colores. |
| `social/og-image.png` | Vista previa al compartir un enlace (1200 × 630). |

Todos los logos vienen en SVG (escalable) y en PNG de alta resolución con fondo transparente. La ventana del cohete está calada, así que toma el color del fondo donde se apoye.

## Código para el `<head>`

Copiar el contenido de `web/` a la raíz pública del sitio y agregar:

```html
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#0A0F12">
<meta property="og:image" content="https://TU-DOMINIO/og-image.png">
```

## En el panel

En la esquina superior del menú lateral, reemplazá el cuadrado "PB" y el texto "PANEL BOT ADMIN" por `landingbuilder-logo-dark.svg` a unos 28–32 px de alto. Si el menú se colapsa, usá `landingbuilder-isotipo-dark.svg`.

## Reglas de uso

- **Espacio libre:** alrededor del logo, como mínimo el alto de la "L" de "Landing".
- **Tamaño mínimo:** logo horizontal, 110 px de ancho; cohete solo, 20 px. Por debajo de eso usar el favicon.
- **No hacer:** separar "Landing" y "Builder" con un espacio, cambiar los colores, enderezar o rotar el cohete, agregar sombras, brillos o degradados, ni usar la versión para fondo oscuro sobre fondo claro (para eso está `light`).

Para cambiar colores o proporciones, editá `generar-kit.py` y volvé a ejecutarlo: regenera todo el kit.
