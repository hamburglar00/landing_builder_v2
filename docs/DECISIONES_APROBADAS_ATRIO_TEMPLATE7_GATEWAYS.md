# Decisiones aprobadas de Atrio Template 7 y gateways

### Vista previa del editor con margen y Template 9 legible (05/11/2026)

- Dejar margen inferior visible en la tarjeta de vista previa, tanto en el editor de cliente como en el de administrador. Mantener el borde exterior completo y el contenido desplazable para alcanzar el resumen de gerencias, incluso en ventanas bajas.
- Template 9 usa el ancho disponible como viewport real, sin el doble escalado del editor que achicaba y difuminaba los textos. Mantener el HTML y CSS públicos, el formulario, el pie legal y el aviso de cookies; permitir recorrer su contenido sin ejecutar scripts, altas ni tracking.
- Conservar la composición propia de las miniaturas de galería y las demás plantillas. Este cambio sólo afecta al editor de Builder; no requiere cambios de gateways, Atrio, renderer clásico, API2, Panel3, migraciones ni funciones Edge.

### Formulario de gateways dentro de la pantalla (05/11/2026)

- Ajustar los cuatro gateways para que ingreso y registro entren sin scroll vertical ni horizontal, conservando margen exterior arriba y a los costados. Espaciado y logo se adaptan a la altura; en ventanas horizontales bajas, marca/ayuda y formulario se distribuyen en dos columnas. No ocultar el desborde del documento para recortar controles ni reducir los inputs por debajo de 16 px o los objetivos táctiles de 44 px.
- Fondo con degradados orgánicos del color de cada marca hacia negro, sin la cuadrícula anterior. Conservar logos transparentes, proporciones y paletas de proveedor/skin. Cambiar el texto a «Tu plataforma y tu asesor, en el mismo lugar.» y mostrar los CTA de ingreso y registro en mayúsculas, incluidos estados de espera.
- Implementación compartida en `gateway-auth-view.ts`, `gateway-login-page.ts` y `gateway-agency-page.ts`, sincronizada en los cuatro. Sin cambios de identidad, recuperación, llamadas, creación de cuentas o validación de gerencia; sin migraciones ni funciones Edge.
- Validación: 480 comprobaciones de navegador aisladas, dos motores, cuatro proveedores, diez tamaños (320×480 a 1920×1080; horizontal desde 568×320), incluyendo errores y registro; márgenes y cero desbordes comprobados. Además, 52 pruebas de ingreso/gerencia y TypeScript por gateway. Publicar Vercel y Worker Ganamos+; API2 y Panel3 siguen locales.
- Publicado en los cuatro dominios, incluido Worker Ganamos+ al 100 %. CSS productivo y texto verificados contra la fuente probada; [versiones, capturas y rollback](validation/gateway-auth-fit-20261105/README.md).

### Publicación del lote acumulado (05/11/2026, segunda entrega)

- Autorización expresa: hacer commit, push, migrar y desplegar todo lo pendiente de Atrio, Landing Builder (incluido el renderer clásico) y los cuatro gateways, con Ganamos+ también en Cloudflare. Reemplaza las notas de estado «local» de los apartados de este lote; conservar sus decisiones funcionales.
- API2 y Panel3 permanecen locales, sin commits, push, migraciones ni despliegues. Extensiones y las validaciones de gerencia que dependen de esos proyectos seguirán sujetas a su publicación posterior. Los subdominios nuevos por skin siguen pendientes de que el usuario elija el dominio.
- Alinear el nombre local de `entry_funnel_chat_diagnostics` con la versión remota `20261031132341`: SQL comparado e idéntico, sin reejecutarlo ni modificar el historial productivo. Actualizar únicamente sus referencias de pruebas.
- Publicar desde archivos de los commits sin `.env` ni `.dev.vars`; conservar las variables productivas y las versiones previas para rollback. Aplicar las tres migraciones nuevas antes de promover las aplicaciones. Verificar producción con lecturas, sin crear jugadores ni ejecutar operaciones financieras o eliminaciones de usuarios de prueba.
- Publicación completada: siete aplicaciones Vercel READY y promovidas, Ganamos+ Worker al 100 %, tres migraciones aplicadas y Edge Functions verificadas idénticas a sus fuentes. Pili recuperó sus tres chips; Gera conserva cuatro. API2 y Panel3 conservan exactamente su HEAD y cambios locales. [Versiones, pruebas, dependencias y rollback](validation/complete-release-20261105/README.md).

### Perfil interno, Conexiones y altas incompletas (05/11/2026, local)

- Administrador y superadmin pueden subir su propia foto desde «Mi perfil», en escritorio y móvil. Conservar las fotos de asesores. El RPC existente mantiene su firma, actualiza exclusivamente el perfil autenticado y rechaza sesiones PBAdmin revocadas; Storage limita la ruta de avatar al UUID del usuario. Mostrar la foto también en la navegación y el listado de usuarios.
- Al crear o vincular Atrio desde Extensiones, completar un token ausente y registrarlo en el broker PBAdmin. Conservar todo token válido existente y los demás ajustes; escrituras condicionales evitan reemplazos entre solicitudes concurrentes. No habilitar una integración expresamente deshabilitada. API2 ya guarda el token cifrado y completa las credenciales del bot por el usuario asignado; Panel3 indica la configuración automática sin exponer el token. Ninguna llamada nueva al recorrido landing → gateway.
- Renombrar «Conexión con PBAdmin» a «Conexiones», explicando UUID para Landing Builder y AtrioToken para PBAdmin. Analíticas abre en «Hoy», con el día de Argentina y sin cambiar las opciones de período existentes.
- Ocultar de la UI el enlace directo del asesor: retirar la card «Mi link», compartir/copiar y la columna de enlace. Conservar el slug, las rutas públicas y los enlaces ya emitidos. En administración, el slug queda como identificador interno sin dominio; no borrar ni regenerar identidades.
- Diagnóstico productivo de Pili (`pilar.asesor@gmail.com`, slug `pili`): perfil existente, dos respuestas rápidas y cero chips. La función `invalidate_gateway_chat_preparations` ejecutaba DELETE sin WHERE y safeupdate lo rechazaba; afectaba guardado de estilo y creación de chips. Logs mostraron 364 rechazos con ese error en la ventana consultada. Gera conserva los chips creados anteriormente; no es un permiso especial de ese asesor.
- Migración correctiva `20261105201307_internal_profile_setup_fixes.sql`: invalidación con condición explícita, sin desactivar safeupdate; restaurar defaults exclusivamente cuando el conjunto de chips está completamente vacío. El alta nativa y PBAdmin comprueban errores de inicialización y preservan configuraciones personalizadas. Reproducción y corrección verificadas en PostgreSQL Supabase desechable con safeupdate real; sin cambios de datos productivos.
- Validación: TypeScript, 22 pruebas de analíticas, 17 escenarios Auth/PostgreSQL/PostgREST (incluye vincular una integración vacía y conservar su token al reintentar), 8 escenarios visuales de foto para ambos roles en móvil/escritorio Chromium/WebKit. Lote local, sin publicación ni migración productiva. API2 y Panel3 no se modificaron en este ajuste.

### Medición completa de entrada y eliminación de equipos Atrio (05/11/2026, local)

- Ampliar la trazabilidad común de templates 7/8/9 hasta el compositor del chat visible y utilizable. Conservar identidad, cuentas, firmas, deduplicación y el criterio de `chat_usable`; bienvenida y billetera pueden terminar después y se miden por separado. La telemetría permanece asíncrona y no añade viajes bloqueantes al ingreso.
- Agregar DOM/load, primera pintura, instantánea de LCP y bloqueo del navegador cuando las APIs lo permiten; solicitudes conocidas por duración total, navegación/renderizado del iframe y tiempo visible → utilizable. La primera visita empieza en el origen temporal de navegación. Conservar separación por intento, cuenta nueva/recuperada, proveedor y skin. No recoger URLs, parámetros, nombres ni credenciales; ni atribuir a un proveedor visibilidad sobre su procesamiento interno.
- Corregir el envío al ocultar/salir: enviar todos los lotes pendientes, también en fallback keepalive, conservar IDs al reintentar y deduplicar en SQL. El reporte `scripts/entry-performance-report.sql` ofrece cobertura, percentiles, errores y línea temporal. Las etapas se solapan y no deben sumarse para inventar un total; una medición ausente no demuestra abandono. LCP/bloqueos son instantáneas del ingreso, no métricas de toda la sesión.
- Lectura productiva del 05/11: 18 recorridos T7 con un único clic y chat utilizable en siete días, mediana clic → utilizable de 11,5 s y p90 de 18,4 s. Muestra pequeña, potencialmente incluye pruebas; no hubo muestra completa T8/T9 para comparar. No se reprodujo un alta real en el sitio mencionado por el usuario.
- Confirmación explícita del usuario: superadmin puede eliminar admins y asesores; admin, sólo sus asesores. Eliminar un admin incluye su equipo. Se permiten borrar chats y contactos, mostrando alcance y exigiendo escribir `ELIMINAR`. No se eliminan superadmins ni la propia cuenta. Si cambia el alcance, se exige revisarlo otra vez.
- La eliminación de datos relacionales, accesos Auth, rutas y vínculos PBAdmin de Atrio es atómica. Los archivos se retiran mediante Storage API con cola durable y reintento visible también tras recargar; no se eliminan objetos de Storage directamente con SQL. Los JWT antiguos no mantienen permiso de subir archivos y los UUID eliminados no pueden recrearse por una autorización PBAdmin antigua. Conservar datos y archivos compartidos de otras cuentas. Bots de API2 y cuentas del casino permanecen; sus enlaces al asesor eliminado dejan de funcionar.
- Implementación local: aplicar primero Builder `20261105193317_entry_render_timings.sql` y Atrio `20261105193319_internal_user_deletion.sql`, luego publicar Builder/clásico, Atrio y los cuatro gateways (incluido Worker Multi Skin). Ninguna migración productiva, eliminación real, commit, push ni publicación se realizó en este lote. API2 y Panel3 permanecen locales.

### Tarjetas de canal, ejemplos de teléfono e ingreso de gateways (05/11/2026, local)

- Restaurar en el editor la tarjeta informativa de canal: WhatsApp en templates 1–6 y Atrio en 7–9. Conservar el canal fijo por plantilla y los selectores de casino existentes; la tarjeta no modifica el destino ni aparece como información técnica en la landing pública.
- Usar `11 0000-0000` como ejemplo ficticio en la captura de teléfono de T7/T8/T9 y en los formularios de cliente/configuración de asesor de Atrio. No precargarlo como valor ni modificar teléfonos guardados. La revisión de fuentes encontró también el teléfono anterior como contacto de soporte en `Otros/landing-venta-asistente/configuracion.js` y `link_ganamos_multiowner/config/soporte.json` (deshabilitado); se conservan esos destinos funcionales y se informa al usuario.
- Mejorar formulario, tarjeta y fondo del ingreso genérico y por gerencia en los cuatro gateways. Presentación canónica en `landing-autologuin/src/lib/gateway-auth-view.ts`, incluida en `scripts/sync-gateway-login.mjs`. Conservar logos transparentes, colores por marca, las 14 skins, campos/autocompletado, recuperación, cookies, verificación del circuito y alta exclusivamente por gerencia. Ajustar contraste del texto del CTA según su color y respetar movimiento reducido.
- El dominio genérico recupera la sesión o valida las credenciales del casino y resuelve exclusivamente la vinculación existente de Atrio. Tener sólo un usuario del casino no crea esa vinculación: el primer acceso debe hacerse por el enlace de gerencia del asesor.
- Validación local: 52 pruebas de ingreso/gerencia por gateway (208), TypeScript en los cuatro gateways, Builder y Atrio; 26 pruebas de render público/T8/T9; 48 escenarios de gerencia y 68 de ingreso genérico en Chromium/WebKit, móvil/escritorio, usando respuestas ficticias. Se verificaron las nueve tarjetas de canal, los placeholders de T7/T8/T9, sincronización SDK/ingreso y renderer clásico. Sin consultas de red adicionales en producción ni cambios en el recorrido template → gateway.
- La galería de prueba aprobada se conserva. Este ajuste permanece local; no se realizó commit, push, despliegue ni cambios de datos productivos.

### Subdominio por skin y detalle de Descargas (05/11/2026, sólo local)

- El usuario eligió subdominios por skin: `bet30.<dominio>/<agency_id>`. Multi Skin conserva una sola gerencia operativa, bot, asesor y cuenta compartida; la skin fija presentación y destino, no autoriza cambiar la pertenencia.
- La galería enumera una tarjeta por gerencia + skin (las 14 actuales), con filtro, marca y enlace propios. Administrador ve su administración; Marketing, sus bots. Sin dominio configurado, las skins nuevas quedan visibles con «Dominio pendiente» y sin acciones de abrir/copiar. Ganamos+ conserva su dominio actual como compatibilidad.
- Configurar el mismo `MULTI_SKIN_GATEWAY_BASE_DOMAIN` (dominio sin protocolo/ruta) en API2, Builder, motor clásico, Atrio y Multi Skin gateway. El catálogo canónico está en `frontend/lib/multi-skin-origins.ts`; `scripts/sync-multi-skin-origins.mjs --check` verifica sus copias. Panel3 recibe el dominio desde API2; no requiere una variable pública independiente.
- Templates 7/8/9 y el motor clásico resuelven el subdominio sin consultas de red adicionales. Las URLs anteriores siguen funcionando. Los nuevos hosts fijan la skin y rechazan pases/sesiones de otra skin. Cookies y recuperación permanecen por host. Atrio comprueba origen, proveedor y skin firmada; su CSP de `/embed` permite exclusivamente los hosts configurados.
- Activación pendiente: elegir dominio, configurar DNS/HTTPS y los 14 custom domains del Worker Multi Skin (o el alojamiento elegido), cargar la variable antes del build de Atrio/Builder/clásico y en el runtime de API2/gateway, publicar coordinadamente y verificar ingreso/chat reales. No modificar los dominios existentes ni habilitar un wildcard de confianza. Los cuatro gateways mantienen los módulos comunes sincronizados.
- Descargas: guardar motivo, proceso/usuario, fecha y resultado conocido de fichas junto con la cancelación. Pedir motivo en la cancelación manual y conservarlo al forzar. No reconstruir motivos históricos. Un solo estado principal de pago; la información de billetera permanece en el detalle. Un pago incierto nunca se presenta como pagado.
- El estado y las decisiones monetarias no se alteran: saldo de agencia insuficiente conserva pendiente y usa el aviso existente de retiros, sujeto a la configuración de Telegram. El rechazo HG mantiene pendiente; no se convierte en cancelación. Los mensajes humanos de recepción de comprobantes ya están incluidos en API2 y se verificaron.
- Esta entrega permanece completamente local, sin commit, push, despliegue ni operaciones reales. Descargas requiere aplicar `20261105000001_add_withdrawal_cancellation_details.ts` antes de publicar API2 y coordinar el formulario Panel3. No se ejecutó esa migración fuera de la base desechable de pruebas.

### Vinculación elegida por el usuario y galería de gateways (05/11/2026, local)

- El usuario reemplazó el mapa previo de cuentas y sus exclusiones por autoservicio: nadie se vincula por coincidencia de email ni por correspondencias precargadas. «Ya tengo cuenta» verifica las credenciales nativas y vincula esa cuenta; «Crear cuenta» prepara una identidad nueva. No borrar vínculos realmente creados ni datos existentes para simular este estado inicial.
- Elección explícita de contraseña: usar la identidad PBAdmin mediante «Ingresar con PBAdmin», sin copiar su contraseña ni pedir otra para las altas nuevas. Las cuentas anteriores conservan sus credenciales nativas y sesiones independientes. El autologin sólo abre vínculos existentes; no crea una cuenta al navegar por el login.
- Builder mantiene un cliente por administración y accesos por persona. Atrio mantiene un administrador por administración y un asesor por persona; al vincular un administrador nativo se elige un asesor propio o se crea uno nuevo. Un asesor Marketing sólo puede vincularse al administrador Atrio ya enlazado a su administración PBAdmin. No reubicar asesores ni chats.
- Las credenciales nativas se usan exclusivamente para verificar propiedad durante la vinculación; no se guardan en el broker, URL ni navegador. Conservar autorización breve de un solo uso, PKCE, comprobación del rol y unicidad entre administraciones. Un error de contraseña de la extensión no cierra la sesión PBAdmin.
- Conservar ARS, defaults actuales del constructor, importación/reconciliación de bots y URL Post personalizada. Las landings de prueba y los asesores compartidos anteriormente no se trasladan; los conflictos de importación siguen requiriendo revisión.
- La galería de gateways adopta proporción 3:4, grilla de hasta cuatro columnas, imagen estática, degradado inferior y animaciones de elevación/zoom como la galería del constructor; respetar movimiento reducido. Conservar «Abrir»/«Copiar», estados y permisos existentes.
- Este ajuste está implementado y validado sólo en local en API2, Panel3, Builder y Atrio. Requiere publicar coordinadamente el nuevo endpoint privado `/api/pbadmin/connect` y el broker con intención persistida antes de activar. Sin altas reales, limpieza de cuentas, migraciones productivas, commit ni push en este lote.

### Galería de gateways en Extensiones (05/11/2026, local)

- Agregar la cuarta tarjeta «Gateways» y una galería con «Abrir gateway» y «Copiar enlace». Administrador: gateways de su administración. Marketing: únicamente las gerencias operativas de sus bots Atrio; no usar la referencia histórica. Superadmin conserva alcance global. Cajero sigue sin Atrio, ya que sus roles de bot son Ads/Asistente.
- El alcance se comprueba en API2; una tarjeta por gerencia, sin credenciales en la respuesta. Los cuatro dominios públicos y sus logos transparentes se conservan. La galería usa vistas estáticas, sin sesiones, iframes ni llamadas a casinos/Atrio; no cambia el recorrido template → gateway.
- La presentación distingue configuración local, pausas, datos incompletos y vínculos duplicados. El gateway sigue verificando el circuito real al ingresar. El listado no depende de activar el autologin de Extensiones.
- API2 y Panel3 permanecen locales. La vista de prueba de la galería muestra datos ficticios identificados como tales; no suplanta la galería de la cuenta real.

### Template 9: logos de los gateways, Ases azul y galería (05/11/2026)

- Usar los mismos logos transparentes y visibles del ingreso de los gateways, conservando sus proporciones, también para las skins. Reemplaza los iconos cuadrados anteriores de T9; conservar las otras paletas, salvo Ases del Norte.
- Ases del Norte adopta la paleta del login público indicado por el usuario: fondo `#071b2c`, acento/CTA `#36a8eb` y texto del botón `#08080b`. Reemplaza la elección anterior negro/plateado para T9.
- La miniatura debe llenar el ancho de la tarjeta de galería, como las otras plantillas, mostrando la marca y el formulario con escala legible. En la galería no se muestran el pie y el aviso de cookies; ambos permanecen completos en la vista previa del editor y en la landing pública. Sin interacción, scroll independiente ni llamadas de alta/tracking desde la miniatura.
- Presentación canónica de Builder compartida con el renderer clásico. Verificar los cuatro proveedores y las skins; sin cambios en API2, Panel3, ingreso, tracking o finanzas.

### Publicación del trabajo pendiente (05/11/2026)

- El usuario autorizó hacer commit, push y despliegue de todo lo implementado en Landing Builder, Atrio y los cuatro gateways, incluidas las migraciones y funciones necesarias. Esta autorización reemplaza la condición de mantener locales esos proyectos en las entradas anteriores.
- API2 y Panel3 permanecen exclusivamente en local: sin commit, push, despliegue ni migraciones productivas. No activar Extensiones hasta configurar y publicar ambos extremos. El ingreso `/<agency_id>` muestra «Enlace no disponible» mientras API2 no provea el circuito requerido.
- Publicar también Ganamos+ en su Cloudflare Worker, además de Vercel. Verificar los dominios públicos sin crear jugadores, vincular clientes excluidos ni ejecutar operaciones financieras.
- La comprobación productiva detectó que Workers no admite `fetch` con `redirect: "error"`. Usar `manual` en los dos puentes compartidos de ingreso y rechazar toda respuesta no exitosa, incluidos 3xx, sin seguir ubicaciones ni reenviar secretos. Aplicar a los cuatro gateways. Compilar Cloudflare desde un archivo del commit sin archivos de entorno locales; verificar que `next-env.mjs` no incorpore valores y conservar sólo los bindings productivos del Worker.

### Usuario dentro de la confirmación de Full Carga (05/11/2026, local)

- El usuario pidió integrar el usuario acreditado dentro de la misma frase, con monto y usuario en negrita: «Listoo 🙌 ya te quedaron acreditados **$10.000** en tu usuario: **pepe123**». Aplicar a las variantes automáticas con y sin bono, reemplazando la línea separada «👤 Usuario».
- El cambio vive en el texto compartido de API2 para los canales de Full Carga y los cuatro gateways. Conservar el importe/bono separado, el cierre de instrucciones de juego en Atrio y la confirmación sin usuario cuando no se pueda recuperar ese dato. Los textos manuales de Atrio y los retiros conservan su formato.
- Sólo presentación, en local; no modifica ejecución financiera, credenciales, destinatarios ni mensajes históricos. Pendiente de despliegue de API2.

### Extensiones PBAdmin, identidad y altas (04/11/2026, decisión inicial)

Las correspondencias y exclusiones automáticas de esta entrada fueron reemplazadas por la decisión de autoservicio del 05/11/2026 registrada arriba. Se conserva esta entrada como antecedente; sus demás restricciones siguen vigentes.

- El usuario autorizó implementar con sumo cuidado el hub «Extensiones» en Panel3. Builder aparece para administrador de administración (rol 0); Atrio para administrador y marketing (rol 3). Cajero sólo tiene Ads/Asistente y conserva Tracking, sin alta de Atrio. El superadmin conserva sus herramientas de gestión; no se crea un constructor personal para él.
- Un constructor por ID de administración, con la persona identificada por sesión. El administrador PBAdmin entra como `client` de Builder. Las cuentas nuevas usan identidad PBAdmin; los logins de Builder/Atrio ofrecen «Ingresar con PBAdmin» y solicitan las credenciales exclusivamente en Panel3. Las credenciales nativas existentes se conservan.
- Autologin mediante código opaco de 60 segundos, canje único, PKCE y estado del navegador. Secretos permanentes sólo entre servidores. Reservas durables, UUID estable y reintentos sin reemplazar cuentas. Nueva configuración del constructor mediante la misma rutina de alta manual, respetando los defaults de módulos y del plan. ARS en altas; conservar workspaces PYG existentes.
- Atrio nuevo: administrador por administración y asesor personal por usuario, también para el administrador. Marketing puede iniciar el alta antes que su administrador. Acceso de administrador con cambio a su propio asesor y retorno sin contraseña. Las credenciales del bot se resuelven para su usuario asignado; se mantienen las validaciones de token, gerencia operativa y manager actuales.
- Corresponden nueve clientes Builder: morejorge→37, fabi→23, diego→25, ailuc→43, tuga→6, elmueca→32, goldencajeros→18, ducklucknuevageneracion→14 y chiva77→7. Las correspondencias por UUID revisadas viven en API2; no inferir nuevas uniones por email. Andres (owner 19) y Golden independientes.
- No vincular por ahora los Atrio existentes de Gera, Diana, Bianca–Colo ni Cunia. Gera/Chiva (7) y DianaAgencias (33) confirmados; 8 y 18 son candidatos sin confirmar y requieren revisión antes de un alta nueva. Conservar también Gera y Diana en las landings de prueba del constructor Golden; no moverlos ni reemplazarlos al importar Chiva.
- Importación inicial y reconciliación de bots en segundo plano, conservando landings, configuración propia y el botón manual de vinculación. No agregar llamadas al recorrido template → gateway. Los conflictos se informan como pendientes de revisión, sin apropiarse de registros de otro workspace.
- Completar URL Post sólo si está vacía; preservar URL existente y toda edición manual, incluso el vaciado posterior a vincular. Acción explícita para restaurar la URL del constructor. Conservar las restricciones de los cuatro gateways; este lote se limita a las cuentas internas.
- Todo este lote permanece local: sin altas reales, migraciones productivas, despliegue, commit ni push. Las banderas de activación requieren migraciones y configuración de ambos extremos antes de habilitarse.

### Enlace del gateway por gerencia (04/11/2026, preparado en local)

- El usuario autorizó `/<agency_id>` para los cuatro gateways. Antes de mostrar ingreso/alta, validar dominio/proveedor, gerencia operativa activa en API2, un único bot Atrio, su asesor, token vigente con `messages.write`, conexión activa y cuenta real de Atrio habilitada. Sin circuito completo, mostrar enlace no disponible, sin elegir otro destino.
- El ingreso comprueba usuario, clave y pertenencia a esa gerencia con el casino antes de vincular. Reutilizar la cuenta/chat existente y rechazar reasignaciones. Un jugador procedente de WhatsApp conserva su ID, creador e historial; API2 registra una autorización explícita por jugador/bot/gerencia. No duplicar su registro ni reiniciar bonos/saldos. Esta excepción no modifica las reglas del login genérico, que continúa recuperando sólo cuentas previamente vinculadas.
- «Crear cuenta» pide el nombre y reutiliza la provisión durable por bot. Reintentos conservan el identificador privado del navegador; no crear otra cuenta para resolver un error. Se ingresa al casino con el widget; las credenciales permanecen disponibles mediante el perfil privado existente, sin agregarlas a URL ni almacenamiento público.
- Logo transparente y visible en los cuatro formularios de ingreso. Se reutilizan recursos existentes, sin el icono de aplicación con fondo sólido.
- Las validaciones nuevas se ejecutan sólo desde el enlace por gerencia y su endpoint. El recorrido template → preparación → gateway conserva sus consultas y contratos. La comprobación de permisos de los jugadores originales conserva la salida sin consulta adicional.
- API2 sigue exclusivamente local y a cargo del programador. No se aplicaron migraciones productivas ni se publicó este lote. [Implementación, pruebas y orden de activación](validation/gateway-agency-20261104/README.md).

### Ajuste de jugadores, visibilidad y origen en Estadísticas (04/11/2026)

- En Recorrido, «Primeras cargas» y «Cargas -> recargas del periodo» muestran jugadores distintos del canal y período, no operaciones ni cantidad de recorridos publicitarios. Una persona que recarga varias veces cuenta una vez en esa última etapa. El ejemplo de 51 jugadores y 38 recargas de 16 jugadores se muestra como 51 → 16 (31,4 %). En Resumen general se mantienen operaciones con subtítulos de jugadores.
- Ocultar CompleteRegistration/«Crearon usuario» de toda la estadística general de WhatsApp: sólo aplica a Full Carga, por lo que no debe ser una etapa ni condicionar tasas de los demás bots. Conservar su captura y sus eventos existentes. Atrio conserva su medición interna de altas confirmadas.
- Si el cliente tiene `show_atrio` apagado, no mostrar chips y usar exclusivamente WhatsApp, incluso si había una selección anterior de Atrio. Superadmin conserva ambos canales.
- Atrio sólo admite origen Landing: al seleccionar su chip fijar ese origen, bloquear el selector en Landing y excluir registros de WhatsApp Cloud API/Chatrace de sus estadísticas. WhatsApp conserva los tres orígenes.
- Restaurar tarjetas compactas en una sola fila de escritorio para Resumen general (siete) y Embudo de conversión (cuatro en WhatsApp, tres en Atrio), adaptándolas a móvil. «Sin medición» usa la mitad del tamaño del valor numérico. No modificar tracking, migraciones, ingresos/operaciones financieras ni API2.
- [Validación del ajuste](validation/conversion-statistics-refinements-20261104.md).

### Estadísticas por canal y significado de los eventos (04/11/2026)

- Los chips «WhatsApp» y «Atrio» filtran toda la card de Estadísticas: resumen, recorrido, porcentajes, ingresos, gasto/ROAS, mapa, tablas, gráficos y contexto del asistente. No mezclar ambos canales. Ocultar «Frecuencia de mensajes por cliente» y mostrar el importe gastado y su input en negrita; mantener gastos independientes por canal durante la consulta.
- «Plataforma de origen» ofrece únicamente Landing, Chatrace y WhatsApp Cloud API (más Todas, mostrando los valores presentes). Atrio es el canal de atención, no una cuarta opción de origen. Ambos filtros se combinan.
- WhatsApp general: CTA Contact → mensaje Lead real → primera carga Purchase. CompleteRegistration sigue disponible para Full Carga, pero no se muestra ni condiciona el embudo general. Atrio: CTA con Lead/CompleteRegistration elegido → Purchase; no interpretar el nombre del evento del CTA como alta o mensaje humano. El resumen distingue «Solicitaron usuario» de «Crearon usuario».
- Contar altas de Atrio sólo desde la respuesta positiva de creación nueva de API2, mediante una medición interna posterior a la respuesta, sin otro evento Meta, credenciales ni cambios en acceso o finanzas. Compartir el registrador en Builder y clásica y verificar Rey, Ases, NET y Multi Skin. Las cuentas existentes no generan altas. WhatsApp depende del emisor preparado sólo en local en API2.
- Preservar el destino capturado de cada recorrido y su pertenencia por propietario, landing y gerencia; nunca reclasificar historia usando la configuración actual de una landing. Las nuevas visitas guardan su canal en inserción. Los históricos inciertos quedan señalados y excluidos; falta de medición no equivale a cero.
- Filtrar cada hito por su fecha, deduplicar entregas/operaciones y calcular tasas sobre etapas compatibles del mismo recorrido, sin inferir mensajes ni altas por una compra. No reconstruir registros históricos ni emitir eventos para probar esta mejora.
- Validación y publicación: [estadísticas por canal](validation/conversion-statistics-channels-20261104.md).

### Vincular Bots: modal y controles (04/11/2026)

- El acceso y el título pasan a «Vincular Bots». Usar selector personalizado, campos visibles del tema y ancho compacto, conservando Agency ID, Owner ID, gerencia manual y vínculo Atrio con sus permisos actuales.
- Corregir la pérdida de foco al escribir o seleccionar mediante callbacks de cierre estables del componente local. No cambiar importación, sincronización ni servicios externos.
- [Validación](validation/bots-link-modal-20261104.md).

### Template 9: páginas legales y proporciones finales (04/11/2026)

- El usuario autorizó terminar/publicar T9 y después preparar sólo en local el evento de alta exitosa de Full Carga WhatsApp. API2 sigue sin commit/push/despliegue.
- Conservar el tamaño de tarjeta/logo/campo/CTA de la referencia en escritorio, limitar el ajuste compacto a móvil y mostrar la página completa en las miniaturas y vista previa, incluido el pie.
- Los cuatro enlaces legales abren páginas propias por landing, con la marca/skin y país del workspace. Usar texto adaptado al funcionamiento real, sin contactos ni condiciones comerciales ajenas. No iniciar cuentas ni medición publicitaria desde esas páginas. Conservar el runtime/tracking y las demás plantillas.
- [Implementación, validación y publicación](validation/template9-legal-release-20261104.md).

### Evento del CTA y mensajes internos de Atrio (04/11/2026)

- El usuario cambió explícitamente el disparador: en T7/T8/T9 emitir el evento elegido al enviar un formulario válido con el CTA, antes del resultado de creación, igual que la referencia pública. El selector ofrece Lead o CompleteRegistration, uno solo por acción; conservar ID, captura, FBC por landing/píxel y deduplicación. Sin elección guardada, usar Lead para preservar las campañas existentes. No cambiar Contact de T1–T6.
- La captura interna del clic mantiene su registro y lineage actuales. El nombre enviado a Meta se guarda con el evento, de modo que un reintento no lo cambie por una edición posterior. El servidor decide el evento desde la configuración publicada; ignorar marcadores aportados por el navegador. CompleteRegistration agrega status registered. Conservar las preferencias CAPI, las rutas de WhatsApp y Purchase.
- Ni la llegada visible, ni el primer mensaje humano ni sus reintentos emiten eventos a Meta desde Atrio. Conservar mensajes, bot, avisos y estadísticas internas de personas que escribieron; excluir mensajes automáticos de esa métrica. Una única implementación cubre widget, chat completo y los cuatro gateways.
- API2 permanece sólo en local: cron de cierre confirmado cada cinco minutos y logs HG observacionales, acotados y sin datos de cuenta o credenciales. No modificar saldos, estados, reintentos monetarios ni filas históricas para verificar el diagnóstico.

### Editor y presentación responsive de Template 9 (04/11/2026)

- Ocultar el campo «País donde circulará la landing» en todos los editores. Conservar la asignación automática AR/PY por workspace y su persistencia; no cambiar tracking ni validación de teléfonos.
- Template 9: Rey de Ases usa negro/dorado; Ases del Norte usa negro/plateado, incluidas superficies, textos y contraste de botones. Conservar los logos, las paletas de NET/Plus y las demás skins.
- La galería usa una miniatura sin scroll ni interacción propia que impida abrir la landing. La landing pública adapta espacios y tamaños a celulares; el aviso de cookies participa del layout y no cubre el formulario o el pie. Mantener todos los contenidos legales en la página pública y permitir desplazamiento accesible si el teclado o contenido personalizado excede la altura disponible.
- Implementación canónica de presentación en Builder, compartida con el renderer clásico. No cambia el runtime T7, redirecciones, gateways, API2 ni operaciones financieras. Verificación y límites: [validación visual](validation/template9-layout-20261104/README.md).

### Directorio unificado Bots y checkpoint del constructor (04/11/2026)

- El usuario aprobó reunir Teléfonos, Atrio y Gerencias en una única pestaña «Bots», con la estética de Teléfonos y su administración por gerencia. Antes de comenzar pidió un checkpoint: commit local `027d4db`, etiqueta `checkpoint/constructor-pre-bots-20261104`, que incluye las modificaciones locales anteriores de visibilidad.
- Agregar gerencia permite importar por Agency ID o por Owner ID de PBAdmin, además de conservar la gerencia manual y el vínculo manual a un asesor existente. La importación enlaza asesores existentes; no crea asesores, jugadores ni cuentas de plataformas. Conservar nombres editados, asignaciones, teléfonos y contadores existentes.
- Mantener una sola entrada de navegación en cliente y superadmin; las seis rutas antiguas redirigen a Bots. «Bots de Atrio» sigue controlado por el permiso opcional `show_atrio`; deshabilitarlo no oculta la administración de WhatsApp. El superadmin conserva sus propios módulos.
- Agrupar Atrio por propietario del workspace y gerencia operativa de cada conexión; los IDs sintéticos de gerencias manuales no identifican gerencias PBAdmin. Mantener visibles los asesores sin bots y las conexiones sin gerencia registrada, sin registrarlas automáticamente en la sincronización de teléfonos.
- El directorio privado de API2 devuelve metadatos por gerencia/propietario, incluyendo bots inactivos o sin teléfono. Conservar la asociación MKT mediante `purchase_settings` y la gerencia operativa de MKT Atrio; el endpoint público `random-contact` no cambia. Atrio aporta el nombre y slug actuales del asesor mediante un puente autenticado.
- Los snapshots `gerencias.pbadmin_bots` y `atrio_clients.pbadmin_bots` son exclusivamente visuales. Los bots de Atrio sin conexión real se muestran como pendientes, sin habilitarles acciones por ese snapshot. No habilita teléfonos, redirecciones, credenciales ni operaciones. Cargarlo sólo al pedir el inventario desde Bots, no desde los lectores de gerencias del editor de landings. La sincronización manual puede refrescarlo; no agrega un cron.
- Los reinicios mantienen sus implementaciones existentes y confirman el alcance: WhatsApp por número/gerencia; Atrio por asesor o workspace completo, conservando históricos. Los filtros no reducen el alcance de un reinicio global. Este lote no modifica lógica financiera ni de ingreso; API2 permanece local y a cargo del programador para desplegar.
- Implementación, límites de transporte, evidencia y publicación pendiente: [validación del lote](validation/unified-bots-20261104/README.md).

### Secciones opcionales del constructor (04/11/2026)

- Ocultar el acceso a Planes en los menús de cliente y superadmin, tanto en escritorio como en móvil. Conservar las reglas de suscripción existentes.
- El superadmin administra por cliente la visibilidad de WhatsApp API, Seguimientos y Notificaciones, junto con Atrio, Kommo y Chatrace. Notificaciones usa el mismo mecanismo de persistencia y protección de pantallas que los otros módulos.
- Todas las opciones de visibilidad parten deshabilitadas cuando falta una habilitación guardada, incluido Logs. Conservar los valores ya guardados; no realizar un apagado masivo de cuentas existentes. Las integraciones y tareas en segundo plano conservan su funcionamiento.
- El superadmin conserva disponibles sus propias secciones e integraciones. Los valores por defecto deshabilitados se aplican al espacio de los clientes y a su formulario de configuración.

### Entrada paralela, sesión reutilizada y catálogo privado (03/11/2026)

- Autorización expresa posterior: «Implementa todo. Luego comittea y pushea. Aplica migraciones y deploya si hace falta». Incluye terminar y publicar la medición local, herramientas diferidas, preparación anticipada, independencia del HTML del casino, reutilización de sesión y catálogo sincronizado. Conservar el trabajo autorizado de T9 pendiente en el mismo conjunto; API2 sigue a cargo del programador.
- Tras validar el pase y resolver su cuenta exacta, preparar el chat en paralelo con el login. Es la precarga oculta existente: sin bienvenida, CBU, LEAD ni actividad financiera. La caché privada dura 30 s, guarda únicamente estructura/configuración y vuelve a consultar mensajes actuales; no almacena contraseñas ni copias del historial. Revalida la pertenencia que ya exigía el bootstrap y se invalida al editar configuración. Los fallos de preparación no bloquean el login.
- El acceso automático autenticado abre `/entry`: el chat conserva su implementación y el casino carga en un iframe del mismo gateway, independientemente de su HTML. Suprimir exclusivamente el chat duplicado en ese iframe, mediante comprobación del padre y mismo origen. La navegación a login/logout abandona la envoltura; entradas manuales, adaptadores, validaciones de HTML y sesiones del proveedor conservan su funcionamiento. Medir la navegación del casino por separado de la envoltura. Cubrir Rey, Ases, NET, todas las skins y el Worker público.
- Reutilizar exclusivamente una sesión del mismo jugador/cuenta/asesor/proveedor/skin que el pase autorizado, comprobándola contra el casino. Ante rechazo, falta de confirmación o cambio de cuenta, usar el login existente. Conservar activación inicial de NET, verificación completa de Ases, relay de Multi Skin, consumo/auditoría y sesión persistida de Rey. No agregar bloqueos operativos ni cambios financieros.
- El catálogo privado reside en Atrio y agrupa referencias de landing/plataforma/skin, asesores permitidos, pools, conexiones, gerencia/agencia y opciones de ingreso. Builder publica cambios versionados desde una cola durable; las ediciones de Atrio actualizan su proyección en la misma transacción. Confirmar solo la versión almacenada; conservar tombstones para impedir resurrecciones por respuestas antiguas. Permisos, asignación por dispositivo, métricas de distribución y operaciones siguen en sus fuentes vigentes, con fallback ante catálogo ausente o viejo.
- Reconciliar cada cinco minutos, con exclusión y vencimiento recuperable. Despachar inmediatamente al editar Builder; secreto específico en Vault y entorno de servidor, sin credenciales en el SQL del cron. Actualizar inventario PBAdmin de los asesores usados mediante la integración de lectura existente, con máximo 20 asesores por lote y cuatro solicitudes concurrentes. No consultar saldos, crear cuentas ni ejecutar cargas/retiros. Los cambios externos de API2 se reflejan con esa reconciliación o su sincronización existente.
- El chat firmado no descarga el SDK legacy de Supabase al arrancar: se carga al usar una acción que lo necesita. Mantener compatibilidad directa/legacy, respuestas RPC, adjuntos, recuperación de chunks y el resto de controles previos. [Pruebas y publicación](validation/entry-parallel-release-20261103.md).

### Medición por intento y herramientas del chat diferidas (03/11/2026)

- El usuario autorizó ampliar la medición para reunir datos, distinguir cuenta nueva/recuperada y reintentos, diferir herramientas secundarias del chat y revisar consultas repetidas. También propuso un catálogo de configuración sincronizado por cambios y una reconciliación periódica: documentar qué datos pueden agruparse y qué operaciones requieren respuesta en vivo antes de introducir esa nueva fuente.
- Conservar identidad, destino, sesión, comportamiento financiero y tracking comercial. Los UUID de diagnóstico no son autoridad ni idempotencia. Las fases tienen nombres cerrados y duraciones acotadas; no guardar texto libre, parámetros publicitarios, cuentas ni credenciales en telemetría. Mantener límites, ownership, permisos y retención del colector.
- Implementación común de Builder/clásico y los cuatro gateways, incluido Ganamos+ Worker: navegación, destino, resolución, cuenta, subetapas numéricas de API2 cuando estén disponibles, login y confirmación de sesión. Conservar los hitos históricos, separar sus significados y evitar sumar tiempos que se solapan. En preparación reutilizar el contexto de `/complete`, sin otra lectura de cookie en paralelo.
- Atrio usa una única implementación para chat completo y widget: emojis, selector de stickers y animaciones de promociones se descargan al abrirlos. Conservar contexto/envío/idempotencia de stickers, pestaña seleccionada, tema y compositor. No modificar API2 ni introducir cachés de credenciales o nuevas reglas operativas.
- Publicado en el lote de entrada paralela, junto con T9 y sus migraciones compatibles. El documento de medición conserva la evidencia de su primera etapa local; el estado final está en la [publicación verificada](validation/entry-parallel-release-20261103.md). [Contrato y mapa entre servicios](validation/entry-performance-20261103.md).

### Consumo de consultas del chat y cierre de pruebas (03/11/2026)

- El usuario autorizó corregir las consultas repetitivas detectadas durante el bloqueo de Vercel: detenerlas ante una sesión rechazada, reducir las consultas sin novedades y cerrar los navegadores de prueba. No modificar operaciones financieras, creación de cuentas, permisos del servidor ni tracking comercial.
- Implementación única en Atrio para los cuatro gateways, chat completo firmado y acceso legacy. Una respuesta 401 detiene los trabajos de mensajes y presencia de ese token en memoria; un token nuevo vuelve a habilitar su conversación. No renovar identidad ni crear una cuenta como respuesta al rechazo. Un 403 de una acción individual no invalida todo el chat.
- Mensajes cada 2 s mientras hay actividad reciente y cada 10 s tras un minuto sin cambios/interacciones. Widget cerrado: consulta cada 30 s para conservar avisos y contador; presencia suspendida. Pestaña oculta, pagehide o sin conexión: pausar y cancelar las consultas pendientes, reanudando al volver. Una sola lectura en curso, plazo de 12 s incluyendo el cuerpo y espera creciente ante fallos transitorios, respetando Retry-After. Conservar presentación, introducción ordenada y mensajes no leídos; no marcar como visto mientras esté cerrado u oculto.
- Las verificaciones de navegador de Atrio tienen cierre en finally, límite de duración y cierre ante las señales de terminación admitidas por Playwright. Sus transportes están aislados antes de navegar. No ejecutar pruebas de carga ni sesiones sintéticas persistentes en producción.
- Publicado en Atrio `eabf24f`, deployment `dpl_CV6hsor9mZJqTRoC9q6u1BT6UHzs`, con commit productivo coincidente y login público HTTP 200. Pasaron 55 pruebas focales, 44 escenarios Chromium/WebKit, tipos, lint y build. Sin migración, API2 ni nueva publicación de los padres de los gateways. Las páginas abiertas deben recibir el JavaScript nuevo. [Evidencia y verificaciones](../../internal-chat/docs/validation/chat-polling-20261103.json).

### Template 9 con la presentación de Ganamos Mayor (03/11/2026)

- El usuario pidió una nueva Plantilla 9 con la UI de `https://ganamosmayor.com/landing`: tarjeta compacta, logo cuadrado, título, nombre, CTA, pie y aviso de cookies. El casino se elige en el editor; no agregar otro selector de plataforma al recorrido del cliente. Ganamos NET y Ganamos+ comparten el logo y los violetas de la referencia; Rey de Ases, Ases del Norte y las demás skins usan su marca/paleta.
- Conservar el circuito de Template 7: identidad, cuenta existente/alta, destino y bot guardados, Contact/FBC por landing y píxel, deduplicación, recuperación y handoff. Continuar conserva su ajuste actual del gateway. No modificar operaciones financieras ni API2.
- Implementación visual única para Builder, clásico y vista previa. Logos locales WebP de 152 px para mostrar a 76 px, con dimensiones reservadas. Borrador de T9 independiente; el editor conserva el permiso de ingreso administrado de T7 para T7/9 y lo identifica así en el panel de permisos. Los controles visuales de otros templates no alteran esta tarjeta.
- Reusar el runtime funcional T7; identificar la presentación como `entryTemplate: 9` en diagnósticos. Actualizar el contrato compartido en los cuatro gateways, incluido Ganamos+ con su Worker. La migración local de Builder amplía sólo la admisión de T9 y el permiso correspondiente, conservando íntegro el resto de las funciones, sus grants y límites. No reescribir landings ni eventos históricos.
- Preparado y verificado en local, **sin commit, push ni publicación de este lote**. Producción fue consultada sólo para verificar las firmas/guardas de las tres funciones que usará la migración. [Alcance, pruebas, capturas y pasos de publicación](validation/template9-20261103/README.md).

### Flujo de retiro separado de avisos en Full Carga (03/11/2026)

- El usuario separó los pedidos de monto/CBU/CVU y confirmación de la solicitud por chat de los avisos operativos. Incorporar «Flujo de retiro» como switch independiente, apagado por defecto también en bots existentes; el usuario confirmó expresamente este valor. «Avisos de retiro» conserva su preferencia y comprende procesamiento, pendientes, pagos, errores, restricciones y cancelaciones.
- El formulario del chip sigue enviando monto y destino estructurados. Esta preferencia controla la entrega de respuestas automáticas: no habilita/deshabilita el parser ni cambia la ejecución financiera, el chip, bonos, límites, pagos o reintentos. No introducir un bloqueo financiero para aplicar una preferencia visual.
- API2 identifica el flujo con `withdrawal_flow`. Atrio reconoce además los eventos explícitos de las versiones anteriores que usaban `withdrawal_status`, sin inferir por palabras del mensaje. Conservar idempotencia, mensajes manuales, MKT, sin clasificar y decisiones históricas de entrega.
- Implementación única en Atrio para los cuatro gateways, widget y chat completo. El usuario autorizó commit, push y publicación, y aclaró que API2 la despliega el programador. La migración productiva de Atrio `20261103175034` fue aplicada antes de publicar la web. API2 se entrega en Git para su despliegue; no requiere migración propia. No se ejecutan operaciones financieras ni se generan mensajes productivos para probarlo. [Alcance y validación](../../internal-chat/docs/validation/withdrawal-flow-replies-20261103.md).

### URL de origen de PURCHASE por recorrido (31/10/2026)

- El usuario autorizó corregir el Purchase que enviaba `event_source_url` como raíz del dominio después de resolver una conversión de una landing concreta. El alcance comprende todas las landings y los cuatro proveedores en el handler central de Builder, incluidas primeras compras, recompras y reintentos legítimos. No depende de conectar Facebook con OpenAI.
- Conservar la URL HTTP(S) explícita válida del emisor; cuando falta, usar la URL específica del contacto o lineage ya autorizado. Si esa columna fue sobrescrita por una raíz, recuperar el `contact_payload_raw` original del mismo contexto, con JSON válido. Cualquier consulta adicional debe estar acotada a los IDs de lineage persistidos y al mismo `user_id`; no buscar otra persona por teléfono ni recorrer el inbox.
- Sólo si no existe una URL original utilizable y se conoce una landing resuelta o matched confiable, construir el fallback con `settings.url_base` y su nombre validado. Respetar los prefijos configurados, incluido `/l/`, sin deducir el motor por host ni fabricar una URL raíz cuando falta la landing. Una raíz solicitada explícitamente por el emisor mantiene su precedencia.
- Preservar la URL capturada de Contact: `/gast` continúa siendo `/gast` aunque un override haya resuelto Diana. Este lote no cambia el contrato de captura que excluye queries, no inventa parámetros descartados y conserva los marcadores propios de WhatsApp Business Messaging y su routing.
- No modificar montos, fechas, identidad, píxeles, FBC, atribución first/repeat, deduplicación ni políticas CAPI. No hacer backfill de filas históricas ni reenviar eventos para verificarlo. Probar con los handlers y reintentos reales, DB/HTTP aislados, antes de publicar las funciones Edge afectadas; sin migraciones ni cambios de los gateways, Worker o API2.
- Publicado y verificado: fuente `1c4387d`, `conversions` v173 y `retry-failed-conversions` v48 activas, con sus 11 y 5 archivos idénticos al commit y autenticación conservada. Pasaron 68 casos Deno del lote, 21 verificaciones de handlers reales con IO aislado y ambos OPTIONS públicos. La implementación única cubre todas las landings y los cuatro proveedores. [Evidencia, límites y rollback](validation/purchase-source-url-20261031.md).

### Caché del runtime público de todas las landings (31/10/2026)

- El pedido de atribución FBC comprende todas las landings y templates de ambos motores. La auditoría encontró que Builder 1–6 seguía publicando el mismo nombre `landing-runtime-v6.js` con caché inmutable anual: un visitante anterior podía conservar el programa previo aunque recibiera HTML nuevo.
- Generar también ese programa compartido con hash de contenido en cada prebuild, sin incorporar configuración de una landing al archivo. Conservar URLs anteriores para HTML ya emitido y los cuatro programas T7/T8 sin cambios. La clásica 1–6 continúa usando sus componentes React en chunks de Next con hash.
- Verificación: HTML de los seis templates, hash/programa sin configuración, 29 pruebas focales, TSC y caché HTTP real en Chromium/WebKit. Contact y journey descartan FBC ajeno y conservan el `fbclid` actual. Publicado en Builder `0bb42f5`; GET público confirma el hash nuevo en T5, sin ejecutar eventos reales ni crear cuentas. Una pestaña ya abierta requiere recibir el HTML nuevo. [Evidencia](validation/public-runtime-cache-20261031.md).

### Estado guardado de Meta en Atrio (31/10/2026)

- La tarjeta de Meta del Admin muestra «Configurada» en verde sólo cuando tiene guardada una `eventUrl` propia válida; escribir un borrador no activa ese estado. Los asesores heredan la configuración del Admin y no requieren URL propia. Conservar permisos, configuración global y tarjetas de Super Admin.
- Validación: `internal-chat/docs/validation/meta-integration-status-20261031.md`.
- Publicado en Atrio `b425cad`, con guardado, borrador, permisos y herencia verificados en Chromium/WebKit.

### Procedencia de FBC por landing y píxel (31/10/2026)

- El usuario aclara que sus accesos fueron orgánicos y que la publicidad de Diana comenzó el día anterior. La investigación encontró el mismo FBC anterior en otras landings, monedas y píxeles: su persistencia no acredita un anuncio de Diana ni el origen publicitario de ese identificador. Corregir esa atribución compartida en constructor y clásico.
- Guardar una procedencia nueva y versionada por UUID de landing, workspace/moneda y píxel desde la configuración efectiva. Una cookie global histórica sin esa procedencia queda fuera de la atribución de la nueva landing; no borrar la cookie común ni reasignarle un origen que no conocemos.
- Priorizar un `fbclid` válido de la entrada actual, validar formato y antigüedad del FBC y conservar el timestamp original durante reingresos y reintentos. Un regreso directo mantiene una atribución válida de su mismo contexto; la llegada actual y la procedencia histórica se registran por separado.
- Mantener el SDK oficial para sus funciones existentes y aceptar sólo una señal nueva cuya recolección pueda observarse en el contexto actual. No rescatar el FBC global desconocido mediante un merge o fallback. Para conservar EBP aunque exista una cookie ajena, usar `collectParams` del SDK oficial mediante un helper acotado que consulta el bridge sin leer ni escribir cookies. Cargarlo en paralelo sin demorar el CTA.
- Conservar los disparadores, deduplicación y políticas de Contact, LEAD y Purchase. Revisar también ingreso del dato y herencia en servidor; no modificar por este diagnóstico las conversiones históricas ni reemitir eventos. Implementación y pruebas aisladas antes de publicar.
- Publicación completada: Builder `ec71dae`, clásico `f689bbe` y conversions v171; smoke público 12/12. El guard Contact V2 compara scope con la landing real de DB y descarta FBC inconsistente sin rechazar el contacto. [Evidencia y límites](validation/scoped-fbc-release-20261031.md).

### Todas las skins y fuente efectiva de Template 7/8 (31/10/2026)

- La revisión solicitada abarca las catorce skins, sus logos/paletas y el ingreso de ambos motores, no una excepción para Bet30. Continuar activado debe mostrar usuario, clave y botón con la marca de la página elegida; desactivado conserva el ingreso automático. No cambiar el ajuste productivo para verificarlo ni crear cuentas en las pruebas de esta auditoría.
- La auditoría encontró otra divergencia: el HTML usa el borrador del template activo, mientras los handlers de ingreso todavía podían tomar una skin raíz desfasada. Unificar esa lectura con la misma resolución efectiva pública. Conservar los campos globales de la raíz y no utilizar borradores inactivos, parámetros del navegador ni la skin de una sesión previa como autoridad.
- Para T7 histórico, cuando falta la skin en la configuración efectiva puede conservarse `landing_config.tracking.skin_code`; si tampoco existe, continúa Ganamos+. Un valor explícito nulo o inválido no autoriza otra skin. T8 conserva su selección por tarjeta y el contrato SQL existente: no se habilitan tarjetas sólo publicadas cuando faltan en la configuración guardada, ni se sustituye un proveedor o gerencia si el contexto autorizado contradice la selección efectiva.
- Publicación coordinada completada: Builder `5a774474bbe63d675823768eebf321d070176584`, clásico `3f9c1bf6877936bef8dff9e30ae6934947d73e7f` y `builder-config` v36 `ACTIVE` con `verify_jwt=false`. Ambos destinos Vercel están `READY` con el commit esperado; el smoke posterior pasó 6/6 GET públicos, sin ejecutar negocio. Validación de las catorce skins, los cuatro proveedores, límites, deployments, SHA256 y rollback: [auditoría de las catorce skins y Continuar](validation/all-skin-entry-presentation-20261031.md). No requiere migración ni cambios de API2. Las pruebas aisladas y el smoke HTML no certifican el E2E del proveedor ni Instagram/Facebook en iPhone.

### Acceso directo por bot y prueba Multi Skin 1045 (31/10/2026)

- Achicar el selector Usuario/Soporte de «Acceso rápido del cliente», conservando la superficie táctil y el comportamiento de guardado. No cambiar las dimensiones de los demás selectores.
- Agregar «Abrir chat» en cada tarjeta activa de Bots de PBAdmin. El enlace público identifica asesor y bot; abre Atrio sin pasar por el gateway. La primera entrada pide el nombre y resuelve la cuenta de ese bot. El regreso y los reintentos conservan la misma identidad y vínculo; ningún bot inactivo, parámetro del cliente o ruta predeterminada puede sustituir el destino.
- Las credenciales permanecen en servidor. El acceso directo usa identidad privada de navegador y sesión de chat firmada; MKT conserva Usuario/Soporte y sus operaciones, Full Carga conserva su gestión automática. La implementación única de Atrio sirve a los cuatro proveedores.
- El usuario confirmó el despliegue de API2 por el programador y creó el bot 1045, Multi Skin (Test), para verificar el recorrido y las operaciones. Verificar su configuración real, el alta y el chat con una identidad de prueba explícita. Distinguir pruebas aisladas, consultas reales y movimientos efectivos; una prueba del proveedor no certifica una transferencia bancaria automática. API2 continúa bajo despliegue del programador.
- La auditoría encontró que `builder-config` reemplazaba Bet30 por Ganamos+ y omitía las skins de las tarjetas T8. Corregir la fuente compartida y los lectores de ambos motores para conservar la skin guardada y rechazar selecciones explícitamente inválidas, sin cambiar cuenta, proveedor ni gerencia.

### Configuración móvil y períodos de Datos (31/10/2026)

- Corregir el desborde de la vista previa de Retirar en Configuración móvil: la descripción, tarjeta y controles deben quedar dentro de su contenedor, con el contenido completo legible. Conservar la presentación de la solicitud real y las operaciones de retiro existentes.
- En Datos agregar Hoy y Ayer y ordenar las opciones: Hoy, Ayer, Últimos 7 días, Este mes, Mes pasado y Máximo. Conservar el filtro de casino y los cálculos/comparaciones en servidor. La implementación única del panel de Atrio sirve a los cuatro gateways.
- Implementado y publicado en Atrio (`d629f8d`), sin migración. Hoy/Ayer usan el calendario argentino; el valor inicial sigue en siete días. Pasaron 22 pruebas focales, TypeScript, lint y 22 casos de navegador en Chromium/WebKit. Tarjeta, edición y solicitud real sin desbordes desde 320 px; filtros probados en los tres roles y gráfico diario visible en móvil. Evidencia y deployment: [Configuración móvil y Datos](validation/atrio-mobile-settings-daily-filters-20261031.json).

### Inicio automático al llegar al chat visible (31/10/2026)

- Publicación completada: migración `20261031154810_gateway_visible_entry` aplicada en Atrio; siete proyectos Vercel promovidos y Worker Multi Skin al 100%. Padres publicados y verificados antes de activar Atrio. Evidencia, pruebas, hashes públicos, commits y rollback: [inicio visible](validation/gateway-visible-entry-20261031.md).
- Publicación autorizada posteriormente por el usuario: aplicar la migración y desplegar el lote completo. Publicar primero los cuatro padres gateway, incluido Worker Multi Skin, y después Atrio para que el inicio requiera visibilidad comprobada. Constructor y clásico incorporan los recursos compartidos del lote.
- El usuario aprobó enviar una solicitud inicial automática al llegar al chat visible y utilizable, seguida de la bienvenida existente y los datos bancarios. Usar variantes argentinas sin signos de apertura, por ejemplo «Hola! Me pasás mi usuario y los datos para cargar?». Conservar la cuenta, asesor y conversación de la skin autorizada.
- CONTACT conserva su disparador actual al tocar el CTA; LEAD corresponde a la llegada al chat visible y utilizable. Una precarga oculta, redirección iniciada o iframe todavía cubierto por la transición no cuentan. Conservar la deduplicación por jugador y `promo_code`, el tracking habilitado y la atribución existente.
- Identificar el inicio automático en metadatos y mostrar un ícono de bot sutil en su burbuja del asesor. Extender el indicador a automatizaciones reconocidas por sus metadatos. No tratar el inicio automático como escritura real del cliente en analíticas, recordatorios o sugerencias de instalación; no enviarlo al bot como otro pedido ni duplicar sus respuestas.
- Guardar el inicio una sola vez por conversación/skin, seguido de bienvenida y datos de carga, con reintentos idempotentes. Recargar, minimizar o volver conserva el historial. Las conversaciones anteriores no reciben una introducción retroactiva; si el cliente ya escribió durante la preparación, se conserva ese intercambio real.
- Aplicar el contrato de visibilidad a los cuatro gateways y la implementación de mensajes/analíticas a Atrio compartido. Ganamos+ incluye su Worker. El acceso directo de Atrio mantiene su comportamiento previo. No modificar API2, Panel3 ni operaciones financieras.


### Misma cuenta e historial independiente por skin (30/10/2026)

- El usuario autorizó crear Template 7 reales en Goldencajeros para corroborar Bet30 → Ganamos+ → Bet30 y confirmó que cada skin debe mostrar su propia conversación/avatar/bienvenida, conservando por detrás la misma cuenta/saldo. Volver a una skin recupera su historial y no repite automáticamente su bienvenida/tarjeta. No separar bonos ni deduplicación financiera por skin.
- La base y el inbox ya separan conversaciones por cuenta y skin. Se reforzó únicamente la preparación privada de `{{clave}}` de la primera bienvenida en una segunda skin mediante `20261030204822_multi_skin_welcome_context.sql`, aplicada en Atrio/Supabase con RLS/grants conservados. Pasaron 17 pruebas, incluida concurrencia e historiales separados en Postgres aislado.
- Creadas y publicadas `golden-e2e-bet30` y `golden-e2e-ganamosplus` en Goldencajeros/ARS, con Gera, logos propios y sin píxel de prueba. El navegador real recibió 503 al seleccionar destino en ambas: falta un bot Multi Skin conectado para ese recorrido. No se alcanzó alta/gateway y no se certifica todavía el E2E completo. Se pidió al usuario el bot/gerencia a utilizar; no se configuró una conexión ficticia ni se modificaron bots anteriores.
- Evidencia y estado: `internal-chat/docs/validation/multi-skin-chat-scope-20261030.md`. No hay migraciones nuevas de API2/Panel3 en esta revisión; su activación/configuración siguen siendo requisitos del E2E real.

### Fluidez del widget en escritorio (30/10/2026, después de la publicación completa)

- El usuario confirmó que Ganamos NET sigue abriendo/cerrando a saltos en Chrome de escritorio después de Ctrl+F5; en móvil funciona bien. La observación de negrita quedó descartada por el propio usuario: ese mensaje no llevaba formato.
- Ajuste de rendimiento compartido en los cuatro gateways: conservar el tamaño interno del iframe cerrado en escritorio, oculto/inert y sin capturar clics; evitar el desenfoque de pantalla completa en dispositivos con puntero fino y hover, conservando el oscurecimiento. Touch y pantallas compactas mantienen su superficie cerrada de tamaño cero y el desenfoque original.
- Conservar tiempos, curva, escala hacia el botón, maximización/restauración, iframe montado, movimiento reducido y contratos de identidad. No requiere cambios de API2, Atrio ni migraciones. Medir con burbujas reales de Atrio además del fixture simple; no equiparar una medición sintética a los FPS del equipo físico del usuario.
- Implementado, comiteado/pusheado y publicado en los cuatro gateways, incluido el Worker Multi Skin. Pasaron 56 escenarios de navegador y 47 pruebas de assets; salud y hashes públicos verificados. Evidencia, commits y despliegues: [fluidez en escritorio](validation/desktop-chat-motion-20261030.md).

### Entrega completa y publicación autorizadas (30/10/2026)

- El usuario autorizó comitear/pushear todo el lote implementado y publicar lo que podemos completar desde nuestro lado. Reemplaza las restricciones de preparación local de los apartados históricos para esta entrega. API2 y Panel3 quedan comiteados/pusheados para el despliegue del programador; el resto se publica desde los proyectos existentes, sin comprar dominios ni cambiar cuentas de proveedor.
- Aplicada en Atrio la migración `20261030185100_multi_skin_shared_provider.sql`, alineando el nombre del borrador anterior con el historial real de Supabase. Se verificaron roles/grants/RLS y la regresión local de Postgres; incluye el reinicio de métricas Multi Skin antes omitido. Constructor no tiene migraciones pendientes de este lote. Dos migraciones nuevas MySQL de API2 y ninguna de Panel3, detalladas en `api2/docs/validation/deploy-handoff-20261030.md`.
- Publicar Builder/clásico antes de los cuatro gateways para conservar la renovación del pase. Multi Skin incluye Vercel, Worker público y relay privado. Conservar variables/secretos y no cambiar claves de cifrado. Los flujos nuevos de proveedor/RTP se activan operativamente después del despliegue/configuración de API2; no certificar ese recorrido completo solo por tener el frontend publicado.
- Publicación completada: siete proyectos Vercel promovidos, Worker público y relay Multi Skin actualizados al 100%, migración de Atrio aplicada. Verificación pública de salud y 38 archivos por hash satisfactoria. API2 y Panel3 están entregados en Git para el despliegue/configuración del programador. Resultado, hashes y estados definitivos: `docs/release/full-release-20261030/README.md` y su manifest.

### Adaptación RTP y entrega independiente de la hora del inbox (30/10/2026)

- El usuario autorizó implementar RTP con el contrato actual del panel: enviar action/username/rtp sin `provider_code`, admitir respuesta mínima con identidad/RTP y conservar la distinción entre aceptación y aplicación. Se implementó en API2/Atrio: verificación confirmada, pendiente o no informada, sin suponer proveedor/boosts ausentes ni alcance sobre todos los juegos. El formulario compartido muestra aceptación amarilla o confirmación verde y conserva los controles de scope, rango y ausencia de reintentos. Sin migraciones nuevas; sigue local para entregar junto con API2 antes que Atrio. Validación: sesenta pruebas y TypeScript de ambos proyectos. Evidencia en `internal-chat/docs/validation/multi-skin-rtp-current-contract-20261030.md` y el documento homónimo de API2.
- El usuario pidió comitear/pushear específicamente la corrección de la hora del inbox. Entregada en `internal-chat/fix/atrio-inbox-validation`, commit `ed3461e3fa7a0ecd69deda7396993ac59d2985be`, remoto verificado. El commit contiene solo las tres expresiones de hora y su documentación; los cambios de avatar/RTP/identidad y el resto del lote continúan sin entregar. No se afirma despliegue productivo por el mero push.

### Hora del inbox y revisión de Contact/RTP (30/10/2026)

- La hora de las listas móvil/escritorio y «Últ. mensaje» de la ficha debe tomar el último mensaje, no `updated_at` de la conversación. La última conexión permanece como dato independiente. Implementado y validado localmente en el componente compartido de Atrio; sin publicación en esta revisión.
- El usuario confirmó el enlace de anuncio `/gast` con el parámetro `landing=diana` y una prueba propia llamada Elsa. Se verificó que el override público muestra Diana y que Contact se emite después del nombre/destino válido y antes del alta, sin alterar su política. Evidencia y límites: `docs/validation/diana-template7-contact-20261030.md`.
- El usuario aportó capturas del panel Multi Skin y confirmó que son más actuales que el PDF. El contrato mostrado envía action/username/rtp sin `provider_code`, y la respuesta mínima exitosa contiene status 1 e identidad/RTP, sin exigir proveedor ni boosts. Las capturas no demuestran un alcance sobre todos los proveedores. La prueba real anterior también devuelve verificación pendiente: conservar la distinción entre orden aceptada y aplicación confirmada. Esta revisión no adapta todavía el botón/cliente RTP ni realiza cambios reales adicionales; queda pendiente compatibilizarlo con el contrato actual antes de publicarlo.

### Avatar de Atrio según la skin elegida (30/10/2026)

- El usuario solicita que el avatar represente la skin que vio/eligió en Template 7/8, aunque comparta usuario/saldo con las otras trece páginas. Usar `provider_skin_code` de la conversación, nunca cambiar la identidad de la cuenta ni inferir la skin desde otro acceso.
- Conservar los cuatro avatares originales e incorporar los logos oficiales de las trece skins restantes, centrados y proporcionados dentro del círculo. Usar recursos locales de Atrio, en lista, chat, ficha y avatar predeterminado de difusiones. Identificar también cada skin con su nombre en la ficha.
- Esto reemplaza el pendiente visual del apartado anterior de RTP. No cambia filtros, operaciones financieras ni la selección de cuenta. No hay migraciones nuevas; implementación y verificación locales sin publicación.
- Aclaración de RTP: el PDF admite `provider_code` y predetermina `PRAGMATIC`, sin enumerar otros valores. El control implementado solo utiliza Pragmatic; no se afirma que el proveedor carezca de otros códigos ni se inventan valores.
- Evidencia: `internal-chat/docs/validation/player-skin-avatars-20261030.md`.

### OLD: pedidos de alias, saludos y RTP Multi Skin (30/10/2026)

- Implementar solamente los puntos 1 y 3 de la revisión de OLD: variantes corteses de pedidos de alias/CBU y saludo con oferta de ayuda usando la copy NEW. Conservar un flujo activo al saludar. El usuario postergó la modificación de recolección/persistencia del retiro y el plazo propuesto de treinta minutos; no aplicar ese punto en esta entrega.
- En el panel del asesor de Atrio, agregar Cambiar RTP junto a las operaciones para cuentas Multi Skin de MKT/Full Carga. Usar el endpoint común del proveedor, rango 75–98 y Pragmatic, con bot/gerencia/cuenta autorizados y clave exclusivamente del servidor. No habilitar movimientos manuales de Full Carga ni repetir automáticamente cambios inciertos. Se publica desde el componente único de Atrio, sin modificar los cuatro gateways.
- La consulta del avatar se respondió con el comportamiento actual: Ganamos+ tiene imagen/nombre propios; el resto conserva su código de skin pero todavía presenta imagen y etiqueta genéricas. Este lote no cambia esos avatares.
- Implementación y pruebas locales, sin cambios reales de RTP, migraciones nuevas, commits ni publicación. Primero desplegar el endpoint de API2 y luego Atrio. Entrega: `api2/docs/validation/old-saludos-alias-multi-skin-rtp-20261030.md`.

### Logos y paletas oficiales de las skins (30/10/2026)

- El usuario autorizó obtener los logos y colores desde los enlaces públicos de cada skin y utilizarlos en las transiciones y el fondo del gateway. Se reemplazan los identificadores de texto de las 13 skins restantes por sus logos reales; Ganamos+ conserva los assets ya aprobados. No inventar marcas ni asumir colores distintos cuando los sitios comparten la misma plantilla.
- Los assets oficiales se guardan en `multi-skin-gateway/public/skins`: AVIF/WebP transparentes e íconos PNG 192/512. No se consulta el sitio remoto para obtener imágenes durante el ingreso. Las fuentes, hashes y colores observados están en `multi-skin-gateway/docs/validation/skin-brand-sources-20261030.json`; vista previa en `skin-brand-preview-20261030.png` del mismo directorio.
- `skin-branding.ts` es el catálogo visual canónico y se sincroniza con constructor, clásico y Atrio. Cada pase conserva su cuenta/proveedor/skin firmados: los colores y logos solo cambian la presentación. Aplicar la marca a preparación, credenciales, conexión, apariencia del gateway, manifest y formulario manual de su skin predeterminada. Las URLs antiguas de wordmark redirigen al logo local.
- Template 8 actualiza paleta, imagen y fuente AVIF al cambiar de tarjeta, evitando que un `<picture>` conserve el logo de la tarjeta anterior. Las mejoras del renderer y formulario compartidos se sincronizan y verifican en los cuatro gateways. Los tres casinos anteriores conservan sus valores predeterminados.
- Validación local: 60 comprobaciones visuales nuevas en Chromium/WebKit, más 56 de la presentación compartida y perfil; 1.034 pruebas aprobadas en los cuatro gateways (dos pruebas previas omitidas en Rey), TypeScript de los seis proyectos web afectados y sincronización de catálogos/renderers. Sin cuentas nuevas, operaciones financieras, cambios DNS ni despliegues en este lote visual.
- Un dominio puede dar lugar a subdominios por skin; la configuración/publicación debe asociar cada dirección a su skin, configurar DNS/alojamiento y HTTPS. El usuario todavía no indicó esas direcciones. No confundir el código visual preparado localmente con una publicación ya disponible.

### Prueba real y skins por tarjeta (30/10/2026)

- El usuario autorizó crear cuentas de prueba de Multi Skin y usar hasta 5.000 fichas para validar cargas y retiros. Esta autorización reemplaza la restricción previa de no realizar altas/movimientos reales para esta prueba acotada; no autoriza despliegues ni migraciones productivas.
- Template 8 permite elegir proveedor y skin por tarjeta. Constructor y clásico resuelven la skin desde la tarjeta guardada, nunca desde la atribución enviada por el navegador ni desde el selector global de Template 7. Las tarjetas históricas sin skin conservan Ganamos+.
- La API real omite `source` en `player_balance`, a diferencia del PDF. El usuario confirmó posteriormente que debemos adaptarnos a la API existente sin requerir cambios del proveedor. Conservar `unknown` y permitir preparar el retiro; confirmar solo con HTTP 200/status 1, identidad e importes válidos y saldo posterior igual al saldo previo menos el importe solicitado. Guardar evidencia antes del envío. La consulta por sí sola no autoriza pago: un recibo inconsistente o incierto conserva la reserva, sin replay ni pago. Un saldo explícitamente `local` continúa bloqueado para retiro; Bonus V2 no adquiere certificación exacta por esta compatibilidad.
- Prueba del endpoint real: `pbmtb5ba95b4` (ID 2123478) autenticó en Ganamos+ y Bet30 con el mismo ID. Una carga de 5.000 y un retiro de 5.000 confirmados dejaron al jugador en cero y devolvieron las fichas al agente. Fue una comprobación explícita del proveedor basada en el crédito recién confirmado, no una habilitación ni prueba productiva del flujo automático de PBadmin/Atrio. Evidencia sanitizada: `api2/docs/validation/multi-skin-live-20261030.json`.
- Prueba posterior del servicio de operaciones real, con el mismo jugador y reutilizando las 5.000 fichas: carga/retiro confirmados sin `source`, replay devuelve el recibo sin otro POST, saldo final cero y fichas restauradas al agente. Se utilizó un registro local durable, sin modificar la base productiva. Evidencia: `api2/docs/validation/multi-skin-service-live-20261030.json`. No se publicaron estos cambios. Las skins distintas de Ganamos+ conservan identificación de texto; incorporar logos oficiales/configurar dominios y publicar no forma parte de esta prueba.

### Una misma cuenta durante todo el ingreso (29/10/2026)

- Recuperar la cuenta ya vinculada al navegador para ese asesor/proveedor antes de volver a pedir el nombre. Un nombre nuevo escrito no cambia esa cuenta. Conservar nombre y promo del regreso autorizado, tanto en constructor como en clásico.
- La pantalla de credenciales, el login del casino y el contexto firmado del chat deben corresponder al mismo acceso. Un pase inválido, vencido o consumido no autoriza continuar con otra sesión vigente. Esto reemplaza el fallback anterior de `/start`; el reingreso normal sin pase conserva su circuito existente.
- Vincular mediante pruebas cifradas de cinco minutos la cuenta mostrada con el pase exacto y su continuación, y la autenticación con la cookie concreta que emitió el gateway. Confirmar esa cookie justo antes de navegar, también al terminar una espera configurada. Una cookie activa cualquiera no acredita la cuenta elegida. Usar un header estándar de autorización además del header propio para conservar el contrato a través del Worker de Plus; nunca incluir estas pruebas en URLs o registros.
- Si el pase falla o vence y existe una continuación válida, renovarlo una vez automáticamente para la cuenta ya resuelta, sin volver a crear jugadores ni cambiar nombre, gerencia, asesor o proveedor. Volver a verificar el vínculo y emitir un pase nuevo; no devolver el pase consumido guardado en la continuación. Conservar los límites y el feedback del recorrido existente.
- La recuperación general conserva la prioridad de la cookie vigente sobre un respaldo antiguo. Solo una confirmación explícita del ingreso puede reparar su propia cookie perdida o sobrescrita usando el recibo cifrado de esa misma sesión recién autenticada. Después de una reparación, leer la cookie nuevamente sin enviar un respaldo: escribir `Set-Cookie` no confirma que el navegador la haya guardado. No restaurar sesiones revocadas ni aceptar un respaldo de otra cuenta como confirmación.
- Ignorar callbacks de preparaciones anteriores tanto al recuperar automáticamente como al enviar el formulario. Las respuestas tardías no deben navegar, desbloquear ni reemplazar la cuenta de un intento posterior. Aplicar el flujo compartido a los cuatro gateways; mantener los adaptadores de autenticación de cada proveedor.
- Registrar internamente `gateway.entry` con un `entry_id` común, etapa, resultado, motivo y usuario esperado/observado cuando corresponda. No registrar claves, cookies, pases, pruebas cifradas ni cuerpos del proveedor. La UI conserva mensajes generales.
- Preparar y verificar en local. Esta corrección no autoriza publicar el lote funcional pendiente ni ejecutar migraciones. Evidencia, límites y orden de entrega: [consistencia de cuenta en el ingreso](validation/entry-identity-consistency-20261029.md).

### Multi Skin como proveedor de PBadmin y Atrio (29/10/2026)

- Integrar Multi Skin como proveedor propio de API2/Panel3, con una API key generada por cada gerente y configurada en su agency. Incluir catálogo, permisos de usuarios/administradores, gerencias, bots y operaciones. Este acuerdo reemplaza la exclusión anterior de Ganamos+ de PBadmin; Ganamos NET conserva su proveedor independiente.
- El endpoint operativo pertenece a Multi Skin (`https://agentes.plus/api.php`), no a una skin. Ganamos+, Bet30 y los demás enlaces comparten cuenta/saldo del proveedor. Mantener un gateway genérico y selección explícita de skin, sin aceptar destinos arbitrarios ni reasignar cuentas al cambiar de presentación.
- Guardar la API key cifrada y no devolverla ni registrarla. Conservar ownership y deduplicación; registrar cada envío financiero de Multi Skin de forma durable, sin reintentar un POST incierto. Un saldo local no acredita una lectura fresca del proveedor. No fingir métodos que la documentación no ofrece.
- Preparar y probar el lote en local, sin altas ni movimientos monetarios reales, sin desplegar API2/Panel3 ni ejecutar migraciones productivas. Actualizar API2 por fast-forward antes de editar, conservando los cambios del programador.
- Desplegar primero la migración API2 `20261029000001_add_multi_skin_provider.ts` y API2; en Atrio aplicar `20261029195500_multi_skin_shared_provider.sql` antes del lote web. Mantener también las migraciones anteriores pendientes. La entrega operativa y validación están en `PROJECT_CONTEXT.md` de API2, sección Multi Skin del 29/10/2026.
- Ganamos+ conserva sus assets actuales. Para otras skins sin imágenes oficiales adjuntas, usar su nombre como identificación de texto, sin atribuirles el logo de Ganamos+. El parámetro cosmético `skin` de `/prepare` no decide la cuenta: esa autoridad sigue en el pase opaco y la configuración guardada.

### Maximizar y restaurar con movimiento continuo (29/10/2026)

- Mantener el alto maximizado y la apertura/compresión ya aprobados. Maximizar y restaurar deben ser fluidos: ajustar el tamaño interno una sola vez por cambio y animar la transformación visual, sin una transición de altura que reacomode todo el chat en cada cuadro.
- Conservar ancho, anclaje inferior, margen superior móvil de 8 px, teclado, movimiento reducido e iframe montado. Una inversión rápida parte de la posición visible y cerrar durante el cambio continúa hacia el botón. Los cambios nativos de viewport cancelan cualquier transformación de tamaño antigua.
- Sincronizar, probar y publicar los dos assets de UI en los cuatro gateways, incluido el Worker de Plus, conservando pendiente el lote funcional que depende de API2.

Validación y publicación: [maximizar y restaurar](validation/smooth-chat-resize-20261029.md).

### Movimiento continuo y altura del teclado (28/10/2026, ajuste posterior)

- Mantener la duración de 520 ms de apertura y cierre, con una curva continua en ambos sentidos. Preparar el tamaño completo del iframe antes de iniciar la escala desde el botón, sin animar la restauración desde altura cero. Conservar el iframe, inversión rápida, foco/teclado, paletas, accesibilidad y paso de toques al cerrar.
- Maximizado móvil: alcanzar el margen superior de 8 px usado por el chat cuando aparece el teclado, conservando ancho y separación inferior de la paleta del gateway. El teclado sigue ajustando el chat al área realmente visible. Este acuerdo reemplaza el margen previo de 32 px.
- Aplicar y comprobar en los cuatro gateways, incluido el fuente de Plus. Estos assets de UI son independientes del deploy pendiente de API2; su publicación debe conservar el código funcional actualmente desplegado.

Validación y publicación: [movimiento continuo y altura](validation/smooth-chat-motion-20261028.md).

### Entrega completa autorizada a Git (28/10/2026, instrucción posterior)

- El usuario autorizó comitear y pushear todo el lote pendiente, incluido API2. Las menciones previas de trabajo local describen la preparación; esta autorización permite su entrega en las ramas actuales, sin cambiar ramas ni publicar API2.
- Primero aplicar las dos migraciones nuevas de altas y desplegar API2; después publicar la recuperación de cuentas en Atrio, constructor, clásico y los cuatro gateways, incluido el Worker de Plus. La conciliación histórica de Kobe no es automática ni forma parte de las migraciones.

### Cargas independientes y publicación separada del widget (28/10/2026)

- Una carga pendiente protege esa transferencia, sin impedir validar otra distinta. Mantener deduplicación por el movimiento verificado, reservas ante resultados inciertos y una sola solicitud activa por jugador. No reintentar el dinero de una operación en revisión. Si se perdieron IDs históricos, distinguir por evidencia del banco/HG, nunca por otro archivo o fecha OCR. El bono único incierto permanece protegido sin retener el capital nuevo.
- La UI de altura y compresión se publica ahora, por separado: commits de dos assets por gateway, Vercel y Worker de Plus. El lote de recuperación de cuentas sigue local y depende de API2/migraciones. Publicar UI no confirma un despliegue del backend financiero.

Evidencia: [UI del widget en producción](validation/widget-ui-production-20261028.md).

### Sustituir altas no vinculadas y ajuste del widget (28/10/2026, acuerdo posterior)

- Este acuerdo reemplaza la obligación anterior de conservar indefinidamente un username incierto. El usuario acepta cuentas huérfanas en el proveedor: intentar recuperar brevemente y, si no se confirma, archivar el candidato como reemplazado y crear otra variante del mismo nombre. Una cuenta ya vinculada permanece estable. Solo una cuenta se vincula a la identidad del navegador; las respuestas viejas no pueden reemplazarla.
- Recuperación de proveedor de hasta 1,8 s por candidato y alta de hasta 8 s por llamada en el recorrido foreground de Atrio. Hasta tres intentos; el éxito inicial conserva una única creación. Persistencia del vínculo y sustitución serializadas sobre la misma fila; historial cifrado y transiciones condicionadas por username. Ante un fallo de vinculación local, primero reintentar esa vinculación y solo sustituir si sigue sin credenciales asociadas. La ventana del worker sigue siendo interna, nunca una espera normal del cliente.
- Aplica a los tres adaptadores de alta PBAdmin utilizados por los dos motores y a la recuperación compartida de los cuatro gateways. Ganamos+ conserva su integración propia, sin alta PBAdmin ni sustitución por NET.
- Cierre del chat: volver de 720 a 520 ms, manteniendo el contenido durante la compresión. Maximizado móvil: reducir el margen superior de 64 a 32 px (más safe area), conservando ancho, restauración, teclado y movimiento reducido. Fuente sincronizada en los cuatro gateways, incluido el código servido por el Worker de Plus.
- Kobe: revisar el bloqueo de carga sin tratarlo como un pendiente de creación. Atrio Full Carga NET usa un único crédito API, con autenticación/búsqueda antes de armar la guarda persistente. Un error previo al crédito no consume el bono ni genera una incertidumbre financiera falsa; un resultado monetario incierto sigue bloqueado y no se reintenta. Los demás canales conservan el recorrido anterior. La conciliación del incidente histórico es explícita, acotada a Kobe, respaldada por lecturas frescas del proveedor y sin enviar dinero.
- El lote funcional de altas/API2 permanece local hasta el despliegue coordinado de API2/migraciones por el programador y la posterior publicación web. La UI independiente de compresión/altura se publicó por separado por instrucción posterior del usuario.

Entrega vigente: [altas, widget y conciliación de Kobe](validation/safe-entry-widget-kobe-20261028.md).

### Alta rápida con nombre y variantes numéricas (28/10/2026)

- Mantener el recorrido que ya crea la cuenta en pocos segundos: un primer intento exitoso no agrega búsquedas ni verificaciones remotas. Las altas nuevas de Atrio usan el nombre normalizado más seis cifras; conservar los usuarios existentes y los intentos pendientes con su usuario reservado.
- Ante un rechazo explícito de nombre ocupado, primero comprobar si esa cuenta corresponde al mismo intento y su clave. Recuperarla si coincide. Si se confirma la ausencia o un rechazo explícito de sus credenciales, reservar otra variante del mismo nombre y clave, dentro del mismo intento. Cambiar la reserva de forma atómica, con exclusión entre procesos y protección contra respuestas tardías de otra variante.
- No interpretar un timeout, HTML de protección, suspensión, correo repetido o error genérico como nombre ocupado. Un resultado incierto conserva su usuario y se concilia. Hasta tres intentos cortos por solicitud, sin pausa artificial por una colisión confirmada; conservar los presupuestos web acotados y la recuperación durable como mecanismo interno.
- Aplica a los adaptadores de altas Atrio de Rey, Ases y NET, usados por ambos motores. Los bots anteriores conservan sus métodos y el sufijo predeterminado de cuatro cifras. Ganamos+ conserva su integración actual y no adquiere un alta PBAdmin. No cambiar cargas, retiros, datos bancarios ni cuentas ya creadas.
- No se implementa una reserva de cuentas precreadas. El objetivo es entregar una cuenta con el nombre del cliente durante el ingreso; las recuperaciones prolongadas no son el recorrido normal de alta.

### Retomar altas pendientes al volver a la landing (28/10/2026)

- Reconocer el navegador con su identidad estable y buscar tanto la cuenta vinculada como el intento de alta pendiente. No pedir otro nombre para recuperar el intento. Conservar asesor, bot, gerencia, proveedor, identidad, usuario/clave reservados y promo originales. Cubrir constructor y clásico, con y sin pool de managers. No adoptar una cuenta de otro navegador por coincidencia de nombre.
- Una identidad recordada sin cuenta vinculada solo se retoma automáticamente tras consultar el estado privado de API2 para ese jugador, asesor, bot, gerencia y proveedor. La consulta no crea usuarios ni devuelve credenciales. Una cuenta pendiente no se presenta como lista. Reutilizar la conciliación existente: verificar pertenencia y clave; únicamente NET permite volver a solicitar el mismo usuario/clave después de confirmar su ausencia. Conservar la protección contra altas inciertas de los demás proveedores.
- El límite interno de 24 horas corresponde a una ventana de recuperación, no a la edad de la cuenta. Un regreso autorizado puede abrir otra ventana para un intento detenido, manteniendo fecha e identidad originales. Los reintentos simultáneos no reinician ni extienden una ventana activa. Mantener exclusión entre trabajadores y alertas internas existentes.
- Limitar los reintentos del navegador a 30 segundos en total y cada petición a 15 segundos. Mostrar feedback tras 8 segundos. Si el recorrido completo del gateway sigue pendiente a los 45 segundos, ofrecer «Retomar mi acceso» y explicar que no hace falta completar los datos nuevamente. Ignorar resultados tardíos de una ejecución anterior; reintentar con el mismo token. Conservar paletas, usuario/clave, espera configurada y ausencia de avisos de autoredirección.
- Misma página y transporte compartidos para los cuatro gateways, incluido el Worker de Ganamos+. Plus conserva su falta de altas PBAdmin; no crear una cuenta NET para ese destino. No cambiar cargas, retiros, saldos ni operaciones bancarias.
- Requiere una columna nueva en API2 (`recovery_started_at`). API2 y su migración quedan para el programador; este lote no publica ni reintenta cuentas reales. Publicar la parte web después de API2 para disponer del endpoint privado de estado.

Entrega y verificación: [recuperación de intentos antiguos](validation/entry-recovery-20261028.md).

### Stickers en los chats (28/10/2026)

- Cliente y asesor tienen el botón de stickers con el símbolo de hoja/cuadrado y esquina doblada, junto al selector de emojis. Un selector compartido ofrece Recientes, Mis stickers y Añadir sticker. Abrir uno cierra el selector de emojis; conservar paletas, teclado, ancho y espacio del compositor.
- Añadir imágenes PNG/JPG/WebP/GIF y guardar stickers recibidos tocándolos o desde sus opciones. Enviar desde la grilla, quitar de Mis stickers y conservar los usados entre los 30 más recientes. Colecciones personales persistidas por jugador o usuario interno; se recuperan al abrir desde otro navegador con la misma identidad. No intentar acceder a la colección privada de WhatsApp.
- Preparar WebP de 512 × 512 manteniendo encuadre, transparencia y animación cuando la entrada la tiene. Entrada máxima 4 MB; salida máxima 1 MB. Validar formato real, dimensiones y cantidad de cuadros en el servidor, retirar metadatos y deduplicar archivos por hash. Los stickers se presentan sin la burbuja rectangular, con horario y tildes; conservar reacciones y respuestas.
- Guardar la colección y los recientes en Supabase. El jugador se resuelve desde la sesión firmada del chat y el usuario interno desde su sesión; autorizar la conversación del asesor con RLS. El navegador elige únicamente un sticker de su colección o un mensaje recibido de su conversación. Nunca aceptar una URL ni un propietario elegidos por el cliente. Las tablas no tienen acceso directo por anon/authenticated y el RPC de envío es exclusivo del servidor.
- El envío y la actualización de recientes son atómicos e idempotentes por intento, conversación, sticker y participante. Una respuesta perdida conserva el identificador al reintentar. Mantener actividad del mensaje, notificaciones y LEAD según sus reglas existentes; excluir stickers de inferencia de carga, análisis de comprobantes y archivos enviados a la automatización de API2.
- Implementación única de Atrio para cliente, ambas vistas del inbox, los tres temas y los cuatro gateways, incluido el embed servido por Ganamos+ desde su Worker. No requiere modificar ni volver a desplegar los padres de los gateways.

Validación y publicación: [stickers del chat](validation/chat-stickers-20261028.md).

### Tamaño del widget, agrupación y respuestas a mensajes (28/10/2026)

- Entre Perfil y Cerrar, el widget tiene Maximizar/Restaurar, con los íconos de un cuadrado y dos cuadrados. Amplía solo su altura, conservando ancho, paleta, espacio superior y adaptación al teclado. El padre valida origen y ventana antes de aceptar la acción; devuelve el tamaño vigente al iframe. Fuente compartida de movimiento para los cuatro gateways, incluido el Worker de Ganamos+.
- La apertura conserva 520 ms. El cierre tarda 720 ms y mantiene visible el contenido durante la compresión hacia el botón; el desvanecimiento ocurre al final. Conservar inversión rápida, iframe montado, ausencia de bloqueo táctil estando cerrado y movimiento reducido.
- La separación entre mensajes consecutivos del mismo emisor pasa de 6 a 3 px; entre emisores distintos se mantiene en 6 px. Respetar los separadores de fecha y los avisos. Aplica a cliente, asesor, móvil, escritorio y los tres temas.
- Cliente y asesor pueden mantener presionada una burbuja para reaccionar con 👍, ❤️, 😂, 😮, 😢 o 🙏, cambiar/quitar su reacción y deslizar horizontalmente para responder. En escritorio, ofrecer también controles al pasar el cursor y con teclado. El scroll vertical, los enlaces y la copia se conservan.
- Guardar una reacción por participante y mensaje; actualizar de forma atómica sin sobrescribir las de otros. Las respuestas muestran una cita validada por servidor dentro de la burbuja, con vista previa en el compositor, cancelación y acceso al original si está cargado. Conservar ambos datos al recargar y mostrarlos al otro participante mediante los canales existentes. No generar mensajes, LEAD ni tracking por reaccionar.
- Rechazar referencias a otra conversación, avisos internos y mensajes no visibles. El gateway deriva jugador y conversación exclusivamente de su sesión firmada; el asesor usa su sesión y permisos de jerarquía. Los RPC anónimos conservan exclusivamente la identidad legacy y no acceden a conversaciones vinculadas a una plataforma. La lógica privilegiada nueva reside en un schema privado no expuesto; las fachadas públicas son invokers. No modificar API2.

Validación y publicación: [interacciones del chat](validation/chat-interactions-20261028.md).

### Recordatorios de invitaciones (28/10/2026)

- En los cuatro gateways, las invitaciones de instalar, completar perfil y activar notificaciones usan «Recordármelo después». La primera postergación habilita el recordatorio dos horas después del envío original; cada postergación posterior inicia otras dos horas desde el clic.
- Reaparecer solo tras un nuevo mensaje/acción del cliente posterior al plazo y su respuesta. El paso del tiempo, una recarga o una respuesta antigua no alcanzan. Esperar el cierre de cargas/retiros pendientes y de formularios abiertos. La primera instalación conserva la tarjeta contextual dentro del chat, sin modal al ingresar.
- Revalidar instalación/suscripción push en el gateway y consultar el perfil existente antes de repetir su invitación. Una acción completada cancela su recordatorio; un fallo de comprobación no significa que esté pendiente. Conservar las promociones fuera de este mecanismo.
- Estado por jugador y tipo en el almacenamiento del navegador de Atrio, con reserva entre pestañas cuando Web Locks está disponible. Mantener el texto de la invitación para poder recordarla aunque salga de la ventana de mensajes. El gateway conserva un recibo transitorio de postergación para recuperarlo si se recarga antes de que lo reciba el iframe. No sincroniza otros dispositivos; borrar el almacenamiento elimina este recuerdo. Sin DB, migraciones, tracking nuevo ni cambios de API2.
- Los gateways conservan una única fuente sincronizada para presentación y puente de recordatorios. Ganamos+ incluye Vercel y su Worker público.

Validación y publicación: [recordatorios de invitaciones](validation/invitation-reminders-20261028.md).

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

### Formato de mensajes de WhatsApp (28/10/2026)

- Cliente y asesor interpretan `*negrita*`, `_cursiva_`, `~tachado~`, monoespaciado con tres acentos graves, código con uno, viñetas (`- ` o `* `), listas numeradas y citas (`> `). Usar la sintaxis documentada por WhatsApp, sin convertir HTML del mensaje en HTML ejecutable.
- La presentación única de Atrio aplica a mensajes actuales y anteriores, automáticos y manuales, chat independiente y los cuatro gateways. Mantener el texto almacenado, las cuentas, sus claves, enlaces HTTP/HTTPS/wa.me, copia, paletas, contención y horarios. No interpretar marcadores interiores de URLs, emails, nombres con guiones bajos o fragmentos de código.
- Verificación: [formato de WhatsApp](validation/chat-formatting-20261028.md). No requiere migraciones ni cambios de API2 o de los gateways; estos cargan el chat compartido de Atrio.

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

### CAPI por workspace y configuración del píxel (26/10/2026)

- En Integraciones → Meta CAPI, el interruptor «Enviar eventos por CAPI» aplica al workspace seleccionado (ARS o PYG), por cliente, por encima de los píxeles. Guardar una moneda no cambia la otra; la configuración existente conserva CAPI activo por defecto.
- Desactivar PYG de goldencajeros y conservar ARS. Los demás clientes conservan su estado. La pausa afecta Contact, Lead, CompleteRegistration y Purchase por servidor, incluidos reintentos y orígenes Atrio, Chatrace y WhatsApp. No modifica el píxel del navegador ni el registro interno de conversiones, valores, monedas o atribución.
- Registrar la omisión como `skipped_workspace_capi_disabled`, sin presentarla como un fallo de Meta. Al reactivar, procesar eventos nuevos; no reenviar los que fueron omitidos durante la pausa. Los eventos ya enviados o en vuelo no se cancelan retroactivamente.
- El modal del píxel usa cuatro pestañas: General, Eventos, Purchase y Ubicación. Una opción por fila, con interruptores alineados a la derecha. Dentro de cada pestaña se permiten tarjetas para agrupar opciones relacionadas, evitando sucesivas capas de tarjetas; Purchase separa clasificación, plazo de recargas y monto mínimo. Conservar las validaciones, credenciales protegidas, botones de ayuda y guardado/cancelación. El borrador se conserva al cambiar de pestaña; abrir el modal comienza siempre en General. Guardar y Cancelar quedan visibles y el motivo de una selección de Purchase inválida se muestra desde cualquier pestaña.

Pruebas y publicación: [CAPI por workspace](validation/workspace-capi-20261026.md).

### Paleta, cuenta creada y perfil del cliente (27/10/2026)

- Mientras se muestra la transición, el fondo raíz y el tema del navegador siguen la página seleccionada, tanto en clásico como en constructor. La creación usa fondo opaco sin blur; al cancelar o fallar y volver al formulario se recupera el tema anterior. Rey usa `#141414`, Ases `#071b2c`, NET `#11001f` y Ganamos+ `#121212`. Las barras nativas, especialmente Chrome/iOS en incógnito, pueden conservar su propio tinte: no afirmar que una prueba de WebKit de escritorio certifica el iPhone.
- La tarjeta de cuenta creada muestra Usuario y Clave, visibles y con copia independiente. La clave se consulta exclusivamente desde la sesión HttpOnly ya autenticada, sin IDs elegidos por el cliente, sin guardarla en storage, URLs o tracking. La consulta no demora el ingreso ni altera la espera configurada o Continuar; si no responde, queda disponible desde Mi perfil. No mostrar un aviso de redirección automática.
- Mi perfil conserva la paleta elegida por el asesor en sus tres temas y cambia «Tu cuenta del casino» por «Tu cuenta». Allí la clave sigue oculta inicialmente, con ojo y copia. Los campos deben caber dentro del modal.
- Los avisos de invitaciones comparten logo centrado sobre el título en los cuatro gateways. Se conserva íntegro el instructivo de instalación.
- No modificar todavía cuándo se ofrece instalar la app. El usuario pidió una explicación y propuesta; cambiar el disparador requiere una decisión posterior.

Validación y textos del recorrido: [revisión de presentación](validation/entry-presentation-20261027.md).

### Perfil e instalación contextual (27/10/2026)

- En Mi perfil, Usuario y Clave tienen tarjetas interiores independientes dentro de Tu cuenta, con fondo y borde sutiles de la paleta elegida. Conservar el ojo, copiar y el tamaño compacto.
- Reemplazar el ofrecimiento automático de instalación al entrar o cerrar el chat por una tarjeta discreta dentro de la conversación: «Guardá tu acceso en este teléfono» y «Instalar app». Aparece después de un mensaje enviado por el cliente y una respuesta del asesor/API2. No requiere una carga; bienvenida, CBU inicial, ausencia, promociones e invitaciones no cuentan como respuesta.
- Posponer la tarjeta durante el envío, un formulario de retiro abierto o estados de procesamiento/pago pendientes visibles en los mensajes. Usar exclusivamente los metadatos existentes; no inferir resultados financieros por palabras ni añadir consultas o eventos. Ante un estado pendiente sin resolución visible, conservar oculta la sugerencia.
- El instructivo existente se abre al tocar Instalar app. Se puede ocultar la sugerencia; recordar esa decisión en el navegador del gateway. No ofrecerla en modo app o cuando el navegador ya registró la instalación. Mantener las invitaciones explícitas del asesor, las notificaciones y el arranque diferido del SDK. Aplicar a los cuatro gateways y a ambos motores mediante el chat compartido.
- La consulta sobre aprovechar la clave devuelta al crear el usuario es una revisión técnica: no cambia todavía el contrato de credenciales ni la consulta autenticada existente.

Pruebas y publicación: [perfil e instalación contextual](validation/profile-contextual-install-20261027.md).

### Clave reutilizada del autologin (27/10/2026)

- La pantalla de cuenta creada obtiene la clave del JSON privado de preactivación del gateway, usando las credenciales del mismo pase con el que acaba de autenticarse. Reemplaza la consulta adicional de entrada a `/api/session/credentials`; no agrega lecturas de base de datos.
- Entregar la clave solo después del login y creación de sesión exitosos, en una petición JSON del mismo origen. La respuesta no admite caché ni CORS. No incluirla en redirecciones, HTML inicial, URLs, logs, tracking ni almacenamiento del navegador. La UI valida que corresponda al usuario mostrado y usa texto, nunca HTML.
- Conservar la confirmación de cookie, recuperación cifrada, Continuar y la espera configurable. Una respuesta antigua, un origen no verificable o un reintento sin credenciales conserva el acceso y muestra «Disponible en Mi perfil», sin otra consulta.
- Mantener el endpoint autenticado de Mi perfil y la compatibilidad con páginas anteriores. Aplicar a ambos motores y los cuatro gateways, incluido el Worker de Ganamos+. No habilita altas PBAdmin para Ganamos+, que aún no tiene esa integración.

Pruebas y publicación: [clave reutilizada del autologin](validation/entry-credentials-20261027.md).

### Teléfono, contraste y variables de respuestas (27/10/2026)

- Mi perfil muestra «Tu teléfono» cuando falta WhatsApp. Los inputs móviles usan 16 px para evitar zoom automático; al cambiar el espacio disponible, el modal mantiene visible el campo enfocado mediante scroll interior. Conservar las tres paletas y las tarjetas de Usuario/Clave.
- En el tema WhatsApp, Perfil y Cerrar tienen borde blanco; la silueta de Perfil también es blanca. Implementación compartida en Atrio para los cuatro gateways.
- Respuestas rápidas, bienvenida y ausencia admiten `{{nombre}}` (nombre del cliente), `{{usuario}}` y `{{clave}}`. Se sustituyen al enviar, usando exclusivamente la cuenta vinculada a esa conversación. La sustitución es literal y de una sola pasada. Si faltan datos de acceso, mostrar «Disponible en Mi perfil»; nunca otra cuenta ni los marcadores sin completar.
- La clave de cuentas PBAdmin necesita un endpoint privado de lectura en API2, con asesor, manager, agencia y jugador explícitos. No crea cuentas, no cambia claves ni consulta saldos/proveedores. API2 queda local; su despliegue corresponde al programador. No agregar una caché de claves.
- Bienvenidas sin clave y chats existentes conservan un solo viaje de bootstrap; únicamente una bienvenida nueva con clave necesita la lectura privada y la segunda fase atómica. Mantener deduplicación, CBU inicial y las demás verificaciones.
- Investigar el intento de Benja en `/diana` del 27/10 a las 14:35 sin crear/reintentar ni modificar su provisión. El estado incierto exige conciliación, no asumir éxito ni fracaso del proveedor.

Validación y dependencia de API2: [perfil y respuestas rápidas](validation/profile-quick-replies-20261027.md).

### Recuperación del alta sin bloqueo de 45 segundos (27/10/2026)

- Ante una falla temporal, recuperar automáticamente el mismo intento de creación. Conservar usuario, clave, identidad, asesor, página y atribución; nunca inventar credenciales ni duplicar cuentas para aparentar éxito. Errores de permisos/configuración no se reintentan. Una caída persistente del proveedor puede impedir completar el alta; mostrar recuperación manual sin el antiguo bloqueo fijo de 45 s.
- API2 fue actualizado por pull hasta `ee8924b1` preservando el trabajo anterior; sus cambios siguen exclusivamente locales para el programador. Recupera hasta tres veces el intento durable. Distingue un alta no enviada de una respuesta incierta. NET solo reenvía el mismo username/clave tras ausencia comprobada; todos los proveedores requieren pertenencia y clave válidas para conciliar. No modificar operaciones financieras.
- Ambos motores y los cuatro gateways comparten `request-recovery.ts`: hasta cuatro solicitudes ante fallos temporales, mismo cuerpo/token, pausas breves y respeto de Retry-After. Conservar transición, usuario/clave, tracking y espera configurada de cuenta creada. Ganamos+ comparte la UI y su Worker; sigue sin integración de altas PBAdmin.
- La migración Builder `20261027184155_template7_resumable_attempt_limits.sql` cambia solo las ventanas de recuperación de T7/T8 a 4 solicitudes/10 s. Mantiene límite global por IP 120/60 s, validación de asesor/cliente y RPC privados. Aplicada en Supabase; no requiere migración nueva de API2.
- Validación: `frontend/tests/entryRecovery.test.ts` y regresiones de entrada (49 pruebas); `scripts/check-entry-recovery.mjs` (36 escenarios Chromium/WebKit, código real compilado, sin solicitudes de negocio externas); `scripts/phase0/entry-recovery-database.mjs` (RPC reales, concurrencia y permisos en PostgreSQL desechable). Gateways: 34 pruebas Rey y 33 por cada otro proveedor. API2: 43 provisión, 19 proveedores y 13 MySQL real; sin datos productivos mutados. La funcionalidad completa depende del despliegue de API2 por el programador.

Publicación del lote: Builder `0d7c96e` (`dpl_7jKkueVayfcfdySrAhZ8AeubjW4B`), clásico `256278f` (`dpl_CPcVw27KXf5K14Vw6XqjscmqQH3U`), Rey `1bfd0c2` (`dpl_8o4DhJa5cAD1c8niPypBB6xd9o74`), Ases `e86a3a7` (`dpl_6kb5pRkGEnkjJZJDGJE7BFy6xPLL`), NET `a01b977` (`dpl_GXCjPHK8ntS8sfpjYSVFEuogBTqR`) y Plus `ca07a96` (`dpl_3c3S793iQKyW9Z7dEBCuMJm7no4h`). Worker público de Plus: `da48127a-b2da-4a51-95f1-388e3cb8e76c`. Todos en `fix/template7-session-reentry`; API2 no publicado. Compilaciones Vercel/OpenNext y lectura de las páginas públicas verificadas; el código compilado de recuperación se ejecutó con HTTP simulado, sin crear jugadores ni emitir conversiones reales.


### Recuperación durable y respuestas truncadas (27/10/2026)

- El usuario autorizó completar el refuerzo antes del despliegue conjunto del programador. La autorización previa de commit/push de API2 sigue vigente en `feature/atrio-integration`; este lote no implica publicar producción ni crear cuentas reales de prueba.
- API2 conserva una recuperación persistida del mismo intento de alta simple para Ases, NET y Rey, aunque termine la solicitud, cierre el navegador o se reinicie el proceso. Reserva exclusiva con vencimiento, revalidación de permisos/destino, reintentos acotados y revisión interna ante fallo permanente. No generar otra identidad, cambiar de asesor/bot ni modificar operaciones financieras. Los intentos anteriores se incorporan mediante un nuevo reintento autorizado, sin reactivación masiva al migrar.
- El navegador de Ases no repite un formulario después de un envío potencialmente efectuado: primero se concilian pertenencia y clave. NET mantiene su requisito de ausencia confirmada y conserva el usuario/clave originales.
- Clásico, constructor y los cuatro gateways consideran confirmado el transporte solo cuando termina el JSON. Mantener el timeout durante la lectura del cuerpo y recuperar un corte/JSON truncado usando exactamente el mismo token/cuerpo. Un error HTTP permanente no se reintenta, incluso si su cuerpo falla. Conservar tracking, selección previa de T8, usuario/clave y espera configurada. Ganamos+ comparte la mejora web; no se habilita su alta PBAdmin.
- Una migración API2 nueva: `20261027000001_add_atrio_provision_recovery.ts`, antes del arranque del código. Sin migración Builder nueva ni cambios de Panel3/internal-chat. Entrega detallada en `api2/docs/validation/atrio-entry-recovery-20261027.md`.
- Validación local: API2 109 pruebas aisladas y 15 en MySQL real descartable; web 3 pruebas de recuperación y 56 escenarios Chromium/WebKit con los HTML/funciones compiladas reales. Sin llamadas de negocio externas. La prueba con proveedor real y la verificación del siguiente intento de Benja quedan para después del despliegue.
- Publicar juntos Builder, clásico, Rey, Ases, NET y Plus (incluido Worker). Esta revisión prepara el código y Git; no promueve despliegues a producción.

### Publicación web de la recuperación durable (27/10/2026)

- Autorización posterior explícita del usuario: publicar todo lo que podemos desplegar; API2 queda a cargo del programador. Esta decisión habilita la promoción web que el apartado anterior dejaba pendiente.
- Publicados Builder, clásico y los cuatro gateways en Vercel; también el Worker de Ganamos+. No hubo cambios adicionales de aplicación, migraciones ni despliegues de API2, Panel3 o Atrio en este paso.
- Verificación de versiones activas y 48 escenarios Chromium/WebKit sobre las funciones descargadas de las páginas públicas. Solo lecturas HTTP en producción; solicitudes del navegador simuladas. Sin altas, activación de pases, conversiones ni operaciones financieras reales.
- La verificación del alta completa depende del código activo de API2 y del proveedor; la publicación web no confirma que API2 esté ejecutando `2752ebe3`. Ganamos+ sigue sin integración PBAdmin para altas.

Versiones publicadas, evidencia y referencias de rollback: [publicación de recuperación](validation/entry-recovery-production-20261027.md).

### Entrada desde Meta Ads y trazabilidad de Template 7/8 (30/10/2026)

- El usuario autorizó implementar el paquete completo después de revisar el caso Eduardo. El ingreso continúa en Facebook, Instagram y el navegador actual; abrir otro navegador queda como recuperación ante una limitación comprobada, sin un paso obligatorio.
- Los parámetros publicitarios no invalidan el pase, aunque su nombre sea nuevo o desconocido. Se validan los campos funcionales declarados de cada ruta; los extras se ignoran para autenticar y no eligen cuentas, credenciales ni destinos. Se conservan las comprobaciones de firma, expiración, identidad, skin, duplicados de campos funcionales y destinos autorizados. La atribución original, incluidos `fbclid`/`fbc`, permanece en su recorrido existente; no se transforma en autoridad de acceso.
- El formulario se muestra sin el viaje obligatorio al gateway para visitantes nuevos. Las señales locales de visita previa son solo una optimización; la recuperación del servidor sigue verificando la identidad. Una respuesta en segundo plano no interrumpe a quien ya escribe. Multi Skin recupera desde la landing y respeta la skin seleccionada, sin usar la skin de una sesión anterior como destino.
- La cuenta confirmada, el asesor y la identidad se conservan ante errores de transición, login o chat. Los reintentos son acotados y reutilizan la misma operación; no se crean cuentas adicionales por una respuesta cortada. Rey incorpora una capacidad de reintento en memoria vinculada al primer consumo y al vencimiento original, con exclusión de concurrencia; el pase consumido por sí solo no se vuelve reutilizable.
- Se desactiva la espera artificial de 20 segundos, conservando el ajuste configurable y las credenciales en Mi perfil. Aplicado en Atrio el 30/10 a las 23:46 UTC: `redirect_wait_enabled=false`, `redirect_wait_seconds=20` conservado.
- Los tiempos de lectura incluyen el cuerpo completo de las respuestas y la cancelación exterior se respeta. El límite de recuperación no representa una espera mínima: un ingreso exitoso continúa inmediatamente.
- Template 7/8 usan recursos compartidos con nombre por contenido y caché; la configuración específica permanece fuera del archivo compartido. Se conservan versiones anteriores de archivos publicadas para HTML cacheado. Se prepara el chat al interactuar con el formulario. Template 8 prioriza las imágenes y preparación de la selección actual, sin esperar otra tarjeta.
- Se agregan eventos internos de formulario visible, foco, inicio de escritura, nombre válido, CTA, destino, cuenta lista, login, gateway y chat disponible. No se guardan teclas, nombres incompletos, credenciales, pases, IP ni parámetros publicitarios en esta telemetría. Una ausencia de eventos posteriores indica una interrupción observada, no demuestra por sí sola su motivo. El cierre/ocultamiento puede reanudarse.
- La telemetría es asíncrona, acotada e idempotente. El contexto viaja separado de la autorización mediante un sobre cifrado y una cookie privada del gateway; no concede acceso. Los datos se conservan 90 días, con permisos exclusivos de servicio. Contact conserva su significado y deduplicación.
- Alcance: constructor, clásico, Rey, Ases, NET y Multi Skin, incluido su Worker. Los templates 1–5 conservan su comportamiento. Este lote no cambia API2, Panel3 ni operaciones financieras; no declara concluido el E2E real Multi Skin pendiente de su integración desplegada.

### Parámetros nuevos de anuncios y prioridad de landing (30/10/2026)

- Aclaración posterior del usuario: no mantener una lista cerrada de parámetros publicitarios aceptados. Meta puede agregar campos nuevos y su presencia no debe interrumpir el ingreso. Validar únicamente los datos funcionales del acceso y descartar los extras al construir la solicitud de autenticación.
- `landing=diana` conserva prioridad sobre el slug del enlace, por ejemplo `/gast?landing=diana`. Se resuelve en la landing antes de preparar el acceso y se conserva al volver desde el gateway, junto con los parámetros de atribución. No reinterpretar `landing` dentro del gateway como permiso para cambiar una cuenta, un asesor o una skin ya confirmados.
- No registrar nombres arbitrarios de parámetros ni sus valores en el diagnóstico; usar categorías y contadores. Conservar límites sobre los campos funcionales y las restricciones del servidor de alojamiento, sin rechazos de la aplicación por cantidad o tamaño de campos extra.
- Verificar ambos motores y los cuatro gateways, incluidos parámetros desconocidos/repetidos, override por `landing`, conservación de atribución y rechazo de pases inválidos o ambiguos.
- La verificación pública detectó además un defecto de serialización de consultas del adaptador OpenNext en Cloudflare. Se corrigió exclusivamente su reconstrucción de `req.url` mediante un parche verificable del bundle generado, aplicado en build/deploy y Wrangler directo. Conservar parámetros repetidos, codificar valores anidados y detener la publicación si cambia el adaptador; no relajar nonce ni orígenes autorizados. Publicación y evidencia finales en `validation/entry-funnel-20261030.md`, apartado de parámetros desconocidos.
### Recuperación acotada y diagnóstico por etapa (31/10/2026)

- El usuario autorizó implementar los refuerzos encontrados en la auditoría posterior del ingreso. Mantener la cuenta, el asesor y la skin del intento; una recuperación no puede sustituirlos por otra sesión del navegador.
- Un fallo de bootstrap o de resolución de destino no debe quedar cacheado indefinidamente. Acotar también la lectura del cuerpo, cancelar el trabajo anterior y descartar respuestas tardías al reintentar o cambiar de tarjeta.
- La comprobación del navegador en `/resume` debe terminar dentro de un plazo total, incluida la lectura de vuelta de la cookie, y volver a la landing autorizada cuando no pueda completar la recuperación.
- Reintentar tras el vencimiento requiere autorización vigente para la misma cuenta. No aceptar pruebas vencidas ni crear una cuenta como consecuencia de renovar un pase o un iframe.
- Un fallo transitorio de red, del proveedor o de persistencia durante la verificación diferida de Rey no debe revocar una sesión por sí solo. Conservar la comprobación de identidad y revocar ante un rechazo inequívoco; diagnosticar las verificaciones que quedaron sin confirmar.
- Separar en la telemetría interna los hitos de iframe, bootstrap del chat, bienvenida y datos de carga. Los errores usan etapa, categoría y estado HTTP acotados; no registrar respuestas arbitrarias, credenciales, pases, URLs ni nombres del cliente. Contact conserva su significado y deduplicación.
- Alcance: ambos motores T7/T8, Atrio y los cuatro gateways, incluido el Worker. No modifica API2, Panel3 ni operaciones financieras. Las simulaciones de navegador no equivalen a una certificación en las aplicaciones nativas de Facebook e Instagram.

### Menor peso, chat disponible y Continuar opcional (31/10/2026)

- El usuario aprobó implementar las mejoras de la auditoría de T7/T8. Medir por separado el chat visible que ya permite escribir (`chat_usable`) y los datos de carga (`wallet_ready`); conservar el significado previo de `chat_ready` para compatibilidad. El iframe oculto o precargado no cuenta como chat utilizable. No agregar datos personales ni alterar Contact, LEAD o Purchase.
- Adelantar el chat autenticado respecto de la descarga completa del HTML del proveedor, conservando la confirmación de la misma sesión, las reescrituras por casino y una alternativa al comportamiento anterior cuando no haya evidencia suficiente. Coordinar los plazos de las etapas y los reintentos sin reiniciar un presupuesto por cada intento ni cambiar la cuenta.
- Excepción de Ases del Norte: su verificación de sesión busca también un formulario de login que puede aparecer al final del HTML. Conservar la inspección completa antes de exponer el chat hasta contar con una validación independiente del proveedor; un marcador temprano de saldo/usuario no basta. Recibe el resto de las mejoras compartidas en este lote.
- Solapar las lecturas independientes de bienvenida y banco después de validar identidad. Persistir introducción, bienvenida y tarjeta en su orden, revalidando el vínculo antes de usar el resultado bancario. No considerar un CBU histórico como una lectura actual.
- Agregar en Configuración de Super Admin de Atrio un interruptor global «Mostrar botón Continuar», independiente de la espera configurable. Por defecto desactivado: conserva el ingreso automático actual. Activado: mostrar las credenciales de la sesión y esperar el clic; volver a confirmar esa misma sesión antes de ingresar. La espera humana no consume el plazo de una solicitud de red.
- El editor optimiza las imágenes estáticas al subirlas y guarda un derivado liviano para el consumo público. Conservar el original por separado, proporción, transparencia y apariencia; admitir formatos habituales sin exigir una conversión manual previa. Validar autenticación, formato y límites antes de procesar; no convertir SVG o animaciones a ciegas. Los archivos originales ya publicados no se sobrescriben.
- Reservar el espacio del logo de T7 y evitar recursos de Next innecesarios en la clásica, conservando diseño, parámetros publicitarios y comportamiento de los demás templates. Aplicar las mejoras compartidas a ambos motores y los cuatro gateways, incluido el Worker.
- El usuario dispone únicamente de iPhone y probará las aplicaciones nativas cuando reciba la publicidad. Esa prueba queda pendiente y no bloquea la implementación, las simulaciones ni la publicación autorizada. No presentar emulación de escritorio como certificación de Instagram/Facebook en iPhone.

### Fecha original de PURCHASE y entregas tardías (31/10/2026)

- El usuario autorizó corregir el caso 126018: una entrega tardía de una carga confirmada no constituye una nueva operación monetaria. Conservar la identidad de la carga, transacción, acción y reservas de deduplicación; no generar otro evento por el cambio de fecha ni reactivar envíos históricos.
- Atrio debe emitir `event_time` en segundos desde el timestamp original. Para entregas pendientes o preparadas anteriormente, derivarlo primero de `confirmed_at` autoritativo y después de `timestamp`/`dateTime` originales válidos. Si ninguna fecha original es válida, fallar sin fabricar la fecha con `Date.now()`. Conservar los demás campos persistidos, IDs y fechas originales.
- Builder conserva `event_time` explícito válido y normaliza segundos, milisegundos e ISO. Si un alias válido de la acción discrepa, lo alinea con ese instante explícito para mantener coherencia con los handlers que leen primero el alias. Si falta `event_time` válido, usa la fecha específica de la acción; en PURCHASE prioriza después `confirmed_at` antes de los campos genéricos originales. La recepción es únicamente el último fallback cuando no existe ninguna fecha original válida. Una fecha antigua permanece antigua y se somete a la política CAPI existente de siete días; no modificar filtros de origen, montos, atribución, lineage ni deduplicación.
- `created_at` conserva su significado de creación/recepción de la fila. La columna Fecha y los filtros que ya usan ese campo no se reinterpretan como fecha de la carga; `purchase_event_time` identifica cuándo ocurrió el hecho. No reescribir filas históricas, reenviar los casos investigados ni crear nuevas operaciones para verificar este arreglo.
- Alcance del lote: normalización de fechas en Atrio y Builder, pruebas aisladas sin Meta ni transferencias y documentación del incidente. Sin migraciones, cambios de API2 ni operaciones financieras.
- Publicado: Atrio `a7f7920`, Builder `0bb42f5`, Edge `conversions` v172 activo y sus diez archivos verificados contra la fuente comprometida. Pasaron 46 pruebas Deno, diez comprobaciones aisladas de recepción/política CAPI, 19 casos únicos de Atrio y el smoke público de cinco GET. Los servicios centrales sirven a los cuatro proveedores sin cambiar sus gateways ni el Worker. [Publicación y rollback](validation/purchase-runtime-release-20261031.md).

### Imágenes del chat y recepción durable de Purchase (31/10/2026)

- El usuario pidió que las imágenes del chat tengan la presentación de la referencia de WhatsApp: imagen completa con esquinas redondeadas, sin marco grueso ni nombre de archivo visible, con hora y estado superpuestos. Conservar captions explícitos, documentos, stickers, confirmaciones reales del comprobante, reacciones, respuestas y apertura accesible. Implementación única en Atrio para cliente e inbox, los tres temas y los cuatro gateways; no modificar copias del SDK.
- Aclaración explícita posterior: la captura y el mensaje de error del comprobante aportan contexto al incidente financiero. No cambiar esa respuesta ni explicar detalles técnicos al cliente. Este lote no modifica API2 ni vuelve a ejecutar operaciones financieras.
- Builder debe guardar el Purchase completo antes de confirmar su recepción con HTTP 202. La respuesta confirma recepción durable, no acredita dinero ni declara que Meta aceptó la conversión. Si no se puede confirmar el guardado, devolver un error reintentable; no ocultar un fallo de recepción con un 2xx.
- El procesamiento posterior conserva fecha original, IDs, monto, moneda, destinatario, atribución, URL, pixel y políticas CAPI existentes. Reintentar el mismo recibo reutiliza su identidad; incluso los emisores sin IDs conservan una clave interna estable durante su recuperación. No importar ni reenviar filas históricas para activar esta cola.
- La cola privada tiene exclusión atómica, leases de diez minutos, recuperación tras interrupciones y ocho intentos con espera progresiva. La ejecución inmediata en segundo plano es una optimización; un cron autenticado cada minuto recupera trabajo pendiente. El envío CAPI existente espera mientras un recibo sigue activo. El traspaso a la espera de un Lead debe confirmar la persistencia del inbox antes de completar el recibo; el replay interno se autentica y no toma autoridad de campos públicos.
- Estado de este lote: implementación y pruebas locales; requiere migración y publicación coordinada de `retry-failed-conversions`, `conversions` y Atrio. No declarar corregida la producción antes de completar esa publicación. [Validación y orden de publicación](validation/purchase-durable-acceptance-local-20261031.md).
- El usuario autorizó después completar commits, push, migración y publicación del lote. También pidió paridad fuera del widget: el perfil del acceso directo debe mostrar el usuario y la clave de su cuenta ya vinculada, mediante lectura privada autenticada por sesión de conversación y cookie HttpOnly del bot exacto. No inventar una cuenta para conversaciones sin vínculo, no incluir contraseñas en bootstrap, URL o almacenamiento público, y conservar el puente privado del widget. Las entradas directas deben respetar la presentación configurada igual que el widget. La publicación común de Atrio cubre los cuatro proveedores.
- Publicado el 01/11: Builder `fd8b5b9`, conversions v174, retry v49 y Atrio `af93430` promovido. Migraciones de cola e índice aplicadas; el índice adicional corrigió timeouts de la nueva consulta detectados en tráfico real. Se recuperó un recibo aceptado del lote manteniendo su evento y payload; a las 15:30:46 UTC había 249 completados y cero pendientes/fallidos. [Publicación, alcance de garantías y reversión](validation/purchase-profile-production-20261101.md).
