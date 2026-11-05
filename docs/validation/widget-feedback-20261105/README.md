# Confirmaciones del widget y tarjetas del editor — 05/11/2026

Atrio muestra un modal adicional al chat para una carga acreditada o un premio pagado. Usa el tema del asesor (Atrio, WhatsApp o plataforma), con cierre por botón, X o Escape. Los chips miden al menos 44 px, se presentan en mayúsculas y Cargar tiene relleno destacado con texto contrastante.

Las notificaciones se originan en `operation_notice`, un marcador protegido por triggers de Atrio. Para cargas se exige el registro confirmado y su vinculación; comprobante y confirmación manual comparten ID. Para retiros manuales se exige estado completado y comprobante. Para pagos automáticos se acepta exclusivamente el evento autenticado `withdrawal_paid` que API2 emite tras confirmar el pago. `withdraw_success` sólo significa solicitud creada y queda excluido. No se modifican saldos, operaciones ni respuestas actuales.

No se agregan consultas al polling ni se reinterpretan textos del chat. El historial inicial no abre modales; cada operación se deduplica y el cierre se conserva por conversación. El widget cerrado espera a ser abierto. No se superpone a formularios o promociones ya abiertos.

Builder usa Plataforma en las etiquetas, ayudas y validaciones del editor; los textos predeterminados de promociones también adoptan ese término. El resumen de gerencias es una tarjeta independiente debajo de la vista previa, en ambos editores. Se conservan el margen inferior y el ancho nativo de Template 9.

Validación:

- TypeScript en Atrio y Builder, 22 pruebas de avisos/DB/recordatorios y 10 pruebas de Template 9.
- PostgreSQL en memoria (PGlite): inserciones y actualizaciones con triggers, impedimento de falsificar o borrar avisos, deduplicación de carga, descarte de retiro pendiente/error/cancelado y activación manual únicamente después de completar el pago.
- 24 escenarios con el widget real en un iframe, Chromium/WebKit, tres temas y cuatro gateways, desde 320×568 hasta 560×320. Datos y red ficticios; se verifican tamaños, contraste de acciones, cierre, foco, deduplicación y recarga.
- Dos escenarios adicionales verifican el polling real en segundo plano (30 s), ausencia de modal mientras el widget está cerrado y entrega ordenada de carga/premio al reabrirlo. [Mediciones](widget-edge-report.json).
- 32 escenarios de editor para cliente/admin, ambos motores, cinco tamaños y cuatro proveedores; resumen fuera de la tarjeta de vista previa y contenido accesible.

Capturas: [carga en WhatsApp](whatsapp-load.png), [premio con tema de plataforma](page-paid.png), [editor](builder-desktop.png). Mediciones: [widget](widget-report.json), [editor](editor-report.json).

Requiere la migración Atrio `20261105213020_widget_operation_success_notices.sql` antes de publicar Atrio. No hay migraciones de Builder ni funciones Edge nuevas. La implementación común de Atrio sirve a los cuatro gateways sin modificar sus fuentes ni SDK. API2 y Panel3 permanecen intactos en local.
