# URL de origen de Purchase

Estado: implementación y revisión independiente completadas; publicación pendiente. La corrección vive en las funciones Edge centrales `conversions` y `retry-failed-conversions`.

## Problema confirmado

En la consulta de producción del 31/10, hasta las 16:27 ART, Builder había enviado 51 compras aceptadas por el píxel compartido: 34 de `goldencjs`, 17 de otras landings y ninguna de Diana. Los 51 payloads salientes llevaban `event_source_url=https://landing.panelbotadmin.com/`.

Los payloads entrantes de esas compras no traían landing ni URL. Builder calculaba el fallback antes de resolver el contacto: con nombre vacío, `settings.url_base` producía la raíz. Ese string no vacío prevalecía luego sobre la URL conocida de la conversión o lineage. El mismo problema alcanzaba las cuatro escrituras de Purchase. El retry de CAPI utilizaba la columna persistida sin recuperar el contexto original.

La URL incorrecta está comprobada en nuestros registros; no demuestra qué eventos atribuyó Ads Manager a la campaña de Diana. El usuario indicó que ese Facebook no está conectado a OpenAI. La corrección del servidor no requiere esa conexión y no modifica campañas.

## Contrato

La precedencia acordada es: URL explícita HTTP(S) válida; URL específica del contexto matched; URL original recuperable de su Contact; y, sólo como último fallback con landing confiable, base pública configurada más nombre validado. No inventar una landing ni recuperar una URL de otro usuario. Conservar rutas reales, prefijos y el contrato actual que excluye queries en la captura. Un override no autoriza reconstruir un camino distinto del capturado.

Los payloads Contact truncados o inválidos no se interpretan mediante regex. Las lecturas adicionales se limitan a referencias de lineage persistidas, filtradas por el usuario ya autorizado. Se preservan las excepciones y el routing de Business Messaging.

La corrección se limita a la URL del evento; conserva identidad, píxel, FBC, monto, fecha, clasificación y deduplicación. No requiere esquema nuevo ni publicación de Atrio, los cuatro gateways, su Worker, la clásica o API2. No se ejecutan operaciones, conversiones de prueba ni reenvíos históricos.

## Validación

- 68 casos Deno aprobados en el lote: 15 del nuevo resolver y regresiones de datos compartidos, origen, atribución de URL y fecha del evento. Tras alinear el fallback con el validador público para nombres legados con punto se repitieron sólo los 15 casos afectados.
- Typecheck de `conversions/index.ts` y `retry-failed-conversions/index.ts` correcto.
- 21 verificaciones aisladas de los handlers reales y del callback HTTP real de retry: primeras compras, recompra, duplicado, flujo simple y primera compra insertada sin Contact. Se ejercitan las cuatro etiquetas de proveedor a través de la implementación central; no se llaman sus APIs ni se certifica concurrencia SQL mediante este fixture.
- Se comprueba que la URL llega al request CAPI con los mismos ID, fecha, píxel, FBC y monto. Un duplicado no emite otro envío. El retry corrige sólo su copia de envío; la URL histórica permanece intacta. Siguen vigentes los filtros CAPI de origen.
- URL explícita, raíz explícita, URL específica de Contact, recuperación desde JSON válido, JSON truncado, rechazo de contexto ajeno, un máximo de dos referencias en una consulta de lineage, prefijos `/l/`, ausencia de nombre confiable y marcadores de WhatsApp cubiertos.
- Revisión independiente de las cuatro escrituras Purchase, SELECT de retry y conservación del routing Business Messaging sin bloqueantes.

Comandos: `deno test supabase/functions/conversions/purchase_source_url_test.ts supabase/functions/conversions/shared_test.ts supabase/functions/conversions/origin_test.ts supabase/functions/conversions/url_attribution_test.ts supabase/functions/conversions/event_time_test.ts`; `deno check` de ambas funciones; `node scripts/check-purchase-source-url.mjs --write-report` y `node --check scripts/check-purchase-source-url.mjs`.

[Resultado del fixture de handlers](purchase-source-url-handler-20261031.json): cero requests externos y cero escrituras productivas. Los requests Meta son simulados. Las consultas de producción realizadas durante la revisión fueron sólo lectura.

## Base y rollback

Antes de publicar, los diez archivos activos de `conversions` v172 y los cuatro archivos activos de `retry-failed-conversions` v47 coincidían con la base Git local. Ambos tienen `verify_jwt=false`; se conserva su autenticación y configuración.

- `conversions` anterior: v172, SHA256 `4b535b399d804a2a7dfab3d810367b2063a18d6d8f6bc2b9e2550ebd309515bd`.
- `retry-failed-conversions` anterior: v47, SHA256 `d48b1488ac1b9776b54846c39c871f24201c20b51470f745e3186c6f0a7b003e`.
- Ambos paquetes anteriores se reconstruyen desde Builder `216d019`. No hay migración que revertir. Reponer esos paquetes también repondría la prioridad incorrecta de la URL raíz.
