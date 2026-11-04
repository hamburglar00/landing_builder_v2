# Editor y Template 9 — 04/11/2026

Publicación de los ajustes de T9 junto con Bots autorizada el 04/11. Se conserva el checkpoint `027d4db`. El estado final y los commits se registran en [la entrega](../../release/bots-template9-20261104/README.md).

## Cambios solicitados

- El editor deja de mostrar «País donde circulará la landing». El componente mantiene su efecto de sincronización: ARS guarda AR y PYG guarda PY. Se verifica también el cambio de workspace; no cambia tracking, teléfonos ni persistencia.
- Rey de Ases: negro/dorado. Ases del Norte: negro/plateado. Se neutralizan también las superficies, inputs y textos que antes conservaban tintes violetas; ambos botones metálicos usan texto oscuro para conservar contraste. Logos, NET, Plus y otras skins mantienen su identidad.
- La galería usa una miniatura adaptada al tamaño de la tarjeta, sin pie/cookies ni campos opcionales de la página completa. El iframe es inerte, no captura el clic del enlace de la landing, no recibe foco por tabulación y no tiene scroll propio.
- La página pública distribuye tarjeta, pie y cookies en el espacio disponible. El aviso ocupa su altura real y no se superpone. Espacios y tamaños se ajustan por altura, con una distribución en dos columnas al girar el celular. Se mantienen todos los textos y accesos legales públicos, el formulario y la opción WhatsApp.
- Al reducir la pantalla por el teclado, o con textos personalizados que exceden el tamaño disponible, el formulario conserva desplazamiento accesible. No se oculta contenido público para aparentar que entra en pantalla.

La fuente de presentación sigue siendo única en Builder. Se regeneró `landing-prueba-1/lib/template7/shared.cjs` mediante `node scripts/build-classic-template7.mjs --write`; el renderer clásico incorpora los mismos cambios. No se modifica el ingreso T7, Contact/FBC, handoff, API2, Atrio, SDK ni adaptadores de los cuatro gateways. Los cuatro proveedores están cubiertos en las pruebas de ambos motores.

## Validación final

- **112 escenarios de layout** en Chromium y WebKit: cuatro proveedores, con/sin WhatsApp y tamaños 320×568, 360×640, 375×667, 390×664, 390×844, 430×932 y 844×390. Se comprueban ancho, ausencia de scroll vertical normal, CTA dentro de pantalla, pie sin superposición con cookies y ocultamiento del aviso. Simulación adicional de teclado 390×360 con CTA accesible por desplazamiento.
- **36 comprobaciones del editor real**: país oculto/automático por workspace, selección de los cuatro proveedores/Bet30, borradores separados, miniaturas 300×400, 240×320 y 180×240 sin scroll ni CTA recortado, clic al enlace padre y ninguna escritura.
- **48 recorridos T9** en Chromium y WebKit, Builder y clásico: los cuatro proveedores, Bet30, Contact/FBC por contexto, deduplicación, reintento, regreso, click anticipado, pantalla chica, escritorio y teclado. Servicios interceptados; sin cuentas, conversiones ni operaciones reales.
- **17 pruebas focales** de T9, borradores y configuración pública de skins aprobadas.
- Build de Builder con TypeScript aprobado; sincronización del renderer clásico, logos, encoding y diff aprobados.

El fixture visual declara UTF-8 explícitamente; se revisaron capturas después de corregir su encabezado. Los navegadores y contextos se cierran en `finally`. Las pruebas de WebKit son simulaciones de navegador, no una prueba física de Instagram/Facebook en iPhone.

Resultados: [layout](layout-results.json), [editor](editor-results.json), [recorridos](browser-results.json).

Capturas: [Rey de Ases](rey_de_ases-390.png), [Ases del Norte](ases_del_norte-390.png), [Rey 320×568 con WhatsApp](rey_de_ases-320-phone.png).

## Repetición y publicación

Desde `frontend`:

```powershell
$env:TEMPLATE9_ARTIFACT_DIR='../docs/validation/template9-layout-20261104'
node --import tsx scripts/template9-layout-check.ts
node scripts/template9-editor-check.mjs
node --import tsx scripts/template9-browser-check.ts
node node_modules/tsx/dist/cli.mjs --import ./tests/revalidation-server-loader.mjs --test tests/template9.test.ts tests/landingTemplateVariants.test.ts tests/builderConfigSkins.test.ts
npm run build
```

Para activar estos ajustes visuales alcanza con publicar clásico y Builder, junto con las dependencias pendientes de los otros lotes si todavía no están publicadas. Este ajuste no agrega migraciones, funciones Edge ni cambios de gateways o API2. No se publicaron aplicaciones durante esta tarea.

## Consulta sobre la recuperación de cargas

Esta tarea no implementa reenvíos monetarios ni cambia el diagnóstico de API2. Se explicó que el registro del fallo no recupera el intento: la recuperación automática requiere consultar y reconciliar el resultado del proveedor; una confirmación positiva cierra el registro sin volver a acreditar. Un nuevo crédito sólo es admisible con una confirmación fiable de no ejecución o una garantía de idempotencia del proveedor. Un estado incierto no prueba un rechazo.

Para distinguir una respuesta del casino de una página intermedia, queda por ampliar el diagnóstico con tipo de contenido, metadatos de servidor/proxy e identificadores/categoría de respuesta depurados, sin cookies, credenciales ni dumps completos. Eso es una mejora observacional separada; no cambia por sí sola el resultado financiero.
