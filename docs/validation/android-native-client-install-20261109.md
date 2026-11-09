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
- Sin cambios de finanzas, esquema, cuentas, credenciales ni operaciones reales. No se modifica ni publica API2 o Panel3. Los cambios locales preexistentes de push y de otras tareas se excluyen.

## Fuentes y preparación de entrega

| Gateway | Base observada en producción | Código de este lote |
| --- | --- | --- |
| Rey de Ases | 03cbe73 | 62950ef |
| Ases del Norte | 43f41cd | 0c2cde4 |
| Ganamos NET | 9baba29 | 56b7dd5 |
| Ganamos+ / Multi Skin | 86e8675 | c11776b |

Los cuatro commits se pushearon a origin/fix/template7-session-reentry. SDK e instalación se verifican con los sincronizadores --check. Se compararon los dos archivos públicos de cada proyecto Vercel y del dominio Worker con sus bases: coinciden antes de la entrega.

Para Ganamos+, la instalación temporal de dependencias falló por espacio en disco, después de que Turbopack rechazara el enlace de dependencias de un checkout aislado. El paquete Worker se preparó a partir del artefacto ya publicado 86e8675 y sólo se reemplazaron assets/gateway-app-sdk.js y assets/gateway-client.js. Una comparación de todos los archivos confirma servidor y resto de recursos idénticos. Pasó el dry-run de Wrangler con --keep-vars, sin ejecutar otro motor ni cambiar variables/configuración. La entrega Vercel usa su build habitual. La publicación y la comprobación de recursos públicos se registran al terminar.
