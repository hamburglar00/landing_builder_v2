# Consistencia de cuenta en el ingreso — 29/10/2026

## Alcance y estado

Corrección local para Template7 del constructor y del clásico, y los gateways de Rey de Ases, Ases del Norte, Ganamos NET y Multi Skin/Ganamos+. No se publicaron commits ni despliegues en esta intervención. Se preservaron los cambios locales anteriores, incluido el lote de Multi Skin y el ajuste del movimiento del widget. No se modificaron API2, Panel3, migraciones ni datos productivos para esta corrección.

El incidente informado coincide con la bienvenida de `benja684826` del 29/10 a las 19:31 de Argentina, asociada al registro anterior de Benja. Los registros disponibles no prueban qué cuenta mostró la pantalla anterior ni que se haya creado una cuenta Belu/Belen. Esta entrega cierra caminos comprobados en el código que permitían mezclar la cuenta mostrada con una sesión anterior; no atribuye al incidente una causa histórica aún no demostrada.

## Cambios

- `entry-identity.ts`, canónico en Rey y sincronizado en los otros tres gateways: capacidades AES-GCM separadas por finalidad y origen, cinco minutos de vigencia, hash del pase y de la continuación, y confirmación ligada al hash de la cookie emitida después del login. No exponer IDs del dispositivo ni credenciales en estas capacidades.
- `/api/preparations/complete`: devuelve el usuario y la prueba de la cuenta/pase elegidos; registra `account_ready`.
- `/start`: valida la prueba antes del login y comprueba que su respuesta corresponda al usuario esperado. Si hay una diferencia, descarta sus cookies en la respuesta al navegador. Un pase inválido/vencido/consumido devuelve fallo aunque exista otra sesión. Para Rey, un ingreso con pase tampoco intenta renovar previamente una sesión anterior ajena.
- La autorización estándar `Gateway-Entry` permite conservar la prueba cuando el Worker elimina headers propios. Plus sigue usando la negociación JSON por `Accept`; recibe confirmación y recuperación también sin `X-Gateway-Preactivate`.
- `preparation-page.ts`: exige usuario coincidente, confirmación y correlación de ingreso. La comprobación de la cookie se hace al continuar o terminar la espera configurada. Una renovación automática máxima conserva la cuenta y no repite `/complete`. Los callbacks de generaciones anteriores no pueden continuar el recorrido actual; reintentar no puede sustituir una cuenta ya mostrada por otra.
- `/api/preparations/finalize` y Builder: la continuación cifrada permite renovar únicamente el pase de la cuenta ya resuelta. Verifica de nuevo el vínculo, vuelve a emitir el handoff y devuelve el mismo username; no llama a resolución/alta de jugadores. La respuesta en caché del pase anterior se omite solo con `renew_handoff: true`.
- `session-recovery.ts`: una confirmación debe coincidir con la cookie o reparar únicamente la sesión exacta acreditada por el recibo cifrado. Una reparación responde `entry_confirmed: false`; una segunda solicitud sin respaldo tiene que leer la cookie guardada antes de continuar. Si el navegador rechazó guardarla, no ingresar con su cookie anterior. Un fallo de resolución o revocación no habilita caer en otro respaldo. Las recuperaciones generales sin confirmación conservan su comportamiento anterior. La recuperación posterior a una confirmación fallida también tiene un límite de 15 segundos y descarta respuestas tardías.
- Runtime de Template7 y renderer generado del clásico: preservar los datos originales del regreso conocido y descartar navegación/errores tardíos de una recuperación automática o formulario anterior.
- `gateway.entry`: correlación de `account_ready`, `login_requested`, `authenticated`, `renew`/`finalized`, `cookie_repaired` y `confirmed`; motivos como `invalid_entry_binding`, `account_mismatch`, `handoff_expired_or_consumed`, `session_mismatch` o `session_unavailable`. Registrar únicamente campos permitidos; no volcar requests, respuestas, tokens o contraseñas.

## Verificación

Todos los proveedores se simularon. No se crearon cuentas, enviaron comprobantes ni realizaron movimientos reales.

| Proyecto | Verificación |
| --- | --- |
| Rey | TypeScript y suite completa: 292 pruebas aprobadas; dos pruebas de DB requieren entorno específico y se omiten. |
| Ases del Norte | TypeScript y suite completa: 237 pruebas aprobadas. |
| Ganamos NET | TypeScript y suite completa: 241 pruebas aprobadas. |
| Multi Skin/Plus | TypeScript y suite completa: 249 pruebas aprobadas. |
| Constructor | TypeScript y 85 pruebas relacionadas con preparación, recuperación, identidad, runtime, permisos y Template8. |
| Clásico | TypeScript, 34 pruebas completas y renderer generado sincronizado. |
| Navegadores | `node scripts/check-entry-identity.mjs`: 80 casos, cuatro gateways en Chromium y WebKit; normales, pase vencido, cuenta distinta recuperable/no recuperable, sesión ajena activa, cambio de cookie durante la espera, cookie reparada/guardado rechazado y pases clásicos. |
| Gateway → Atrio | `node scripts/check-gateway-entry-contract.mjs`: 16 verificaciones del contexto firmado para los cuatro proveedores, incluida la acción de billetera y el rechazo de adulteraciones. |

Además se verifican directamente en servidor: prueba adulterada, otro origen/finalidad, sustitución del pase o continuación, cookie distinta, sesión revocada con un respaldo ajeno válido, y rechazo de pase vencido/vacío con una sesión anterior activa. Las pruebas de confirmación son compartidas y se verifican con `node scripts/sync-entry-identity.mjs --check`; la página se verifica con `node scripts/sync-preparation-page.mjs --check` y el clásico con `node scripts/build-classic-template7.mjs`.

La validación de navegador usa renderers reales y respuestas controladas. La autenticación real de los proveedores y el Worker desplegado no se acreditan con estas pruebas locales. El resultado detallado del navegador queda como artefacto local ignorado en `.vercel/validation-entry-identity/results.json`.

## Límites y entrega

- No prometer renovación indefinida ni reconocimiento físico del teléfono. La continuación debe seguir siendo válida. Un ticket clásico antiguo sin continuación y ya vencido se rechaza; no se redirige al inicio para adoptar una cuenta anterior. Reabrir la landing permite recuperar el vínculo por el circuito existente.
- Esta corrección no cambia el motor financiero, el número de intentos de alta de API2 ni las cuentas ya vinculadas. La recuperación temprana del navegador usa la identidad y las rutas autorizadas existentes.
- Al publicar, entregar primero el soporte de renovación de Builder y el renderer del clásico, y después los cuatro gateways con su página, confirmación, endpoints y módulos compartidos. Actualizar también el Worker de Plus; Vercel solo no acredita la versión pública.
- Este cambio no necesita nuevas migraciones ni un cambio nuevo de API2. Sin embargo, las ramas locales incluyen el lote previo de Multi Skin, que sí mantiene sus propias dependencias de API2 y migraciones. No publicar esas dependencias como si formaran parte de esta corrección ni afirmar que ya están desplegadas.
- Después de publicar, comprobar con cuentas de prueba autorizadas el reingreso de un navegador conocido y la coincidencia entre pantalla, plataforma, perfil y bienvenida en los cuatro destinos. Conservar el diagnóstico histórico como hipótesis hasta contar con evidencia del usuario mostrado originalmente.
