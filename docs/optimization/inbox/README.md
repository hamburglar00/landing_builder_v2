# Inbox de WhatsApp Cloud API

Base: main, ad436ff1ee3a329c1d6c702d0ce2cbfd05f92981. Implementación exclusivamente local; el estado de validación y checkpoint está en [validación](validation.md) e [inventario](inventory.json). Fase 1B.5 sigue diferida. No se modifican autenticación de conversions, webhooks, envíos, asignaciones ni repositorios externos.

## Causa acreditada

Dashboard y admin comparten WhatsAppCloudApiInboxPageContent.tsx. El helper de whatsappCloudApiDb.ts llama directamente a Data API; no hay una ruta Next ni una Edge Function para estas lecturas.

El lector anterior es POST /rest/v1/rpc/get_whatsapp_cloud_api_inbox_threads_page, variante de siete parámetros: límite 20, offset, moneda, etiqueta, no leídos y extremos de fecha. El cuerpo desplegado coincide con la migración histórica 20260825192821_whatsapp_cloud_api_inbox_date_filter.sql, MD5 793e4ed5e583d31ce9c63857d83649d9. “Hoy” procede del día local del navegador y se convierte a ISO/UTC. Chromium comprobó ARS, Todos, sin búsqueda, offset cero y esos extremos.

Se reprodujo 57014 dentro de ese RPC con su límite de ocho segundos, en producción mediante una transacción exclusivamente de lectura y en PostgreSQL sintético. La reproducción remota usó el último día con actividad; la fecha exacta de la captura original no quedó establecida. Solo se conservaron metadatos, planes y agregados, sin registros personales, escrituras productivas ni EXPLAIN ANALYZE remoto. Ver [reproducción](remote-reproduction.json).

Hay dos problemas SQL y una carga adicional del navegador:

1. Las igualdades por external_id y promo_code no expresaban los predicados no vacíos requeridos por índices parciales existentes. El plan podía recorrer conversions completamente dos veces. Los predicados añadidos son redundantes respecto de las igualdades con identificadores no vacíos.
2. Con fechas, el plan repetía cálculos laterales de no leídos y umbrales. El fixture registró 72.361 recorridos de mensajes para 269 contactos elegibles. Materializar esos CTE evita repeticiones sin cambiar sus expresiones ni resultados.
3. Cada una de las 20 conversaciones enviaba hasta 50 mensajes: 1.000 objetos descargados y normalizados aun sin selección.

El costo EXPLAIN de 55.713 frente a 2.452 fue una hipótesis inicial, no una medición temporal. Ahora existen tiempos ejecutados, buffers, equivalencia y reproducciones del timeout. [Mediciones](measurements.json), [SQL sintético](sql-measurements.json) y [diagnóstico previo](synthetic-diagnostic.json) distinguen esas evidencias. Este último conserva el fallo del RPC histórico; no es una validación de la implementación nueva.

## Arquitectura y contratos

El SQL enlaza contactos/configuraciones, última asignación/gerencia, redirects, conversiones, umbrales, lecturas por usuario y atribución. Moneda y fecha acotan contactos; etiquetas y no leídos se calculan antes del límite. Conteos, estados e importes continúan calculándose en PostgreSQL.

La migración 274 optimiza el RPC existente y agrega dos entradas para authenticated:

- get_whatsapp_cloud_api_inbox_summaries: máximo 20 resúmenes sin arrays de mensajes. Obtiene una vista previa por dirección y devuelve su fecha e identificador para que un estado Realtime antiguo no sustituya la vista previa actual.
- get_whatsapp_cloud_api_inbox_messages: vuelve a autorizar el contacto y devuelve hasta 50 mensajes. El cursor exclusivo combina timestamp con precisión PostgreSQL, dirección y UUID. Solo se consulta al seleccionar una conversación o solicitar una página anterior.

Las entradas públicas nuevas son SECURITY INVOKER. Los helpers privilegiados viven en el esquema no expuesto inbox_private, con search_path fijo, sin EXECUTE de PUBLIC/anon y con comprobación explícita de auth.uid() y profiles.role. Conservan autorización owner/admin; no usan user_metadata. No se crean índices, tablas, políticas ni permisos de escritura. Las 273 migraciones anteriores están intactas.

Se conservan los dos órdenes históricos: selección de página por actividad del contacto y orden de presentación de esa página por último mensaje. Se añaden desempates por ID. Conversaciones conserva páginas de 20 con offset; mensajes usa cursor. Búsqueda, gerencia y ocultos mantienen su alcance sobre los 20 resúmenes actuales. Convertirlos en filtros globales habría cambiado el contrato.

La lista no normaliza historiales. El detalle llega ordenado de SQL. Realtime mantiene la página y el detalle seleccionado; otros chats retienen como máximo una vista previa. Se conservan conciliación de envíos optimistas, actualizaciones recibidas durante una lectura y ventana de atención del detalle inicial más eventos nuevos. Cargar mensajes antiguos no abre la ventana; muchos outbound no borran el último inbound de la selección. Refrescar vuelve a obtener los últimos 50 mensajes.

Las respuestas obsoletas se descartan al cambiar selección/filtros. Cambiar etiqueta reinicia la página en la misma acción. Las dos recargas existentes tras un webhook no coincidente se conservan porque cubren su procesamiento posterior.

## Tráfico y límites

Chromium usa el componente real y HTTP loopback con respuestas sintéticas acreditadas por SQL. No es una captura productiva ni mide PostgreSQL dentro del navegador. Data API se valida aparte con PostgREST real, JWT efímeros y red Docker aislada. Ver [navegador](browser.json).

El componente hace getUser y un RPC al abrir, antes y después. El layout añade usuario, perfil, suscripción y menú: seis llamadas explícitas en el recorrido estático, sin contar widgets, navegación, renovación y Realtime. No se presenta ese número como un total productivo observado.

Seleccionar agrega un RPC de detalle y puede marcar como leído. Antes solo marcaba, porque el historial estaba precargado. CPU, memoria y primera vista son muestras locales instrumentadas; no se extrapolan como SLA ni se confunden con tiempo SQL.

Aplicar primero la migración y luego el lector. El frontend anterior conserva firma y respuesta completas. Ver [rollback](rollback.md). Despliegue y verificación del tráfico productivo quedan pendientes de una autorización separada.

Fuentes consultadas: [changelog Supabase](https://supabase.com/changelog?types=breaking-change), [optimización](https://supabase.com/docs/guides/database/query-optimization), [RLS](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) y [EXPLAIN PostgreSQL 17](https://www.postgresql.org/docs/17/sql-explain.html). Se distinguen planes genéricos, costos y tiempos ejecutados.
