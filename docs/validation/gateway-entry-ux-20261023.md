# Feedback de ingreso y animación del chat — 23/10/2026

El botón de Continuar muestra un spinner y un estado visible desde el clic,
incluida la confirmación de sesión pendiente. Navegar automáticamente muestra el
mismo feedback. La espera configurable conserva su duración y Continuar permite
adelantarla, sin omitir la confirmación de cookie ni repetir el login.

El widget se expande desde las coordenadas del botón flotante y se contrae hacia
él. Durante el cierre queda inerte y deja pasar los toques; al terminar vuelve a
tener tamaño cero, conservando montado el mismo iframe. Se cancelan los timers
anteriores al invertir una animación y se respeta reducción de movimiento.

El HTML inicial agrega un borde inferior opaco del color oscuro del casino,
independiente del tema del chat y de los modales del proveedor. El chat móvil
reserva esa zona segura. No requiere red, SDK ni permisos, ni captura toques.
La implementación mantiene las paletas y los adaptadores de cada casino.

## Validación

- 144 pruebas unitarias relevantes en los cuatro gateways: transición, espera,
  confirmación de sesión, handoff, apariencia y recursos. TypeScript pasó en los
  cuatro repositorios.
- `node scripts/check-gateway-entry-ux.mjs`: 40 comprobaciones con los renderers,
  JS y CSS reales, datos locales y Chromium/WebKit. Ambos motores, confirmación
  retenida, clic repetido, 390×844, 844×390 y 1366×768, apertura y contracción,
  interacción del casino durante el cierre, tamaño cero final, reapertura rápida,
  reducción de movimiento, borde oscuro y un único iframe sin recarga.
- `PLAYWRIGHT_MODULE_PATH=<playwright instalado> node scripts/check-deferred-gateway-app.mjs`:
  32 regresiones de arranque en los cuatro gateways y Chromium/WebKit. SDK y
  worker diferidos hasta disponibilidad real; permisos conservan su gesto y se
  guardan antes de anunciar éxito. No se enviaron notificaciones reales.
- `sync-gateway-chat-motion.mjs --check`, `sync-entry-transition.mjs --check`,
  `sync-gateway-browser-appearance.mjs --check` y `sync-gateway-app-sdk.mjs --check`
  conservan sincronizadas las partes compartidas.
- Las pruebas de UI no crearon jugadores, mensajes, conversiones ni operaciones
  financieras; las solicitudes de creación del fixture se interceptaron localmente.
- `node scripts/check-public-entry-release.mjs`: cuatro dominios públicos
  verificados después de publicar, incluido el Worker. JS/CSS coinciden con la
  fuente normalizando únicamente LF/CRLF; se guardan ambos hashes. Los dos
  recorridos entregan el nuevo feedback y el login mantiene su formulario.
  No se activó ningún pase ni se creó ninguna cuenta.

Artefactos locales: `.vercel/validation-entry-ux/report.json`, capturas de ambos
motores de navegador y `.vercel/validation-deferred-app/browser-validation.json`.

**Límite:** Playwright/WebKit verifica el contenido y su borde oscuro, no la
barra nativa de Safari en un iPhone físico. Debe comprobarse desde el dispositivo
del usuario al iniciar, abrir y cerrar el chat. Los cambios de tinte por paneles
fijos están documentados en [WebKit 302272](https://bugs.webkit.org/show_bug.cgi?id=302272)
y la selección del color de los bordes en [WebKit 301756](https://bugs.webkit.org/show_bug.cgi?id=301756).

## Publicación y recuperación

Todos los commits están en `fix/template7-session-reentry`.

| Gateway | Commit | Deployment Vercel | Deployment anterior |
| --- | --- | --- | --- |
| Rey de Ases | `f731f4ad22a1f6c66f6ff3ff6dfa1fcc8d060b67` | `dpl_JCJENsTJnpinyWMxyDnVPWD7XJXg` | `dpl_8HMGmDJrVGXSuLuLCn4U5x79yM25` |
| Ganamos NET | `48aedb5e15268ab0d55bd48f8bceca7d1c98c657` | `dpl_8Bbw5PDp5oG4iiNkncJcZwxyf5GQ` | `dpl_61eNmX2YAi1tfiPxzT2xzQYfgSMD` |
| Ases del Norte | `a79f324422e78cd196410d3f6316fd5667f3058b` | `dpl_2NVLD77gmW7vwtQXTFZwgn1ZchH9` | `dpl_EN5hTFT5nMaR7WjaDwoFJUDCKp2E` |
| Ganamos+ | `a18e2b2de1af85b9a70ed9eb0393f896db8b8256` | `dpl_Hnf7KfYH4iUfk7o9dhkxtfbJcPSX` | `dpl_E5j6V4TaEYFYBj733yVrrdFGzLHy` |

Se construyeron snapshots de cada commit sin archivos `.env*` ni `.dev.vars*`,
se comprobó `READY` y luego se promovieron con el scope explícito del equipo.
Ganamos+ también se construye con OpenNext y publica en su Worker con `--keep-vars`.
El Worker anterior era `0eb309c5-68a2-4b19-adfb-437e858f5d72`.
La versión nueva publicada es `4ff1757d-a31d-473e-bf35-0314a97ac9b7`, activa
en `ganamosnet.global` y su dominio `workers.dev`.

Los 72 casos de navegador y los cuatro chequeos públicos pasaron. Los hashes
publicados están en [gateway-entry-ux-public-20261023.json](gateway-entry-ux-public-20261023.json).
Builder conserva la exportación `GATEWAY_ENTRY_BRANDS` necesaria para Template 8;
la sincronización de transición la preserva explícitamente. Sus cambios en este
lote son documentación y herramientas de validación, sin un nuevo runtime del panel.

No requiere migraciones ni cambios de configuración. No cambia API2, Panel3,
Atrio, los destinos de las landings, la identidad ni las operaciones financieras.
