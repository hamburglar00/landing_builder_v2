# Template 7/8: validación de carga e ingreso

Validación local del 30/10/2026. Referencia anterior: `598f531cbfc8cf8447ca6e1cf69eb41b62ee1eef`. No se crearon cuentas ni se operó contra proveedores reales en estas pruebas.

## Arquitectura y límites

El formulario se entrega como HTML utilizable antes de descargar el programa compartido. Cuatro archivos JavaScript sin configuración de clientes, píxeles ni credenciales se publican bajo nombres que incluyen el hash de su contenido, con caché inmutable. El HTML conserva solamente la configuración de esa landing y el manejo temprano de entrada, errores y medición. Se conserva cada versión publicada para que un HTML cacheado siga funcionando después de otra publicación.

El cliente nuevo no hace un viaje obligatorio al gateway antes de ver el formulario. Una señal local sin secretos permite comprobar sesiones conocidas en los proveedores individuales. Multi Skin recupera la identidad mediante el destino del mismo origen, respetando la skin seleccionada. Una recuperación tardía no redirige mientras la persona escribe; al continuar se utiliza la cuenta existente confirmada por el servidor.

Facebook/Instagram continúan en el mismo navegador. Los parámetros de marketing no invalidan el pase; `ef` y la skin validada se conservan. La conversión de `/start` clásico a `/prepare` agrega la skin vigente de Multi Skin. Un error sincrónico de navegación conserva la alternativa de abrir/copiar el mismo pase; los errores posteriores de sesión son responsabilidad de la recuperación del gateway.

La descarga del programa tiene un plazo de 10 segundos y un reintento automático. Si vuelve a fallar, muestra un mensaje y permite reintentar conservando el nombre. El reintento usa un contador en la URL del recurso estático: WebKit podía reutilizar una respuesta 503 al solicitar exactamente el mismo recurso. No se envía una creación antes de tener el programa disponible, y la ejecución duplicada queda bloqueada.

El iframe pesado de Atrio se prepara al expresar intención de usar el formulario. Template 8 prepara únicamente la tarjeta seleccionada, sin esperar solicitudes de otra tarjeta; sus imágenes públicas de almacenamiento usan tamaños adaptados. Los eventos tempranos se envían también si la persona abandona antes de descargar el programa, sin guardar teclas ni nombres incompletos.

## Tamaño del documento

Misma configuración sintética antes/después; bytes sin comprimir. El programa extraído sigue descargándose en la primera visita y luego puede reutilizarse desde caché. Esta tabla mide el documento crítico, no una reducción equivalente del total de bytes de la primera visita.

| Motor/template | HTML anterior | HTML nuevo | JS inline anterior | JS inline nuevo |
|---|---:|---:|---:|---:|
| Builder 7 | 115409 | 37651 | 99622 | 21566 |
| Clásico 7 | 110011 | 33507 | 95472 | 18670 |
| Builder 8 | 125803 | 40873 | 103766 | 18538 |
| Clásico 8 | 120938 | 37229 | 99844 | 15837 |

Los programas cacheables pesan 99317/98212 bytes para T7 Builder/clásico y 105804/104732 para T8. Comprimidos con gzip: 22162/21991 y 23609/23446 bytes respectivamente. Los documentos completos de Templates 1 a 5 resultaron idénticos al baseline, incluido el JavaScript inline.

No se midió aquí el costo por contacto ni el LCP real de Facebook/Instagram. El bloqueo deliberado de la descarga de JavaScript demuestra que el formulario acepta entrada antes del programa; no equivale a un ensayo de red móvil real o a una medición de CPU.

## Verificación

- 36 escenarios de navegador: Chromium con UA Facebook Android y WebKit con UA Instagram iPhone, en ambos motores. Incluyen visita nueva, CTA antes del JS, abandono antes del JS, primer 503, fallos persistentes y recuperación manual, escritura durante recuperación, selección de Bet30, recuperación de Bet30 y cambio desde una señal previa de Ganamos+.
- Los casos de skin usan URLs de preparación `p1` con `skin`, `ef` y marketing; clásico usa `/start` y comprueba que la conversión conserva Bet30. Un único pedido de acceso por recorrido y ningún rebote a `/resume` para la recuperación de otra skin.
- Todas las solicitudes de cuenta, proveedor, Meta y gateway de esas pruebas son respuestas controladas. No demuestran todavía el E2E real de dos skins con el proveedor desplegado.
- 60 pruebas focalizadas de Builder y 35 de clásico aprobadas. Tipos TypeScript de ambos motores aprobados. Tras normalizar las líneas vacías antes del hash, se repitieron las cinco pruebas de integridad de recursos.
- Generación y comprobación de sincronización aprobadas; `git diff --check` sin errores de espacios. Se retiraron únicamente generaciones intermedias nunca publicadas y no seguidas por Git; quedan los cuatro recursos actuales en cada repositorio.

Comandos reproducibles desde Builder:

```text
node scripts/build-template7-runtime-assets.mjs --write
node scripts/build-classic-template7.mjs --write
node scripts/build-template7-runtime-assets.mjs
node scripts/build-classic-template7.mjs
node scripts/measure-template-entry-payload.mjs
cd frontend
npx tsx scripts/template-entry-fast-browser-check.ts
npx tsc --noEmit
npx tsx --import ./tests/revalidation-server-loader.mjs --test tests/template7ClientIdentity.test.ts tests/template7ManagerWarmRuntime.test.ts tests/template7Performance.test.ts tests/template7RealEntry.test.ts tests/template7Reentry.test.ts tests/template7RuntimeAsset.test.ts tests/template8.test.ts tests/landingTemplate7.test.ts
```

En `landing-prueba-1`: `npm test` y `npx tsc --noEmit`. Los registros completos de ejecución quedaron en el directorio temporal local, fuera de Git.
