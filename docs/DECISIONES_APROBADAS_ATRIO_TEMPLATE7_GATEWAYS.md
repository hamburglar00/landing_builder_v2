# Decisiones aprobadas de Atrio Template 7 y gateways

Actualizado el 19 de octubre de 2026. Este registro conserva los requisitos acordados con el usuario para que una mejora no elimine comportamientos ya aprobados. Se aplica a `landing-builder`, `landing-prueba-1`, `internal-chat`, `landing-autologuin`, `ases-gateway`, `ganamos-gateway` y `multi-skin-gateway`. API2 conserva su propio lote local.

Una decisión nueva reemplaza una anterior solo cuando el usuario cambia explícitamente ese requisito. Registrar el cambio aquí y verificar los comportamientos relacionados antes de publicar. Un build correcto o una prueba con sesión insertada artificialmente no demuestran que el navegador real conserve la cuenta.

Última publicación del ingreso real y retiro de bypass: [alcance, mediciones y validación del 17/10](./release/template7-real-entry-20261017/README.md). API2 y Panel3 permanecen locales.

SDK y notificaciones pospuestos hasta los datos de carga, junto con la corrección de hidratación de horarios: [publicación y pruebas del 17/10](./release/template7-deferred-app-20261017/README.md). Para cambios posteriores en este arranque, ejecutar `scripts/check-deferred-gateway-app.mjs` y `scripts/check-client-chat-hydration.mjs`, además de la sincronización del SDK y la prueba con CSS/JavaScript del casino retenidos.

## Regla obligatoria para mejoras compartidas en gateways

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
Facebook, Portofolio, Cuenta publicitaria, Campaña, Conjunto de anuncios y
Anuncio. Incluir los tres campos en búsqueda y exportación y en la ayuda del
editor. Template 7 usa la misma captura para Rey de Ases, Ases del Norte,
Ganamos NET y Ganamos+, sin cambiar su identidad ni acceso.

Al crear un cliente, Facebook, Portofolio y Cuenta publicitaria quedan
desmarcadas por defecto; el administrador puede habilitarlas. Las vistas
reducida y técnica incluyen estas columnas cuando están habilitadas para el
cliente. La ayuda del editor no muestra la explicación de persistencia ni
compatibilidad con `utm_campaign`.

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
| Configuración | Conexión con PBAdmin y Managers de PBAdmin colapsables y cerradas inicialmente en móvil; abiertas en escritorio. Mantener tarjetas oscuras, íconos y acentos dorados y botones coherentes. Retirar muestra una vista representativa de la solicitud real, con ícono; Soporte también tiene ícono. |
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

El 17/10/2026 el usuario informó que abrió Template 7 directamente desde Safari y creó únicamente `probando3540`. Cerró la pestaña, volvió a abrir Template 7 y fue redirigido al gateway con la misma cuenta. Después ingresó directamente al gateway y también conservó esa cuenta. Esto valida esos dos reingresos en Safari según su prueba manual, sin demostrar conservación de identidad al cerrar y reabrir la ventana interna de WhatsApp. La diferencia entre ambos recorridos apunta al almacenamiento del navegador interno; no confirma por sí sola su mecanismo de borrado o aislamiento.
