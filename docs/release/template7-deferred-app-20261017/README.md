# Instalación y notificaciones después del ingreso

Publicado el 17/10/2026 en Atrio, los dos motores de landing y los cuatro gateways. Ganamos+ incluye Vercel y el Worker público de `ganamosnet.global`. API2 y Panel3 no se modificaron ni publicaron; no hubo migraciones en este lote.

## Prioridad del recorrido

Template 7 conserva la preparación de identidad, destino y recursos del chat. Se retiró el prefetch del SDK de instalación. Los cuatro rewriters del casino conservan la precarga del cliente del chat y retiran tanto el preload como el script inicial del SDK.

Una captura inline compartida conserva los eventos tempranos `beforeinstallprompt` y `appinstalled` en memoria. No inicia descargas, permisos ni service workers. Su fuente canónica es `landing-autologuin/src/lib/gateway-app-capture.ts`, sincronizada junto con el SDK mediante `scripts/sync-gateway-app-sdk.mjs`.

En el ingreso con intención de cargar, Atrio confirma que terminó la solicitud de billetera, que existe una tarjeta válida, que ya no está enviando ni mostrando el loader y deja pasar dos frames para pintarla. Envía únicamente booleanos mediante `atrio.widget.entry-ready`; no agrega datos bancarios al mensaje entre ventanas. El gateway valida origen y ventana del iframe, y recién entonces solicita el SDK a baja prioridad. Registro del service worker, sincronización de push e interfaz de instalación comienzan después.

El SDK no bloquea el chat, la tarjeta ni el formulario. Un fallo de descarga permite reintentar desde una acción explícita de instalar. El evento nativo de instalación capturado antes del SDK sigue siendo utilizable. El permiso de notificaciones se solicita sin un `await` previo al gesto del botón. Las invitaciones recibidas antes se conservan hasta que las funciones estén disponibles. Si no hay billetera configurada, el chat listo permite continuar; una solicitud expresa del usuario de instalar puede iniciar esas funciones a pedido.

Los eventos de visita, apertura de app y confirmación de instalación mantienen un circuito independiente del SDK. Los payloads, atribución, deduplicación y envío de Meta no se trasladaron a esta espera. Se mantuvo la prueba del Contact inicial y su deduplicación entre Pixel/CAPI.

## Corrección encontrada en la validación

La prueba real detectó React #418 al presentar los horarios del chat. Se reprodujo con el componente real: servidor en UTC y navegador en Argentina. La versión anterior calculaba las horas iniciales con la zona predeterminada de cada entorno. Esta diferencia de texto obliga a React a reconstruir el árbol, como describe su [documentación del error de hidratación](https://react.dev/errors/418).

Ahora la presentación inicial es determinista en UTC y la hora local se deriva del estado de hidratación con `useSyncExternalStore`, antes de quitar el loader. No se reescribe el estado de los mensajes desde un efecto ni se ocultan las advertencias con `suppressHydrationWarning`. Las horas siguen siendo locales en el navegador; IDs, mensajes, comprobantes, saldos y timestamps persistidos se conservan.

La comparación local con el componente completo reprodujo el error anterior en Chromium y WebKit con zona Argentina y confirmó su ausencia tras la corrección, tanto en Argentina como UTC. Todo el tráfico de esa prueba es interceptado y sus datos son sintéticos.

## Validación

- Pruebas de los gateways: Rey 126 correctas y 2 omitidas, Ases 69, Ganamos NET 78, Ganamos+ 71. SDK compartido: 8 correctas, incluyendo la captura anterior a su descarga.
- Constructor: 10 pruebas focalizadas, incluyendo conservación de Contact y deduplicación. Bundle clásico sincronizado. Compilaciones de los siete proyectos y del Worker correctas; TypeScript y ESLint del componente de Atrio correctos.
- Navegadores: 32 casos con los cuatro rewriters y clientes reales, Chromium/WebKit, APIs simuladas de Android/iOS y SDK lento/rápido. No hay solicitudes del SDK ni registro de SW antes de la billetera; se rechazan señales de origen incorrecto o de datos todavía pendientes. Una señal repetida no duplica la descarga.
- Otros 24 casos verifican ausencia de billetera, solicitud explícita de instalación y reintento después de fallar la descarga del SDK. Se mantiene el aviso nativo desde el CTA, el orden permiso/suscripción/guardado y el evento de instalación capturado previamente.
- Los cuatro clientes siguen iniciando el iframe con CSS y JavaScript del casino retenidos. No se reinstaló una dependencia del SDK ni la espera fija para ingresar.
- Producción: ambos HTML públicos omiten el prefetch del SDK; hashes del cliente, SDK, SW e íconos coinciden con las fuentes de los cuatro casinos. Los siete proyectos quedaron en producción y el Worker público fue actualizado.
- Recorrido real con la cuenta de prueba existente del manager 1035: recuperación, login confirmado, tarjeta con CBU visible y chat habilitado, más reingreso con sesión. Se verifica que el SDK y el registro del SW empiezan después de la señal de datos listos. No se crean cuentas ni se mueven fichas.

Los resultados y despliegues exactos están en [validation.json](./validation.json). La prueba real es de Rey de Ases; las pruebas interceptadas de los otros tres gateways no certifican un alta real en cada proveedor. Las APIs simuladas de instalación/push no sustituyen una validación en teléfonos físicos. Las muestras temporales no son promedios ni una comparación controlada de velocidad; este lote certifica el orden de las tareas.

## Repetir las pruebas

Desde `landing-builder`, con Playwright y sus navegadores disponibles (instalación local o `PLAYWRIGHT_MODULE_PATH`):

```sh
node scripts/sync-gateway-app-sdk.mjs --check
node scripts/build-classic-template7.mjs
node scripts/check-deferred-gateway-app.mjs
node scripts/check-client-chat-hydration.mjs
```

Las evidencias detalladas y los checkpoints privados de la cuenta de prueba permanecen bajo `.vercel/release-20261017-deferred-app`. No se publican cookies, tokens, credenciales ni datos bancarios en este documento.
