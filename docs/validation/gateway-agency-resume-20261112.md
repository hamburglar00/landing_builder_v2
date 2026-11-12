# Recuperación de sesión en el enlace por gerencia

Pedido de Leo del 12/11: implementar el reconocimiento previo de sesión y después comitear/pushear. No incluye operaciones reales, cambios de API2/Panel3 ni despliegues manuales.

## Por qué elegimos este flujo

La diferencia está en si el enlace identifica una gerencia. El objetivo es facilitar el regreso de un jugador y el alta de uno nuevo, conservando la posibilidad de reutilizar una cuenta del casino original.

| Enlace | Qué sabemos | Comportamiento |
| --- | --- | --- |
| Genérico, por ejemplo `reydeases.fun` | El casino, pero el enlace no identifica una gerencia ni un asesor para crear una cuenta nueva. | Puede recuperar una sesión válida o permitir el ingreso de una cuenta ya vinculada. Para un alta o una primera vinculación, orientar al enlace de la gerencia/asesor; no elegir un destino por defecto. |
| Por gerencia, por ejemplo `reydeases.fun/306` | El ID permite validar la gerencia, su casino y su conexión con el bot/asesor correspondiente. | Intentar recuperar la sesión compatible; si no se recupera, ofrecer nombre y «Crear usuario», junto con «Ya tengo usuario. Ingresar». |

La recuperación evita volver a pedir credenciales a quien ya tiene una sesión válida para ese destino. El alta por nombre resulta posible porque la gerencia ya está definida. Abrir el enlace sólo ofrece o recupera el acceso: la cuenta nueva se crea únicamente después de que la persona envía el nombre y presiona «Crear usuario».

**No reconocer una sesión no significa que la persona no tenga cuenta.** Puede estar usando otro navegador, Incógnito o haber perdido sus cookies. Por eso se mantiene visible «Ya tengo usuario» y se explica que debe usarlo quien ya tenga cuenta, evitando un alta innecesaria.

### Para qué se conserva «Ya tengo usuario»

También cubre al jugador que tiene usuario en la página original del casino, dentro de esa gerencia, y todavía no lo había vinculado al gateway. No exige una vinculación previa con el gateway cuando entra desde el enlace por gerencia.

1. La persona ingresa el usuario y la contraseña de su cuenta de casino.
2. Se validan las credenciales y la pertenencia a la gerencia del enlace. Que el usuario exista en el casino, por sí solo, no alcanza.
3. Con el circuito habilitado y sin conflictos, se reutiliza esa cuenta y se completa la vinculación interna necesaria con el gateway y su chat. También se reutilizan los vínculos internos que ya existan.
4. Se establece la sesión para ingresar con esa cuenta y facilitar sus próximas visitas.

Este recorrido no crea otro usuario en el casino ni reinicia su saldo u operaciones. Puede completar registros internos faltantes para representar la cuenta y su vínculo. Una cuenta de otra gerencia o ya vinculada de forma incompatible se rechaza; no se mueve automáticamente a otro asesor/bot.

El ingreso con credenciales, por lo tanto, cumple dos funciones: **incorporar una cuenta de casino todavía no vinculada** y **recuperar el acceso de una cuenta ya vinculada cuya sesión no se pudo reconocer**. La decisión cambia cuál pantalla se ofrece primero en el enlace por gerencia; conserva ambas posibilidades.

Fuentes verificadas: login genérico de los gateways (`gateway-login.ts`), ingreso por gerencia de Atrio (`gateway-agency.server.ts`) y validación/importación existente de API2 (`gateway_agency.service.ts`). La explicación documenta el comportamiento y su motivo; no cambia esas implementaciones.

## Resultado

`/<agency_id>` valida primero el circuito existente e intenta recuperar la cuenta autenticada del navegador. Si coincide con gerencia, proveedor, asesor, backend y skin, confirma la cookie exacta y abre su casino/chat. La sesión PBAdmin no identifica a un jugador.

Sin sesión recuperable, presenta el nombre y «Crear usuario», junto con «Ya tengo usuario. Ingresar». Crear exige enviar el formulario y conserva la provisión idempotente. El ingreso manual conserva la validación de credenciales, pertenencia e historial anterior. Una falla de recuperación ofrece información y reintento; no confirma una cuenta ni crea otra por sí sola.

La cookie válida tiene prioridad sobre una identidad antigua de localStorage. Si falta o expiró, se puede recuperar únicamente el token cifrado de ese origen y validar su sesión real. Rey conserva almacenamiento del servidor y claves anteriores; los demás conservan cookies cifradas. Ganamos NET conserva también su cookie de navegador y Multi Skin el aislamiento por host/skin.

Atrio/NexoBet agregan una consulta privada que valida conexión, perfil, cuenta exacta y `entry-status` existente de API2. No invoca registro ni vinculación durante la recuperación. Nexo mantiene transporte, activación y datos propios. El comprobante de confirmación se liga al token validado para impedir confundir cuentas entre pestañas.

El Worker exige `utf8` explícito en dos llamadas de cifrado compartidas. Se conserva AES-GCM, contexto, claves, IV, contenido y formato anteriores. Las pantallas horizontales conservan su distribución en dos columnas aun con el contenedor de recuperación.

## Fuentes y entrega Git

| Producto | Rama | Commits del lote, en orden |
| --- | --- | --- |
| Atrio | `fix/landing-performance-20261109` | `5ae6c659e705` + `3b75b56bac2e` |
| Rey de Ases | `fix/landing-performance-20261109` | `404e6b8c6335` + `991925f0703a` |
| Ases del Norte | `fix/landing-performance-20261109` | `d716b48f4d83` + `342535f52bc2` |
| Ganamos NET | `fix/landing-performance-20261109` | `c98d539625d0` + `2d6170b76264` |
| Ganamos+/Multi Skin | `main` | `ea8b22c49692` + `2e1619fc73c2` |
| NexoBet | `main` | `dd223cb7a1b4` |
| Builder | `main` | Este informe, decisiones, sincronizador y pruebas; sin cambios de aplicación |

Los tres primeros gateways incorporaron mediante fast-forward los commits de diagnósticos ya presentes en `origin/main`, sin cambiar de rama ni sobrescribir trabajo local. Del documento de decisiones de Builder sólo se entrega la sección nueva de este lote; sus modificaciones de otras tareas se conservan. Los cambios concurrentes de confirmación en los webhooks de Telegram de Atrio/NexoBet quedan fuera de estos commits.

En los gateways, el primer commit contiene el comportamiento y el segundo completa el estilo de reintento. Para integrar sólo este lote hacen falta ambos; el segundo por sí solo no incorpora la recuperación.

## Verificación

- Suites completas de gateways: Rey 566 aprobadas y 11 omitidas por fixtures de DB no configurados; Ases 491, Ganamos NET 497 y Multi Skin 533 aprobadas. Después del ajuste final, 92 comprobaciones de ingreso/identidad/recuperación por gateway aprobadas y TypeScript de los cuatro aprobado.
- Atrio: 84 escenarios de gerencia/recuperación y TypeScript aprobados. NexoBet: 85 escenarios, incluyendo su adaptación propia, aprobados; `npm run test:regression` completó las 37 etapas sin fallas, incluyendo PostgreSQL descartable, navegadores y build de producción con servicios simulados. La etapa final aprobó 84 comprobaciones de páginas Next y dos comprobaciones de producción aislada.
- `check-gateway-agency-browser.mjs`: 112 escenarios aislados, cuatro proveedores, Chromium/WebKit y móvil/escritorio. Incluye recuperación, ausencia de sesión, cuenta diferente, error de red, confirmación de cookie fallida e ingreso/registro explícitos. Capturas inspeccionadas en móvil/escritorio.
- `check-gateway-auth-fit.mjs`: 560 comprobaciones aprobadas, dos motores, cuatro proveedores y diez tamaños de 320×480 a 1920×1080, incluidos horizontales; sin desbordes.
- Worker: pruebas de propiedad de backend y preparación aprobadas; nueva prueba real en Miniflare de cifrado, comprobantes, prioridad de cookie y aislamiento por origen aprobada (`npm run test:agency-session:worker`).
- `sync-gateway-login.mjs --check`, `sync-entry-identity.mjs --check` y `sync-gateway-app-sdk.mjs --check` aprobados. SDK/widget sin cambios; Nexo conserva las 304 fuentes verificadas del módulo 1.9.1. `git diff --check` aprobado.
- Las verificaciones no crearon cuentas/jugadores ni enviaron eventos o pagos reales. La base productiva no se usó como fixture. No hay migraciones nuevas.

## Publicación posterior

Commit/push no certifica producción. Integrar los commits de este lote sobre la versión productiva vigente de cada producto, conservando los cambios publicados en paralelo (incluidas las respuestas por titular de Atrio); las ramas de trabajo contienen antecedentes que no equivalen a esa versión. Publicar primero Atrio y NexoBet con la acción `resume`; después Rey, Ases, Ganamos NET y Multi Skin en Vercel, además del Worker público de Ganamos+. Revisar cada dominio/skin y conservar su configuración actual. Los cambios de API2/Panel3 y slots quedan fuera del lote.

Si un gateway nuevo encuentra un backend anterior, la recuperación falla de forma visible y conserva el ingreso/registro explícitos. No interpreta una respuesta vieja como sesión válida.

La comprobación con una sesión real requiere que su titular vuelva a abrir el enlace en el mismo navegador. Una ventana Incógnito nueva no comparte la sesión normal. No usar altas reales para probar ausencia de sesión: basta comprobar que se muestra el formulario sin enviarlo. Para revertir, volver a las versiones anteriores de los gateways y luego de los backends; no hay datos ni esquema que revertir.
