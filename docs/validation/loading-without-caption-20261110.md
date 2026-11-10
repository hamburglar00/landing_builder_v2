# Indicador de carga sin texto visible — 10/11/2026

Alcance exclusivo del panel Builder: ocultar visualmente la leyenda del componente común `LandingBuilderLoading`, dejando logo animado y tres puntos. La leyenda sigue en el árbol accesible y no ocupa espacio en el layout. Se conservan `role=status`, `aria-live`, `aria-busy`, el mensaje específico de cada pantalla, animaciones y movimiento reducido. Sin cambios de TSX, estados, recursos de marca ni otros productos.

Vista revisada con el componente/CSS reales a 390 y 1280 px, en variantes de sección y pantalla completa, con Chromium y WebKit (ocho combinaciones), y con movimiento reducido. La leyenda queda recortada a 1 px y fuera del flujo, permanece en el snapshot accesible, el logo y los tres puntos siguen visibles y no hay desbordes. El movimiento reducido conserva las animaciones desactivadas. Captura móvil inspeccionada. Evidencia y registro de publicación en `.vercel/loading-without-caption-20261110/`.

Publicar por `main` de Builder y comprobar READY y alias `constructor.panelbotadmin.com` y `mkt.panelbotadmin.com`. No requiere migraciones ni publicación de otros proyectos.
