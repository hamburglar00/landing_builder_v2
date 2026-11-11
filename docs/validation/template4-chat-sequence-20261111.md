# Template 4: secuencia y adaptación del chat

Alcance: LandingBuilder, editor de cliente/administrador y renderer público en los motores Constructor y clásico. Fuente canónica de animación y ajuste: `frontend/components/public-landing/template4Motion.ts`. NexoBet conserva sus 24 archivos de marketing fijados, verificados sin diferencias. No cambian Atrio, los gateways ni sus Workers.

Las tres burbujas comienzan a los segundos 1, 2 y 3. Cada una crece desde su esquina inferior izquierda durante 360 ms. Con movimiento reducido aparecen completas. Se mantienen a la izquierda, con ancho máximo del 82% para dejar aire a la derecha.

El texto parte del doble del tamaño anterior y se ajusta junto con espaciados y burbujas al alto/ancho disponible, sin desplazar ni recortar los mensajes. El encabezado aumenta de 66 a 99 px (60 a 90 px en pantallas bajas), con elementos mayores y adaptación horizontal. El fondo utiliza el mismo color del encabezado y pie, conservando el patrón o imagen configurada. En horizontal se aprovecha más ancho y se reduce el espacio inferior reservado, manteniendo CTA y privacidad visibles.

La medición utiliza las cajas completas de los mensajes y no su escala animada; abrir cada burbuja no cambia el ajuste. Se recalcula al cambiar el tamaño y cargar las fuentes. El editor también recalcula al modificar sus textos. Se conservan los recursos publicados anteriores y se generan URLs nuevas para el runtime y CSS actuales.

Verificación: build de Next/TypeScript, ESLint y encoding aprobados; 26 pruebas existentes de renderer, imágenes y aislamiento de Template 7 aprobadas. Chromium/WebKit: 32 recorridos con servicios sintéticos, sin escrituras de negocio. Constructor, clásico y vista previa a 320×568, 390×844, 768×1024, 1440×900 y 667×375; además movimiento reducido. Se comprueban intervalos reales de un segundo, tres mensajes completos, alineación/margen derecho, límites del contenido, ausencia de scroll y colores/CTA. Evidencia operativa local en `.vercel/template4-sequence-20261111/`.

Publicación: integrar por avance rápido en `main`, hacer push y verificar READY, ambos dominios del panel y los hashes de los recursos públicos. La evidencia de publicación se registra por separado en el mismo directorio operativo.
