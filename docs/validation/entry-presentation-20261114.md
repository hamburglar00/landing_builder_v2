# Continuidad visual del ingreso — 14/11/2026

Lote local, sin publicación ni creación de usuarios. Complementa el registro de UX y el informe `internal-chat/docs/validation/entry-performance-20261114.md`.

## Decisión aplicada

La transición posterior a Crear cuenta usa una barra indicativa con degradado y tres hitos discretos: **Cuenta · Acceso · Chat**. El tiempo transcurrido no confirma una etapa ni llega al 100 %. Cuenta se confirma cuando comienza el ingreso de una cuenta ya resuelta; Acceso al conectar el chat con la sesión confirmada; Chat sólo mediante la señal autorizada de chat utilizable. No se añaden pausas, peticiones ni temporizadores a la coordinación existente. Reducir movimiento detiene el avance animado, conservando la etapa correspondiente.

Cada recorrido conserva logo, paleta, fuentes, márgenes y geometría desde T7/T8/T9 hasta preparación y conexión. Rey usa dorado; Ases, azul; Ganamos NET y Ganamos+, violeta. Las demás skins mantienen su catálogo propio. La paleta de transición no modifica el casino, el chat, los modales PWA, el footer ni las áreas seguras aprobadas. En T8 se aplica sólo la marca seleccionada. El logo de transición sigue diferido hasta el CTA.

La fuente canónica es `landing-autologuin/src/lib/gateway-entry-transition.ts`; preparación consume la misma definición de marca. El generador la copia a los otros tres gateways y Builder. Ganamos+ comparte esta fuente también en su implementación Worker, sin una variante visual independiente. Nexo importa la copia revisada y conecta la transición a su adaptador público T8/T9; conserva identidad, alta, tracking y persistencia propios.

## Comprobaciones acotadas

- `node scripts/check-entry-journey-presentation.mjs`: 120 recorridos renderizados (constructor y clásico T7/T8/T9, Nexo T8/T9; cuatro marcas y Casino Zeus; 320×568, 390×844 y 1365×768), más 15 estados de conexión. Diferencia menor a 1 px en posición/tamaño de logo, título, barra y etiquetas; igualdad de colores, tipografía y degradado; sin overflow horizontal; movimiento reducido verificado.
- La selección T8 ejecuta el adaptador real con dependencias de identidad/tracking inertes. Los logos se sirven desde archivos locales; ninguna petición productiva se permite. La captura opcional se habilita mediante `ENTRY_VISUAL_SCREENSHOT` y espera a decodificar el logo.
- Gateway Rey: 81 pruebas focalizadas de transición, preparación y ruta. Ases: ocho de ruta. NET: ocho de ruta. Multi Skin: nueve de ruta y 15 de catálogo/branding, incluida la conservación de las otras skins y de la paleta del casino/PWA.
- `check-entry-progress-continuity.mjs` conserva el contrato de progreso sin retrocesos, origen autorizado y finalización por chat utilizable; la generación y comprobación final de artefactos se coordinan con el lote de política por landing.

La prueba visual usa HTML real y navegador Chromium local; no acredita tiempos de red, funcionamiento en teléfonos físicos ni publicación. La fuente extraída de Template 8 corresponde al commit previo `10be27ef` y no se atribuye a este lote. Las verificaciones finales de tipos, fuentes vendorizadas y política por landing se registran en el cierre consolidado.
