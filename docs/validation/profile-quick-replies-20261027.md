# Perfil y variables de respuestas — 27/10/2026

Implementación común en Atrio: teléfono vacío con placeholder «Tu teléfono», inputs móviles de 16 px, scroll del campo enfocado dentro del modal cuando se reduce el viewport, y borde/icono blancos en los controles del header WhatsApp. Los cuatro gateways consumen el mismo chat.

Las respuestas usan `{{nombre}}`, `{{usuario}}`, `{{clave}}`, tolerando espacios y mayúsculas. Nombre corresponde al cliente. La expansión es literal, no recursiva, sin HTML. El mensaje enviado se guarda en el historial como los demás mensajes; no se añade otra tabla/caché de contraseñas.

Normal: ruta privada autenticada, lectura de conversación con RLS y envío por el RPC existente que vuelve a comprobar autorización. Bienvenida: wrapper privado con fase de preparación solo si una conversación nueva necesita clave, luego bootstrap atómico existente y contexto de contraseña limitado a esa transacción y cuenta. Ausencia: misma resolución privada; el fallback SQL cubre los canales sin gateway. Sin credenciales verificadas se escribe «Disponible en Mi perfil».

API2 tiene un nuevo GET `/api/v1/bot/atrio/advisors/:advisor/players/:external/credentials`, protegido por las claves de integración y con manager/agencia obligatorios. Comprueba asesor, agencia operativa, bot activo y propietario del jugador antes de leer Credential. No provisiona, cambia claves, concilia ni llama a proveedores. Respuesta privada sin caché. Atrio comprueba también usuario, manager, agencia y jugador de la respuesta. API2 permanece local: hasta que el programador lo despliegue, esas cuentas usan el fallback para `{{clave}}`. Rey sin conexión PBAdmin conserva su lectura privada existente; Ganamos+ sin integración tiene el mismo fallback.

Validación ejecutada:

- Atrio y API2: TypeScript sin errores; ESLint dirigido en Atrio.
- 15 pruebas Atrio: expansión literal, datos ausentes, identidad de respuesta, error/timeout, bootstrap, CBU inicial y contrato de credenciales.
- 5 pruebas API2 aisladas, con red bloqueada: lectura exacta, bot inactivo, jugador ajeno/ausente, credenciales incompletas y manager de otro asesor.
- `scripts/phase0/quick-reply-variables-database.mjs`: Postgres desechable, red interna y sin puertos. RPCs privados, scope asesor/jugador/cuenta, preparación sin insertar bienvenida, dos bootstraps concurrentes con un único mensaje, no reutilización de contexto de contraseña, preservación de texto del cliente.
- 56 escenarios Chromium/WebKit de presentación (3 temas, 4 viewports, 4 plataformas) y 8 escenarios del chat real con los scripts de los cuatro gateways; incluyen teléfono y contraste. Solo fixtures: no se crearon cuentas ni operaciones reales. WebKit de escritorio no certifica el teclado nativo de un iPhone físico.

Investigación de Benja (solo lectura): `/diana`, 27/10/2026 14:35 Argentina. El primer `/api/template7/start` devolvió 503 a las 14:35:03; Atrio resolvió la identidad correctamente. API2 reservó `benja6168` para manager 1044/agencia 280 y persistió `uncertain` a las 14:35:07. No quedó una cuenta confirmada en Atrio. Esto no demuestra que el proveedor no haya creado el usuario: falta confirmar el resultado. Un segundo `/start` a las 14:35:43 devolvió 429, dentro del límite de un intento cada 45 segundos. El aviso del formulario es el fallback genérico de error con ese cooldown; no es un rechazo del nombre. No se modificó ni reintentó la provisión. Los logs disponibles no acreditan una causa más específica del proveedor.

Publicación: aplicar migración Atrio `20261027181043_quick_reply_variables.sql` antes de promover el frontend. No requiere migración API2. Rollback: volver al deployment previo de Atrio; los RPCs viejos siguen disponibles. Puede desactivarse únicamente el trigger nuevo si fuera necesario. No borrar historial de mensajes.

Publicado y verificado: Atrio commit `4b637c8`, deployment `dpl_A7TWUQ55W2KUBeqqD3XPySzUA2iP`, promovido a producción. Anterior: `dpl_Bj7MzDaWTkzTcnvxRjGjeN6EV8HB` (`6a3c0de`). Migración aplicada y permisos comprobados: ambos RPCs nuevos inaccesibles a anon/authenticated y disponibles a service_role. La revisión de seguridad de Supabase no agregó avisos respecto del baseline.

La [verificación pública](profile-quick-replies-public-20261027.json) confirmó el bundle nuevo de Atrio, rechazo 401/sin caché de la ruta privada sin sesión y los scripts de los cuatro gateways sin cambios inesperados. No hubo escrituras de negocio en estas comprobaciones. API2 sigue local, sin commit/push/deploy; instrucciones en `api2/docs/ATRIO_QUICK_REPLY_CREDENTIALS_20261027.md`.
