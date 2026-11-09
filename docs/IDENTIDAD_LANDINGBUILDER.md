# Identidad de LandingBuilder

Desde el 9 de noviembre de 2026, el producto se llama **LandingBuilder**, todo junto. Reemplaza la identificación «PANEL BOT ADMIN» del constructor.

## Fuentes y recursos

El kit original completo está versionado en `frontend/assets/landingbuilder/`: guía `LEEME.md`, logos SVG/PNG para fondos oscuros y claros, variantes verticales y de una tinta, isotipos, íconos web/app, imagen social, lámina de referencia y generador original. La aplicación ya no depende de la carpeta Descargas.

Los recursos que consume la web están en `frontend/public/brand/landingbuilder/`. Los íconos de navegador e instalación están en `frontend/public/`, manteniendo los nombres de las rutas existentes. `frontend/app/manifest.ts` sigue siendo la única fuente del manifiesto servido en `/manifest.webmanifest`; el `site.webmanifest` del kit se conserva como referencia, sin publicar un segundo manifiesto.

`LandingBuilderLogo` centraliza los logos horizontal, vertical e isotipo. Los SVG contienen el texto trazado y no requieren instalar fuentes. Mantener sus proporciones, colores y ventana transparente; no agregar efectos al logo. En los estados de carga se permite animar su contenedor con una flotación suave y puntos de progreso, respetando movimiento reducido, sin alterar el recurso original.

Para actualizar la marca: revisar primero el kit versionado, copiar los archivos utilizados a sus destinos públicos y actualizar el componente, los metadatos y el manifiesto cuando corresponda. El generador original requiere Inter Display, fontTools, rsvg-convert e ImageMagick en Linux; no se ejecuta durante el build de la aplicación.

## Aplicación

- Nombre y logo en ingreso de escritorio/móvil, menú de administrador, menú de cliente y transición de workspace; nombre visible también en privacidad.
- Verde principal `#8EE04E`, fondo `#0A0F12` y superficie `#0E1418`; tema de navegador y PWA alineados con el kit.
- Título, descripción, imagen Open Graph/Twitter, favicon SVG/ICO/PNG, Apple Touch y tres íconos PWA actualizados. Los íconos referenciados llevan `?v=landingbuilder` para renovar la caché de la identidad anterior.
- PBAdmin sigue identificando al proveedor externo de autenticación e integración. Se conservan los dominios, claves de almacenamiento, rutas, UUID, tokens y cuentas existentes.
- El canal de atención del editor usa el logo de WhatsApp existente en `/whatsapp-icon.png` para las plantillas 1–6. Para las 7–9 usa `/brand/atrio/icon.svg`, copia exacta del ícono canónico `../internal-chat/public/icons/icon.svg`. La corrección es única en `CtaDestinationSection` para los editores de administrador y cliente; conserva selección de plantilla, canal fijo y plataformas.

## Alcance y entrega

Fuente canónica: este proyecto y su kit versionado. El cambio de identidad es exclusivo del panel de Builder. NexoBet conserva su marca; Atrio, las landings de clientes, Sorteos Golden y los cuatro gateways conservan sus contratos e identidades. No se modifican los archivos del módulo compartido de marketing. Revisar el sincronizador con `node scripts/sync-nexobet-marketing.mjs` y comprobar ambos proyectos.

Entrega Git de Builder: commit `c54ac2f534d75495395c9cd3f5ce78502cdabf85`, integrado por avance directo y pusheado a `origin/main` el 09/11/2026. La rama de producción configurada en Vercel es `main`; la rama de trabajo `fix/template7-session-reentry` generó inicialmente sólo Preview. Publicación de producción READY: `dpl_6C5WHw5VLU253EAViQpBk4h8QPwt`, verificada en `constructor.panelbotadmin.com` y `mkt.panelbotadmin.com`. NexoBet, Atrio y gateways no necesitan publicación para esta identidad de producto. Validación: `docs/validation/landingbuilder-brand-20261109.md`; entrega productiva: `docs/release/landingbuilder-brand-20261109.md`.
