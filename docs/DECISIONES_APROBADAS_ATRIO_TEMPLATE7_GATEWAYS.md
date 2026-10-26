# Decisiones aprobadas de Atrio Template 7 y gateways

Actualizado el 23 de octubre de 2026. Este registro conserva los requisitos acordados con el usuario para que una mejora no elimine comportamientos ya aprobados. Se aplica a `landing-builder`, `landing-prueba-1`, `internal-chat`, `landing-autologuin`, `ases-gateway`, `ganamos-gateway` y `multi-skin-gateway`. API2 conserva su propio lote local.

Una decisión nueva reemplaza una anterior solo cuando el usuario cambia explícitamente ese requisito. Registrar el cambio aquí y verificar los comportamientos relacionados antes de publicar. Un build correcto o una prueba con sesión insertada artificialmente no demuestran que el navegador real conserve la cuenta.

Última publicación del ingreso real y retiro de bypass: [alcance, mediciones y validación del 17/10](./release/template7-real-entry-20261017/README.md). API2 y Panel3 permanecen locales.

SDK y notificaciones pospuestos hasta los datos de carga, junto con la corrección de hidratación de horarios: [publicación y pruebas del 17/10](./release/template7-deferred-app-20261017/README.md). Para cambios posteriores en este arranque, ejecutar `scripts/check-deferred-gateway-app.mjs` y `scripts/check-client-chat-hydration.mjs`, además de la sincronización del SDK y la prueba con CSS/JavaScript del casino retenidos.

## Regla obligatoria para mejoras compartidas en gateways

### Alcance confirmado por el usuario el 19/10, durante las pruebas posteriores al despliegue

Ganamos+ **no está integrado en PBAdmin y no tiene managers**. No equipararlo con Ganamos NET por el nombre o por una coincidencia de plataforma: la plataforma 2 de PBAdmin se vincula únicamente con Ganamos NET. No ofrecer Ganamos+ como elección de manager ni crear una cuenta de NET para ese destino. El recorrido real de alta por API2 se valida en Rey de Ases, Ases del Norte y Ganamos NET; el alta de Ganamos+ queda pendiente de una integración propia. Las mejoras comunes de UI, chat, instalación y notificaciones siguen aplicándose a los cuatro gateways.

El botón «Usar en accesos directos al gateway» selecciona la ruta sin landing para cuentas nuevas de ese asesor y casino. No reasigna cuentas existentes ni reemplaza el destino explícito de una landing. Si no hay contexto que identifique al asesor, ese botón no habilita por sí solo un alta anónima desde el dominio del gateway.

En las operaciones manuales de Atrio, un HTTP 2xx no constituye prueba de acreditación o descuento. Para Rey se exige el recibo del proveedor con transacción, jugador, tipo, importe y saldo posterior coincidentes. Un retiro con saldo posterior contradictorio queda en revisión, conserva su clave y bloquea otra operación sobre ese jugador. Persistir la evidencia; no repetir el POST ante una respuesta incierta. No modificar los métodos usados por los bots anteriores ni el motor de HG Cash. Estas correcciones de API2 quedan locales y no necesitan nuevas migraciones.

Las mediciones del recorrido deben permitir reutilizar los recursos precargados con la caché normal del navegador. Si la automatización desactiva la caché al interceptar solicitudes, indicarlo y no atribuir sus tiempos al comportamiento normal del prewarm. Medir con contexto nuevo y conservar la identidad al reintentar una prueba.

La pantalla de Configuración debe mostrar el mismo HTML inicial en servidor y navegador antes de consultar permisos de notificaciones. Leer capacidades del navegador después de hidratar; la comprobación no solicita permisos automáticamente.

LEAD conserva su disparador de primer mensaje del cliente. Los avisos push y Telegram se ejecutan independientemente del envío de tracking; su lentitud o rechazo no pueden impedirlo. Si landing-builder procesa un LEAD pero la respuesta llega después del timeout, recuperar la misma entrega persistida con el mismo `action_event_id`, fecha y payload. No generar otro LEAD por el siguiente mensaje para reemplazar una entrega fallida. Usar una reserva en DB para impedir reintentos simultáneos, conservar la pertenencia al administrador y recuperar entregas pendientes abandonadas. El reintento inmediato corre después de responder; el cron existente conserva un respaldo acotado.

La emisión del pase de transición comparte un módulo liviano para las páginas: criptografía, identidad, validación y selección del gateway, sin cargar servicios de DB o creación. El pase conserva el formato y las comprobaciones de integridad, expiración y ownership del flujo completo. Esta separación no habilita ningún bypass.

Excepción del proveedor Ases del Norte: el HTML original invoca jQuery desde su LiveChat anterior antes de cargarlo; ese bloque ya reemplazado por Atrio se retira del gateway. Su `main.js` también llama una API de placeholders que el módulo actual no expone: conservar la llamada y sus opciones solo cuando esa API exista. No aplicar cambios de ese script PHP a los casinos con otro proveedor.

Toda mejora compartida debe aplicarse y verificarse en los cuatro gateways en el mismo lote: Rey de Ases (`landing-autologuin`), Ases del Norte (`ases-gateway`), Ganamos NET (`ganamos-gateway`) y Ganamos+ (`multi-skin-gateway`). No darla por terminada tras actualizar un solo casino. Esto incluye ingreso y recuperación, transición, imágenes, instalación, permisos y notificaciones, chat y sus recursos/configuración.

- Antes de editar, identificar qué parte es común y qué depende del proveedor. Priorizar módulos compartidos; no copiar contratos de autenticación incompatibles entre casinos.
- El SDK común tiene como fuente `landing-autologuin/public/gateway-app-sdk.js`. Ejecutar `node scripts/sync-gateway-app-sdk.mjs` desde `landing-builder` al cambiarlo y `node scripts/sync-gateway-app-sdk.mjs --check` antes de publicar. No editar sus cuatro copias por separado.
- Cuando la funcionalidad reside en Atrio, los cuatro gateways utilizan la misma implementación: modificarla una vez allí y verificar su integración. Para las demás piezas repetidas, mantener sincronizadas las implementaciones y registrar la cobertura de los cuatro casinos; extraer lógica común cuando pueda hacerse sin alterar los contratos de cada proveedor.
- La validación debe registrar por casino qué código/configuración cambió, qué se verificó y qué se publicó. Ganamos+ incluye tanto Vercel como el Worker que sirve su dominio público. Un despliegue de Vercel por sí solo no acredita que el Worker esté actualizado.
- Si existe una excepción propia de un proveedor, documentar su motivo y verificar que los demás conservan su comportamiento. La creación separada de Ganamos NET no cambia el acceso de Ganamos+ ni reemplaza la API completa existente.
- API2 continúa exclusivamente en local hasta autorización explícita para publicar ese lote. Esta regla no autoriza su despliegue.

## Identidad y acceso

### Selección de landing por URL (19/10/2026)

El motor constructor admite `?landing=<slug>` en la raíz, `/l` y `/l/<slug>`;
el parámetro tiene prioridad sobre la ruta, igual que en el motor clásico.
Resolver mediante reescritura interna antes del HTML, conservar atribución y
caché por la landing seleccionada, y mostrar la explicación en ambos editores
para los dos motores. No aplicar esta selección al panel, API, promociones o
recursos. Sin parámetro o con uno vacío, conservar el comportamiento anterior;
valores inválidos, repetidos o una landing inexistente devuelven 404. Template 7
conserva su identidad y el destino configurado en la landing seleccionada.

La comprobación de sesión de Template 7 debe regresar a la ruta canónica de
la landing que realmente se renderizó, también si el ingreso fue por la raíz,
`/l` u otra ruta con `?landing=...`. El gateway recibe solo esa ruta y el nonce
de retorno. Al volver sin sesión, restaurar la URL original y su atribución
desde el almacenamiento del mismo origen, sin cambiar la landing, el asesor
o el casino ni emitir otro Contact por la comprobación de sesión.

### Origen publicitario por URL (19/10/2026)

Los templates 1 a 7, en clásico y constructor, admiten `facebook`, `portofolio`
y `cp` (con esa escritura exacta). Identifican el Facebook, portofolio y cuenta
publicitaria usados en el anuncio. Los valores los proporciona el enlace;
pueden ser nombres o IDs y se guardan como texto en `conversions`, conservando
ceros iniciales. No inferirlos del usuario que abre la landing.

Conservar el origen del contacto cuando se vinculan Lead, CompleteRegistration
y Purchase, incluidas compras recurrentes. Un evento posterior no reemplaza
un dato original ya conocido; puede completar un campo faltante. Valores
ausentes permanecen NULL, sin inventar atribución histórica.

En las tablas de conversiones de Admin y cliente, el orden es Landing,
Resolución de landing, Facebook, Portofolio, Cuenta publicitaria, Campaña, Conjunto de anuncios y
Anuncio. Incluir los tres campos en búsqueda y exportación y en la ayuda del
editor. Template 7 usa la misma captura para Rey de Ases, Ases del Norte,
Ganamos NET y Ganamos+, sin cambiar su identidad ni acceso.

Al crear un cliente, Facebook, Portofolio y Cuenta publicitaria quedan
desmarcadas por defecto; el administrador puede habilitarlas. Las vistas
reducida y técnica incluyen estas columnas cuando están habilitadas para el
cliente. La ayuda del editor no muestra la explicación de persistencia ni
compatibilidad con `utm_campaign`.

### Resolución de landing (19/10/2026)

Registrar en `conversions.landing_resolution` cómo se eligió la landing original:
`url_parameter` (Parámetro URL), `path` (Ruta) o `automatic` (Automática).
El parámetro `landing` tiene prioridad, incluso desde la raíz. La selección
automática corresponde exclusivamente al fallback del clásico; el constructor
conserva el login en la raíz sin selección. Capturar el resultado antes de perder
el origen en redirecciones y conservarlo en Lead, CompleteRegistration y Purchase.
No inferir datos históricos desde la URL de un evento posterior: mostrar «Sin dato».
La columna va inmediatamente después de Landing en ambas vistas y exportación.
Su visibilidad inicial acompaña a Landing; el administrador puede configurarla.
La marca interna del fallback clásico se consume al capturar el dato y no es un
parámetro publicitario para configurar en los anuncios.

| Decisión | Comportamiento que debe conservarse |
| --- | --- |
| Una cuenta por identidad y destino | Reabrir la landing, cambiar el nombre escrito, abrir otra pestaña o reintentar una solicitud no debe crear otra cuenta del mismo jugador/destino. El nombre no identifica el dispositivo. |
| Reingreso por landing y gateway | Con identidad guardada, recuperar la cuenta existente y entrar con chat utilizable, sin volver a pedir el nombre. El dominio sin `www` debe conservar el acceso mediante su dominio canónico. |
| Persistencia real | La relación asesor, identidad, cuenta, manager, gerencia y casino se guarda en DB. Una sesión del casino vencida se renueva usando esa relación; no se interpreta como necesidad de crear otra cuenta. |
| Navegadores internos | Probar expresamente cerrar y reabrir el enlace desde WhatsApp en iPhone, además de Safari. No equiparar una cookie inyectada en Chromium con esta comprobación. Si el navegador elimina o aísla todo su almacenamiento, documentar el límite y ofrecer una recuperación segura; no identificar a una persona solo por IP o nombre. |
| Ingreso real único | Se retiran los bypass, las cuentas compartidas configuradas y las rutas de demo `/testing`. Solo se crean o recuperan cuentas reales mediante API2. Un fallo muestra un error y conserva el intento recuperable; jamás sustituye la cuenta por una de prueba. Conservar las cuentas y mensajes históricos. |
| Recuperación de la prueba del usuario | El usuario eligió `guille1075` como cuenta que debe recuperar. Conservar `guille2101` y `cami1766`; no fusionarlas, eliminarlas ni crear una cuarta cuenta para resolver el acceso. Los enlaces de recuperación son credenciales temporales y no se guardan en este documento. |
| Entrada inmediata | Entrar apenas estén listos el login y el chat; no reinstalar la espera fija de cuatro segundos. Medir por separado formulario, creación, login y chat hidratado. |

## Carga inicial e imágenes

Continuar la optimización del recorrido real completo: preparar en segundo plano sin bloquear el formulario ni crear jugadores antes de confirmar el nombre; ejecutar en paralelo las tareas independientes y cargar el chat sin esperar scripts ajenos del casino. Conservar ownership, persistencia e idempotencia. Medir alta, login, navegación y compositor hidratado; no presentar una prueba aislada del proveedor como tiempo completo. El orden de scripts debe conservar instalación, permisos y notificaciones nativas incluso cuando el SDK cargue después del cliente.

Montar el iframe antes de asignarle `src` para conservar compatibilidad con WebKit. La navegación usa el siguiente frame, con un timer de respaldo de 100 ms y una guarda de ejecución única: el CSS lento del casino no puede retener el inicio del chat. Verificar este caso reteniendo tanto el script como el stylesheet del proveedor.

Prioridad explícita del usuario: el SDK de instalación y las notificaciones se descargan e inicializan después de que el casino esté autenticado y Atrio haya renderizado los datos para cargar. Retirar su preload/prefetch del formulario, transición y casino. Mantener solo la captura inline mínima de los eventos tempranos de instalación, sin red ni service worker. Atrio comunica la disponibilidad real de la tarjeta después del render; no usar una espera fija como sustituto. Una acción explícita de instalar puede iniciar esas funciones a pedido. Conservar el tracking por su circuito independiente, sin esperar al SDK. Si no hay billetera configurada, la disponibilidad del chat permite continuar sin inventar datos de carga.

Conservar la hora local del cliente sin provocar que React reconstruya el widget: el HTML y la primera hidratación usan el mismo formato UTC; luego se presentan las horas del navegador mediante el estado de hidratación de React. No cambiar timestamps de DB, tracking ni payloads de Meta por un ajuste visual. La validación debe incluir servidor UTC y navegador en Argentina, además de una zona coincidente.

Template 7 debe mostrar su formulario y permitir escribir enseguida, como prioridad principal. Asesor, identidad, ruta de manager y recursos pueden prepararse en paralelo. La preparación no bloquea la carga inicial ni crea la cuenta del casino antes de confirmar el nombre. Las reservas abandonadas vencen y se limpian; no dejan chats vacíos.

Los fondos y logos deben tener derivados livianos, preferentemente AVIF cuando reduzca el peso conservando calidad y transparencia. Conservar los originales y los formatos exigidos por compatibilidad para íconos de instalación, manifest y notificaciones. No convertir SVG, animaciones o imágenes de usuarios a ciegas. Los derivados no deben cambiar encuadre, proporciones o colores aprobados.

Las transiciones entregan AVIF con fallback WebP. No asumir que todos los motores WebKit decodifican AVIF. Los avatares públicos del asesor pueden servirse reducidos y con negociación de AVIF/WebP, manteniendo intactos los comprobantes, adjuntos privados y originales.

La recuperación del navegador conserva HttpOnly como cookie principal y puede restaurarla con un respaldo cifrado y autenticado del mismo origen. Ese respaldo es una credencial de acceso y no debe enviarse a analytics, URLs, logs o terceros. La identidad de la landing usa un sobre cifrado; no publica el UUID en JSON ni HTML. Una cookie vigente tiene prioridad sobre un respaldo antiguo. La recuperación del gateway revalida la sesión del servidor y no puede revivir una revocada. Si no existe ningún almacenamiento recuperable, hace falta Safari con persistencia, la app instalada o una verificación de identidad; no prometer reconocimiento físico del teléfono.

## Presentación aprobada

| Elemento | Decisión vigente |
| --- | --- |
| Logo de transición | La instrucción del 17/10 reemplaza el límite compacto aplicado previamente: recuperar el logo grande y con jerarquía de la cuarta captura del usuario, con resplandor suave que siga su silueta, sin recuadro visible. No volver a reducirlo para igualar la caja compacta del formulario de Template 7. |
| Zonas seguras en iPhone | La transición y el gateway deben usar el color de la página en fondo raíz, tema y zonas seguras. Conservar `viewport-fit=cover` y espacio suficiente para los controles; no dejar franjas blancas. |
| Botón de saldo | En celular debe verse un solo texto, también mientras consulta. El spinner y los cambios de estado no deben superponer el texto anterior y el nuevo. |
| Ficha móvil | Ocultar metadatos. Información de usuario y contacto colapsables y cerradas inicialmente. Promos debajo de Total cargado. |
| Credenciales | Mostrar la clave oculta con un ojito y un botón de copiar discretos. Mostrar el casino y, cuando se conozca, la gerencia entre paréntesis. |
| Nombre en inbox | Mostrar emoji únicamente si el jugador tiene al menos una carga confirmada por API2. Sin cargas confirmadas, mostrar solo el nombre, sin emoji ni espacio reservado. Desde la primera carga, anteponer emoji según Total cargado confirmado: menos de 1.000 💩; 5.000 🟢; 10.000 🟡; 50.000 🟠; 100.000 🔴; 300.000 ⚫; 500.000 🔥; desde 500.000 💣. Aplicar el mismo criterio en listas y encabezados del chat, tanto móvil como escritorio. El saldo disponible no determina el emoji; los retiros no eliminan el historial de cargas. |
| Navegación del asesor | Difusiones debajo de Promos en escritorio y a su derecha en el footer móvil. Cerrar sesión al final de Configuración en celular. |
| Contadores del inbox | El badge junto a Inbox cuenta conversaciones con mensajes del cliente sin leer, no mensajes ni conversaciones totales. El contador del chat se oculta en el mismo clic que lo abre; guardar la lectura en DB sin bloquear la UI y reconciliar con el servidor. |
| Presencia en inbox | El círculo de conexión se ancla a la esquina del avatar con dimensiones fijas. Agregar o quitar etiquetas CARGA, RETIRO, SOPORTE o promociones no desplaza ese círculo, en móvil ni escritorio. |
| Estados del mensaje | En ambos chats: un check para enviado, doble para recibido y doble azul para visto. Un read_at existente implica doble check aunque falte delivered_at en datos históricos. Registrar entrega y lectura también en el gateway y avisos enviados por el asesor. Una pestaña oculta no marca como visto; al volver al chat visible, persistir su lectura. |
| Configuración | Conexión con PBAdmin y Bots de PBAdmin colapsables y cerradas inicialmente en móvil; abiertas en escritorio. Mantener tarjetas oscuras, íconos y acentos dorados y botones coherentes. Retirar muestra una vista representativa de la solicitud real, con ícono; Soporte también tiene ícono. |
| Marca del panel | Duplicar el tamaño del logo superior izquierdo de Super Admin, Admin y Asesor (36 a 72 px), con nombre y rol acordes. No aplicar este cambio al logo de Template 7 ni a sus transiciones. |
| Difusiones | Desplegables con estética propia, con teclado y cierre por Escape. Consultar contactos en DB de a 50 por página; cambiar de página pide el siguiente bloque y no acumula toda la agenda en el navegador. Mantener la selección de contactos al paginar. Mostrar foto de perfil o imagen del casino como en el inbox, y el emoji de nivel solo si existen cargas confirmadas, usando el mismo acumulado y escala. |
| Textos de Datos y perfil | Total cargado: «Suma de cargas confirmadas». La comparación usa el período inmediatamente anterior de igual cantidad de días, calculado en servidor y aclarado con fechas. Variaciones positivas verdes y negativas rojas, incluida su flecha. El aviso de perfil varía según falte WhatsApp, email o ambos. |

## Managers operaciones y conversiones

- Un asesor puede tener varios managers. Cada chat conserva su propia cuenta, manager, gerencia y casino. El token del asesor no selecciona arbitrariamente un único manager.
- Cada manager pertenece a una agencia/página en PBAdmin. Cuando haya varios candidatos del mismo casino, la landing define el manager por asesor y casino. Las cuentas ya creadas conservan su relación.
- En MKT con gerencia operativa estándar aparecen consultar saldo, cargar y retirar. Full Carga funciona automáticamente. Evitar una tarjeta de modo manual/automático que contradiga las capacidades reales.
- Solo cargas confirmadas exitosamente por API2 incrementan Total cargado y generan PURCHASE. Una operación se cuenta una vez, aun con reintentos. No contar comprobantes detectados, cargas pendientes/fallidas ni descontar retiros del acumulado.
- Esta regla pertenece al canal Atrio (MKT y Full Carga). Los MKT de otros transportes con gerencias de referencia conservan su lógica actual basada en comprobantes. API2 no emite LEAD/PURCHASE directos para Atrio; sí envía la confirmación financiera que Atrio necesita para registrar el total y emitir PURCHASE.
- Full Carga con Atrio reutiliza el motor de comprobantes y retiros de API2, incluido el pago automático por HG Cash cuando corresponda. El formulario de retiro envía monto y cuenta estructurados, sin otra extracción de IA; conserva validaciones de saldo, bonos, límites y horarios. No afirmar pago exitoso por recibir la solicitud o aceptar HG el POST: esperar confirmación del proveedor. Persistir solicitudes y respuestas, y no repetir efectos financieros por reintentar un mensaje o una entrega.
- Alcance acordado después de la revisión: adaptar nuestros endpoints, colas, recuperación y avisos de Atrio al motor existente. No modificar la lógica de pagos, reservas, devoluciones ni conciliación de HG Cash del programador; documentar las incidencias de ese motor para su responsable. Los resultados inciertos conservan su intento original y no habilitan otra operación cambiando la clave. Solo una confirmación persistida de la misma operación permite cerrar nuestra solicitud en revisión. La preparación y entrega de comprobantes tiene reintento propio, sin repetir pagos ni mensajes ya entregados.
- Al cargar en Full Carga, la tarjeta consulta el CBU del flujo de depósito de API2. No debe elegir las billeteras manuales del asesor ni inventar un alias o titular faltante. Habilitar el acceso a cargar aunque no haya billeteras manuales; si API2 no entrega una cuenta válida, mostrar un fallo y conservar el chat utilizable. MKT mantiene la selección de sus billeteras.
- La IA puede identificar comprobantes y extraer emisor, transaction_id y coelsa_id para enriquecer el evento. Detectar el archivo no confirma una carga.
- LEAD/PURCHASE deben conservar origen inicial y distinguir emisor del evento. Incluir los identificadores disponibles de jugador, manager, gerencia, action_event_id, timestamp y dateTime; no inventar teléfono de bot para Atrio.
- Atrio y PBAdmin usan una integración global administrada por Super Admin. El asesor ve su UUID completo con copiar y puede crear, ver/ocultar y regenerar su AtrioToken; no necesita configurar otra External Request a API2.
- En Datos: cálculos en backend, filtro de casino antes del de fechas, visitas globales para todos los gateways, términos App y tasas de instalación app/chat y app/visita, sin card Mensajes. Total cargado deriva del mismo registro confirmado de la ficha; las barras diarias tienen leyenda.

### Revisión manual de comprobantes y retiros

Solo managers MKT habilitados usan estos flujos. Full Carga conserva su automatización. Las solicitudes y los intentos de operación se guardan en DB, vinculados al asesor, conversación, cuenta y mensaje de origen. Cambiar de chat, cerrar un modal o reintentar no debe cambiar esa vinculación ni generar otra operación para el mismo intento.

- Analizar archivos entrantes del cliente aunque no haya tocado Cargar. Guardar detección, monto, emisor, fecha, Coelsa ID y número de operación. Un comprobante detectado crea la solicitud y etiqueta CARGA; el chip de carga conserva su comportamiento.
- Al abrir el chat, mostrar «CARGA - USERNAME», datos y enlace al comprobante, y monto precargado editable antes del primer envío. La confirmación depende de API2; solo entonces se contabiliza y genera PURCHASE.
- Comparar identificadores bancarios normalizados con comprobantes en proceso o procesados del mismo asesor/administración, sin revelar datos de otros clientes. **Decisión explícita:** advertir y permitir continuar solamente tras aceptar la advertencia; guardar esa aceptación. El mismo mensaje/solicitud ya completado no se vuelve a ejecutar.
- Toda carga manual exitosa, desde modal o botón, genera un mensaje al cliente con monto y usuario. Guardar un único aviso por operación confirmada y conservar la misma clave al reintentar un aviso pendiente.
- **Retiro en dos pasos, aprobado explícitamente:** primero consultar saldo, rechazar insuficiencia y descontar fichas en PBAdmin. Después el asesor hace la transferencia bancaria, sube imagen/PDF y confirma el envío del comprobante y la felicitación al cliente. La segunda etapa no llama al endpoint de retiro ni vuelve a descontar fichas. El estado «descontado, comprobante pendiente» debe sobrevivir al cierre y reapertura.
- El modal de retiro debe ser compacto y no tener scroll vertical interno. Mantener visibles cuenta para copiar, monto, saldo disponible, errores relevantes y la acción de la etapa correspondiente, tanto en móvil como escritorio.
- La cruz de un retiro pendiente sin descuento descarta esa solicitud de forma persistente, elimina su aviso y quita RETIRO cuando no queda otra solicitud activa del jugador. No borrar el mensaje del cliente ni registrar el descarte como retiro exitoso. No reactivar una solicitud descartada por recarga, reintento o relectura del mensaje. Una solicitud en proceso o ya descontada conserva su seguimiento y ofrece posponer la revisión, sin cancelar el descuento ni perder el comprobante pendiente.
- La clasificación atrasada de un mensaje o su aviso push no puede volver a etiquetar una solicitud ya descartada/completada. Agregar etiquetas desde el estado actual en DB y conservar las de otras solicitudes activas del jugador, incluso en otra conversación; no sobrescribirlas usando una copia antigua del contacto.
- Conservar etiquetas de solicitudes pendientes al abrir el chat; la lectura no las completa. Limpiarlas al resolver la solicitud. Los botones deben retomar un intento pendiente o dirigir al modal de su solicitud, sin iniciar otro intento que lo duplique.

La demora inicial de los botones fue comunicada por el usuario como observación: se conserva la comprobación de manager y permisos. La pantalla de carga periódica del inbox sigue sin diagnóstico confirmado; no registrarla como revalidación de sesión comprobada.

### Ajustes del chat y revisión manual aprobados el 18/10

- Cada mensaje nuevo de texto o archivo, del cliente o del asesor, lleva el hilo al final dentro del área del chat. Conservar esa posición cuando la imagen termina de cargar o cambia el alto del footer; permitir leer mensajes anteriores hasta que llegue otro mensaje. La lógica de desplazamiento se comparte entre el cliente y el inbox, incluidos los cuatro gateways.
- La revisión de CARGA, igual que RETIRO, debe ser compacta y no tener scroll vertical interno en móvil, escritorio u orientación horizontal. Mantener los datos del comprobante, monto, advertencia de duplicados y confirmación accesibles. El texto introductorio es «Revisá el comprobante y el importe extraído antes de confirmar.». Quitar la explicación sobre conservar el monto original sin cambiar la idempotencia ni permitir editar un intento ya iniciado.
- Todos los avisos al asesor deben ser breves y en castellano. Las validaciones y rechazos esperables del servidor se devuelven como datos; no lanzar excepciones que React oculta en producción. No mostrar errores técnicos de React, DB o Storage ni atribuir un error genérico a falta de fichas sin confirmación del proveedor.
- Cerrar una revisión con la cruz, Escape o el fondo quita persistentemente su aviso y su etiqueta CARGA/RETIRO, salvo que otra solicitud visible del mismo jugador todavía necesite esa etiqueta. Una solicitud sin iniciar queda descartada. Si ya está en proceso o descontada, solo se descarta la atención visual: conservar estado, monto, clave y operación para retomarla desde Cargar/Retirar, sin consultar saldo como requisito para volver a abrirla ni repetir el descuento. El cierre no cuenta como éxito ni envía un mensaje al cliente. La recarga, un análisis atrasado o un aviso push no deben volver a mostrar la notificación descartada.

## Publicación y validación

### Mensajes, comprobantes y entrega aprobados el 20/10

- Los avisos de carga manual exitosa llevan emojis acordes (✅, 💰, 🎉), monto y usuario. La confirmación del premio/retiro manual lleva 🏆 y ✅ y se envía con su comprobante después del segundo paso; descontar fichas por sí solo no anuncia el pago bancario.
- El loader dentro del widget hereda su paleta: fondo, superficie, texto, logo y anillo. WhatsApp usa sus tonos claros y verdes, y el modo página respeta la marca configurada. El panel conserva la identidad visual de Atrio.
- Cerrar la revisión de un comprobante pendiente con X descarta persistentemente el aviso y la etiqueta CARGA cuando no queda otra solicitud activa. No carga fichas ni borra el archivo del historial. El asesor puede realizar luego la operación con Cargar. Una operación ya iniciada conserva su identidad y recuperación; cerrar no habilita otro débito/crédito sobre un resultado incierto.
- Una carga confirmada vinculada a su comprobante agrega una marca sutil «Comprobante cargado» al archivo original, visible para cliente y asesor y persistente al recargar. Detectar un comprobante, cerrar el modal o fallar la carga nunca agrega esa marca. El navegador no puede falsificar la confirmación mediante metadata.
- Enviado: un tick. Entregado: dos ticks neutros cuando el dispositivo receptor recibe el mensaje, también mediante push en segundo plano. Visto: dos ticks azules cuando abre el chat. Aceptar el envío en el servidor push no equivale a entrega; el service worker acusa recibo del mensaje exacto con prueba firmada, vencimiento y validación del destinatario. El acuse modifica únicamente `delivered_at`, sin marcar lectura ni cambiar etiquetas.
- La recepción push comparte `internal-chat/public/atrio-push-delivery.js`, sincronizada a los cuatro gateways con `node scripts/sync-push-delivery.mjs` y comprobada con `--check`. Se ejecuta en segundo plano al recibir push y no se agrega a las dependencias de Template 7, login o chat listo.

### Instalación y notificaciones aprobadas el 17/10

- Los cuatro gateways comparten `gateway-app-sdk.js` y la captura temprana `gateway-app-capture.ts`; las fuentes canónicas viven en `landing-autologuin` y se sincronizan con `scripts/sync-gateway-app-sdk.mjs` del constructor. Cada repositorio conserva su copia para desplegarse por separado. El cliente del chat carga asíncrono con precarga; el SDK no se precarga ni se descarga hasta la señal de entrada lista de Atrio, salvo una solicitud explícita del usuario. El SDK carga a baja prioridad y prepara instalación/push después. Conservar la captura de eventos tempranos y el gesto del CTA para los permisos nativos.
- En Android, el CTA Instalar utiliza el aviso nativo cuando el navegador entrega `beforeinstallprompt`. La cancelación no cuenta como instalación y la disponibilidad tardía actualiza el botón. Conservar la guía cuando el navegador no habilite la instalación nativa. No afirmar que existe una instalación silenciosa.
- Manifest: cada casino usa su propio logo, íconos PNG de 192 y 512 px, una variante maskable con margen seguro y Apple Touch de 180 px. Estos archivos son independientes de los logos grandes y el resplandor de la transición; normalizar los íconos no autoriza a achicar la transición.
- El CTA de campanita «Activar notificaciones» solicita el permiso nativo directamente desde el clic, antes de esperar service worker o red. Preparar el worker en segundo plano. No pedir consentimiento por tocar otra parte del chat. Solo mostrar activación exitosa después de guardar la suscripción del cliente en DB; conservar reintentos ante fallas de red.
- En iOS el permiso web push exige abrir la app desde Inicio, con iOS 16.4 o posterior. Si todavía está en Safari como pestaña, conservar el instructivo de instalación. En Android se usa el permiso nativo del navegador compatible. Un permiso bloqueado requiere la configuración del sistema; no insistir con solicitudes nativas.
- Al abrir el formulario de retiro del cliente o la revisión del asesor, mostrar sutilmente el saldo disponible y el estado de consulta. La lectura usa la cuenta y el manager persistidos en la conversación, nunca identificadores enviados por el navegador. No bloquea la apertura del formulario ni reemplaza la comprobación fresca al descontar. Un intento ya iniciado conserva su clave aunque el saldo actual sea menor tras un descuento de resultado incierto.
- API2: optimizar Ases del Norte con el mismo formulario PHP autenticado por HTTP, preservando campos y selecciones del proveedor. El fallback a navegador solo se permite antes de intentar el POST de creación. Después de un resultado incierto, reconciliar la misma cuenta; nunca crear otra por esa incertidumbre. Ganamos conserva creación y activación de clave, con conexiones reutilizadas dentro de una única alta, sin compartir sesiones entre managers ni alterar operaciones financieras.

Las nuevas mediciones son muestras individuales desde el equipo local: Ases del Norte 13,801 → 3,366 ms y Ganamos 4,285 → 2,547 ms. Ambas altas optimizadas se verificaron contra el proveedor con pertenencia al manager y contraseña originales. No representan promedios ni el tiempo completo hasta el chat. API2 sigue sin publicarse por esta validación.

### Creación separada de Ganamos para Template 7

Decisión posterior del usuario: conservar la API y el método completos que usan los bots existentes, y agregar una vía que solo cree la cuenta para Template 7. El modo predeterminado continúa siendo completo; no quitarle sus pasos de acceso y activación de clave.

- API2 conserva `createPlayerComplete` y `createPlayerDetailed`. Agrega `createPlayerOnly` y `createPlayerOnlyDetailed`, que autentican al manager —necesario para autorizar el alta— y crean el jugador, sin iniciar sesión como jugador ni activar su contraseña.
- La nueva ruta `POST /api/v1/bot/managers/:manager_id/players/create-only` comparte validación, API key/secret, ownership y persistencia idempotente con la existente. El endpoint anterior también admite `creation_mode: "create_only"`; sin ese campo sigue usando el flujo completo.
- Template 7 solicita ese modo para `ganamos_net` mediante el endpoint existente. La versión de API2 que está en producción ignora el campo adicional y conserva su flujo completo; cuando el programador publique el lote local comenzará a usar solo creación. No probar otra ruta ni otra identidad después de una respuesta incierta.
- Ganamos NET devuelve `changed_password: false` para una cuenta recién creada. El gateway completa esa activación dentro del primer login, reutilizando su sesión y la contraseña elegida. Solo lo hace si el usuario devuelto por el proveedor coincide con el solicitado y la marca es exactamente falsa. Ante un error no declara el ingreso listo; un reintento con la marca verdadera no vuelve a activar la clave.
- No aplicar este contrato por coincidencia de número de plataforma a Ganamos+: su gateway tiene otro protocolo de acceso. Mantener el recorrido de Rey, Ases del Norte y Ganamos+.

Prueba real acotada: una cuenta nueva en Ganamos, alta sola en 1.179 ms, primer ingreso con el código del gateway NET en 1.813 ms y reingreso en 1.617 ms. La activación ocurrió una sola vez; se verificó `changed_password: true` y la contraseña original. Son tramos individuales medidos desde Windows mediante el proxy del cliente de API2, no tiempos del recorrido completo ni promedios de producción. No se movieron fichas, no se escribieron players en la DB productiva de API2 y no se publicaron cambios de API2. No hay otra migración por este ajuste.

API2 permanece **solo local** hasta que el usuario autorice otra cosa. El programador tiene pendiente publicar el lote acumulado con estas cuatro migraciones:

1. `20261016000001_create_atrio_player_provisions.ts`.
2. `20261016000002_create_atrio_confirmed_load_notifications.ts`.
3. `20261017000001_allow_multiple_atrio_managers.ts`.
4. `20261018000001_create_atrio_automation_queues.ts` (recepción y respuestas persistentes de Full Carga; no ejecutar contra producción en esta tarea).

Atrio, constructor, motor clásico y gateways pueden publicarse dentro del alcance autorizado. Ganamos+ requiere actualizar también su Worker de Cloudflare, que sirve el dominio público. Preservar los cambios locales existentes al generar snapshots de publicación.

Antes de publicar un cambio relacionado con acceso, comprobar: alta única, recuperación cambiando el nombre, reintentos, reapertura de pestaña/navegador con almacenamiento persistente, cookie del casino vencida, entrada directa por dominio canónico y sin `www`, acceso desde la landing y widget realmente hidratado. Verificar aislamiento entre asesores/managers/casinos y rechazo de credenciales adulteradas. El escenario WhatsApp/iPhone necesita evidencia del dispositivo real o una limitación expresamente indicada.

Para cambios visuales, revisar celular, escritorio y orientación horizontal; estados de carga/error y zonas seguras. Para imágenes, registrar bytes antes/después y verificar transparencia y dimensiones. Conservar evidencia y despliegue anterior para rollback. Informar qué se probó realmente, sin presentar una simulación como validación del dispositivo del usuario.

## Evidencia manual comunicada por el usuario

### Validación y correcciones posteriores al despliegue del 20/10/2026

El programador ya publicó el lote anterior de API2 y Panel3. La prohibición de publicar API2 sigue vigente para las correcciones nuevas: confirmación financiera estricta de Atrio/Rey y recuperación de credenciales Lucid. Este lote no agrega migraciones ni modifica el motor de HG Cash. El registro de publicación anterior es histórico; no ejecutar nuevamente sus migraciones por leerlo.

Se verificó el recorrido real del constructor desde Template 7 hasta casino autenticado y chat hidratado con CBU para 1035/Rey, 1040/Ases del Norte, 1041/Ganamos NET MKT y 1042/Ganamos NET Full Carga. Se comprobó una cuenta persistida por identidad, manager/gerencia correctos y reingreso desde landing y dominio del gateway. Ganamos+ no tiene manager ni integración de altas en PBAdmin; no declarar esa prueba realizada.

Las muestras nuevas duran aproximadamente 9–11 segundos desde el clic de confirmación hasta el chat con datos para cargar, sin limitación artificial de red y con caché normal del navegador. No equivalen a un promedio ni a validación en el navegador interno de WhatsApp/iPhone. No afirmar que el recorrido ya es instantáneo ni confundir creación de cuenta con disponibilidad completa del chat.

La preparación de Template 7 emite el mismo pase cifrado sin cargar dependencias de DB o creación de cuentas. Mantener los controles de identidad, vencimiento, asesor y tracking. Las notificaciones y el SDK continúan sujetos al evento de recorrido utilizable, comprobado en los cuatro gateways con Chromium/WebKit.

LEAD se entrega independientemente de los avisos push/Telegram. Un fallo o timeout conserva el payload y su `action_event_id`; reintentar esa misma entrega bajo una reserva atómica, sin generar otra conversión ni cambiar su fecha. La validación real confirmó los cuatro LEAD en builder con origen `landing` y estado CAPI `enviado`; un timeout se recuperó conservando el mismo evento. PURCHASE de una carga manual confirmada no necesita una imagen de comprobante; conservar `is_valid_receipt: null` si no existe.

Referencia histórica del backend: el predeterminado es por asesor y casino para integraciones antiguas sin selección de landing. La UI que permitía elegirlo se retiró por la decisión posterior de simplificación; los gateways públicos recuperan la cuenta existente y no lo usan para crear otra. No reasigna cuentas existentes ni sobreescribe el manager configurado en una landing. Las cuentas mantienen su conexión persistida con manager y gerencia.

El retiro histórico de `prueba8339` fue corregido el 20/10/2026 después de verificar el historial completo del proveedor: no existía el retiro original de 100. Se hizo una única corrección por el endpoint de API2, operación 12, con clave `reconcile-atrio-operation-11-prueba8339-20261020` y transacción del proveedor 237150568. Historial y consulta independiente confirmaron saldo 0. La operación 11 conserva su respuesta histórica incorrecta y queda vinculada documentalmente con la correctiva; no repetir ninguno de esos retiros. El intento original de alta de Ganamos 1041 permanece incierto; las altas nuevas de prueba sí funcionaron sin cambiar esa identidad.

### Destinos por manager y optimización aprobados el 20/10

- En Atrio del constructor, agrupar los managers por asesor y mostrar casino, gerencia, modalidad MKT/Full Carga, estado, asignaciones y chats iniciados. Las métricas se calculan en backend por bot. Un chat cuenta al recibir al menos un mensaje del cliente; sus mensajes posteriores no incrementan chats iniciados.
- En el editor de Template 7, seleccionar explícitamente los managers habilitados del casino elegido: un bot seleccionado como destino único, reparto aleatorio con pesos o equitativo por asignaciones/chats iniciados de esta landing. MKT y Full Carga solo se mezclan si el usuario selecciona ambos. Ganamos+ continúa sin integración de managers en PBAdmin.
- En Redirección, cada modalidad tiene un botón «i» accesible por toque y teclado con su explicación. Agrupar los managers por asesor en secciones colapsables inicialmente cerradas, con la cantidad seleccionada visible en el encabezado. El texto introductorio es «Elegí cada manager que participará en la redirección de la landing.»; quitar el párrafo general sobre contadores, mensajes y reingresos. La ayuda no cambia el modo ni guarda destinos.
- Guardar reparto y asignación en DB. Resolver de forma atómica antes del alta mientras la persona escribe, sin bloquear la presentación inicial de la landing. Una identidad existente conserva asesor, cuenta y manager; cambiar el reparto no mueve jugadores ni crea otras cuentas. Constructor y motor clásico comparten la lógica de selección.
- El contador del directorio representa asignaciones persistidas al bot, incluidas las de otras landings. Es informativo: la selección equitativa usa exclusivamente asignaciones o chats iniciados de la landing actual. Reabrir la misma landing con la misma identidad no vuelve a incrementar esa asignación. Preparar la entrada no crea una cuenta del casino ni un mensaje del cliente.
- El casino debe recibir el chat con los datos iniciales ya disponibles: reutilizar el bootstrap validado en servidor y preparar la tarjeta de carga auténtica dentro de ese flujo. Conservar la comprobación de cuenta/manager, los estados de lectura y el seguimiento de conversiones. Full Carga obtiene su CBU de API2; MKT de las billeteras activas del asesor.
- La acción inicial de carga viaja dentro del token firmado de los cuatro gateways. No aceptar acciones adulteradas ni marcar el chat utilizable antes de la hidratación. SDK, instalación y notificaciones siguen pospuestos hasta que el recorrido esté utilizable.

### Rendimiento y recursos públicos verificados el 20/10

- La comprobación de persistencia de la cookie y la selección del destino comparten la misma promesa del navegador. No iniciar una cuenta si la identidad no se pudo verificar. El formulario sigue disponible mientras se prepara la entrada.
- El contexto del destino y sus límites se resuelven mediante una sola RPC interna. Conservar los límites existentes de 60 por IP y 6 por dispositivo por minuto, sus claves HMAC generadas en servidor y el comportamiento de constructor/clásico ante un límite agotado. La RPC sólo es ejecutable por `service_role`; no aceptar claves ni límites enviados por el navegador.
- Builder conserva PDX para sus rutas generales. Sólo las rutas de destino, emisión de preparación y resolución de cuenta de Template 7 están configuradas en GRU. La comparación mostró mejora en muestras calientes y variabilidad al arrancar; no presentar un cambio de región como una garantía de latencia.
- Medir separadamente contexto, identidad, resolución de cuenta por API2, vinculación, handoff y tiempo total mediante `Server-Timing`, sin identificadores ni credenciales. El tiempo de la llamada a API2 incluye su coordinación y no equivale exclusivamente al tiempo que tarda el proveedor en crear la cuenta.
- Mantener las verificaciones del usuario autenticado y la activación inicial de contraseña al reducir pasos de login. Ganamos+ conserva su obtención de CSRF; no copiarle un protocolo de otra plataforma.
- Los archivos públicos de construcción del casino usan un helper común: `landing-autologuin/src/lib/public-provider-assets.ts`, sincronizado con `node scripts/sync-public-provider-assets.mjs` y comprobado con `--check`. Solicitar esos archivos sin cookies ni credenciales del jugador y cachear únicamente respuestas públicas válidas. HTML, APIs, adjuntos privados y respuestas de sesión conservan su acceso autenticado.
- Los archivos con hash tienen una vida máxima de un día, respetando un plazo menor del proveedor. Ases del Norte usa archivos sin hash: conservar su parche de JavaScript y una caché máxima de cinco minutos. No convertirlos en recursos inmutables.
- El Worker público de Ganamos+ utiliza Cache API; los gateways de Vercel usan su caché CDN. Aumentar la versión del espacio de caché compartido cuando cambie una transformación o política para evitar conservar una reparación antigua. Verificar HIT, igualdad de contenido y ausencia de cookies en los cuatro dominios después de publicar.
- Conservar todas las tandas de medición, incluidos los casos lentos. Informar muestras individuales como tales; no afirmar que el recorrido es instantáneo, que se probó Ganamos+ con un manager inexistente o que Chromium de escritorio certifica WhatsApp/iPhone.

La última tanda, posterior a la publicación de estas optimizaciones, registró 8,879 s para Rey MKT, 7,981 s para Ases del Norte MKT, 9,135 s para Ganamos NET MKT y 7,773 s para Ganamos NET Full Carga desde confirmar el nombre hasta chat utilizable con CBU. Los reingresos de esa tanda conservaron la misma cuenta y demoraron entre 1,199 y 2,452 s. Son muestras individuales de Chromium, no promedios ni una garantía para WhatsApp/iPhone. Las tandas anteriores y sus casos lentos se conservan.

La evidencia actualizada se conserva en `docs/validation/template7-manager-routing-20261020.json`. `atrio-corrections-20261020.json` es la referencia previa a esta última optimización; `atrio-postdeploy-20261020.json` es una medición todavía anterior. No presentar ninguno de ellos como resultado del despliegue final.

La comprobación de seguimiento está en `docs/validation/second-wave-identity-wallet-tracking-20261020.json`: CONTACT y LEAD recibidos por Meta, una conversión por identidad y reintento sin duplicación; sin PURCHASE cuando no existe carga. La tarjeta inicial de CBU no genera un mensaje del cliente ni un LEAD artificial. Los reingresos finales incluyen un error JavaScript del iframe deportivo externo de Ganamos, documentado por separado del funcionamiento del chat; no declararlo corregido por este lote.

El 17/10/2026 el usuario informó que abrió Template 7 directamente desde Safari y creó únicamente `probando3540`. Cerró la pestaña, volvió a abrir Template 7 y fue redirigido al gateway con la misma cuenta. Después ingresó directamente al gateway y también conservó esa cuenta. Esto valida esos dos reingresos en Safari según su prueba manual, sin demostrar conservación de identidad al cerrar y reabrir la ventana interna de WhatsApp. La diferencia entre ambos recorridos apunta al almacenamiento del navegador interno; no confirma por sí sola su mecanismo de borrado o aislamiento.


### Simplificación de bots, canales y recuperación aprobada el 20/10

Esta decisión reemplaza las referencias anteriores a predeterminados públicos, mensajes individuales y selección de canal de las plantillas.

- En la UI de Atrio usar Bot/Bots; conservar los nombres técnicos de API y DB. Configuración muestra los bots vinculados al asesor con casino, gerencia, modalidad y badge de estado. Retirar el botón y la explicación del predeterminado para accesos directos; no reasignar cuentas existentes.
- En el constructor, agrupar los bots por asesor. Mostrar contador y chats iniciados; no mostrar la suma de mensajes individuales. El reparto equitativo compara asignaciones o chats iniciados dentro de la landing, con desempate por asignaciones y selección atómica. Los totales del directorio son informativos y no mezclan la distribución de distintas landings.
- Redirección de Template 7 sigue la presentación de WhatsApp: selección por asesor y bot, aleatoria con pesos o equitativa por contador/chats iniciados. Una sola selección equivale a destino único sin otro modo Fijo. Conservar las ayudas accesibles y la selección explícita de MKT/Full Carga. Guardar destinos desde el guardado general del editor.
- Templates 1–6 usan WhatsApp y Template 7 usa Atrio. Retirar Destino del CTA y aplicar la regla también al guardar, cambiar plantilla y publicar en constructor y motor clásico. Conservar los accesos de soporte secundarios ya aprobados.
- Los cuatro gateways intentan recuperar la sesión automáticamente. Sin recuperación muestran ingreso con usuario y contraseña: validar contra el casino y recuperar exclusivamente la cuenta de Atrio ya vinculada, su asesor, bot y conversación. No crear cuentas, no adivinar asesor ni reasignar por nombre. Rechazar cuentas no vinculadas o ambiguas y limitar intentos. Mantener cookies HttpOnly y respaldo cifrado; no publicar contraseñas ni identificadores privados en URLs o storage.
- Ganamos+ conserva su protocolo y Worker público; sin integración PBAdmin no se declara probada un alta inexistente. API2 continúa solo local y no se modifica HG Cash.


### Evidencia de la simplificación y recuperación manual

El lote quedó publicado en Atrio, constructor, motor clásico y los cuatro gateways, incluido el Worker público de Ganamos+. La evidencia está en `docs/validation/bots-channels-and-manual-login-20261020.json`.

Se probaron cuatro ingresos manuales reales desde navegadores vacíos, con las cuentas de prueba existentes de los bots 1035, 1040, 1041 y 1042. El casino validó sus credenciales y el chat usó el mismo jugador y cuenta firmados, conservó la conversación y no creó LEAD/PURCHASE. No se crearon cuentas del casino ni se movieron fichas. También se verificaron ocho reingresos desde landing/dominio directo con los mismos usuarios y CBU visible. Son pruebas de Chromium; no certifican WhatsApp/iPhone físico.

Las interfaces de configuración y constructor se verificaron en Chromium/WebKit, móvil y escritorio. El guardado del editor se validó con escrituras interceptadas: dos bots, criterio de chats iniciados, pesos conservados y guardado con Redirección cerrada. No se modificaron los destinos de las landings productivas durante esa prueba. La sección conserva montado su borrador al colapsar y carga su configuración aun estando cerrada. Guardar Template 7 no reescribe las gerencias de WhatsApp.

La concurrencia, aislamiento entre tenants, contadores independientes por landing, un chat con múltiples mensajes, recuperación ambigua y permisos de servicio se probaron en Postgres aislado. La migración aplicada es `internal-chat/supabase/migrations/20261020163516_landing_bot_chat_fairness.sql`; el lookup no puede ejecutarse por anon ni authenticated. No se agregaron hallazgos respecto de los avisos de seguridad preexistentes.

El ingreso manual común vive en `landing-autologuin/src/lib/gateway-login.ts` y `gateway-login-page.ts`, con pruebas compartidas. Sincronizar los cuatro mediante `node scripts/sync-gateway-login.mjs` y comprobar `--check` antes de publicar; conservar los adaptadores de login propios del casino. No agregar estas dependencias al alta de Template 7.

Ganamos+ tuvo validación del formulario, recursos y contrato compartido, pero no ingreso con cuenta real de PBAdmin porque esa integración no existe. API2 permanece local y Panel3/HG Cash no se modificaron.

### Reinicios de métricas y presentación de redirección (20/10/2026)

- En Atrio del constructor, reunir título, buscador, filtro de bots activos y botones globales en una sola fila. Si no entra en el ancho disponible, permitir desplazamiento horizontal dentro de esa cabecera, sin mostrar la barra ni ensanchar la página (21/10/2026).
- En Atrio del constructor, ofrecer «Reiniciar contadores» y «Reiniciar mensajes» para el workspace, además de los mismos controles por asesor. El alcance incluye todos sus bots aunque la búsqueda o el filtro de activos oculten filas; describirlo en la confirmación. No reiniciar métricas reales al validar la interfaz.
- «Reiniciar mensajes» reinicia la métrica de chats iniciados, no cuenta cada mensaje individual. Cada conversación participa una vez, desde su primer mensaje del cliente. Los mensajes posteriores de un chat previo al reinicio no lo convierten en un chat nuevo. Conservar y mostrar los chats históricos.
- Guardar ventanas independientes para asignaciones y chats, sin borrar asignaciones, jugadores, cuentas, conversaciones, mensajes ni atribución. Los reingresos mantienen su bot. El reparto equitativo respeta estas ventanas y conserva su comparación por landing. Proteger los reinicios con la sesión del constructor, ownership de sus asesores y puente de servicio; ningún navegador puede aportar otro asesor por ID.
- Los selectores Aleatoria/Equitativa y Por contador/Chats iniciados de Template 7 utilizan el control segmentado oscuro, selección clara y tamaño compacto de los templates 1–6. Conservar las ayudas «i», pesos y borrador del editor.
- La etiqueta CARGA expresa una solicitud de carga, no una acreditación. El envío inicial automático de CBU no agrega esa intención. Los chats de medición antiguos pueden conservar etiquetas de la acción de carga ejecutada por el flujo anterior; no eliminar solicitudes reales ni modificar su historial al explicar ese estado.

Validación y publicación: [reinicios de bots y selectores del 20/10](validation/atrio-bot-metric-resets-20261020.json). La migración `20261020172854_builder_bot_metric_resets.sql` está aplicada y su versión coincide entre local y remoto. Los reinicios funcionales se probaron en Postgres aislado; en las cuatro pruebas de interfaz productiva se interceptaron las escrituras para conservar los contadores reales.

### Jerarquía visual del directorio Atrio en el constructor (22/10/2026)

- Separar las tarjetas de asesores del contenedor general para evitar recuadros anidados. Destacar el nombre y avatar de inicial, con la dirección pública y workspace como información secundaria; el UUID completo queda disponible en «Ver UUID».
- Mantener la cabecera de búsqueda, filtro de activos y acciones globales en una sola fila con scroll interno sin barra cuando no entra. Distinguir Actualizar de los reinicios, que mantienen su alcance global y su confirmación.
- Cada asesor conserva sus bots colapsables, totales de asignaciones y chats, columnas por bot y chats históricos. «Asignaciones» expresa el mismo contador de nuevas cuentas, sin cambiar su cálculo. Usar encabezados de tabla sobrios, nombres de casino destacados, modalidad con color, estado con texto y punto, y cifras alineadas para comparar.
- Colocar los reinicios del asesor al pie de su tarjeta. Editar y eliminar mantienen sus funciones y confirmaciones; no ejecutar reinicios ni eliminar asesores durante la validación. Conservar búsqueda por asesor/bot/casino/gerencia, filtro, moneda, permisos y sincronización existentes. El cambio vive solo en el directorio del constructor, compartido por las vistas de cliente y admin; no modifica el runtime de Atrio, gateways ni API2.

Validación y publicación: [directorio Atrio con jerarquía visual](validation/builder-atrio-directory-ui-20261022.json). Se renderizaron los componentes y estilos reales con datos simulados en Chromium y WebKit, anchos 320/390/768/1366; se comprobaron búsqueda, filtro, UUID, colapsado con teclado, formularios y confirmaciones de reinicio global/individual sin escrituras.

### Tipografía compacta, comprobantes e información del inbox (22/10/2026)

- En el directorio Atrio del constructor, reducir nombres, iniciales y totales a 14 px como máximo, también en móvil. Los números de la tabla usan 13 px. Ningún nombre ni métrica supera el título de la pantalla; conservar la organización, filtros y acciones aprobados.
- El check y el texto «Comprobante cargado» utilizan el mismo verde sutil en el inbox. En los widgets, adaptar el verde al color de texto de cada burbuja para mantener su lectura en los tres temas. Conservar las condiciones de confirmación existentes: el estilo no marca una carga como confirmada ni cambia el estado financiero.
- «Info de usuario» e «Info de contacto» son secciones independientes, colapsables y cerradas por defecto tanto en escritorio como en móvil. Cambiar de conversación vuelve a cerrarlas. El saldo y las operaciones permanecen visibles fuera de esas secciones, sin consultar claves al desplegarlas ni modificar el guardado de contacto.
- Los botones de promoción, perfil, instalación y activación de notificaciones comparten Manrope, tamaño de 12,5 px, peso 600 e interlineado 1,4, con altura de 40 px en ambos layouts. Una regla común evita heredar tamaños diferentes de las tarjetas; no cambiar textos, destinatarios ni flujos de invitación.

Validación y publicación: [ajustes de tipografía e inbox](validation/atrio-builder-ui-refinements-20261022.json). Se verificaron los componentes y JSX reales con datos simulados en Chromium y WebKit, móvil y escritorio: tamaños bajo el título, apertura/cierre con teclado, edición sin guardar, cierre al cambiar de chat, operaciones visibles, tipografía idéntica de invitaciones y comprobantes en los tres temas. No se enviaron invitaciones, mensajes ni operaciones financieras reales. La implementación de Atrio es compartida por los cuatro gateways.

### Operaciones manuales y navegación entre chats (20/10/2026)

- Las lecturas de bot, saldo y solicitudes pendientes del panel usan GET autenticado, sin caché y con ownership de la conversación. No ponerlas en la cola serial de Server Actions: una consulta o mutación lenta de un jugador no debe impedir preparar los botones del siguiente. Al salir del chat, cancelar sus lecturas, conservando siempre las operaciones financieras iniciadas y sus claves persistidas. Mostrar preparación o reintento si falla la consulta del bot, en lugar de ocultar indefinidamente los controles.
- En el formulario manual de retiro, indicar que se descuentan fichas y que la transferencia bancaria se realiza aparte; no pedir revisar un comprobante inexistente. En carga por botón, pedir revisar el monto y aclarar que se acredita en la cuenta del jugador.
- API2 permanece local. Sus optimizaciones son explícitas para el adaptador de Atrio: Ganamos utiliza sus métodos API ya existentes, Ases consulta saldo por HTTP y sus mutaciones omiten lecturas informativas y esperas de un modal transitorio, conservando la confirmación real. El saldo validado por el servidor antes del retiro se transmite al adaptador del proveedor para evitar una segunda consulta idéntica. Los demás callers mantienen su comportamiento anterior; no modificar HG Cash. Un resultado incierto no habilita un nuevo POST automático.
- La consulta de saldo actual de Ganamos dio 504 a los 30,65 s. La operación 13 de carga por 1.000 sigue en processing: no repetirla ni marcarla como exitosa o fallida sin evidencia del proveedor. El saldo consultado por API fue 0; ese dato aislado no sustituye la conciliación del historial. La carga y retiro de Ases registrados por el usuario duraron aproximadamente 25 y 29 s; Rey, 1 y 2 s. Las nuevas pruebas reales de optimización solo consultan saldos y no acreditan tiempos de una carga o retiro optimizado.

Evidencia: [operaciones manuales y navegación entre chats](validation/atrio-manual-operations-20261020.json). Chromium y WebKit, móvil y escritorio, abrieron los botones del segundo chat con la consulta del anterior retenida. La validación conserva su carácter simulado para esa demora; las lecturas del proveedor y los registros de operaciones se verificaron por separado, sin iniciar nuevas cargas ni retiros.

### Widget y saldo de Full Carga (20/10/2026)

- La X para cerrar el widget debe tener contraste y tamaño visibles en los tres temas. Los textos y enlaces largos deben permanecer dentro de la burbuja sin perder copia ni saltos de línea.
- El asesor puede consultar saldo de las cuentas Full Carga vinculadas a sus conversaciones. Es una lectura autenticada; las cargas y retiros manuales siguen limitados a MKT y no se habilitan para Full Carga.
- No ocultar respuestas genéricas de API2 según palabras del texto. La clasificación semántica completa y la política de entrega siguen pendientes de definir; conservar mensajes y avisos financieros actuales.

Evidencia y conciliación pendiente de la operación 13: [widget y Full Carga](validation/atrio-widget-full-carga-20261020.md). API2 permanece local.

### Enlaces del chat y color del navegador (21/10/2026)

- Reconocer enlaces HTTP/HTTPS, dominios sin protocolo y `wa.me` en los mensajes del cliente y del asesor. Los enlaces se distinguen con subrayado, heredan el color de texto del tema y abren su destino en otra pestaña o aplicación, conservando el chat. Mantener el texto completo, saltos de línea, copia y contención de direcciones largas. No interpretar HTML ni convertir protocolos ejecutables en enlaces.
- La representación se comparte entre inbox, chat independiente y widget, incluidos los tres temas y los cuatro gateways. También aplicar enlaces a los textos de promociones e invitaciones del chat.
- En los cuatro gateways, unificar `theme-color`, el manifest y el fondo real con el color de fondo de cada casino; reemplazar metadatos contradictorios del proveedor y declarar esquema oscuro. La implementación compartida vive en `landing-autologuin/src/lib/gateway-browser-appearance.ts`; sincronizar con `node scripts/sync-gateway-browser-appearance.mjs` y verificar con `--check`. Ganamos+ incluye su Worker público.
- La interfaz nativa del navegador puede ignorar o adaptar el color indicado. Las pruebas de Chromium/WebKit de escritorio no certifican el color de la barra de Chrome en un iPhone físico.

### Separación de las burbujas del chat (21/10/2026)

- Reducir a 6 px la separación vertical entre mensajes en el chat del cliente, el widget y el inbox del asesor, tanto en móvil como en escritorio. Conservar los separadores de fecha, el contenido, los horarios y las tildes. La implementación única de Atrio aplica a los tres temas y a los cuatro gateways.

Validación y publicación: [separación de burbujas](validation/atrio-chat-spacing-20261021.json). Se verificó la geometría en Chromium y WebKit con mensajes simulados, y la configuración compartida y los accesos públicos de los cuatro gateways. No se enviaron mensajes ni operaciones financieras reales.

### Adjuntos y tarjeta de retiro en el chat (21/10/2026)

- Los nombres e íconos de los adjuntos respetan el color del texto de su burbuja en los tres temas, tanto para el cliente como para el asesor. Conservar los enlaces al archivo, horarios y confirmaciones.
- Mostrar la solicitud de retiro como una tarjeta dentro de la conversación del asesor, con monto y CBU/CVU/Alias para copiar, en MKT y Full Carga y en móvil y escritorio. Darle un ancho estable que se adapte a la burbuja. El usuario confirmó que Full Carga no debe abrir un aviso adicional; conserva su retiro automático y no recibe controles manuales nuevos.

Validación y publicación: [adjuntos y tarjeta de retiro](validation/atrio-attachments-withdrawals-20261021.json). Se probaron los renderizadores reales de mensajes con datos simulados en Chromium y WebKit, los tres temas y anchos móvil/escritorio; copiar conserva monto y cuenta. La implementación compartida está publicada para los cuatro gateways. No se iniciaron retiros ni envíos financieros.

### Saldo consultado, porcentaje de carga e instalación inicial (21/10/2026)

- Conservar en DB la última consulta exitosa de saldo de cada cuenta, con su asesor, bot, gerencia y fecha. Al volver al chat, mostrar ese valor y «Última consulta» con fecha y hora local en formato de 24 horas. Un saldo cero también se conserva. Una actualización fallida mantiene el último valor y su fecha. El valor es informativo e histórico: cargas y retiros siempre realizan sus comprobaciones frescas existentes. Las consultas viejas que responden tarde no reemplazan una consulta posterior; el navegador no puede escribir snapshots ni sustituir su ownership.
- En Datos, el porcentaje de carga es la proporción de clientes únicos que escribieron y tuvieron al menos una carga confirmada en el mismo período, sobre los clientes únicos que escribieron en ese período. Aplicar primero el filtro de casino, deduplicar mensajes y cargas del mismo cliente y usar la misma fórmula en totales, asesores, administradores y período de comparación. LEAD no determina esta métrica.
- La instalación inicial del gateway usa el mismo texto completo y título de la invitación de Atrio, incluidos los pasos aprobados por plataforma. Conservar un texto personalizado si lo envía la invitación. La copia inicial se comparte desde `installationInstructions` en el SDK canónico, sincronizado para los cuatro gateways. Verificar igualdad con `node scripts/check-gateway-installation-copy.mjs`; conservar el arranque diferido, los permisos nativos y el gesto de instalación.
- El usuario confirmó que kobe5483 solo agregó el acceso a Inicio en iOS. No existe todavía una señal `standalone_open` ni `appinstalled` y su estado permanece `unknown`; no crear una instalación histórica artificial. Se confirmará cuando abra la app desde el ícono y llegue la señal correspondiente.

Validación y publicación: [saldo, instalación y Datos](validation/atrio-balance-install-data-20261021.json). La migración `20261021200503_advisor_balance_snapshots.sql` está aplicada y permite al asesor leer su historial, pero solo el servidor puede guardarlo. La prueba aislada en Postgres 17 verificó permisos, saldo cero, respuestas tardías y vinculación de cuenta/bot; no ejecutó operaciones financieras. Se verificó la restauración del saldo con los componentes reales en Chromium y WebKit, móvil y escritorio, y la igualdad de las instrucciones por plataforma en los cuatro gateways. API2 no se modificó en este lote.

### Clasificación compatible y mediciones locales (20/10/2026)

- Las respuestas nuevas de API2 pueden incorporar un descriptor opcional y versionado: categoría, evento de origen y estado. Atrio lo valida y guarda como `metadata.api2_reply`, sin convertirlo en prueba financiera ni generar conversiones. La clasificación usa señales explícitas del origen, nunca palabras del mensaje.
- Categorías iniciales: procesamiento de archivo, estado de carga, estado de retiro, cuenta, soporte, conversación, promoción y sin clasificar. Conservar todos los mensajes y los callers antiguos; esta etapa no habilita filtros de entrega. Las respuestas adicionales sin señal inequívoca no heredan un éxito financiero.
- El outbox conserva el descriptor en su JSON y los reintentos conservan la misma clave de entrega. Un despliegue gradual puede recibir mensajes sin descriptor y no debe rechazarlos ni duplicarlos. No reescribir el historial ni modificar HG Cash u otros canales.
- Para medir localmente se puede ejecutar el adaptador real contra las cuentas de prueba autorizadas, cargar una ficha, verificarla, retirarla con consulta previa y confirmar el saldo inicial. Persistir los intentos antes de ejecutarlos y detenerse ante un resultado incierto. La operación 13 pendiente queda excluida. Estos tiempos no incluyen el circuito HTTP completo desde Atrio.

Evidencia: [clasificación y ciclos locales](validation/atrio-classification-and-local-cycles-20261020.json). API2 y Panel3 permanecen locales; el receptor compatible de Atrio se publica por su circuito habitual.

### Transición continua, preferencias de Full Carga y HTTP de Ases (20/10/2026)

- Ambos motores muestran una transición de marca al confirmar el nombre, incluida la espera de identidad/destino. El CTA conserva su texto. Una consulta de destino todavía pendiente o ya válida se reutiliza al enviar; sólo se reemplaza un resultado fallido. Reutilizar también el calentamiento del mismo gateway y detener la recuperación en segundo plano cuando la persona ya confirmó.
- Conservar los protocolos de identidad de cada motor. El clásico entrega su pase ya creado a `/prepare`; el constructor conserva el pase cifrado `p1`. La página común admite ambos y no vuelve a crear la cuenta del clásico. No añadir otro viaje de creación ni cambiar el bot, la cuenta o la atribución para igualar la presentación.
- Tras autenticar el casino, mantener una capa de marca mientras carga Atrio, con el casino detrás. Quitarla únicamente con el aviso del iframe autorizado de conversación utilizable y preparación de CBU terminada, o sin billetera configurada. La carga del iframe o una señal de otro origen no bastan. No añadir una demora mínima. Un fallo de CBU o una espera prolongada ofrece reintentar el mismo chat o continuar; no crea otra cuenta ni repite operaciones financieras. SDK y notificaciones siguen sujetos a su señal de disponibilidad existente.
- En Configuración → Bots de PBAdmin, cada bot Full Carga tiene un engranaje que abre sus switches en un modal de Atrio. Las ocho categorías comienzan activadas, incluidas las respuestas sin clasificación. El cambio sólo afecta futuras respuestas automáticas de API2 para ese bot; no modifica chips, operaciones, mensajes manuales, MKT ni mensajes históricos. Omitir un mensaje se registra atómicamente con su clave de entrega y no lo reactiva un reintento o un cambio posterior de preferencias. No enviar push de mensajes omitidos.
- La X del widget utiliza el tamaño de botón del perfil vecino; el UUID usa una fila compacta. Los cuatro ingresos manuales quitan el subtítulo, usan ojo para mostrar/ocultar y centran el texto inferior en una o dos líneas.
- Ases de Atrio puede cargar/retirar por el mismo formulario autenticado mediante HTTP, conservando campos exitosos del proveedor, sesión aislada, saldo fresco, importe, jugador y bot. El POST debe devolver su confirmación nativa coincidente y el saldo posterior debe verificar el movimiento con aritmética decimal exacta. HTTP 200 por sí solo no confirma. No seguir redirecciones ni reintentar un POST financiero; sólo antes de enviarlo puede emplearse el navegador anterior. Mantener la reserva persistida y el mismo intento ante incertidumbre. No modificar HG Cash ni otros canales.
- El login HTTP de Ases conserva cookies y comprueba el formulario autenticado de la cuenta; evita descargar home/avisos que no intervienen en la operación. Registrar tiempos de login, formulario, envío y comprobación, con el ID persistido de operación cuando está disponible. La verificación financiera tiene prioridad sobre el tiempo.
- No incorporar Redis por ahora: primero medir los procesos existentes. API2 y Panel3 siguen locales. La última muestra real del adaptador local dio carga 2,379 s y retiro 2,684 s incluida la consulta previa; terminó con las 500 fichas iniciales. No equivale al circuito completo de Atrio ni a un promedio o tiempo certificado de producción.

Revisión de los cinco puntos del programador y validación: [transición, preferencias y Ases HTTP](validation/template7-transition-full-carga-and-ases-http-20261020.md).

### Espera configurable antes del ingreso automático (21/10/2026)

- En Integraciones del Super Admin, agregar una tarjeta «Ingreso desde Template 7» con switch global y segundos enteros entre 1 y 60. Comienza desactivada y propone 4 segundos al activarla. Admins y asesores no pueden cambiarla.
- La espera es un tiempo mínimo de exposición de la tarjeta de usuario, contado desde que aparece. El autologin sigue en paralelo: esperar el mayor de los dos tiempos, sin sumar una pausa completa después de autenticar. Continuar permite adelantar la navegación una vez confirmada la cookie de sesión.
- Aplicar el mismo comportamiento a constructor y clásico, y los cuatro gateways. El clásico puede mostrar el usuario obtenido del handoff autenticado; no vuelve a crear la cuenta ni transmite usuario/contraseña por URL. Conservar el protocolo de cada proveedor y el Worker de Ganamos+.
- La configuración viaja en el JSON existente de preactivación. Su lectura privada comienza en paralelo con el login, tiene timeout acotado y ante un fallo conserva el acceso inmediato. No agregar un fetch del navegador ni bloquear el formulario inicial. La recuperación directa de sesiones y el login manual no incorporan esta espera.
- Esta decisión reemplaza la ausencia de pausa mínima únicamente en la tarjeta de usuario; la capa posterior del casino/chat conserva sus etapas reales, sin otra demora artificial. No cambiar API2, Panel3, atribución, bots ni operaciones financieras.

Evidencia y detalles: [espera de ingreso configurable](validation/template7-entry-wait-20261021.md).

### Template 8: selección de página antes del flujo de Atrio (22/10/2026)

- El usuario autorizó su implementación E2E con pruebas. Es un permiso independiente por cliente, administrado por superadmin como el del 7.
- Al publicarlo, Template 8 comienza deshabilitado para todos los clientes. También queda deshabilitado para clientes nuevos; el superadmin debe habilitarlo explícitamente por cuenta.
- Reutilizar el editor de tarjetas del 6: entre una y seis tarjetas, dos columnas y última tarjeta impar centrada. Cada tarjeta elige una página y conserva sus imágenes, texto y CTA.
- Es exclusivo de Atrio. Después de elegir una página se reutiliza el circuito del 7, con el mismo comportamiento en clásico y constructor. No crear otra landing para el paso intermedio ni duplicar el flujo hacia gateway/chat/CBU.
- Mantener la grilla hasta una selección explícita, incluso si se reconoce una cuenta durante la preparación. Después de seleccionar se recupera la cuenta de esa página y su vinculación existente; se ofrece ingreso manual cuando haga falta.
- Preparar por landing, página y visitante. Cada página utiliza sus bots y criterio de reparto; no se elige un asesor global para todas. Deduplicar recursos comunes y las tarjetas que apuntan a una misma página.
- En el editor, Template 8 usa una sola sección «Redirección», con la misma lista de asesores/bots y los controles de reparto del 7. No dividir la interfaz en bloques por página. La selección y el criterio son comunes; internamente cada tarjeta usa únicamente los bots seleccionados de su casino. Mantener las selecciones y los pesos guardados al reabrir.
- Una landing recién creada existe inicialmente como Template 1/WhatsApp. Al cambiarla a 7 u 8, permitir consultar los bots del cliente/workspace antes del primer guardado. Consultar no escribe destinos, asignaciones ni permisos; configurar mantiene la validación de la plantilla guardada y el ownership.
- El prewarm no crea cuentas, chats ni conversiones y no incrementa asignaciones. Sólo reserva IDs con expiración. Confirmar una única asignación al seleccionar, y verificarla en el inicio sin volver a repartir.
- Ganamos+ continúa pendiente de integración; no usar las conexiones ni la plataforma de Ganamos NET como reemplazo.
- Analíticas por tarjeta como en el 6, con página y texto preservados en el evento. Conservar el tracking y la deduplicación del flujo existente de Meta; la preparación no es una conversión.
- API2, Panel3 y las implementaciones de los gateways no cambian por Template 8. Las comprobaciones financieras siguen intactas.

Implementación, migraciones y prueba repetible: [template8-e2e.txt](template8-e2e.txt).

### Feedback de ingreso y movimiento del widget (23/10/2026)

- Al tocar Continuar después de crear la cuenta, mostrar inmediatamente un spinner y el estado en el propio botón, deshabilitado durante el ingreso. La navegación automática muestra el mismo feedback. Mantener la tarjeta, la espera configurable y su adelanto, la confirmación de cookie y el login único; no agregar demoras ni llamadas ni crear otra cuenta. El renderer común sirve clásico y constructor en los cuatro gateways.
- El chat se expande desde la posición real del botón flotante y se contrae hacia él al cerrar. Mantener el iframe montado y reutilizarlo; los cierres y aperturas rápidos no deben ejecutar un timer viejo contra un chat abierto. Quitar interacción y foco del panel desde el cierre y reducir su superficie a cero al terminar la contracción, conservando el acceso a los controles del casino. Respetar reducción de movimiento.
- Conservar una base oscura opaca en el borde inferior desde el HTML inicial, independiente del tema claro del widget y de los modales del proveedor. Reservar ese espacio en el chat móvil y mantener las zonas seguras. La capa no captura toques ni foco y no requiere SDK, cookies ni JavaScript. No cambiar el tema interior del chat.
- La animación común tiene fuente canónica en Rey y se sincroniza mediante `scripts/sync-gateway-chat-motion.mjs`; comprobar `--check` junto con las sincronizaciones de transición, apariencia y SDK. Conservar las identidades y los adaptadores de cada proveedor.
- Verificar CTA pendiente y recuperación de interacción con fixtures reales en navegador. El color de la barra nativa de Safari no se certifica con Playwright/WebKit: requiere la prueba física del iPhone del usuario. WebKit documenta que los paneles fijos pueden cambiar el tinte de su interfaz: https://bugs.webkit.org/show_bug.cgi?id=302272 y https://bugs.webkit.org/show_bug.cgi?id=301756.

Validación y publicación: [feedback y movimiento del gateway](validation/gateway-entry-ux-20261023.md). No modificar API2, Panel3, Atrio ni las verificaciones financieras por este ajuste de presentación.

### Paleta de la página y credenciales del cliente (23/10/2026)

- El borde y el fondo del navegador siguen el color propio de la página. Esta corrección reemplaza cualquier tono neutro fijo introducido en la mejora anterior. Usar una variable de paleta independiente del tema del widget, y conservarla desde el HTML inicial y al abrir/cerrar. El CSS común no debe sobrescribirla. Rey utiliza el gris de su página, Ases su azul y Ganamos sus tonos de marca. La barra nativa de Safari requiere validación en el iPhone real.
- En Mi perfil, el cliente puede consultar el usuario y la clave de la cuenta con la que ingresó al casino, con la clave oculta inicialmente, ojo y copiar. Obtenerlos solo a pedido mediante la sesión HttpOnly del gateway y el iframe autorizado. No incorporarlos al bootstrap público, URLs, almacenamiento del navegador ni analytics.
- En Configuración → Bots de PBAdmin, cada bot MKT/manual permite elegir Usuario o Soporte. Usuario comienza seleccionado, también para los bots existentes. Full Carga conserva sus chips y sus preferencias de respuestas de API2. No cambiar Cargar ni Retirar.
- El chip Usuario devuelve un mensaje del asesor con «👤 Te paso tu usuario y clave», «🆔 Usuario: …» y «🔑 Clave: …», usando la vinculación existente. El servidor valida una prueba cifrada, con vencimiento y ligada al jugador, cuenta, asesor, casino, conversación e intento. El navegador no elige la cuenta ni puede aportar una clave sin validar. Un reintento del mismo pedido devuelve el mensaje ya guardado. No crear usuarios, mensajes ficticios del cliente, LEAD, PURCHASE ni operaciones financieras.
- Conservar los protocolos de sesión de los cuatro gateways; Ganamos+ admite la consulta del perfil de una cuenta existente, sin inventar una integración MKT/PBAdmin. La configuración llega en el bootstrap existente, sin un viaje adicional al entrar.

Migración de Atrio: `20261023220427_manual_client_credentials.sql`. Pruebas y publicación: [paleta, perfil y chip Usuario](validation/client-credentials-palette-20261023.md).

### Movimiento del chat más pausado (23/10/2026)

- Ampliar de 280 a 520 ms la expansión desde el botón y la contracción hacia él en los cuatro gateways, conservando el recorrido y la curva existentes. Acompañar la duración con el desvanecimiento del botón y el fondo; completar el cierre antes de mostrar avisos aplazados.
- Mantener el iframe reutilizado, los controles del casino disponibles durante el cierre, la inversión rápida del movimiento y la preferencia de movimiento reducido. La paleta de cada página se conserva.

Validación y publicación: [animación del chat a 520 ms](validation/chat-motion-520-20261023.md).

### Transiciones sin cuenta regresiva (23/10/2026)

- Conservar la espera configurable de ingreso automático, incluido Continuar para adelantarla, pero retirar los segundos visibles. Corrección explícita del 26/10: no mostrar ningún texto referido a la redirección automática, tampoco un aviso fijo. El feedback del botón durante el ingreso real se conserva.
- En las transiciones y el CTA usar «plataforma» en lugar de «casino», tanto en clásico como en constructor y en los cuatro gateways. Conservar las rutas técnicas y nombres propios.
- Mantener el logo grande y su resplandor, paletas por marca y una jerarquía común de título, descripción y acción. Las descripciones y errores conservan al menos 12 px y pueden ocupar varias líneas centradas; no reducirlos a una tipografía diminuta para forzar una línea. Los títulos y nombres de usuario conservan el ajuste de ancho existente.

Pruebas y publicación: [transiciones de acceso](validation/entry-platform-20261023.md).

Corrección del aviso de redirección: [espera sin aviso](validation/entry-silent-20261026.md).
