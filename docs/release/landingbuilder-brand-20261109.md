# LandingBuilder: identidad y logos del editor — publicación 09/11/2026

## Configuración verificada

- Proyecto Vercel `landing-builder-v2-k259` (`prj_Mwgk26w4BkZ1hhv2TBsSLlJShka8`), raíz `frontend`, repositorio `hamburglar00/landing_builder_v2`.
- La API del proyecto confirma `link.productionBranch = main`. Los dominios `constructor.panelbotadmin.com` y `mkt.panelbotadmin.com` pertenecen a esta aplicación.
- Antes de la corrección, `origin/main` seguía en `5372c88993198870a340ed20cc67e375aea2b0d4`. Producción servía el despliegue manual `dpl_9GUkZeY4Jojf3nYF7bjw26dT8HwF`, desde `fix/template7-session-reentry`, código `aaf640887d01f89e71ec1f70b5d25e433b43777a`.
- El primer push del lote de marca a la rama de trabajo produjo el Preview `dpl_GkCS9CvtbPr6DkAR12d7mWtcFw2W`; no actualizó los dominios productivos. Por eso refrescar conservaba el nombre anterior.

## Entrega Git y producción

Se comprobó que `main` era ancestro del lote y que, respecto de la versión de aplicación ya publicada, la diferencia de código se limita a la identidad de LandingBuilder y los logos del canal del editor. Los otros cinco commits posteriores a la base productiva sólo registran documentación. No se añadieron cambios de autenticación, finanzas, base de datos o configuración de servicios.

`main` avanzó sin reescritura de historia hasta el commit de código `c54ac2f534d75495395c9cd3f5ce78502cdabf85` (`feat(branding): adopt LandingBuilder identity and channel logos`) y se pusheó a `origin`. Vercel inició automáticamente un despliegue Git de `main` con target `production`.

| Estado | Identificación |
| --- | --- |
| Código de aplicación integrado y pusheado a `main` | `c54ac2f534d75495395c9cd3f5ce78502cdabf85` |
| Despliegue de código | `dpl_6C5WHw5VLU253EAViQpBk4h8QPwt`, READY, fuente Git `main`, target Production |
| URL del despliegue | `https://landing-builder-v2-k259-r5waw2u04-juanclouds-projects.vercel.app` |
| Panel productivo | `https://constructor.panelbotadmin.com`, `https://mkt.panelbotadmin.com` |

La actualización posterior de esta documentación registra la entrega ya verificada y conserva el mismo código de aplicación. La nota local preexistente de ingreso PBAdmin/billetera, y las otras decisiones locales agregadas durante el trabajo, se conservaron fuera del lote. El uso de un checkout aislado permitió publicar sin incluir esos cambios.

## Verificación pública

En ambos dominios, el login responde 200, el título es `LandingBuilder`, aparece el nuevo logo y no aparece `PANEL BOT ADMIN`. El manifiesto devuelve `name` y `short_name` `LandingBuilder`, con tema `#0A0F12`. Se comprobaron 13 recursos por dominio —26 comparaciones— por estado HTTP y SHA-256 contra los archivos revisados: logos, imagen social, favicon SVG/ICO/PNG, Apple Touch, íconos PWA y logos de Atrio/WhatsApp.

También pasaron 26 escenarios contra el panel publicado en `constructor.panelbotadmin.com`, con Chromium/WebKit y tamaños 320×720, 390×844, 768×1024 y 1440×900: ingreso, menús de ambos roles, cambio de workspace, privacidad, metadatos, manifiesto e íconos. Sin errores JavaScript ni desborde horizontal. Las pruebas del panel usan servicios de negocio interceptados e identidad ficticia. No se accedió a la cuenta del usuario de la captura ni se modificaron cuentas, datos o eventos reales. Las comprobaciones locales, el editor en nueve plantillas y la revisión de NexoBet constan en la [validación del lote](../validation/landingbuilder-brand-20261109.md).

Evidencia pública: [HTTP y hashes](landingbuilder-brand-20261109/http-results.json), [26 escenarios del panel](landingbuilder-brand-20261109/panel-browser-results.json), [panel de escritorio](landingbuilder-brand-20261109/panel-desktop.png) e [ingreso móvil](landingbuilder-brand-20261109/login-mobile.png).

## Alcance y reversión

Sólo Builder requiere esta publicación. NexoBet conserva su identidad y módulo compartido 1.2.0; Atrio sólo aportó una copia exacta de su SVG, y los cuatro gateways/Worker conservan su código. No hubo publicaciones de API2, Panel3, Atrio, NexoBet ni gateways, ni migraciones o cambios de variables.

Ante una regresión, promover el despliegue productivo anterior `dpl_9GUkZeY4Jojf3nYF7bjw26dT8HwF` y revertir el commit de marca con un commit nuevo en `main`. No retroceder `main` a `5372c88`, porque omitiría funciones que ya estaban publicadas mediante despliegues manuales.
