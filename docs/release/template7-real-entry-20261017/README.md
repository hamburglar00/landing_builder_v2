# Template 7: ingreso real, preparación y chat

Publicado el 17/10/2026 en Atrio, Landing Builder, el motor clásico y los cuatro gateways. Ganamos+ incluye su Worker de Cloudflare, que sirve `ganamosnet.global`. API2 y Panel3 no se modificaron ni publicaron en este lote. No se crearon commits ni pushes.

## Comportamiento publicado

- Se retiraron las rutas `/testing`, su runtime, cuentas compartidas configurables y endpoints privados de handoffs de prueba. Todos los ingresos crean o recuperan la cuenta real mediante API2. Un fallo no sustituye la cuenta. Se conservaron jugadores y mensajes históricos; las preparaciones antiguas marcadas como demo se rechazan.
- Template 7 conserva el formulario y su runtime inicial. Después de dos frames comienza la preparación opcional de recursos del gateway y del chat. Esa preparación no crea cuentas, conversaciones ni conversiones antes de confirmar el nombre. Las reservas de identidad existentes conservan su vencimiento y limpieza.
- El SDK y cliente de los cuatro gateways cargan asíncronos. El cliente monta el chat sin esperar el SDK ni los scripts del casino; al llegar el SDK se inicializan instalación y notificaciones. Se conserva la compatibilidad con una copia anterior del SDK en caché y el gesto del usuario para solicitar permisos nativos.
- El iframe se monta antes de asignarle `src`. La navegación ocurre en el siguiente frame con un timer de respaldo de 100 ms y una guarda para ejecutarla una sola vez. Así el CSS lento del casino no retiene el comienzo del chat.
- Atrio valida y prepara el chat con una sola RPC de servidor: asesor, jugador, cuenta, conversación, bienvenida, accesos rápidos y últimos 50 mensajes. Conserva la separación entre casinos y chat directo, el aislamiento entre asesores y una sola conversación/bienvenida ante concurrencia.
- El indicador de conexión del inbox se ancla al tamaño fijo del avatar, en móvil y escritorio. Las etiquetas pueden crecer sin desplazarlo.
- Ambos motores de Template 7 solicitan `creation_mode: "create_only"` para Ganamos NET. La implementación nueva de API2 sigue local; la API completa existente de Ganamos no se eliminó ni modificó en este lote. No se certifica aquí que producción esté ejecutando las optimizaciones locales de API2.

La migración de Atrio `20261017212342_atomic_gateway_chat_bootstrap.sql` se probó en PostgreSQL aislado y se aplicó a Atrio. La RPC usa `SECURITY INVOKER`, `search_path` vacío y permisos únicamente para `service_role`. También retira la RPC de identidad compartida de demo; no borra datos históricos. No se aplicaron migraciones de API2.

## Medición productiva

Alta real en Rey de Ases, manager 1035, Chromium con viewport móvil 390 × 844, sin limitar CPU/red y esperando que terminara el prewarm. Cada columna es **una muestra**, no un promedio. Los tiempos posteriores al formulario parten del clic de confirmación del nombre.

| Etapa | Antes del lote | Publicación final |
| --- | ---: | ---: |
| Formulario disponible desde abrir el enlace | 2,44 s | 1,95 s |
| API2: creación de cuenta aislada | 2,04 s | 1,69 s |
| Cuenta visible en la transición | 6,12 s | 4,94 s |
| Navegación al casino | 9,53 s | 7,79 s |
| Chat embebido hidratado y compositor habilitado | 15,02 s | 8,83 s |
| Reingreso con sesión: chat utilizable desde abrir la landing | 1,96 s | 1,79 s |

Una publicación intermedia midió 11,21 s hasta el chat. La medición posterior incluye el ajuste de navegación del iframe ante CSS pendiente. Se confirmó el login mediante el endpoint real del casino; no se usó como sustituto una navegación directa al documento del widget. No hubo cargas, retiros ni apuestas. Las cuentas de prueba pueden generar su bienvenida y atribución normales del lado del servidor.

La línea base nueva no reemplaza las mediciones históricas de 8–10 s: servicios, red y cachés varían. Estos resultados no demuestran un promedio ni garantizan entrada instantánea. La porción más larga que queda está antes de navegar al casino: resolver el ingreso entre servicios y autenticar al proveedor. Las optimizaciones locales de API2 no participaron de esta publicación.

## Validación y cobertura

- Gateways: Rey 126 pruebas correctas y 2 omitidas; Ases 69, Ganamos NET 78 y Ganamos+ 71 correctas. Compilaciones productivas de los siete proyectos y del Worker correctas.
- Pruebas focalizadas: constructor 53, motor clásico 8, Atrio 45 y SDK compartido 7 correctas. TypeScript validado en los siete proyectos; el constructor se volvió a comprobar después de actualizar la prueba permanente de scripts y CSS pendientes.
- PostgreSQL aislado: siete grupos de comprobaciones, incluyendo aislamiento por asesor/cuenta/skin, historial acotado, permisos de roles y ocho aperturas simultáneas con una sola conversación y bienvenida.
- Navegador: 32 combinaciones entre los cuatro clientes, Chromium/WebKit, SDK temprano/tardío y APIs simuladas de Android/iOS; dos casos adicionales con SDK antiguo en caché; 12 comprobaciones de geometría del avatar con etiquetas.
- CSS retenido: ocho casos Chromium/WebKit de los cuatro clientes. El inicio del iframe pasó de 1,83–1,87 s a 0,15–0,19 s con una demora controlada de 1,80 s en CSS. La prueba permanente usa los cuatro rewriters reales y mantiene pendientes tanto CSS como JavaScript del proveedor hasta que empieza el chat.
- Producción: hashes del SDK, cliente, service worker e íconos iguales a las fuentes de los cuatro casinos; manifests e íconos correctos. Las rutas de demo devuelven 404 y los antiguos endpoints privados ya no ofrecen el handler de prueba. Solo `/embed/warm` admite los orígenes de las landings; el chat firmado conserva sus restricciones originales.

La medición completa con una cuenta nueva se hizo en Rey de Ases. Las pruebas interceptadas y la verificación de publicación de los otros tres gateways no certifican una nueva alta real de cada proveedor. Los permisos nativos simulados en WebKit/Chromium tampoco sustituyen una prueba en teléfonos físicos ni certifican persistencia entre ventanas internas de WhatsApp.

Evidencia sin credenciales: [validation.json](./validation.json). Los checkpoints con identidad de las pruebas y las trazas completas permanecen en el directorio privado e ignorado `.vercel/release-20261017-fast-real-entry`; no se publican en este documento.

Verificaciones reproducibles desde `landing-builder`:

```sh
node scripts/sync-gateway-app-sdk.mjs --check
node scripts/build-classic-template7.mjs
cd frontend
node --import tsx scripts/template7-widget-load-browser-check.ts
```

Decisiones que deben conservarse: [registro aprobado](../../DECISIONES_APROBADAS_ATRIO_TEMPLATE7_GATEWAYS.md).
