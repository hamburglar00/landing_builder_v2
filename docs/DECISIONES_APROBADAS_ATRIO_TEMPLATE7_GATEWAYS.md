# Decisiones aprobadas de Atrio Template 7 y gateways

Actualizado el 20 de octubre de 2026. Este registro conserva los requisitos acordados con el usuario para que una mejora no elimine comportamientos ya aprobados. Se aplica a `landing-builder`, `landing-prueba-1`, `internal-chat`, `landing-autologuin`, `ases-gateway`, `ganamos-gateway` y `multi-skin-gateway`. API2 conserva su propio lote local.

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

- En Atrio del constructor, ofrecer «Reiniciar contadores» y «Reiniciar mensajes» para el workspace, además de los mismos controles por asesor. El alcance incluye todos sus bots aunque la búsqueda o el filtro de activos oculten filas; describirlo en la confirmación. No reiniciar métricas reales al validar la interfaz.
- «Reiniciar mensajes» reinicia la métrica de chats iniciados, no cuenta cada mensaje individual. Cada conversación participa una vez, desde su primer mensaje del cliente. Los mensajes posteriores de un chat previo al reinicio no lo convierten en un chat nuevo. Conservar y mostrar los chats históricos.
- Guardar ventanas independientes para asignaciones y chats, sin borrar asignaciones, jugadores, cuentas, conversaciones, mensajes ni atribución. Los reingresos mantienen su bot. El reparto equitativo respeta estas ventanas y conserva su comparación por landing. Proteger los reinicios con la sesión del constructor, ownership de sus asesores y puente de servicio; ningún navegador puede aportar otro asesor por ID.
- Los selectores Aleatoria/Equitativa y Por contador/Chats iniciados de Template 7 utilizan el control segmentado oscuro, selección clara y tamaño compacto de los templates 1–6. Conservar las ayudas «i», pesos y borrador del editor.
- La etiqueta CARGA expresa una solicitud de carga, no una acreditación. El envío inicial automático de CBU no agrega esa intención. Los chats de medición antiguos pueden conservar etiquetas de la acción de carga ejecutada por el flujo anterior; no eliminar solicitudes reales ni modificar su historial al explicar ese estado.

Validación y publicación: [reinicios de bots y selectores del 20/10](validation/atrio-bot-metric-resets-20261020.json). La migración `20261020172854_builder_bot_metric_resets.sql` está aplicada y su versión coincide entre local y remoto. Los reinicios funcionales se probaron en Postgres aislado; en las cuatro pruebas de interfaz productiva se interceptaron las escrituras para conservar los contadores reales.
