# Template 7, Atrio y gateways: medición y optimización

Publicado el 16/10/2026 en Argentina; mediciones del 17/10 en UTC. API2 permanece en local, sin push, despliegue ni migraciones productivas. Los cambios se publicaron desde snapshots de los árboles locales, sin commits ni pushes.

## Comportamiento publicado

- Los cuatro gateways ingresan apenas termina el login confirmado. Se eliminó la espera mínima de cuatro segundos para leer/copiar el usuario. Esa espera antes se solapaba con parte del trabajo del servidor: eliminarla no implica ahorrar cuatro segundos completos en cada acceso.
- El cliente de Atrio se carga con `async` al final del body del casino. No depende de la ejecución de sus scripts `defer` o módulos. Conserva el montaje del iframe antes de asignarle `src`, necesario para iOS/WhatsApp.
- Atrio consulta identidades independientes en paralelo y valida sus vínculos antes de devolver datos o escribir actividad. Conversación, accesos rápidos y billetera se consultan en paralelo. Las actualizaciones de actividad se ejecutan con `after`, después de responder; la conversación y su bienvenida siguen disponibles antes de consultar los mensajes.
- El mismo código de gateway sirve a los motores constructor y clásico. Landing Builder y el motor clásico no necesitaron otro despliegue de código en este lote.
- Ganamos+ también se actualizó en el Worker `multi-skin-gateway`, que sirve `ganamosnet.global`.

## Mediciones reales

Landing normal: `https://mkt.panelbotadmin.com/l/rey-de-ases-demo`. Casino: `https://www.reydeases.fun`. Manager **1035**, asesor Gera. Chromium local con viewport 390 × 844, sin limitar CPU ni red; no representa una prueba de teléfono físico ni de 4G.

Formulario se mide desde la navegación inicial; usuario, casino y chat desde el clic. En el reingreso con sesión, los tiempos empiezan al navegar a la landing. “Chat listo” exige un campo habilitado e hidratado por React dentro del iframe real. No se enviaron mensajes ni se confirmaron movimientos de fichas.

| Escenario | Formulario | Usuario visible | Casino | Chat listo |
| --- | ---: | ---: | ---: | ---: |
| Antes: recuperar cuenta, sin cookie del gateway | 1,01 s | 2,79 s | 7,85 s | 11,52 s |
| Antes: crear una cuenta real | 0,74 s | 3,59 s | 8,62 s | 12,16 s |
| Final: recuperar cuenta existente | 1,04 s | 2,90 s | 6,21 s | 9,64 s |
| Final: recuperar la cuenta creada en la medición inicial | 0,89 s | 2,59 s | 6,48 s | 8,56 s |
| Final: reingreso con sesión, muestra 1 | — | — | 1,48 s | 2,90 s |
| Final: reingreso con sesión, muestra 2 | — | — | 1,04 s | 2,39 s |

Los accesos finales confirmaron además `status === 0` en `/api/user/check`. Se creó **una sola cuenta adicional** para medir el alta inicial; no se repitió su creación para medir el estado final. La recuperación de esa cuenta es recuperación, no otra medición de alta. El primer muestreo anterior al ajuste del criterio de hidratación se conserva separado y no se usa como comparación equivalente.

Son muestras pequeñas con cachés y latencias variables, no percentiles ni una garantía de tiempo. Una etapa intermedia tuvo 14,32 s hasta el chat y otra 10,26 s; se conservan en el JSON. Los dos accesos finales quedaron entre 8,56 y 9,64 s. El reingreso conserva tiempos del mismo orden que antes. **El recorrido todavía no es instantáneo.**

Dos repeticiones demasiado próximas con la misma identidad recibieron **429** en `/api/preparations/complete`, confirmado por los logs de Vercel. El constructor protege el inicio con una ventana de 45 segundos por landing/dispositivo. Esas ejecuciones se registran como rechazadas, no como tiempos exitosos; no se cambió ni desactivó el límite para medir. La primera no capturó la respuesta pendiente en el navegador, pero su 429 se recuperó del log del servidor.

Los logs de Atrio mostraron 260–499 ms para el bootstrap de servidor en las muestras iniciales posteriores al cambio. Ese valor no incluye la carga del casino, el montaje del iframe ni la hidratación del navegador. El login externo medido en una muestra tomó 1,76 s. Aún hay latencia del proveedor y del navegador fuera de ese bootstrap.

## Validación

- Gateways: 338 pruebas correctas, dos omisiones preexistentes y typecheck correcto en los cuatro repositorios. Después del ajuste de scripts se repitieron las pruebas de los cuatro rewriters y sus typechecks.
- Atrio: typecheck, ESLint de los archivos modificados y 41 pruebas de identidad/vínculo/credenciales correctas. Se actualizó una comprobación textual que dependía del formato de una llamada y del nombre anterior de su filtro; las pruebas de comportamiento comprueban el aislamiento.
- Bootstrap real de Atrio con almacenamiento aislado: siete comprobaciones, incluyendo consultas concurrentes, rechazo de otro asesor/jugador/proveedor y una sola conversación/bienvenida ante concurrencia.
- Prueba de navegador de los cuatro clientes y rewriters reales: el iframe empieza a cargar mientras el script del casino sigue retenido. Toda la red se intercepta.
- Flujo integrado local: 13/13; matriz de reingreso en ambos motores y cuatro proveedores: 32/32. Estas pruebas no usan cuentas ni bases productivas.
- Builds productivos de Atrio y los cuatro gateways correctos; build y publicación de OpenNext/Cloudflare correctos. Los cuatro dominios responden 200 en salud y preparación, sin temporizador fijo, y 303 en reingreso sin sesión hacia una landing permitida.

Desde `landing-builder/frontend`:

```powershell
node --import tsx scripts/template7-chat-bootstrap-check.ts
node --import tsx scripts/template7-widget-load-browser-check.ts
node --import tsx scripts/template7-local-flow-check.ts --api2-repo C:/Users/Leo/Documents/GitHub/api2
node --import tsx scripts/template7-reentry-browser-check.ts
```

La medición productiva privada está en `.vercel/release-20261017-performance/measure.mjs`. Recupera una identidad de prueba ya existente; su checkpoint de creación impide repetir el alta accidentalmente. Se bloquearon las solicitudes del navegador a Pixel/Analytics y a `/api/track`/`journey-start`; la ruta normal `atrio-click` sí pudo incrementar su contador de uso. Este ensayo no certifica LEAD/PURCHASE/CAPI ni sus efectos de servidor. No se hicieron cargas, retiros ni PURCHASE de prueba.

## Despliegues y pendientes

[production-validation.json](production-validation.json) contiene IDs, hashes de manifiestos, dominios y resultados. [measurements.json](measurements.json) conserva las etapas y los fallos sin cookies, credenciales, tokens, IDs de dispositivo ni URLs firmadas. Los snapshots y detalles privados permanecen en `.vercel/release-20261017-performance` y `.vercel/release-20261017-performance-async`.

API2 sigue en `fix/atrio-bot-form`. El programador debe publicar el lote acumulado y aplicar **tres** migraciones pendientes (estado actualizado después del trabajo de múltiples managers):

1. `20261016000001_create_atrio_player_provisions.ts`.
2. `20261016000002_create_atrio_confirmed_load_notifications.ts`.
3. `20261017000001_allow_multiple_atrio_managers.ts`.

Esta optimización no agregó otra migración. Las correcciones locales de API2 y sus pruebas no certifican que ya estén publicadas. Los cambios de Panel3 que necesitan ese backend continúan pendientes de ese despliegue.

## Preparación anticipada y medición de altas: 17 de octubre UTC

Esta segunda publicación actualiza los resultados y el comportamiento anteriores. Incluye Atrio, constructor, motor clásico y los cuatro gateways; Ganamos+ también en Cloudflare. API2 no se modificó ni publicó en este trabajo.

Mientras se completa el nombre, el constructor y el motor clásico llaman a `/api/template7/warm`. El servidor valida la identidad, la asignación del asesor y la ruta persistida de manager/landing/casino. Atrio reserva identificadores en una tabla privada, sin crear usuarios ni conversaciones. La reserva vence a los 15 minutos; un cron elimina las vencidas cada cinco minutos. Al confirmar el nombre se revalida la relación y se aprovecha la reserva. Si ya venció o cambió la asignación, funciona la resolución habitual. La limpieza nunca elimina jugadores o chats.

La respuesta privada de cuenta del constructor ahora incluye la finalización del vínculo y el handoff, evitando otra ida y vuelta del navegador. Los gateways precargan el código real del chat durante su pantalla de preparación, sin montarlo ni crear conversaciones. El cliente del widget se descubre al principio del body del casino y conserva la precaución de montaje para iOS. En una traza productiva, los principales JS/CSS del chat ya estaban en caché al abrir su iframe. Esto no elimina los tiempos del login externo, la respuesta del casino ni la hidratación del chat.

Migraciones aplicadas en Atrio:

1. `20261017023054_gateway_entry_preparations.sql`.
2. `20261017023104_schedule_gateway_preparation_cleanup.sql`.

El cron de limpieza registró tres ejecuciones correctas y ninguna fallida al verificar. Los avisos de seguridad conservan los 11 hallazgos preexistentes de funciones accesibles para anon, los 23 para authenticated y el aviso de protección de contraseñas. El único nuevo aviso informativo es [RLS sin políticas](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) en la tabla de reservas: es intencional, con acceso revocado a anon/authenticated y operaciones permitidas solo a service_role. Se verificaron los rechazos de acceso público.

### Tres altas nuevas en Rey de Ases

Se crearon tres cuentas nuevas reales del manager **1035**, gerencia operativa **272**. No se enviaron mensajes ni se movieron fichas. Las tres esperaron a que la preparación inicial estuviera lista antes de confirmar el nombre, simulando el tiempo de escritura; esa espera no forma parte del tiempo desde el clic. La creación de cuenta se mide en el servidor mediante `Server-Timing`, separada de la resolución de Atrio, el vínculo y el login.

| Muestra | Formulario desde navegación | Creación API2 | Casino desde clic | Chat utilizable desde clic |
| --- | ---: | ---: | ---: | ---: |
| 1 | 0,88 s | 1,84 s | 7,22 s | 9,87 s |
| 2 | 0,86 s | 1,65 s | 6,17 s | 8,69 s |
| 3 | 0,67 s | 1,69 s | 5,42 s | 8,07 s |
| Promedio | **0,80 s** | **1,73 s** | **6,27 s** | **8,88 s** |

Una recuperación con preparación lista midió 0,27 s en API2 y 5,48 s hasta el chat. Los reingresos de estas cuatro muestras, con sesión válida, midieron 1,71–2,15 s hasta el chat. Una ejecución inicial de recuperación sin precarga observada midió 10,70 s y se conserva separada; no se trata como equivalente a las muestras preparadas.

No se infiere un percentil ni una garantía de estos datos. La suma restante incluye resolución/vínculo de cuenta, varias solicitudes entre servidores, login y carga de la página del casino/widget. La traza de recuperación mostró 1,28 s en `/start` y aproximadamente 0,8 s entre la navegación al casino y el montaje del iframe; no son promedios de alta. **La creación de cuenta no es el mayor componente del tiempo total.**

Ases del Norte, Ganamos+ y Ganamos NET tienen desplegadas y verificadas las mejoras comunes. Sus tiempos reales de creación siguen pendientes de managers de prueba que el usuario creará. No se habilitó un pool ni se eligió todavía un timeout para cuentas precreadas; tres altas de una sola página no permiten fijar ese umbral para todas.

### Validación de esta actualización

- Pruebas de preparación/finalización y warm del constructor: 13 correctas. Pruebas del endpoint privado de Atrio correctas.
- PostgreSQL real y aislado: reserva repetida estable, ausencia de chat/jugador anticipado, consumo de identificadores reservados, conservación del jugador tras limpiar reservas, permisos y concurrencia de identidad/manager correctos.
- Pruebas enfocadas de gateways: 20 en Rey de Ases y ocho en cada uno de los otros tres. Prueba de navegador con scripts del casino retenidos: correcta en los cuatro.
- Renderer compartido: paridad con clásico y matriz de cuatro casinos en ambos motores correctas; templates 1–6 conservan su HTML.
- Typechecks y builds de las siete aplicaciones correctos; build/publicación de Cloudflare correctos.
- Producción: warm y reintento idempotente en ambos motores, rechazo de otro origen, reserva sin usuario/chat, validación de las tres cuentas creadas, endpoint privado sin autorización rechazado y salud/preparación correctas en los cuatro dominios.

Evidencia sin credenciales ni identificadores de dispositivo: [prewarm-measurements.json](prewarm-measurements.json) y [prewarm-production-validation.json](prewarm-production-validation.json). Los scripts, trazas detalladas y snapshots privados están en `.vercel/release-20261017-prewarm`. Se bloquearon Pixel y parte del tracking del navegador; las visitas y otros efectos normales del servidor no se consideran desactivados ni esta medición valida CAPI.

## Correcciones de regresiones y persistencia: 17 de octubre UTC

Esta actualización reemplaza las descripciones anteriores del logo compacto y del retorno inmediato sin cookie en `/resume`. El contrato vigente está en [Decisiones aprobadas](../../DECISIONES_APROBADAS_ATRIO_TEMPLATE7_GATEWAYS.md), enlazado desde los `AGENTS.md` de las siete aplicaciones. API2 permanece exclusivamente local; este trabajo no agregó migraciones.

La landing conserva un respaldo cifrado de su identidad y verifica que el navegador aceptó la cookie antes de habilitar el alta. Si ya existe una cuenta para su asesor, manager y casino, la preparación recupera esa cuenta sin pedir otro nombre. Los gateways conservan un respaldo cifrado de la sesión, recuperan la cookie desde una página del propio dominio y revalidan su vigencia. Una cookie válida prevalece sobre un respaldo antiguo; no se recuperan sesiones revocadas. La entrada directa abre el chat. Estos cambios no identifican un teléfono cuando el navegador borra o aísla todo su almacenamiento.

Las transiciones recuperaron logos grandes y resplandor suave, con tema oscuro y `viewport-fit=cover`. El botón real de saldo de Atrio mantiene una sola etiqueta mientras consulta. Los logos se entregan como AVIF con fallback WebP; se conservan los PNG de instalación y los originales. El inventario de 14 derivados principales pasó de 5.347.143 a 295.920 bytes; no es una medición del peso transferido de una página y no incluye los fallback. El logo de Ganamos NET conserva su WebP de 9.242 bytes porque convertirlo aumentaba su peso. El preloader del casino Rey de Ases se negocia como AVIF y los avatares públicos del asesor se reducen con negociación AVIF/WebP; los comprobantes y adjuntos privados permanecen intactos.

Se publicaron Atrio, constructor, motor clásico y los cuatro gateways, incluyendo el Worker que sirve Ganamos+. [regressions-20261017.json](regressions-20261017.json) registra los siete despliegues, hashes de sus manifiestos, versión de Cloudflare, comprobaciones públicas y evidencia sin credenciales ni URLs firmadas.

La prueba **real en producción con WebKit Windows** recuperó una cuenta existente sin escribir nombre ni tener cookie del gateway, reabrió la landing tres veces, entró por el dominio sin `www`, recuperó una cookie perdida y restauró la identidad de la landing desde su respaldo. Las siete comprobaciones confirmaron el login del casino y un campo de chat habilitado. No se crearon cuentas ni se movieron fichas en esta ronda; se utilizó una cuenta de prueba existente. La identidad inicial se suministró al contexto de prueba para seleccionar esa cuenta; no equivale a demostrar conservación del almacenamiento de una ventana de WhatsApp.

En WebKit aislado se verificaron las reaperturas y recuperación de cookies en los cuatro gateways, además del componente real de saldo con respuesta demorada. Se revisaron tamaño y proporción de los cuatro logos, ausencia de desbordamiento y metadatos oscuros. La matriz Chromium de reingreso pasó 32/32 y los controles de carga inicial mantuvieron el HTML de templates 1–6. La comprobación pública final confirmó salud, preparación y recuperación en los cuatro dominios, rechazo de otro origen, avatar negociado como AVIF y preloader AVIF.

**Pendiente:** comprobar cerrar y reabrir la ventana interna de WhatsApp en un iPhone físico. WebKit Windows no reproduce las políticas de almacenamiento de esa aplicación. Si desaparecen tanto cookies como localStorage, hace falta una recuperación verificada o un navegador con almacenamiento persistente; no se puede prometer reconocimiento físico automático. Los tiempos de creación/login de los otros tres casinos siguen pendientes de sus managers de prueba.

### Validación manual del usuario en Safari

El usuario informó el 17/10/2026 que creó una sola cuenta (`probando3540`) al abrir Template 7 directamente en Safari. Luego cerró la pestaña y reabrió Template 7: ingresó al gateway con la misma cuenta. También accedió directamente al gateway y conservó el usuario. Son dos reingresos manuales exitosos reportados por el usuario. No se ejecutaron otras altas o movimientos para registrar esta evidencia. El escenario de cerrar y reabrir la ventana interna de WhatsApp permanece pendiente y no se considera validado por esta prueba.
