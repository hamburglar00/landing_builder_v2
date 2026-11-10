# CTA y modal de Redirección — 10/11/2026

Productos: LandingBuilder (`landing_builder_v2`) y motor clásico (`public_landing_bl`).

El CSS canónico de Builder corrige la especificidad del reset público de fuentes, que dejaba los CTA 5/6 con 16 px y peso normal. Templates 4/5 usan texto adaptable de 18–22 px, peso 900 e icono de 28 px. Template 6 usa 18–22 px, peso 800 e icono de 20 px, respetando la altura previa. La vista previa conserva también sus dimensiones previas. Los textos excepcionalmente largos usan elipsis. No cambian destinos, handlers ni seguimiento.

El modal de edición usa un módulo CSS propio para separar etiquetas e inputs, con fondo, borde y foco visibles. Se conservan datos, validación, estado ocupado y guardado. La ruta pública del motor clásico reescribe los GET/HEAD al renderer generado compartido, por lo que se sincronizan tanto el bundle como su CSS versionado.

## Verificación

- `node scripts/check-template-cta-typography.mjs`: 216 casos con Chromium y WebKit, usando renderer real del constructor, bundle real del clásico y componente real de vista previa. Comparación contra Builder `164ae84` y clásico `3509175`, a 320, 360, 390, 768, 1280 y 844 px (horizontal). Dimensiones de botón iguales; fuentes/iconos mayores; sin desbordes. Incluye textos largos y control de Template 8 sin cambios. Scripts y red bloqueados para no generar eventos reales. Evidencia local en `.vercel/cta-typography-20261110/`.
- Modal: 8 casos en Chromium/WebKit a 320, 390, 768 y 1365 px con componente, portal y CSS reales; servicios sustituidos por mocks y red bloqueada. Etiquetas separadas, fondo/borde visibles, foco verde, fuente móvil de al menos 16 px. Cambiar ambos campos y guardar conserva exactamente el payload y cierra el modal. Capturas inspeccionadas a 390 px.
- Comprobación final del panel publicado: Chromium a 390/1280 px para cliente y administrador (4 casos), con sus bundles/CSS productivos y servicios interceptados con datos sintéticos. Fondo de input `rgb(25, 34, 46)`, borde visible de 1 px, separación de etiqueta de 8 px, foco y guardado simulado correctos. No se escribió ningún vínculo real.
- Builder: TypeScript sin emisión, ESLint de los componentes modificados y 16 pruebas de HTML público/Template 8 aprobadas.
- Clásico: 16 pruebas de entrega pública, Template 6 y renderers de Template 7 aprobadas.
- Runtimes/estilos versionados y bundle clásico sincronizados; los scripts de seguimiento no cambian. Marketing NexoBet: 24 archivos fijados sin diferencias; no requiere publicación. Los cuatro gateways y su Worker no cambian porque este lote modifica solo presentación de WhatsApp 4–6 y el panel de Builder.

## Publicación

Publicación verificada el 10/11/2026 a las 15:06 UTC (12:06 de Buenos Aires), después de push separado a `main` en ambos repositorios:

| Producto | Commit de implementación | Despliegue READY | Dominios asociados |
| --- | --- | --- | --- |
| Builder | `cbec24a44d2474b014563652ac1f8a066ae744c1` | `dpl_FCiiBq178h5DAQCwgruE751D7Fxp` | `constructor.panelbotadmin.com`, `mkt.panelbotadmin.com` |
| Clásico | `f6573580964ae7503a4637e33bce89e253ab9d32` | `dpl_4sMnoSHJKeVddGfLg9WNCANj6SPy` | `landing.panelbotadmin.com` |

Los tres dominios devuelven HTTP 200 para `landing-d7816d41a7dbda1fcbb0fac6.css`, con contenido idéntico al recurso validado y SHA-256 `d7816d41a7dbda1fcbb0fac6f859d4bac575a202a6768ac273f8c8a0aa202a90`. Evidencia de despliegues y lectura pública en `.vercel/cta-typography-20261110/release-observed.json` y `production-smoke.json`.

No requiere migraciones ni despliegue de funciones. El registro documental posterior no modifica el código publicado.
