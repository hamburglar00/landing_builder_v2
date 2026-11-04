# Template 9: proporciones, miniatura completa y páginas legales

## Alcance aprobado

El usuario autorizó terminar y publicar T9 antes del evento de alta exitosa de WhatsApp, que permanece sólo en API2 local. Ajustar las proporciones a la referencia pública, conservar Rey negro/dorado y Ases negro/plateado y reproducir los cuatro enlaces legales con contenido propio adaptado a la marca, sin contactos ajenos.

## Implementación

- La tarjeta de escritorio conserva 400 px, logo de 76 px, campo de 54 px y CTA de 60 px. Las reglas compactas por altura se limitan a móviles; el pie se adapta a escritorios bajos sin taparlo con cookies. La UI estándar cabe en los tamaños probados; el teclado o contenido personalizado extenso puede requerir desplazamiento accesible.
- Rey y Ases usan superficies negras neutras. Los brillos dorados/plateados se concentran en logo, bordes y CTA. Las otras skins conservan su catálogo guardado.
- La galería y vista previa reducen una página móvil completa de 390×844 al espacio disponible mediante ResizeObserver. Incluyen pie y aviso, sin scroll propio, scripts, tracking ni navegación; la tarjeta de galería conserva su enlace exterior.
- Enlaces `/l/<slug>/{privacidad,terminos,cookies,juego-responsable}` en Builder y `/<slug>/...` en clásico. Cada página obtiene la misma configuración pública, con caché de 60 s, y usa la marca/skin y país del workspace. Se abren aparte para conservar el formulario de origen. Un nombre de página desconocido o una landing distinta de T9 devuelve 404.
- Renderer legal único exportado al bundle clásico: HTML con CSS local, sin React de cliente, Pixel, prewarm, creación ni requests de negocio. Texto propio sobre el comportamiento implementado; no se copian KYC, límites, emails, teléfonos, reglas bancarias o promesas de conservación de la competencia. El aviso de cookies sigue siendo informativo, sin presentarlo como un control de consentimiento.
- Tracking, cuenta, destino y runtime T7 no cambian. La prueba antigua que buscaba un literal Contact se actualiza al selector publicado en el lote anterior; los casos T1–T6 mantienen su fallback Contact.

## Evidencia

Referencia inspeccionada por lectura sin enviar formularios ni eventos: https://ganamosmayor.com/landing y sus páginas /privacidad, /terminos, /cookies, /juego-responsable. Capturas y métricas previas en `C:/Users/Leo/.codex/tmp/t9-inspection-20261104.json`. Implementación y capturas nuevas en `C:/Users/Leo/.codex/tmp/t9-final-20261104`.

- 24 pruebas de renderer, selector y configuración; TypeScript y lint focal sin errores.
- 48 recorridos con transportes aislados en Chromium/WebKit, Builder/clásico, cuatro proveedores: atribución orgánica/publicitaria, CTA temprano, reintento, regreso, teclado y Bet30.
- 128 verificaciones de layout en Chromium/WebKit: cuatro proveedores, 320–430 px, escritorio 1366×635 / 1440×900, horizontal y teléfono opcional. Sin overflow ni solapamiento del pie/aviso en las configuraciones estándar.
- 36 verificaciones del editor real, selección de proveedores/skin y miniaturas de 300×400, 240×320 y 180×240. Sin escrituras ni eventos reales.
- Builds de Builder y clásico aprobados. SDK e ingreso compartidos verificados sincronizados en los cuatro gateways; no necesitan desplegar sus aplicaciones padre ni Atrio para este cambio visual.
- 32 comprobaciones visuales de páginas legales en Chromium/WebKit y los cuatro proveedores: título, marca, retorno, ancho y ausencia de scripts/formularios. Ver `legal-results.json` y verificación pública posterior a la publicación.

Sin migraciones ni cambios API2 para publicar este lote. El despliegue se verifica contra el SHA exacto antes de promover; no se modifican configuraciones guardadas de clientes ni campañas.
