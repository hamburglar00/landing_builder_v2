# Perfil e instalación después de conversar — 27/10/2026

Usuario y Clave usan dos tarjetas interiores, con borde y fondo sutiles de cada tema. La clave continúa oculta inicialmente; ojo y copia conservan su comportamiento. El perfil es compartido por los cuatro gateways.

La sugerencia «Guardá tu acceso en este teléfono» aparece dentro del chat después de un mensaje enviado por el cliente y una respuesta del asesor/API2. No cuenta la bienvenida, ausencia, CBU, mensajes de sistema, promociones ni invitaciones. No hay modal de instalación al entrar o al cerrar el chat. El botón Instalar app abre el instructivo existente, sin cambiarlo. La X y el uso de la sugerencia se recuerdan en el navegador del gateway. Una invitación explícita del asesor puede seguir mostrando el instructivo.

La sugerencia no se muestra en modo app ni cuando ese navegador ya registró instalación o descarte. No se solicitan permisos ni se registra una instalación por mostrar la tarjeta. En iOS se mantiene la detección mediante apertura standalone.

Durante envío, subida de adjuntos, formulario de retiro o estados financieros pendientes visibles se oculta la sugerencia. Esta decisión usa el historial que ya recibe el chat; no consulta operaciones ni cambia estados financieros. Si el cierre de una operación no llega al chat (por ejemplo, por preferencias de mensajes), se conserva oculta. Los metadatos de respuesta no se convierten en prueba de acreditación o pago.

## Código y alcance

- Atrio: perfil y componente compartido de sugerencia; clasificación puramente visual de la interacción.
- Cuatro gateways: disponibilidad/descarte mediante mensajes entre iframe y padre autorizados; eliminación del disparador automático; mismo SDK e instructivo. Se conserva la revalidación del service worker específica de Ganamos NET.
- Fuente compartida: `scripts/sync-gateway-install-offer.mjs`, además de las sincronizaciones existentes de SDK y movimiento.
- Builder: documentación y scripts de validación/sincronización. No cambia su aplicación pública ni el motor clásico.
- Sin cambios de API2, Panel3, esquema, migraciones, credenciales, tracking o verificaciones financieras.

## Consulta sobre la clave

`frontend/lib/reyDeAses/integrations.server.ts` recibe usuario y clave al resolver la cuenta. `preparation.server.ts` entrega al navegador usuario, continuation_token y handoff_url. El gateway consume el pase, usa la clave para autenticar y responde a la preactivación con el destino y usuario. La UI actual obtiene la clave con una consulta privada adicional. Podría aprovecharse la respuesta de autenticación para evitar ese viaje; esta entrega no modifica ese contrato.

## Verificación

- `node --experimental-strip-types --test tests/client-install-offer.test.mjs` en Atrio: seis casos con subescenarios de envío fallido, mensajes automáticos, procesamiento, cierre de carga y retiro manual/automático.
- TypeScript y ESLint de los componentes de Atrio.
- `node scripts/check-entry-presentation.mjs`: 56 escenarios Chromium/WebKit, tres temas, cuatro tamaños y cuatro gateways. Inspección de capturas del perfil.
- `node scripts/check-contextual-install.mjs`: ocho recorridos con el componente real del chat y el JS real de cada gateway en Chromium/WebKit; sin modal inicial/al cerrar, primera respuesta, proceso pendiente, instructivo intacto, descarte persistente, invitación del asesor y modo app.
- `node scripts/check-deferred-gateway-app.mjs`: 32 escenarios para inicio diferido, SDK lento, permiso explícito y evento nativo de instalación conservado.
- `node scripts/check-client-chat-hydration.mjs`: cuatro casos de hidratación/horarios.
- Sincronizaciones compartidas y `git diff --check`.

Los escenarios de navegador usan respuestas aisladas. No se crean cuentas, cargas, retiros, mensajes reales ni conversiones. No certifican una instalación física en iPhone.

## Publicación

Se completará aquí la evidencia de los despliegues activos y sus verificaciones públicas.
