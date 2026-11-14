# Template 9: logo de Rey de Ases a 1,5×

Pedido confirmado por Leo el 13/11/2026: aumentar el logo un 50 % en clásico y constructor. La escala pertenece a la marca y la aplica el CSS común en todos sus tamaños; conserva proporción y límites de ancho. Los espacios de Rey se ajustan para mantener el formulario y los avisos dentro del viewport. La galería y la vista previa usan la misma fuente. Las otras marcas y las cabeceras legales conservan sus tamaños.

Alcance compartido: Builder, clásico y copia versionada de Marketing de NexoBet (1.2.1). Los cuatro gateways y Atrio no renderizan esta landing y no requieren publicar código. Sin cambios de ingreso, tracking, recursos originales, configuración guardada, API2/Panel3 o bases de datos.

Fuentes productivas preservadas: Builder `0f7d42553674953de09273d54a76bfa319d743d6`, clásico `9c46c83ddd57356357b6e775bfea7c8f68c2f3ab`, NexoBet `d0ae61328a224f6fc2d44d524d4d689818eb29a7`. Builder se prepara en un worktree desde `origin/main`; no se incorpora el workspace de Nexo pendiente en la rama de trabajo. La fuente publicada de Nexo se compara con sus 828 archivos de Vercel; las diferencias anteriores eran dos documentos, un manifiesto y un fixture. Se conservan los pins vigentes y se corrige su prueba de revisión para contemplar los seis pins PWA ya publicados.

Validación local: diez contratos T9, 48 escenarios funcionales de los dos motores en Chromium/WebKit, 160 comprobaciones de layout/legal y 36 de editor/galería. El layout verifica la proporción pintada 1,5× de Rey y 1× en las otras marcas. TypeScript de Builder y sincronización del bundle clásico y sus 17 recursos verificados. El harness antiguo del editor necesita resolver CSS Modules y activar el radio mediante su evento DOM; la ejecución temporal añade esas adaptaciones y espera la decodificación del logo antes de capturar.

Evidencia visual y JSON: `C:/Users/Leo/.codex/tmp/t9-logo-20261113`. La regresión completa de NexoBet y la publicación por producto se registran al terminar.

Reversión anterior: Builder `dpl_ETuMVTZuk1g2T99Gen4VG7GJYfKH`, clásico `dpl_5CmquDg77ZdS48S9FR67HjKCAWJg`, NexoBet `dpl_9U6VWkHxqjXhB3L1TaGR1m4rqddk`.
