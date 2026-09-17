# Endpoints y consumidores — Fase 1A

31 Edge Functions desplegadas, nueve rutas Next.js revisadas por contrato. Sólo lectura de manifiesto remoto; la lógica descrita corresponde al código local del checkpoint. No se descargó el bundle remoto para inspeccionarlo ni se afirma igualdad byte a byte entre fuente y bundle. Versiones/hashes del bundle permiten cerrar esa acreditación en preflight futuro sin invocar endpoints reales. verify_jwt=false no implica por sí solo ausencia de autenticación: muchos handlers validan proveedor, usuario o cron.

El rol HTTP identifica al emisor; el rol service_role de acceso a la DB es interno y no el permiso que necesita un navegador. Cuando no hay referencia local de un integrador externo, su identidad/capacidad de firmar sigue pendiente: no revocar basándose en silencio del repositorio.

## E01 create-client

Desplegado: versión 32, ACTIVE, verify_jwt=false; hash bundle d2d27fae1013acbf82c0a914315aafa06484b3c67fd132f01f06510823e54bf2.

Consumidores/canal: Panel administrativo vía invokeFunction. Evidencia de referencias: frontend: frontend/app/(panel)/admin/clientes/nuevo/page.tsx:77.

Auth actual según código: auth.getUser y profiles.role admin antes de auth.admin. Público por diseño: No. Mínimo propuesto: Mantener sesión y autorización admin, después de blindar profiles.role; service_role sólo backend. Riesgo al cambiar/revocar: medio: altas.

Backend: tablas directas auth_signup_approvals, profiles, conversions_config, client_subscriptions; RPC SDK ninguna literal; revisar llamadas dinámicas/helpers. Source: supabase/functions/create-client/index.ts. Una tabla usada por este backend no necesita por ello grants de browser.

## E02 update-client

Desplegado: versión 20, ACTIVE, verify_jwt=false; hash bundle 2165630cebba1665d0723da85ea4cc835dfbc50711b3998071e68b444d3932ad.

Consumidores/canal: Panel administrativo vía invokeFunction. Evidencia de referencias: frontend: frontend/app/(panel)/admin/clientes/[id]/administrar/page.tsx:202; frontend: frontend/app/(panel)/admin/clientes/[id]/administrar/page.tsx:228; frontend: frontend/app/(panel)/admin/clientes/[id]/administrar/page.tsx:265.

Auth actual según código: auth.getUser y profiles.role admin. Público por diseño: No. Mínimo propuesto: Mantener validación admin y alcance de usuario objetivo; no revocar backend. Riesgo al cambiar/revocar: medio: administración de clientes.

Backend: tablas directas profiles, conversions_config, client_subscriptions; RPC SDK ninguna literal; revisar llamadas dinámicas/helpers. Source: supabase/functions/update-client/index.ts. Una tabla usada por este backend no necesita por ello grants de browser.

## E03 delete-client

Desplegado: versión 12, ACTIVE, verify_jwt=false; hash bundle bbaca36ca26971c3844ce20c215484c8ce43939b9056e203b4cf30fa31efeeea.

Consumidores/canal: Panel administrativo vía invokeFunction. Evidencia de referencias: frontend: frontend/app/(panel)/admin/clientes/page.tsx:116.

Auth actual según código: auth.getUser y profiles.role admin. Público por diseño: No. Mínimo propuesto: Mantener guardas y operación vigente; no probar borrado remoto. Riesgo al cambiar/revocar: alto si se altera: baja de cliente.

Backend: tablas directas profiles; RPC SDK ninguna literal; revisar llamadas dinámicas/helpers. Source: supabase/functions/delete-client/index.ts. Una tabla usada por este backend no necesita por ello grants de browser.

## E04 list-clients

Desplegado: versión 21, ACTIVE, verify_jwt=false; hash bundle c1e1fa00f941bb60faf57bfec5d08b4a0372f031ab251d74a24e759b0acdf642.

Consumidores/canal: Panel administrativo vía invokeFunction. Evidencia de referencias: frontend: frontend/app/(panel)/admin/clientes/[id]/administrar/page.tsx:109; frontend: frontend/app/(panel)/admin/clientes/page.tsx:54; frontend: frontend/app/(panel)/admin/landings/page.tsx:62; frontend: frontend/components/whatsapp-cloud-api/WhatsAppCloudApiPageContent.tsx:589.

Auth actual según código: auth.getUser y profiles.role admin. Público por diseño: No. Mínimo propuesto: Mantener sesión/admin y evitar ampliar lectura de profiles a todos. Riesgo al cambiar/revocar: medio: listado administrativo.

Backend: tablas directas profiles, conversions_config, client_subscriptions; RPC SDK ninguna literal; revisar llamadas dinámicas/helpers. Source: supabase/functions/list-clients/index.ts. Una tabla usada por este backend no necesita por ello grants de browser.

## E05 builder-config

Desplegado: versión 25, ACTIVE, verify_jwt=false; hash bundle 64692d35ca6ad11a915c4ee53bcd0420cfc8cee9144cd98c3f42b6424b1929e1.

Consumidores/canal: Navegador/runtime de landing. Evidencia de referencias: frontend: frontend/app/(panel)/admin/landings/[id]/editar/page.tsx:791; frontend: frontend/app/(panel)/admin/landings/[id]/editar/page.tsx:793; frontend: frontend/components/public-landing/getLandingConfig.ts:13; frontend: frontend/components/public-landing/getLandingConfig.ts:27.

Auth actual según código: Sin sesión; service_role consulta landing/configuración y genera postUrl. Público por diseño: Sí. Mínimo propuesto: Acceso público a configuración necesaria; asegurar que la proyección no devuelve credenciales ni concede tenant arbitrario; no cambiar configuración de negocio. Riesgo al cambiar/revocar: alto: carga inicial de todas las landings.

Backend: tablas directas landings, profiles; RPC SDK ninguna literal; revisar llamadas dinámicas/helpers. Source: supabase/functions/builder-config/index.ts. Una tabla usada por este backend no necesita por ello grants de browser.

## E06 landing-phone

Desplegado: versión 21, ACTIVE, verify_jwt=false; hash bundle 91989231e45c7cd72f02560d0182d1616ff226e4dea56f3238d507158b42517d.

Consumidores/canal: Navegador/landing y cron warm. Evidencia de referencias: frontend: frontend/app/(panel)/admin/landings/[id]/editar/page.tsx:58; frontend: frontend/app/(panel)/admin/landings/[id]/editar/page.tsx:78; frontend: frontend/app/(panel)/admin/landings/[id]/editar/page.tsx:115; frontend: frontend/app/(panel)/admin/landings/[id]/editar/page.tsx:797; frontend: frontend/app/(panel)/admin/landings/[id]/editar/page.tsx:799; frontend: frontend/app/(panel)/admin/landings/[id]/editar/page.tsx:855; frontend: frontend/app/(panel)/dashboard/landing/[id]/editar/page.tsx:57; frontend: frontend/app/(panel)/dashboard/landing/[id]/editar/page.tsx:77; frontend: frontend/app/(panel)/dashboard/landing/[id]/editar/page.tsx:114; frontend: frontend/app/(panel)/dashboard/landing/[id]/editar/page.tsx:832; frontend: frontend/components/integraciones/IntegracionesMetaCapi.tsx:272; frontend: frontend/components/integraciones/IntegracionesMetaCapi.tsx:279; frontend: frontend/components/public-landing/PhonePrewarmScript.tsx:34; frontend: frontend/components/public-landing/PublicLandingRuntimeScript.tsx:606; backend: frontend/components/public-landing/getCachedLandingPhone.ts:29; frontend: frontend/components/public-landing/getLandingPhone.ts:13.

Auth actual según código: Sin auth de usuario; service_role; RPC dinámico get_phone_for_landing o get_phone_for_chatrace_client. Público por diseño: Sí. Mínimo propuesto: Mantener entrega pública conforme landing/cliente; no exigir login ni cambiar asignación/reserva. Riesgo al cambiar/revocar: alto: entrega/confirmación de teléfono.

Backend: tablas directas profiles, landings, landing_phone_cache; RPC SDK increment_phone_assignment_scope_usage, record_landing_phone_availability_demand, is_client_access_blocked. Source: supabase/functions/landing-phone/index.ts. Una tabla usada por este backend no necesita por ello grants de browser.

## E07 reset-phone-counters

Desplegado: versión 11, ACTIVE, verify_jwt=false; hash bundle f662f5134ae6deb896b333d8cb3014cb4d7c00ca3147e6edcb2fe1e04f70d99a.

Consumidores/canal: Pantalla Teléfonos. Evidencia de referencias: frontend: frontend/components/telefonos/TelefonosPageContent.tsx:402.

Auth actual según código: Sin auth; user_id recibido y service_role. Público por diseño: No. Mínimo propuesto: Sesión de usuario validada, owner/admin y tenant de gerencia; adaptar cliente que hoy envía anon. Riesgo al cambiar/revocar: alto: operación administrativa de teléfonos.

Backend: tablas directas gerencias, gerencia_phones, phone_assignment_scope_metrics; RPC SDK ninguna literal; revisar llamadas dinámicas/helpers. Source: supabase/functions/reset-phone-counters/index.ts. Una tabla usada por este backend no necesita por ello grants de browser.

## E08 sync-phones

Desplegado: versión 27, ACTIVE, verify_jwt=false; hash bundle 0da6f2c9f195091855db1c40f3e888191f5ae34d2a633deb99470773b2cf3084.

Consumidores/canal: Pantalla Teléfonos/admin tests y cron. Evidencia de referencias: frontend: frontend/components/telefonos/TelefonosPageContent.tsx:352; edge: supabase/functions/bootstrap-cron-config/index.ts:10; edge: supabase/functions/bootstrap-cron-config/index.ts:78; edge: supabase/functions/bootstrap-cron-config/index.ts:100.

Auth actual según código: Secreto válido habilita modo global; rama user_id no exige sesión. Público por diseño: No. Mínimo propuesto: JWT de usuario y owner/admin en modo manual; secreto interno en cron; actualizar headers de pantalla antes de rechazo. Riesgo al cambiar/revocar: alto: sincronización manual/cron.

Backend: tablas directas cron_config, gerencias, gerencia_phones, client_subscriptions; RPC SDK ninguna literal; revisar llamadas dinámicas/helpers. Source: supabase/functions/sync-phones/index.ts. Una tabla usada por este backend no necesita por ello grants de browser.

## E09 bootstrap-cron-config

Desplegado: versión 9, ACTIVE, verify_jwt=true; hash bundle acbb20dd89981283feecbafa88e3d6ebe57b5a9c5ff5994a0e26c68d0c27911b.

Consumidores/canal: Operador de infraestructura, fuera del runtime. Evidencia de referencias: sin referencia nominal localizada; operador/integrador externo a confirmar.

Auth actual según código: Gateway JWT más BOOTSTRAP_SECRET mínimo configurado. Público por diseño: No. Mínimo propuesto: Sólo operación de bootstrap acreditada; no asumir que verify_jwt verifica al operador por sí solo. Riesgo al cambiar/revocar: medio: configuración scheduler.

Backend: tablas directas cron_config; RPC SDK ninguna literal; revisar llamadas dinámicas/helpers. Source: supabase/functions/bootstrap-cron-config/index.ts. Una tabla usada por este backend no necesita por ello grants de browser.

## E10 phone-click

Desplegado: versión 11, ACTIVE, verify_jwt=false; hash bundle 6fdf240da779a9bd53ae1901816b6ef057eb3b0ad897c191015796439efec4ac.

Consumidores/canal: Runtime de landing. Evidencia de referencias: frontend: frontend/components/public-landing/PublicLandingRuntimeScript.tsx:885.

Auth actual según código: Sin sesión; service_role incrementa/extiende reserva. Público por diseño: Sí. Mínimo propuesto: Autorizar sólo el alcance de la asignación legítima; preservar contrato de confirmación. Decidir prueba de posesión sin añadir campos de evento. Riesgo al cambiar/revocar: alto: contadores/reservas.

Backend: tablas directas landings, gerencia_phones, landings_gerencias; RPC SDK extend_landing_phone_assignment_reservation, increment_phone_assignment_scope_usage. Source: supabase/functions/phone-click/index.ts. Una tabla usada por este backend no necesita por ello grants de browser.

## E11 conversions

Desplegado: versión 158, ACTIVE, verify_jwt=false; hash bundle 388bae74bcad8987e6b059bbcd919626a3f2b86136a8fcefaafd3703bf2f61fd.

Consumidores/canal: Landings/proxy Next, integradores externos, retry-failed-conversions, whatsapp-cloud-redirect. Evidencia de referencias: frontend: frontend/app/(panel)/admin/conversiones/page.tsx:27; frontend: frontend/app/(panel)/admin/conversiones/page.tsx:270; frontend: frontend/app/(panel)/admin/conversiones/page.tsx:404; frontend: frontend/app/(panel)/admin/conversiones/page.tsx:805; frontend: frontend/app/(panel)/admin/conversiones/page.tsx:806; frontend: frontend/app/(panel)/admin/conversiones/page.tsx:1505; frontend: frontend/app/(panel)/admin/conversiones/page.tsx:1535; frontend: frontend/app/(panel)/admin/inicio/page.tsx:5; frontend: frontend/app/(panel)/admin/inicio/page.tsx:10; frontend: frontend/app/(panel)/admin/inicio/page.tsx:58; frontend: frontend/app/(panel)/admin/landings/[id]/editar/page.tsx:57; frontend: frontend/app/(panel)/admin/landings/[id]/editar/page.tsx:74; frontend: frontend/app/(panel)/admin/landings/[id]/editar/page.tsx:133; frontend: frontend/app/(panel)/admin/landings/[id]/editar/page.tsx:241; frontend: frontend/app/(panel)/admin/landings/[id]/editar/page.tsx:306; frontend: frontend/app/(panel)/admin/landings/[id]/editar/page.tsx:359; frontend: frontend/app/(panel)/admin/landings/[id]/editar/page.tsx:361; frontend: frontend/app/(panel)/admin/landings/[id]/editar/page.tsx:371; frontend: frontend/app/(panel)/admin/landings/[id]/editar/page.tsx:405; frontend: frontend/app/(panel)/admin/landings/[id]/editar/page.tsx:491; frontend: frontend/app/(panel)/admin/seguimiento/page.tsx:15; frontend: frontend/app/(panel)/admin/seguimiento/page.tsx:38; frontend: frontend/app/(panel)/admin/seguimiento/page.tsx:56; frontend: frontend/app/(panel)/admin/seguimiento/page.tsx:61; frontend: frontend/app/(panel)/admin/seguimiento/page.tsx:182; frontend: frontend/app/(panel)/dashboard/conversiones/page.tsx:25; frontend: frontend/app/(panel)/dashboard/conversiones/page.tsx:415; frontend: frontend/app/(panel)/dashboard/conversiones/page.tsx:579; frontend: frontend/app/(panel)/dashboard/conversiones/page.tsx:580; frontend: frontend/app/(panel)/dashboard/conversiones/page.tsx:951; frontend: frontend/app/(panel)/dashboard/conversiones/page.tsx:952; frontend: frontend/app/(panel)/dashboard/conversiones/page.tsx:1163; frontend: frontend/app/(panel)/dashboard/conversiones/page.tsx:1164; frontend: frontend/app/(panel)/dashboard/conversiones/page.tsx:1889; frontend: frontend/app/(panel)/dashboard/conversiones/page.tsx:1919; frontend: frontend/app/(panel)/dashboard/inicio/page.tsx:6; frontend: frontend/app/(panel)/dashboard/inicio/page.tsx:7; frontend: frontend/app/(panel)/dashboard/landing/[id]/editar/page.tsx:56; frontend: frontend/app/(panel)/dashboard/landing/[id]/editar/page.tsx:73; frontend: frontend/app/(panel)/dashboard/landing/[id]/editar/page.tsx:132; frontend: frontend/app/(panel)/dashboard/landing/[id]/editar/page.tsx:226; frontend: frontend/app/(panel)/dashboard/landing/[id]/editar/page.tsx:290; frontend: frontend/app/(panel)/dashboard/landing/[id]/editar/page.tsx:343; frontend: frontend/app/(panel)/dashboard/landing/[id]/editar/page.tsx:345; frontend: frontend/app/(panel)/dashboard/landing/[id]/editar/page.tsx:355; frontend: frontend/app/(panel)/dashboard/landing/[id]/editar/page.tsx:389; frontend: frontend/app/(panel)/dashboard/landing/[id]/editar/page.tsx:475; frontend: frontend/app/(panel)/dashboard/layout.tsx:396; frontend: frontend/app/(panel)/dashboard/layout.tsx:397; frontend: frontend/app/(panel)/dashboard/layout.tsx:401; frontend: frontend/app/(panel)/dashboard/layout.tsx:473; frontend: frontend/app/(panel)/dashboard/notificaciones/page.tsx:43; frontend: frontend/app/(panel)/dashboard/notificaciones/page.tsx:44; frontend: frontend/app/(panel)/dashboard/notificaciones/page.tsx:48; frontend: frontend/app/(panel)/dashboard/promociones/page.tsx:102; frontend: frontend/app/(panel)/dashboard/promociones/page.tsx:103; frontend: frontend/app/(panel)/dashboard/promociones/page.tsx:108; frontend: frontend/app/(panel)/dashboard/seguimiento/page.tsx:15; frontend: frontend/app/(panel)/dashboard/seguimiento/page.tsx:39; frontend: frontend/app/(panel)/dashboard/seguimiento/page.tsx:57; frontend: frontend/app/(panel)/dashboard/seguimiento/page.tsx:62; frontend: frontend/app/(panel)/dashboard/seguimiento/page.tsx:135; frontend: frontend/app/(panel)/dashboard/seguimiento/page.tsx:152; frontend: frontend/app/(panel)/dashboard/seguimiento/page.tsx:263; frontend: frontend/components/conversiones/ArgentinaMap.tsx:5; frontend: frontend/components/conversiones/ArgentinaMap.tsx:199; frontend: frontend/components/conversiones/ArgentinaMap.tsx:206; frontend: frontend/components/conversiones/ArgentinaMap.tsx:212; frontend: frontend/components/conversiones/ArgentinaMap.tsx:214; frontend: frontend/components/conversiones/ArgentinaMap.tsx:318; frontend: frontend/components/conversiones/ArgentinaMap.tsx:324; frontend: frontend/components/conversiones/ArgentinaMap.tsx:343; frontend: frontend/components/conversiones/ArgentinaMap.tsx:344; frontend: frontend/components/conversiones/ArgentinaMap.tsx:349; frontend: frontend/components/conversiones/ArgentinaMap.tsx:374; frontend: frontend/components/conversiones/ClearConversionsViewModal.tsx:51; frontend: frontend/components/conversiones/ClearConversionsViewModal.tsx:60; frontend: frontend/components/conversiones/ConversionConfigurationPanel.tsx:41; frontend: frontend/components/conversiones/ConversionTablePdfExportButton.tsx:4; frontend: frontend/components/conversiones/DateRangeFilter.tsx:187; frontend: frontend/components/conversiones/EditableConversionEmailCell.tsx:7; frontend: frontend/components/conversiones/FunnelBoard.tsx:9; frontend: frontend/components/conversiones/GerenciasPerformancePanel.tsx:11; frontend: frontend/components/conversiones/GerenciasPerformancePanel.tsx:362; frontend: frontend/components/conversiones/HomeOverview.tsx:3; frontend: frontend/components/conversiones/StatsPanel.tsx:8; frontend: frontend/components/conversiones/StatsPanel.tsx:435; frontend: frontend/components/conversiones/StatsPanel.tsx:446; frontend: frontend/components/conversiones/StatsPanel.tsx:488; frontend: frontend/components/conversiones/StatsPanel.tsx:494; frontend: frontend/components/conversiones/StatsPanel.tsx:531; frontend: frontend/components/conversiones/StatsPanel.tsx:559; frontend: frontend/components/conversiones/StatsPanel.tsx:564; frontend: frontend/components/conversiones/StatsPanel.tsx:575; frontend: frontend/components/conversiones/StatsPanel.tsx:580; frontend: frontend/components/conversiones/StatsPanel.tsx:590; frontend: frontend/components/conversiones/StatsPanel.tsx:595; frontend: frontend/components/conversiones/StatsPanel.tsx:615; frontend: frontend/components/conversiones/StatsPanel.tsx:635; frontend: frontend/components/conversiones/StatsPanel.tsx:656; frontend: frontend/components/conversiones/StatsPanel.tsx:765; frontend: frontend/components/conversiones/StatsPanel.tsx:907; frontend: frontend/components/conversiones/StatsPanel.tsx:925; frontend: frontend/components/conversiones/StatsPanel.tsx:935; frontend: frontend/components/conversiones/StatsPanel.tsx:956; frontend: frontend/components/conversiones/StatsPanel.tsx:977; frontend: frontend/components/conversiones/StatsPanel.tsx:995; frontend: frontend/components/conversiones/StatsPanel.tsx:1003; frontend: frontend/components/conversiones/StatsPanel.tsx:1021; frontend: frontend/components/conversiones/StatsPanel.tsx:1051; frontend: frontend/components/conversiones/StatsPanel.tsx:1075; frontend: frontend/components/conversiones/StatsPanel.tsx:1715; frontend: frontend/components/conversiones/TrackingBoard.tsx:8; frontend: frontend/components/conversiones/TrackingBoard.tsx:84; frontend: frontend/components/conversiones/TrackingBoard.tsx:94; frontend: frontend/components/conversiones/TrackingBoard.tsx:185; frontend: frontend/components/conversiones/TrackingBoard.tsx:223; frontend: frontend/components/conversiones/TrackingBoard.tsx:362; frontend: frontend/components/conversiones/exportConversionTablePdf.ts:1; frontend: frontend/components/integraciones/IntegracionesMetaCapi.tsx:13; frontend: frontend/components/integraciones/IntegracionesMetaCapi.tsx:258; frontend: frontend/components/integraciones/IntegracionesMetaCapi.tsx:1387; frontend: frontend/components/telefonos/TelefonosPageContent.tsx:195; frontend: frontend/components/telefonos/TelefonosPageContent.tsx:467; frontend: frontend/components/whatsapp-cloud-api/WhatsAppCloudApiPageContent.tsx:513; frontend: frontend/lib/conversionPageConfig.ts:7; frontend: frontend/lib/conversionPageDataSource.ts:20; frontend: frontend/lib/conversionStats.ts:1; frontend: frontend/lib/conversionStats.ts:2; frontend: frontend/lib/conversionStats.ts:244; frontend: frontend/lib/conversionStats.ts:260; frontend: frontend/lib/conversionStats.ts:291; frontend: frontend/lib/conversionStats.ts:309; frontend: frontend/lib/conversionStats.ts:314; frontend: frontend/lib/conversionStats.ts:335; frontend: frontend/lib/conversionStats.ts:458; frontend: frontend/lib/conversionStats.ts:463; frontend: frontend/lib/conversionStats.ts:533; frontend: frontend/lib/conversionStats.ts:538; frontend: frontend/lib/conversionStats.ts:543; frontend: frontend/lib/conversionStats.ts:577; frontend: frontend/lib/conversionStats.ts:578; frontend: frontend/lib/conversionStats.ts:591; frontend: frontend/lib/conversionStats.ts:596; frontend: frontend/lib/conversionStats.ts:601; frontend: frontend/lib/conversionsDb.ts:620; frontend: frontend/lib/conversionsDb.ts:676; frontend: frontend/lib/conversionsDb.ts:726; frontend: frontend/lib/conversionsDb.ts:808; frontend: frontend/lib/conversionsDb.ts:819; frontend: frontend/lib/conversionsDb.ts:830; frontend: frontend/lib/conversionsDb.ts:895; frontend: frontend/lib/conversionsDb.ts:925; frontend: frontend/lib/conversionsDb.ts:1017; frontend: frontend/lib/conversionsDb.ts:1025; frontend: frontend/lib/conversionsDb.ts:1032; frontend: frontend/lib/conversionsDb.ts:1049; frontend: frontend/lib/conversionsDb.ts:1261; frontend: frontend/lib/conversionsDb.ts:1263; frontend: frontend/lib/conversionsDb.ts:1268; frontend: frontend/lib/conversionsDb.ts:1270; frontend: frontend/lib/conversionsDb.ts:1273; frontend: frontend/lib/conversionsDb.ts:1284; frontend: frontend/lib/conversionsDb.ts:1286; frontend: frontend/lib/conversionsDb.ts:1289; frontend: frontend/lib/conversionsDb.ts:1731; frontend: frontend/lib/conversionsDb.ts:1737; frontend: frontend/lib/conversionsDb.ts:1759; frontend: frontend/lib/conversionsDb.ts:1797; frontend: frontend/lib/currency.ts:1; frontend: frontend/lib/demoData.ts:1; frontend: frontend/lib/demoData.ts:137; frontend: frontend/lib/demoData.ts:139; frontend: frontend/lib/landing/landingsDb.ts:183; frontend: frontend/lib/landing/landingsDb.ts:189; frontend: frontend/lib/whatsappCloudApiDb.ts:666; frontend: frontend/lib/whatsappCloudApiDb.ts:678; frontend: frontend/lib/whatsappCloudApiDb.ts:684; edge: supabase/functions/builder-config/index.ts:229; edge: supabase/functions/builder-config/index.ts:239; edge: supabase/functions/create-client/index.ts:374; edge: supabase/functions/create-client/index.ts:392; edge: supabase/functions/create-client/index.ts:425; edge: supabase/functions/list-clients/index.ts:180; edge: supabase/functions/notify-inactive-contacts/index.ts:171; edge: supabase/functions/notify-inactive-contacts/index.ts:214; edge: supabase/functions/promotion-draw-due/index.ts:135; edge: supabase/functions/promotion-draw/index.ts:113; edge: supabase/functions/promotion-match-backfill/index.ts:84; edge: supabase/functions/promotion-match-backfill/index.ts:85; edge: supabase/functions/promotion-match-backfill/index.ts:91; edge: supabase/functions/promotion-match-backfill/index.ts:102; edge: supabase/functions/promotion-match-backfill/index.ts:181; edge: supabase/functions/promotion-participate/index.ts:70; edge: supabase/functions/promotion-participate/index.ts:85; edge: supabase/functions/promotion-participate/index.ts:168; edge: supabase/functions/promotion-participate/index.ts:169; edge: supabase/functions/promotion-participate/index.ts:201; edge: supabase/functions/promotion-participate/index.ts:202; edge: supabase/functions/reset-phone-messages/index.ts:11; edge: supabase/functions/retry-failed-conversions/index.ts:21; edge: supabase/functions/retry-failed-conversions/index.ts:24; edge: supabase/functions/retry-failed-conversions/index.ts:59; edge: supabase/functions/retry-failed-conversions/index.ts:112; edge: supabase/functions/retry-failed-conversions/index.ts:131; edge: supabase/functions/retry-failed-conversions/index.ts:156; edge: supabase/functions/retry-failed-conversions/index.ts:168; edge: supabase/functions/retry-failed-conversions/index.ts:192; edge: supabase/functions/retry-failed-conversions/index.ts:198; edge: supabase/functions/retry-failed-conversions/index.ts:284; edge: supabase/functions/retry-failed-conversions/index.ts:311; edge: supabase/functions/retry-failed-conversions/index.ts:387; edge: supabase/functions/retry-failed-conversions/index.ts:402; edge: supabase/functions/retry-failed-conversions/index.ts:444; edge: supabase/functions/retry-failed-conversions/index.ts:474; edge: supabase/functions/retry-failed-conversions/index.ts:520; edge: supabase/functions/retry-failed-conversions/index.ts:562; edge: supabase/functions/retry-failed-conversions/index.ts:598; edge: supabase/functions/retry-failed-conversions/index.ts:636; edge: supabase/functions/retry-failed-conversions/index.ts:691; edge: supabase/functions/retry-failed-conversions/index.ts:717; edge: supabase/functions/retry-failed-conversions/index.ts:862; edge: supabase/functions/retry-failed-conversions/index.ts:884; edge: supabase/functions/retry-failed-conversions/index.ts:906; edge: supabase/functions/retry-failed-conversions/index.ts:989; edge: supabase/functions/retry-failed-conversions/index.ts:1073; edge: supabase/functions/retry-failed-conversions/index.ts:1100; edge: supabase/functions/retry-failed-conversions/index.ts:1129; edge: supabase/functions/retry-failed-conversions/index.ts:1176; edge: supabase/functions/retry-failed-conversions/index.ts:1179; edge: supabase/functions/retry-failed-conversions/index.ts:1189; edge: supabase/functions/retry-failed-conversions/index.ts:1297; edge: supabase/functions/retry-failed-conversions/index.ts:1327; edge: supabase/functions/retry-failed-conversions/index.ts:1341; edge: supabase/functions/retry-failed-conversions/index.ts:1349; edge: supabase/functions/retry-failed-conversions/index.ts:1394; edge: supabase/functions/retry-failed-conversions/index.ts:1547; edge: supabase/functions/retry-failed-conversions/index.ts:1633; edge: supabase/functions/retry-failed-conversions/index.ts:1735; edge: supabase/functions/retry-failed-conversions/index.ts:1818; edge: supabase/functions/retry-failed-conversions/index.ts:1853; edge: supabase/functions/retry-failed-conversions/index.ts:2013; edge: supabase/functions/retry-failed-conversions/index.ts:2023; edge: supabase/functions/update-client/index.ts:266; edge: supabase/functions/update-client/index.ts:271; edge: supabase/functions/whatsapp-cloud-redirect/index.ts:177; edge: supabase/functions/whatsapp-cloud-redirect/index.ts:200; edge: supabase/functions/whatsapp-cloud-redirect/index.ts:208.

Auth actual según código: Sin auth en handler; name decide tenant, service_role interno. Replays internos no distinguen emisor. Público por diseño: Mixto; visitantes públicos por contrato pendiente de censo; servidores privados. Mínimo propuesto: Credencial de transporte por emisor/tenant antes de efectos; mantener canal público explícito con alcance aprobado. No exigir JWT de usuario global. Riesgo al cambiar/revocar: alto: ingestión Contact/Lead/Purchase y replays.

Backend: tablas directas gerencia_phones, gerencias, landings_gerencias, whatsapp_cloud_api_assignments, conversions, whatsapp_cloud_api_configs, whatsapp_cloud_api_contacts, whatsapp_cloud_api_attribution_sessions, ar_name_inferred_sex, conversion_inbox, conversion_logs, ar_phone_area_codes, landings, chatrace_client_configs, settings, profiles, conversions_config, conversions_pixel_configs; RPC SDK claim_purchase_event, complete_purchase_event_claim. Source: supabase/functions/conversions/index.ts. Una tabla usada por este backend no necesita por ello grants de browser.

## E12 retry-failed-conversions

Desplegado: versión 44, ACTIVE, verify_jwt=false; hash bundle bb3dd97624f873543773a656686dc77419db5bd553f8da0707811a4bf538607b.

Consumidores/canal: pg_cron cron_retry_failed_conversions; operación interna. Evidencia de referencias: sin referencia nominal localizada; operador/integrador externo a confirmar.

Auth actual según código: CRON_SECRET o secreto cron_config; crea cliente service_role. Público por diseño: No. Mínimo propuesto: Conservar secreto interno; añadir auth de transporte en sus llamadas a conversions sin alterar reintentos. Riesgo al cambiar/revocar: alto: retries y diferidos.

Backend: tablas directas cron_config, conversions, conversions_config, conversions_pixel_configs, chatrace_client_configs, whatsapp_cloud_api_configs, conversion_inbox, profiles, conversion_log_lead_backfill_replays, conversion_logs; RPC SDK ninguna literal; revisar llamadas dinámicas/helpers. Source: supabase/functions/retry-failed-conversions/index.ts. Una tabla usada por este backend no necesita por ello grants de browser.

## E13 conversions-test

Desplegado: versión 11, ACTIVE, verify_jwt=false; hash bundle c6c1593d65ce821d69e58396f99764db6ff0303bc5a3331d6530db1e9b098aef.

Consumidores/canal: Panel de integración autenticado. Evidencia de referencias: sin referencia nominal localizada; operador/integrador externo a confirmar.

Auth actual según código: getUser(token); configuración/filas del usuario autenticado; env SUPABASE_SERVICE_ROLE_KEY. Público por diseño: No. Mínimo propuesto: Preservar sesión y tenant propio; ejecutar test sólo contra Meta simulado, nunca llamar endpoint productivo para esta revisión. Riesgo al cambiar/revocar: medio: pruebas del panel.

Backend: tablas directas ver helpers/importaciones; RPC SDK ninguna literal; revisar llamadas dinámicas/helpers. Source: supabase/functions/conversions-test/index.ts. Una tabla usada por este backend no necesita por ello grants de browser.

## E14 notify-inactive-contacts

Desplegado: versión 19, ACTIVE, verify_jwt=false; hash bundle 52199f1cd7c7b5ad3c066691aae37f757033c3d16f747ba030e9ebb3da27fc10.

Consumidores/canal: Cron postgres. Evidencia de referencias: sin referencia nominal localizada; operador/integrador externo a confirmar.

Auth actual según código: Secreto cron o bootstrap; service_role. Público por diseño: No. Mínimo propuesto: Mantener autorización de servicio y cron vigente; no tocar selección ni envío. Riesgo al cambiar/revocar: alto: notificaciones.

Backend: tablas directas cron_config, notification_bot_config, notification_settings, notification_telegram_destinations, conversions, notification_contact_alerts, conversions_config; RPC SDK ninguna literal; revisar llamadas dinámicas/helpers. Source: supabase/functions/notify-inactive-contacts/index.ts. Una tabla usada por este backend no necesita por ello grants de browser.

## E15 configure-telegram-webhook

Desplegado: versión 5, ACTIVE, verify_jwt=true; hash bundle 5a3de6d6d80844a31cb9ce5c8a2e68564777b4e83725908e18e82a65385a3e40.

Consumidores/canal: Operador de infraestructura. Evidencia de referencias: sin referencia nominal localizada; operador/integrador externo a confirmar.

Auth actual según código: Gateway JWT más BOOTSTRAP_SECRET; secretos sólo servidor. Público por diseño: No. Mínimo propuesto: Mantener secreto de administración; no invocar setWebhook/getWebhookInfo en esta revisión. Riesgo al cambiar/revocar: alto: configuración Telegram.

Backend: tablas directas notification_bot_config; RPC SDK ninguna literal; revisar llamadas dinámicas/helpers. Source: supabase/functions/configure-telegram-webhook/index.ts. Una tabla usada por este backend no necesita por ello grants de browser.

## E16 telegram-webhook

Desplegado: versión 8, ACTIVE, verify_jwt=false; hash bundle 4ae5c74ca8a4a0ecd69ec5bd1c3099ba2e1e22b4704f8ba87e68ad88fa4ef8a4.

Consumidores/canal: Telegram; conexiones/reconexiones. Evidencia de referencias: edge: supabase/functions/configure-telegram-webhook/index.ts:39.

Auth actual según código: Header secreto cotejado pero tolerado en mensajes con texto. Público por diseño: Público en red, debe autenticar al proveedor. Mínimo propuesto: Rechazo de firma/secreto incorrecto sólo después de acreditar y ensayar emisor/reconexión. Riesgo al cambiar/revocar: alto: notificaciones/conexiones.

Backend: tablas directas notification_telegram_destinations, notification_settings, profiles, notification_bot_config; RPC SDK ninguna literal; revisar llamadas dinámicas/helpers. Source: supabase/functions/telegram-webhook/index.ts. Una tabla usada por este backend no necesita por ello grants de browser.

## E17 promotion-draw

Desplegado: versión 10, ACTIVE, verify_jwt=false; hash bundle 200a173d9e38b93a0a241d55674447612b3ea7a1755e986caa5e3c894ed1367f.

Consumidores/canal: Página pública para sorteo vencido; owner/admin para forzar antes. Evidencia de referencias: frontend: frontend/app/(panel)/dashboard/promociones/page.tsx:668; frontend: frontend/app/(panel)/promo/[slug]/page.tsx:224; frontend: frontend/app/(panel)/promo/[slug]/page.tsx:261; frontend: frontend/app/(panel)/promo/[slug]/page.tsx:609; frontend: frontend/app/(panel)/promo/[slug]/page.tsx:645; frontend: frontend/app/(panel)/promo/[slug]/page.tsx:664; frontend: frontend/app/(panel)/promo/[slug]/page.tsx:728; edge: supabase/functions/promotion-draw-due/index.ts:336.

Auth actual según código: Cuando draw_at es futuro y force, getUser + owner/admin; después del plazo la rama es pública. Público por diseño: Mixto por contrato vigente. Mínimo propuesto: Preservar exactamente la distinción actual; no exigir login global ni mover momento del sorteo. Riesgo al cambiar/revocar: alto: sorteo público/forzado.

Backend: tablas directas promotion_participants, conversions, promotions, profiles, notification_bot_config, notification_settings, notification_telegram_destinations; RPC SDK ninguna literal; revisar llamadas dinámicas/helpers. Source: supabase/functions/promotion-draw/index.ts. Una tabla usada por este backend no necesita por ello grants de browser.

## E18 promotion-participate

Desplegado: versión 7, ACTIVE, verify_jwt=false; hash bundle bc68f4d8833f0cbfcd12306b3becd2b071b9ee9f131828f93eda9e7d13268cd8.

Consumidores/canal: Página pública de promoción. Evidencia de referencias: frontend: frontend/app/(panel)/promo/[slug]/page.tsx:310.

Auth actual según código: Sin sesión; visitor_token y datos de participación; service_role. Público por diseño: Sí. Mínimo propuesto: Mantener participación pública; visitor_token no equivale a usuario admin. Riesgo al cambiar/revocar: alto: participación legítima.

Backend: tablas directas conversions, promotions, promotion_participants; RPC SDK ninguna literal; revisar llamadas dinámicas/helpers. Source: supabase/functions/promotion-participate/index.ts. Una tabla usada por este backend no necesita por ello grants de browser.

## E19 promotion-draw-due

Desplegado: versión 7, ACTIVE, verify_jwt=false; hash bundle ae1c7df93ee9f91b2150db7509ae3446787519ae64085d14247d885fb9decc63.

Consumidores/canal: Cron postgres. Evidencia de referencias: sin referencia nominal localizada; operador/integrador externo a confirmar.

Auth actual según código: cron_secret o bootstrap_secret. Público por diseño: No. Mínimo propuesto: Conservar autenticación interna y horario. Riesgo al cambiar/revocar: alto: sorteo programado.

Backend: tablas directas promotion_participants, conversions, notification_settings, notification_telegram_destinations, promotions, cron_config, notification_bot_config; RPC SDK ninguna literal; revisar llamadas dinámicas/helpers. Source: supabase/functions/promotion-draw-due/index.ts. Una tabla usada por este backend no necesita por ello grants de browser.

## E20 reset-phone-messages

Desplegado: versión 4, ACTIVE, verify_jwt=true; hash bundle 5bd0116acbaf580a4cf29e2fa7d6f9fb00840876c6fe7725347e955443891089.

Consumidores/canal: Pantalla Teléfonos. Evidencia de referencias: frontend: frontend/components/telefonos/TelefonosPageContent.tsx:433.

Auth actual según código: Gateway JWT; handler no valida identidad/propiedad; pantalla envía anon. Público por diseño: No. Mínimo propuesto: Mismo control de owner/admin, sin cambiar reset ni sus datos. Riesgo al cambiar/revocar: alto: reset operativo.

Backend: tablas directas gerencias, gerencia_phones, phone_metrics; RPC SDK ninguna literal; revisar llamadas dinámicas/helpers. Source: supabase/functions/reset-phone-messages/index.ts. Una tabla usada por este backend no necesita por ello grants de browser.

## E21 promotion-match-backfill

Desplegado: versión 3, ACTIVE, verify_jwt=false; hash bundle 99f3a11ef231e811494754fea27fca2c5bc31eef9fe0b053db87efd060785b53.

Consumidores/canal: Cron postgres/operador. Evidencia de referencias: sin referencia nominal localizada; operador/integrador externo a confirmar.

Auth actual según código: cron_secret o bootstrap_secret. Público por diseño: No. Mínimo propuesto: Sólo servicio; no modificar backfill. Riesgo al cambiar/revocar: medio: asociación de participantes.

Backend: tablas directas cron_config, promotion_participants, conversions; RPC SDK ninguna literal; revisar llamadas dinámicas/helpers. Source: supabase/functions/promotion-match-backfill/index.ts. Una tabla usada por este backend no necesita por ello grants de browser.

## E22 sync-telegram-connections

Desplegado: versión 2, ACTIVE, verify_jwt=true; hash bundle no informado.

Consumidores/canal: Scheduler histórico/operador; no job actual identificado. Evidencia de referencias: sin referencia nominal localizada; operador/integrador externo a confirmar.

Auth actual según código: Gateway JWT; cron_secret o bootstrap_secret en handler. Público por diseño: No. Mínimo propuesto: Mantener sólo principal interno; no desplegar para “activar” un cron ausente. Riesgo al cambiar/revocar: medio: sincronización de conexiones.

Backend: tablas directas notification_telegram_destinations, cron_config, notification_bot_config, notification_settings; RPC SDK ninguna literal; revisar llamadas dinámicas/helpers. Source: supabase/functions/sync-telegram-connections/index.ts. Una tabla usada por este backend no necesita por ello grants de browser.

## E23 whatsapp-cloud-webhook

Desplegado: versión 10, ACTIVE, verify_jwt=false; hash bundle 9e0ac4c60af5eaf565678124e564a6ba7c3a515eb6d3fcc0636a66673aa65098.

Consumidores/canal: Meta webhook. Evidencia de referencias: frontend: frontend/components/whatsapp-cloud-api/WhatsAppCloudApiPageContent.tsx:496.

Auth actual según código: GET verify_token; POST firma x-hub-signature-256 y app_secret, rechazo ante falta/config no reconocida. Público por diseño: Público en red, autenticado por proveedor. Mínimo propuesto: Conservar firma y tenant/config vinculados; verify_jwt=false es compatible con webhook firmado. Riesgo al cambiar/revocar: alto: recepción de mensajes.

Backend: tablas directas whatsapp_cloud_api_configs, whatsapp_cloud_api_webhook_request_logs, whatsapp_cloud_api_webhook_events; RPC SDK ninguna literal; revisar llamadas dinámicas/helpers. Source: supabase/functions/whatsapp-cloud-webhook/index.ts. Una tabla usada por este backend no necesita por ello grants de browser.

## E24 whatsapp-cloud-worker

Desplegado: versión 12, ACTIVE, verify_jwt=false; hash bundle 4a697ad168614bb931edcd52e53c4cb53e32713c89a47f6f43bb9b24c6918e9d.

Consumidores/canal: Cron postgres/webhook backend. Evidencia de referencias: edge: supabase/functions/whatsapp-cloud-webhook/index.ts:304.

Auth actual según código: Bearer service_role exacto o cron_secret. Público por diseño: No. Mínimo propuesto: Mantener autenticación interna; migración a credencial acotada sólo como lote posterior con ambos emisores adaptados. Riesgo al cambiar/revocar: alto: cola WhatsApp.

Backend: tablas directas cron_config, whatsapp_cloud_api_webhook_events, whatsapp_cloud_api_configs, whatsapp_cloud_api_outbound_messages, whatsapp_cloud_api_assignments, whatsapp_cloud_api_contacts, whatsapp_cloud_api_attribution_sessions, whatsapp_cloud_api_redirects; RPC SDK record_conversion_journey_start, get_phone_for_whatsapp_cloud_api, increment_phone_assignment_scope_usage. Source: supabase/functions/whatsapp-cloud-worker/index.ts. Una tabla usada por este backend no necesita por ello grants de browser.

## E25 whatsapp-cloud-send-message

Desplegado: versión 1, ACTIVE, verify_jwt=true; hash bundle ef1990ae2fa0ae2dc420a0decadff9aa7b5b5cf2b0645df42031743623d5eff5.

Consumidores/canal: Panel WhatsApp autenticado. Evidencia de referencias: frontend: frontend/components/whatsapp-cloud-api/WhatsAppCloudApiInboxPageContent.tsx:1039.

Auth actual según código: getUser y verificación de propietario/admin del contacto. Público por diseño: No. Mínimo propuesto: Mantener control y service_role interno; ninguna alteración de mensajes. Riesgo al cambiar/revocar: alto: envío manual.

Backend: tablas directas profiles, whatsapp_cloud_api_webhook_events, whatsapp_cloud_api_contacts, whatsapp_cloud_api_configs, whatsapp_cloud_api_outbound_messages; RPC SDK ninguna literal; revisar llamadas dinámicas/helpers. Source: supabase/functions/whatsapp-cloud-send-message/index.ts. Una tabla usada por este backend no necesita por ello grants de browser.

## E26 whatsapp-cloud-sync-health

Desplegado: versión 6, ACTIVE, verify_jwt=false; hash bundle 08681c438bdf31ae2a2c9d1cd03e1828bf4aea94f29c79537c05fd34f360c005.

Consumidores/canal: Panel autenticado y cron postgres. Evidencia de referencias: frontend: frontend/lib/whatsappCloudApiDb.ts:253.

Auth actual según código: Bearer service_role o cron_secret; alternativa getUser + propietario/admin. Público por diseño: No. Mínimo propuesto: Conservar modos separados y alcance tenant. Riesgo al cambiar/revocar: medio: salud/configuración.

Backend: tablas directas notification_bot_config, notification_settings, notification_telegram_destinations, profiles, cron_config, whatsapp_cloud_api_configs; RPC SDK ninguna literal; revisar llamadas dinámicas/helpers. Source: supabase/functions/whatsapp-cloud-sync-health/index.ts. Una tabla usada por este backend no necesita por ello grants de browser.

## E27 whatsapp-cloud-ensure-dataset

Desplegado: versión 4, ACTIVE, verify_jwt=true; hash bundle bf5211e15201b8f0e18591e11db29ec884ab4595d660fd87c410eb49355b2d30.

Consumidores/canal: Panel de integración autenticado. Evidencia de referencias: frontend: frontend/lib/whatsappCloudApiDb.ts:223.

Auth actual según código: getUser y targetUserId propio/admin. Público por diseño: No. Mínimo propuesto: Conservar guardas y backend de credenciales. Riesgo al cambiar/revocar: medio: configuración Meta.

Backend: tablas directas profiles, whatsapp_cloud_api_configs; RPC SDK ninguna literal; revisar llamadas dinámicas/helpers. Source: supabase/functions/whatsapp-cloud-ensure-dataset/index.ts. Una tabla usada por este backend no necesita por ello grants de browser.

## E28 whatsapp-cloud-redirect

Desplegado: versión 5, ACTIVE, verify_jwt=false; hash bundle 7c13171b1e89d3739e74dd45b87e7c625a4dbdaaad77dd4899da764fdc290e86.

Consumidores/canal: Visitante público desde /w/[token]. Evidencia de referencias: frontend: frontend/app/(public)/w/[token]/route.ts:32.

Auth actual según código: Token de redirect; service_role interno; llama conversions con Bearer service_role actualmente. Público por diseño: Sí, mediante token público de navegación. Mínimo propuesto: Mantener contrato de redirect y salida; dar principal interno al salto a conversions, sin cambiar evento ni instante. Riesgo al cambiar/revocar: alto: atribución/redirección/contacto.

Backend: tablas directas profiles, conversions, whatsapp_cloud_api_assignments; RPC SDK record_whatsapp_cloud_api_redirect_click. Source: supabase/functions/whatsapp-cloud-redirect/index.ts. Una tabla usada por este backend no necesita por ello grants de browser.

## E29 atrio-click

Desplegado: versión 1, ACTIVE, verify_jwt=true; hash bundle 7f35cdc4009a42e59c45a7a152fd134a23e14f94de4d2b3252bd615cac1f8b79.

Consumidores/canal: Runtime público. Evidencia de referencias: frontend: frontend/components/public-landing/PublicLandingRuntimeScript.tsx:915.

Auth actual según código: Gateway verify_jwt=true; service_role; sin autenticación de usuario. Público por diseño: Sí. Mínimo propuesto: Confirmación pública acotada a asignación legítima; mantener auth de proyecto mientras haya compatibilidad. Riesgo al cambiar/revocar: alto: uso/asignación Atrio.

Backend: tablas directas landings, landings_atrio_clients; RPC SDK increment_atrio_assignment_scope_usage. Source: supabase/functions/atrio-click/index.ts. Una tabla usada por este backend no necesita por ello grants de browser.

## E30 landing-atrio

Desplegado: versión 1, ACTIVE, verify_jwt=true; hash bundle 89b2b6eab46e2375f4f078bb886508b50996acf32350b0bc9eb8b0459dca0496.

Consumidores/canal: Runtime público. Evidencia de referencias: frontend: frontend/app/(panel)/admin/landings/[id]/editar/page.tsx:803; frontend: frontend/app/(panel)/admin/landings/[id]/editar/page.tsx:805; frontend: frontend/components/public-landing/PublicLandingRuntimeScript.tsx:637.

Auth actual según código: Gateway verify_jwt=true; handler usa service_role sin getUser. Runtime usa clave pública. Público por diseño: Sí. Mínimo propuesto: No interpretar anon JWT como usuario; mantener acceso público explícito de landing, sin alterar selección. Riesgo al cambiar/revocar: alto: redirección Atrio.

Backend: tablas directas landings; RPC SDK is_client_access_blocked, get_atrio_for_landing. Source: supabase/functions/landing-atrio/index.ts. Una tabla usada por este backend no necesita por ello grants de browser.

## E31 whatsapp-cloud-retarget

Desplegado: versión 7, ACTIVE, verify_jwt=false; hash bundle 5c16d92a1f37b9364771f6f5449c7beb315eee97fdf69cd867d0e424bcaf19b9.

Consumidores/canal: Cron postgres. Evidencia de referencias: sin referencia nominal localizada; operador/integrador externo a confirmar.

Auth actual según código: Bearer service_role exacto o cron_secret. Público por diseño: No. Mínimo propuesto: Conservar autorización de servicio, tiempos y cola; ninguna corrección de concurrencia aquí. Riesgo al cambiar/revocar: alto: mensajes retarget.

Backend: tablas directas cron_config, whatsapp_cloud_api_retarget_messages, whatsapp_cloud_api_outbound_messages; RPC SDK claim_whatsapp_cloud_api_retarget_candidates. Source: supabase/functions/whatsapp-cloud-retarget/index.ts. Una tabla usada por este backend no necesita por ello grants de browser.

## Rutas Next.js

| Ruta | Consumidor y autenticación actual | Mínimo propuesto y qué se rompe | Impacto |
| --- | --- | --- | --- |
| POST /api/track | Runtime público fetch/sendBeacon; sólo allowlist de host upstream; cola/backend service_role con fallback anon. | Entrada pública legítima con alcance de landing acreditado; sólo backend firma salto a conversions; no firmar destino arbitrario. Mantener payload/reintentos. | Alto: Contact y transporte de eventos. |
| GET/POST /api/track/retry | Cron/operador; TRACK_RETRY_SECRET o CRON_SECRET o secreto en cron_config; headers/Bearer/body admitidos. | Servicio interno; agregar credencial al upstream antes de enforcement en conversions. | Alto: recuperación de cola. |
| POST /api/journey-start | Runtime público sin sesión; resuelve landing y usa RPC interno con service_role. | Conservar público y acceso backend; autorización de alcance sin cambiar construcción de identidades. | Alto: funnel/inicio de journey. |
| POST/OPTIONS /api/revalidate | Cliente de publicación/operador con secreto; backend compara env o RPC verify_revalidate_secret usando anon. | No quitar anon al RPC hasta migrar el backend; proteger lectura de settings.revalidate_secret. | Alto: publicación/cache de landing. |
| GET/POST /api/stats-assistant | Usuario con Bearer validado vía Auth; cuota con el mismo JWT. | authenticated para cuota y datos propios; secreto del proveedor exclusivamente servidor. | Medio: asistente, sin cambiar cuota ni estadísticas. |
| POST /api/integrations/kommo/sync | Bearer Auth válido, nombre comprobado contra perfil propio; secreto de administración al upstream sólo servidor. | Mantener vínculo con usuario; no introducir service_role en frontend ni devolver secretos. | Medio: integración Kommo. |
| GET /l/[slug] | Visitante público; runtime constructor/legacy. | Conservar acceso público y proyecciones de configuración; censo de clientes legacy antes de retirar RPC públicas. | Alto: landing. |
| GET /w/[token] | Visitante público con token de redirección. | Conservar contrato público y ruta a Edge redirect. Token de navegación no es clave DB. | Alto: click/atribución. |
| GET /promo/[slug]/share-image | Compartición pública de promoción. | Conservar lectura de promoción autorizada; no requerir sesión de panel. | Medio: previsualización pública. |

## Transporte, credenciales y casos que bloquean un corte inmediato

- Teléfonos: TelefonosPageContent.tsx:352/402/433 usa apiKey pública en Authorization, no session.access_token. La UI logueada no convierte ese request en authenticated. Cambiar únicamente el header y verificar dueño antes del corte, manteniendo body/acciones.
- Reintentos diferidos: retry-failed-conversions/index.ts:993/:1077/:1331 usa sólo Content-Type hacia conversions. No exigirle auth antes de adaptar transporte.
- Redirect: whatsapp-cloud-redirect/index.ts:176 ya envía Bearer service_role hacia conversions; hoy el receptor lo ignora. Es principal interno existente, no autenticación del visitante.
- SSR: getCachedLandingPhone usa anon; /api/revalidate también usa anon para su RPC. Ubicación en servidor no significa credencial service_role.
- Auth de operador: bootstrap/configure no necesitan ser públicos; respetar secreto actual y probar gateway sin invocar servicios externos.
- Público legítimo: promotion-draw vencida, promotion-participate, builder-config, landing-phone, phone-click y los redirects no deben cerrarse por una regla global de login.
- Migrar JWT anon a publishable exige revisar las llamadas que lo colocan como Bearer y verify_jwt=true; no es un reemplazo textual de la variable.
- Las URLs publicadas para integradores prueban disponibilidad del contrato, no el censo real de emisores. No se accedió a configuración de clientes ni cuerpos productivos para inferirlo.
