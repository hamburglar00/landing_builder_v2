# Vista previa del editor — 05/11/2026

La tarjeta conserva margen inferior y borde exterior completo, con encabezado fijo y contenido desplazable. Template 9 utiliza el ancho real del contenedor sin el doble escalado que difuminaba el texto. Implementación única para los editores de cliente y administrador; la galería y la landing pública conservan su presentación.

Validación local con las páginas y layouts reales, datos ficticios y red interceptada, sin sesiones ni escrituras productivas:

- 32 escenarios Chromium/WebKit: ambos roles; 1366×635, 1366×768, 1920×1080, 390×844 y 320×568; los cuatro proveedores en la ventana de escritorio baja, con captura de teléfono habilitada.
- Sin escalado ni desbordes horizontales; inputs de al menos 16 px y título de al menos 22 px; formulario a ancho disponible. Pie legal, cookies y resumen de gerencias accesibles mediante scroll.
- Margen inferior de la tarjeta verificado antes y después de desplazar el editor. Revisión visual de las capturas.
- TypeScript y las 10 pruebas existentes de Template 9 correctos; control de codificación y diff sin errores.

[Captura de escritorio](desktop.png). Mediciones en [report.json](report.json).

El ajuste sólo requiere publicar Builder. No modifica el renderer clásico, Atrio, gateways, API2 ni Panel3; no requiere migraciones ni funciones Edge.

Publicado: commit `ec0bbf7`, despliegue Vercel `dpl_HC5KBxMTihcYovCwnqK6sWganBKu`, compilado y promovido a `mkt.panelbotadmin.com`. Verificados los recursos públicos de ambos editores, sin iniciar sesión ni guardar landings. [Versión y rollback](deployment.json), [comprobación pública](public.json). API2 y Panel3 conservan exactamente su HEAD y cambios locales anteriores.
