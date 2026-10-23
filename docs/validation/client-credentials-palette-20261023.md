# Paleta, perfil y chip Usuario — 23/10/2026

El fondo y el borde inferior usan `--gateway-page-background`, definido por el
casino en el HTML. El CSS compartido respeta esa variable: Rey `#141414`, Ases
`#071b2c`, Ganamos NET `#11001f` y Ganamos+ `#121212`. Abrir el widget WhatsApp
no cambia esa paleta al blanco de sus burbujas. Se conserva la animación anterior.

Mi perfil consulta usuario y clave a pedido. La clave empieza oculta, con ojo y
copiar. Al cerrar el perfil se elimina su estado; no viaja en el HTML inicial ni
en URLs, storage o analytics. Los gateways resuelven exclusivamente la sesión
HttpOnly propia; un cuerpo con otro account ID se rechaza antes de consultar.

En Configuración → Bots de PBAdmin, cada MKT puede elegir Usuario o Soporte.
Usuario es el valor inicial. Full Carga conserva los chips anteriores. La elección
se guarda por bot y llega al abrir el chat mediante el bootstrap existente.

El mensaje contiene:

```text
👤 Te paso tu usuario y clave

🆔 Usuario: …
🔑 Clave: …
```

Atrio acepta una prueba AES-GCM de 60 segundos, con contexto separado, ligada a
cuenta, jugador, asesor, proveedor, conversación e intento. Antes de guardar,
comprueba usuario persistido, bot activo, modalidad MKT y preferencia Usuario.
El índice parcial por conversación/intento evita duplicados concurrentes. Un
reintento conserva el ID. No se llama a API2 ni se fabrica una intervención del
cliente o una conversión para generar esa respuesta.

## Pruebas

- Pruebas unitarias de los cuatro gateways, TypeScript y ESLint de las piezas
  modificadas. Prueba de cifrado, adulteración, vencimiento y secreto incorrecto.
- Postgres 17 aislado: modalidad, ownership, preferencia persistida, permisos
  públicos denegados, seis pedidos concurrentes con un único mensaje y Full
  Carga excluido. No utiliza tablas productivas.
- `scripts/check-client-credentials.mjs`: componentes, JS/CSS y POST reales con
  fixtures. Perfil oculto/revelado/copiado, formato multilínea, elección de chip,
  guardado fallido, teclado, Escape, clic exterior y rechazo de otros bots o sesión
  ausente. El puente y la respuesta se prueban para los cuatro gateways y los tres
  temas en Chromium/WebKit. Los contextos de otra cuenta, jugador, asesor,
  proveedor, conversación o intento no llegan al RPC de inserción.
- `scripts/check-gateway-entry-ux.mjs`: 40 regresiones de ingreso, animación,
  interacción del casino, movimiento reducido y paleta por proveedor.
- `scripts/check-client-chat-hydration.mjs`: cuatro comprobaciones, servidor UTC
  y navegador UTC/Argentina, sin errores de hidratación.

WebKit reveló un fallo del selector: Safari puede desenfocar el botón sin enfocar
la opción al tocarla. Se conserva la selección cuando `relatedTarget` es nulo;
el listener de clic exterior, el teclado y Escape siguen cerrando el menú.

Ganamos+ se prueba con una identidad sintética para el protocolo y el perfil.
No acredita una integración de managers PBAdmin inexistente ni una nueva alta.
No se crearon jugadores ni operaciones financieras reales durante estas pruebas.

## Base de datos y publicación

Migración aplicada en Atrio (`didrpwkdqizivfbapofx`):
`20261023220427_manual_client_credentials.sql`. La versión local coincide con la
historia remota. El RPC usa SECURITY INVOKER, solo service_role puede ejecutarlo
y los asesores guardan la elección por la acción autenticada de su propio bot.
La consulta de verificación confirmó permisos y formato sin insertar mensajes.
Los avisos de seguridad del proyecto no cambiaron respecto del estado anterior.

Se conserva una fuente común para la prueba y el puente con
`scripts/sync-client-credentials.mjs --check`. No requiere nuevas variables de
entorno ni modificaciones de API2 o Panel3.

El tinte de la barra nativa de Safari debe comprobarse en el iPhone del usuario.
Las pruebas verifican la paleta y los bordes del documento, no la interfaz del
navegador físico.
