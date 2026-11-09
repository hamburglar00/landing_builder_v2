# Identidad LandingBuilder — 09/11/2026

Alcance: panel de Builder; kit original incorporado en `frontend/assets/landingbuilder`. Recursos públicos y comportamiento compartido revisados con NexoBet, que conserva su identidad. Fuente canónica y excepciones: [identidad](../IDENTIDAD_LANDINGBUILDER.md).

Estado: implementado, validado y publicado en producción el 09/11/2026, desde `main`. Código `c54ac2f534d75495395c9cd3f5ce78502cdabf85`, despliegue READY `dpl_6C5WHw5VLU253EAViQpBk4h8QPwt`. [Registro de publicación](../release/landingbuilder-brand-20261109.md).

## Cambios

- Nombre LandingBuilder, logos del kit, paleta, metadatos sociales, favicon e íconos de instalación. Nombre visible en ingreso, menús de administrador/cliente, transición de workspace y privacidad.
- Canal del editor: logo WhatsApp original para las plantillas 1–6, SVG original de Atrio para las 7–9. Implementación compartida por ambos editores en `CtaDestinationSection`, sin modificar selección, permisos, destinos ni contenido publicado.
- Kit completo: 43 archivos copiados de la carpeta aportada, con SHA-256 idéntico. Atrio: SVG idéntico a `../internal-chat/public/icons/icon.svg`; WhatsApp: recurso existente `/whatsapp-icon.png`.

## Verificación

| Comprobación | Resultado |
| --- | --- |
| `npm run build` en `frontend` | Correcto, incluido TypeScript y 72 páginas estáticas |
| `landingTemplate7`, `template9` y `publicLandingHtml` | 27 pruebas aprobadas |
| Panel real en servidor de producción local | 26 escenarios aprobados en Chromium/WebKit: ingreso, menús de ambos roles, transición de workspace, privacidad, metadatos, manifiesto e íconos |
| Selector de plantillas y canal reales en fixture local | 72 escenarios aprobados: 9 plantillas × 4 tamaños × 2 navegadores; recurso correcto y cargado, dimensiones, ausencia de desborde, canal fijo y plataforma sólo en T7/T9 |
| `node scripts/sync-nexobet-marketing.mjs` | 24 archivos fijados de marketing 1.2.0 verificados; no hay diferencias para sincronizar |
| `npm run test:regression:checks` en NexoBet | 14 grupos aprobados, incluidos servicios, contratos, TypeScript y módulos Builder/Atrio; sin modificaciones de su marca ni del código compartido |
| `node scripts/check-encoding.js --changed` y `git diff --check` | Correctos |

Tamaños: 320×720, 390×844, 768×1024 y 1440×900. Las pruebas usan identidad/datos ficticios y solicitudes interceptadas; no ingresan con cuentas reales ni crean usuarios, eventos comerciales u operaciones. Las verificaciones del panel y del selector se ejecutaron en Chromium y WebKit, sin errores de JavaScript. La regresión de NexoBet corresponde a la suite `checks`, sin ejecutar sus suites de navegador o base de datos.

Evidencia: [panel](landingbuilder-brand-20261109/brand-browser-results.json), [72 escenarios de editor](landingbuilder-brand-20261109/editor-browser-results.json), [ingreso escritorio](landingbuilder-brand-20261109/login-desktop.png), [ingreso móvil](landingbuilder-brand-20261109/login-mobile.png), [editor WhatsApp](landingbuilder-brand-20261109/editor-whatsapp.png) y [editor Atrio](landingbuilder-brand-20261109/editor-atrio.png).

## Cobertura y entrega

Builder es la única aplicación modificada y la fuente canónica del ajuste del editor. NexoBet se revisó y verificó por separado; conserva su canal e identidad propios, y su módulo de marketing permanece en 1.2.0. Atrio sólo aporta una copia exacta de su ícono; no se modificó su implementación. Las cuatro plataformas/gateways, Ganamos+ Worker y el renderer público no requieren cambios ni publicación para esta presentación del panel. API2 y Panel3 conservan su estado.

Entrega Git de Builder: commit de código `c54ac2f534d75495395c9cd3f5ce78502cdabf85`, publicado primero en la rama de trabajo y luego integrado por avance directo y pusheado a `origin/main`. Publicación: Vercel Production READY `dpl_6C5WHw5VLU253EAViQpBk4h8QPwt`, fuente Git `main`; ambos dominios del panel devuelven la nueva marca y los recursos coinciden por SHA-256. La documentación posterior registra esta publicación y no cambia el código de aplicación. NexoBet, Atrio y los cuatro gateways no requieren commit/push ni publicación por este lote. No hubo migraciones ni dependencias externas para usar los nuevos recursos.
