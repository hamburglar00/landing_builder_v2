# URL de origen de Purchase

Estado: publicado y verificado el 31/10/2026 a las 16:47 ART. La corrección vive en las funciones Edge centrales `conversions` v173 y `retry-failed-conversions` v48, ambas activas.

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

## Publicación verificada

Fuente comprometida: `1c4387d091d413ac77f19dc5ab21f4fca2a4cf8c`, rama `fix/template7-session-reentry`.

| Función | Versión | Archivos verificados | SHA256 del paquete |
| --- | --- | --- | --- |
| `conversions` | 173 ACTIVE | 11 | `8316491ef1f3ffe626dfcf9750a2b34b977b3a79e6458ffe2ce288633b1d2101` |
| `retry-failed-conversions` | 48 ACTIVE | 5 | `914f1161c511022166e23647b5772bb890adb73ab1ccbc170cf88375da04b22a` |

Todos los archivos recuperados después del despliegue coinciden exactamente con el commit. Se conservaron `verify_jwt=false`, las credenciales existentes y la autenticación propia de cada función. [Smoke público](purchase-source-url-public-20261031.json): ambas responden OPTIONS 200, sin invocar POST, cron, conversiones ni operaciones de proveedores.

La publicación se aplica a los nuevos procesamientos y a los reintentos legítimos de la cola existente. No se alteraron retrospectivamente los eventos aceptados por Meta ni se invocaron reenvíos manuales. La prueba aislada valida el request saliente; no prueba una nueva adjudicación de compras en Ads Manager, cuyo acceso no está conectado para ese Facebook.

## Base y rollback

Antes de publicar, los diez archivos activos de `conversions` v172 y los cuatro archivos activos de `retry-failed-conversions` v47 coincidían con la base Git local. Ambos tienen `verify_jwt=false`; se conserva su autenticación y configuración.

- `conversions` anterior: v172, SHA256 `4b535b399d804a2a7dfab3d810367b2063a18d6d8f6bc2b9e2550ebd309515bd`.
- `retry-failed-conversions` anterior: v47, SHA256 `d48b1488ac1b9776b54846c39c871f24201c20b51470f745e3186c6f0a7b003e`.
- Ambos paquetes anteriores se reconstruyen desde Builder `216d019`. No hay migración que revertir. Reponer esos paquetes también repondría la prioridad incorrecta de la URL raíz.
