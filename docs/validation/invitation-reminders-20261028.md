# Recordatorios de invitaciones — 28/10/2026

## Comportamiento

«Recordármelo después» pospone instalación, notificaciones y perfil. Primer plazo: dos horas desde el envío original (desde la primera presentación de la tarjeta contextual). Los siguientes plazos se cuentan desde cada nueva postergación. Solo una interacción posterior al plazo, respondida y sin una operación pendiente, habilita la reaparición. No se generan mensajes nuevos ni eventos de tracking.

El chat compartido persiste por jugador/tipo en localStorage y reserva la presentación con Web Locks cuando está disponible. Ante storage bloqueado, conserva estado en memoria durante esa apertura. El gateway guarda un recibo mínimo de descarte hasta que Atrio confirme su recepción; permite recargar inmediatamente sin perder la espera. Un recibo repetido no vuelve a posponer ni duplica avisos. No hay sincronización entre dispositivos.

La comprobación de perfil utiliza el endpoint existente. La instalación se confirma con standalone/appinstalled y las notificaciones con permiso y suscripción activa. Los reintentos no interrumpen cargas/retiros, la captura temprana de instalación ni la carga diferida del SDK. No cambia la creación de cuentas ni API2. No requiere migraciones.

## Alcance

Atrio implementa el controlador único y los gateways intercambian capacidad, estado y confirmaciones de descarte. Rey de Ases es fuente canónica del puente; `scripts/sync-gateway-install-offer.mjs` lo sincroniza con Ases del Norte, Ganamos NET y Ganamos+. `sync-gateway-app-sdk.mjs` conserva la captura común y actualiza la versión del recurso del cliente. Builder solo contiene sincronización, pruebas y documentación.

## Validación

- Pruebas de lógica: primer plazo, nuevas postergaciones, interacción posterior, descarte tardío, persistencia y separación por cliente/tipo, respuestas antiguas, cargas y retiros pendientes.
- Navegadores: `node scripts/check-contextual-install.mjs`, componente React y JS reales, Chromium/WebKit y los cuatro gateways. HTTP simulado, reloj controlado, sin altas, mensajes, cargas, retiros o notificaciones reales.
- Arranque diferido: `scripts/check-deferred-gateway-app.mjs`.
- TypeScript, ESLint, pruebas de presentación/promociones y sincronizaciones.

## Publicación

Pendiente de completar la validación y registrar las versiones publicadas.
