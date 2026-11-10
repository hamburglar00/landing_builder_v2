# Encabezados del panel y tabla de Redirección — 10/11/2026

Producto: panel LandingBuilder, roles cliente y administrador. Fuente canónica: `PageHeader`, `.ui-page-title` y el CSS de `BotsDirectoryView`. No cambia el motor clásico ni los otros productos.

Se elimina `eyebrow` de la API de `PageHeader` y de sus 22 consumidores que lo usaban. Documentación pierde su rótulo manual. Los títulos de sección, incluido Redirección y las dos vistas previas del editor, usan la clase común con mayúsculas y corte de palabras para nombres largos. Se conservan descripciones, botones, títulos de contenido y etiquetas de los modales.

La cabecera de Redirección pasa de 11 px/peso 700 a 12 px/peso 800, de 13 a 16 px de padding vertical, con fondo verde en degradado, borde de marca de 2 px y texto claro. La altura pasa de 46,5 a 54 px; no cambian el cuerpo, las separaciones de 12 px, la estructura de columnas ni sus controladores.

## Verificación

- TypeScript sin emisión aprobado.
- ESLint de todos los TSX modificados: sin errores; cinco advertencias preexistentes en Integraciones, Notificaciones y Teléfonos, cuyas modificaciones se limitan a retirar la prop del encabezado.
- Diez casos con Chromium/WebKit a 320, 390, 768, 1280 y 1440 px, usando los componentes y CSS reales con servicios inertes y red bloqueada. Títulos en mayúsculas sin rótulos superiores; nombres largos contenidos; cabecera de tabla de 54 px, tipografía/peso/contorno correctos; columnas alineadas y scroll limitado a la tabla, sin ensanchar la página. Capturas revisadas a 390 y 1280 px.
- La revisión del diff limita los cambios a presentación y a la eliminación de props decorativas. Datos, permisos, handlers, paginación, modales y recorridos públicos conservan su implementación.

## Publicación

Push a `main`, despliegue de Builder READY y comprobación de los alias `constructor.panelbotadmin.com` y `mkt.panelbotadmin.com`. Verificar con servicios simulados el panel publicado para cliente y administrador. Evidencia local en `.vercel/panel-headings-20261110/`: `results.json`, capturas y registro productivo. No requiere migraciones ni publicación de otros proyectos.

## Ajuste posterior: sincronización debajo de la descripción

Se separa la descripción del canal del bloque de estado, cuenta regresiva y «Sincronizar ahora». El bloque inferior admite salto de línea en móvil. Se conserva la posición de los CTA de administración a su lado, y no cambian sincronización, temporizadores, permisos ni estados del botón. Verificación de geometría y publicación en `.vercel/redirection-sync-layout-20261110/`.
