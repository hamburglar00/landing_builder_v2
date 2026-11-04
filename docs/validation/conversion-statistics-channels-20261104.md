# Estadísticas separadas por canal — 04/11/2026

El selector WhatsApp/Atrio se aplica antes de reconstruir contactos y calcular cualquier sección de Estadísticas, tanto en cliente como en superadmin. El gasto publicitario se conserva por canal y moneda durante la consulta. La card de frecuencia se retiró de la UI.

## Definición de métricas

- Origen: Landing, Chatrace o WhatsApp Cloud API. Destino/canal: WhatsApp o Atrio. No reemplazar el origen de una landing por Atrio.
- WhatsApp: CTA Contact, mensaje Lead real, alta confirmada y Purchase. No inferir mensajes o altas por una compra. El resumen cuenta mensajes del período aunque el CTA sea anterior; el recorrido y sus tasas requieren hitos vinculados del período.
- Atrio: el CTA con Lead/CompleteRegistration elegido se muestra como «Solicitaron usuario» y se vincula directamente a Purchase. El nombre Meta del CTA no implica una cuenta creada. Sus series de actividad se llaman solicitudes, no mensajes.
- «Crearon usuario» cuenta el evento confirmado de API2 para WhatsApp y la confirmación interna del servidor para Atrio. La emisión WhatsApp sigue preparada únicamente en API2 local y no se publica en este lote. Las cuentas recuperadas no cuentan como altas nuevas. Ausencia de confirmaciones históricas se muestra como «Sin medición».
- Compras e ingresos se deduplican por propietario y transacción/evento. Las tasas usan recorridos, no cantidad de recargas, y no unen gerencias incompatibles por arrastre de un mismo promo. Los gráficos usan la fecha de cada hito y el query incluye eventos agregados a filas anteriores, manteniendo el corte de ocultamiento y los permisos existentes.
- Las nuevas visitas capturan su destino en una inserción. Los históricos sin canal confirmado permanecen sin clasificar y se excluyen con aviso; no se actualizan por la configuración actual de la landing. Las conversiones se clasifican por su destino capturado, asignación histórica y lineage inequívoco del mismo propietario.

## Implementación compartida

`frontend/lib/conversionJourneyStats.ts` concentra clasificación, deduplicación, fechas y embudos; `StatsPanel` recibe exclusivamente los datos del canal seleccionado y los pasa también al mapa, tablas, series e ingresos.

`registrationStats.server.ts` se ejecuta con `after` tras una respuesta confirmada `account.created=true`. Guarda propietario, landing, promo, gerencia e identificador de cuenta de Atrio, con idempotencia por cuenta. No guarda credenciales ni envía eventos a Meta. Sus errores no bloquean el ingreso. El registrador canónico se sincroniza a la clásica con `node scripts/build-classic-template7.mjs --write/--check`; cada runtime conserva su adaptador de entrada.

Rey de Ases, Ases del Norte, Ganamos NET y Multi Skin usan el mismo punto de confirmación. No cambian SDK, login, dominios, configuraciones, operaciones ni código de los cuatro gateways; el Worker de Ganamos+ conserva su entrada existente. No se modifica Atrio ni API2 en este lote.

## Migración y validación

Migración aplicada en Builder: `20261104203153_conversion_statistics_channels.sql`. Agrega el snapshot de destino, la tabla interna de altas y cuatro índices por fecha de hito. No agrega un cron ni hace backfill.

- 91 pruebas de Builder: estadísticas, origen/atribución, tabla, compatibilidad de gerencias, fechas, duplicados, aislamiento de gerencia/propietario, registro positivo/recuperación en los cuatro proveedores y preparación del acceso.
- 16 pruebas de la clásica: entrada, medición nueva/recuperada y tolerancia a fallos del registro, render y vista rápida.
- Componente y CSS reales en Chromium y WebKit a 1280, 768, 390 y 320 px: selección de canal, totales financieros distintos, alta sin medición, gasto separado y en negrita, frecuencia ausente, textos contenidos y cero errores de página. Todas las requests interceptadas; no se crean usuarios ni se envía tracking.
- Compilaciones de producción de Builder y clásica, TypeScript y ESLint de los componentes/lógica añadida. Comprobaciones canónicas de SDK e ingreso de los cuatro gateways y del renderer/registrador clásico.
- PostgreSQL: probes en tabla temporal y rollback verificaron destino de landing WhatsApp/Atrio, Cloud API y conservación del snapshot al actualizar. Ninguna visita/conversión de prueba quedó persistida.
- RLS: SELECT de propietario o administrador autenticado; sin SELECT anónimo ni INSERT autenticado, escritura sólo con service role. Asesores de seguridad sin hallazgos sobre los objetos nuevos; las categorías existentes del proyecto quedan fuera de este cambio.
- Fetch remoto previo al cierre: ambos repositorios estaban 0/0 con sus ramas remotas, sin cambios concurrentes para incorporar.

Evidencia local: `%TEMP%/conversion-statistics-channels-20261104/`, y logs `C:/Users/Leo/.codex/tmp/statistics-*-20261104.log`. Los manifiestos de despliegue registran SHA y producción anterior. Aplicar primero la migración y promover después Builder y clásica; verificar el SHA publicado y las rutas mediante lecturas, sin altas reales ni eventos publicitarios.

## Límites y reversión

No se reconstruyen visitas o altas pasadas. El registro interno posterior a la respuesta es observacional: una falla de persistencia se registra y no interrumpe la cuenta. Para WhatsApp hace falta el despliegue pendiente del programador en API2 para recibir nuevas altas.

Si se revierte el frontend, la migración puede permanecer: es aditiva y compatible con las versiones anteriores. No borrar datos ni revertir cuentas/cargas para volver al despliegue web anterior.
