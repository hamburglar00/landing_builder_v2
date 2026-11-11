# Template 4: secuencia y adaptación del chat

Alcance: LandingBuilder, editor de cliente/administrador y renderer público en los motores Constructor y clásico. Fuente canónica de animación y ajuste: `frontend/components/public-landing/template4Motion.ts`. NexoBet conserva sus 24 archivos de marketing fijados, verificados sin diferencias. No cambian Atrio, los gateways ni sus Workers.

Las tres burbujas comienzan a los segundos 1, 2 y 3. Cada una crece desde su esquina inferior izquierda durante 360 ms. Con movimiento reducido aparecen completas. Se mantienen a la izquierda, con ancho máximo del 82% para dejar aire a la derecha.

El texto parte del doble del tamaño anterior y se ajusta junto con espaciados y burbujas al alto/ancho disponible, sin desplazar ni recortar los mensajes. El encabezado aumenta de 66 a 99 px (60 a 90 px en pantallas bajas), con elementos mayores y adaptación horizontal. El fondo utiliza el mismo color del encabezado y pie, conservando el patrón o imagen configurada. En horizontal se aprovecha más ancho y se reduce el espacio inferior reservado, manteniendo CTA y privacidad visibles.

La medición utiliza las cajas completas de los mensajes y no su escala animada; abrir cada burbuja no cambia el ajuste. Se recalcula al cambiar el tamaño y cargar las fuentes. El editor también recalcula al modificar sus textos. Se conservan los recursos publicados anteriores y se generan URLs nuevas para el runtime y CSS actuales.

Verificación: build de Next/TypeScript, ESLint y encoding aprobados; 26 pruebas existentes de renderer, imágenes y aislamiento de Template 7 aprobadas. Chromium/WebKit: 32 recorridos con servicios sintéticos, sin escrituras de negocio. Constructor, clásico y vista previa a 320×568, 390×844, 768×1024, 1440×900 y 667×375; además movimiento reducido. Se comprueban intervalos reales de un segundo, tres mensajes completos, alineación/margen derecho, límites del contenido, ausencia de scroll y colores/CTA. Evidencia operativa local en `.vercel/template4-sequence-20261111/`.

Los motores se publican por separado. Builder sirve Constructor en `constructor.panelbotadmin.com` y `mkt.panelbotadmin.com`; `landing-prueba-1` sirve el clásico en `landing.panelbotadmin.com` (proyecto Vercel `public-landing-bl`). Un despliegue de Builder no actualiza el clásico.

Antes de entregar Template 4, ejecutar `node scripts/build-classic-template7.mjs --write` y luego el mismo comando sin `--write`: pese a su nombre, ese generador también sincroniza el renderer y los assets de las plantillas 1–6. Revisar la diferencia, conservar las bases productivas y publicar ambos repositorios desde `main`. Verificar READY, los dominios, los hashes de CSS/runtime y la URL real de la landing en ambos motores. La comprobación del editor y de un renderer clásico aislado no acredita el despliegue del clásico.

La sincronización clásica de este lote modifica únicamente el bundle generado y agrega los mismos CSS/runtime que ya usa Builder; los otros módulos compartidos coinciden. Sus 47 pruebas existentes pasan. Evidencia adicional y comprobación de `b30golden` en `.vercel/template4-classic-release-20261111/`.

## Fondo del documento, descripción e indicador

La revisión del 11/11 corrige también el fondo de `html` y `body`, que seguía negro, y `theme-color` para Template 4: los tres se emiten con `#102326` desde el HTML inicial. Los demás templates conservan sus colores. Se mantienen `viewport-fit=cover` y los insets existentes. Referencias de WebKit: [fondo de las zonas seguras](https://webkit.org/blog/7929/designing-websites-for-iphone-x/) y [color de tema](https://webkit.org/blog/11989/new-webkit-features-in-safari-15/).

La descripción del encabezado se muestra completa en una sola línea; parte de 12 px y se reduce cuando su caja lo requiere. El indicador aumenta texto, punto y espaciado, con tipografía independiente del ajuste de las burbujas, y dice «X personas están escribiendo en este momento». El ajuste de las tres burbujas reserva el espacio real del indicador ampliado y se actualiza también cuando cambia el contador.

Fuente única en Builder, sincronizada al clásico con el generador. Se verifica en ambos motores y en la vista previa: raíz/cuerpo/metadatos del color correcto, descripción sin cortes ni salto de línea, texto nuevo del indicador y tamaño mínimo de 18 px, tres mensajes completos sin scroll y secuencia de un segundo. Los checks de WebKit son automatizados; no equivalen a una captura de las barras nativas en un iPhone físico. Evidencia de esta revisión en `.vercel/template4-mobile-chrome-20261111/`.
