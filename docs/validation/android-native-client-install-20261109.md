# Instalación directa de Android — Atrio y NexoBet — 09/11/2026

## Resultado y alcance

Cuando el navegador ofrece instalación nativa, la invitación muestra «Instalar app», una explicación breve y «Ver instructivo de instalación». El aviso del sistema se abre desde el toque del cliente, conservando la activación del usuario. La llegada del mensaje no abre el aviso ni instala una app.

Android conserva el instructivo. Sin evento nativo se muestra completo; una cancelación o error vuelve a ofrecer la guía, sin un CTA obsoleto. Un evento que aparece más tarde habilita el botón. Mientras se espera la confirmación, el CTA queda deshabilitado; no se duplica la instalación. La resolución de una invitación anterior no cierra una nueva. iPhone conserva exactamente las instrucciones existentes.

Aceptar el diálogo no marca instalada la app. Se mantiene la confirmación por evento del navegador/apertura standalone y el estado independiente de push. El SDK recuerda una instalación confirmada y no vuelve a ofrecerla ante un evento repetido.

El SDK y la presentación tienen fuente canónica en Rey. Los cuatro gateways sirven este mismo comportamiento a Atrio y NexoBet, conservando backend, sesiones y marca de cada casino. No se necesita modificar/publicar las aplicaciones Atrio/NexoBet ni cambiar su versión visual compartida para actualizar estos recursos del host. Sus instructivos del chat directo conservan el recorrido actual. No se crea una PWA de cliente con identidad del panel.

La consulta del asesor compartido se verificó por lectura: la vinculación manual por token de API2 permite varios bots con el mismo asesor; Extensiones mantiene su ámbito de administración. No se inspeccionó inventario real del usuario. La protección de conservación de inventario de Builder no cambia.

## Verificación

- 48 escenarios de instalación en Chromium/WebKit y los cuatro gateways: aceptación, cancelación, excepción del navegador, disponibilidad tardía, iOS y reemplazo de invitación durante un aviso pendiente. Las APIs del sistema se simulan. Sin instalaciones ni cuentas reales.
- Antes del cambio, el escenario de cancelación no llegaba al estado «Entendido»: quedaba ofreciendo un evento ya consumido. Se registró el fallo contra los HEAD de base, antes de los commits del lote.
- 32 escenarios de arranque diferido, captura temprana, carga única de SDK y push aprobados; el aviso se invoca desde el CTA y la suscripción sólo se confirma después de persistirla.
- Doce comparaciones conservan el texto exacto de los instructivos para cuatro proveedores y tres plataformas.
- Suites de gateways: Rey 516 aprobadas y 11 omitidas heredadas; Ases 441, Ganamos NET 447 y Multi Skin 483 aprobadas. Siete comprobaciones adicionales de empaquetado Worker/query/backend.
- El harness de conversación ejecuta ClientChatShell real de Atrio y NexoBet con HTTP ficticio. Se actualizó para incluir el CSS importado, responder el contrato actual de visible_entry y comprobar la decisión aprobada de que una invitación explícita nueva llega aunque otra se haya pospuesto. Se conservan las comprobaciones de recordatorios y de ausencia de errores. Los service workers de este harness se simulan para evitar registros reales en dominios ficticios; su contrato se prueba en el checker diferido.
- Sin cambios de finanzas, esquema, cuentas, credenciales ni operaciones reales. No se modifica ni publica API2 o Panel3. Se conserva exactamente el receptor push que ya estaba publicado, incorporándolo a Git; los restantes cambios locales de otras tareas se excluyen. Sus siete pruebas de origen/ruta/token también aprobaron.

## Fuentes y preparación de entrega

| Gateway | Base observada en producción | Código de este lote |
| --- | --- | --- |
| Rey de Ases | 03cbe73 | 3d65a9f |
| Ases del Norte | 43f41cd | 71a31eb |
| Ganamos NET | 9baba29 | a8468f8 |
| Ganamos+ / Multi Skin | 86e8675 | 92bb411 |

Los cuatro commits se pushearon a origin/fix/template7-session-reentry. SDK e instalación se verifican con los sincronizadores --check. Se compararon los dos archivos públicos de cada proyecto Vercel y del dominio Worker con sus bases: coinciden antes de la entrega.

Para Ganamos+, la instalación temporal de dependencias falló por espacio en disco, después de que Turbopack rechazara el enlace de dependencias de un checkout aislado. El paquete Worker se preparó a partir del artefacto publicado 86e8675: servidor y resto de recursos permanecen idénticos. Se actualizaron los dos archivos de instalación y se conservó el receptor push de la publicación previa. Pasaron el dry-run de Wrangler con --keep-vars y las pruebas de empaquetado, sin ejecutar otro motor ni cambiar variables/configuración. La entrega Vercel usa su build habitual.

La comprobación adicional del receptor encontró que el código servido previamente tenía la lista de orígenes de NexoBet, aunque ese archivo seguía sin commit en los gateways. La primera promoción desde la base Git omitió ese ajuste. Se restauró su contenido publicado exacto en los cuatro repositorios y se repitió la publicación; no se diseñó otra lógica de push. Los códigos de la tabla son los finales, incluidos ambos cambios.

## Publicación final

| Proyecto | Deployment Vercel READY y promovido |
| --- | --- |
| Rey | dpl_Euft9osfUBffvu2PJ19xnvWCg57F |
| Ases | dpl_8MXcote2Leaw6EYYkd2MDMQzjJxh |
| Ganamos NET | dpl_EXYEdF2j7bCiZ4jcV4omzNjsS38V |
| Multi Skin | dpl_Kv41ACQQokw6T8dLywgdhqyuXGAo |

Ganamos+ también quedó publicado en ganamosnet.global y su workers.dev, con Worker 304438af-defd-45b0-93b4-324d7cb995cc. Los commits finales están pusheados; los checkouts principales de los cuatro gateways avanzaron sin perder otros cambios.

Se verificó que los cuatro alias públicos apuntan a los deployments de la tabla. Pasaron 60 escenarios con los recursos descargados de los cinco hosts públicos: cuatro proyectos Vercel y el dominio de Ganamos+. Se compararon hashes normalizados de SDK, cliente, CSS, receptor de push y service worker contra las fuentes finales. Las pruebas usan APIs de instalación simuladas: cero instalaciones, cuentas, notificaciones u operaciones reales. La disponibilidad y la confirmación del sistema operativo siguen dependiendo del navegador del cliente.

La conversación real pasó para ambos productos en los cuatro gateways y ambos motores: ocho casos de NexoBet; cuatro Chromium de Atrio en la primera corrida y cuatro WebKit en la repetición con el service worker ficticio estable. Se conservaron reenvíos explícitos, posposición, espera de otra interacción respondida, finalización y ausencia de ofrecimiento en modo app.

Evidencia: [48 casos locales](android-native-client-install-20261109/local-results.json), [60 públicos](android-native-client-install-20261109/public-results.json), [NexoBet completo](android-native-client-install-20261109/nexobet-results.json) y [Atrio WebKit](android-native-client-install-20261109/atrio-webkit-results.json).

Referencias para reversión del host: Rey dpl_9HZ2Jc9ituavVRKFz9Tu6FwnXUkc; Ases dpl_FPxr4qAKjFT3g7JgWu2V4zk7aC2y; Ganamos NET dpl_4uyUSP6PZd3v7fC2Z3jGyeEAPYeK; Multi Skin dpl_9uEXeaBNNRHtwpdzGkNXR9eQS5sL. Worker previo observado: 22ddf76a-2fb8-49bc-b180-4b75a251f9fc. La documentación posterior conserva el mismo runtime.
