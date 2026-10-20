# Widget, saldo Full Carga y revisión de Ganamos — 20/10/2026

## Cambios de Atrio

- Cierre del widget compartido: botón de 36 px, X de 20 px, trazo mayor, fondo negro al 50 %, borde y foco visibles. Aplica a Atrio, WhatsApp y tema de página, en los cuatro gateways que consumen el widget.
- Los mensajes de texto admiten corte de URLs y cadenas largas dentro de la burbuja, conservando saltos de línea y texto copiable. Se limita también el ancho mínimo del contenedor del mensaje entrante.
- Los bots Full Carga permiten al asesor consultar el saldo de la cuenta vinculada. Se conserva el ownership de asesor, conversación, jugador, cuenta y bot. Las mutaciones manuales siguen requiriendo un bot MKT con sus permisos; Full Carga no recibe botones de cargar o retirar.
- La consulta aprovecha el endpoint de saldo existente de API2. La prueba real detectó que la versión desplegada todavía responde `capability_not_allowed` para Full Carga. Se corrigió localmente el permiso del servicio exclusivamente para lectura; requiere desplegar API2. La demora del proveedor desplegado no desaparece por mostrar el nuevo botón: las optimizaciones de API2 continúan locales.

## Carga de Ganamos pendiente: operación 13

Lecturas verificadas: bot 1041, gerencia 278, jugador API2 31722, usuario `medici4384`, carga por 1.000 iniciada el 20/10 a las 18:23:37 UTC. API2 conserva `processing`, sin respuesta financiera persistida. La consulta autenticada independiente informa saldo 0.

El reporte autenticado de Ganamos para ese usuario entre el 1/10 y el 21/10 devuelve depósitos 0 y retiros 0. Su respuesta contiene totales y fecha de cálculo `2026-10-20 18:40:00`, pero no un listado de transacciones. No presentarlo como un historial exhaustivo ni reemplazar con ese agregado la conciliación final. Ninguna llamada de esta revisión acreditó o retiró fichas.

Para cerrar el incidente, el responsable con escritura en API2 debe:

1. Confirmar que no queda ejecutándose la solicitud original y verificar los movimientos del jugador en el proveedor, con cobertura posterior al intento original. Conservar la evidencia y relacionarla con la operación 13.
2. Si no existió acreditación, cerrar la operación original como fallida/no aplicada con auditoría, conservando su ID, clave y respuesta anterior. Si existió, finalizar esa misma operación con su comprobación real y procesar la entrega de la confirmación sin repetir el depósito.
3. Sin acreditación, recuperar desde Atrio el resultado terminal del mismo intento para liberar su intención pendiente. Recién después podrá hacerse una nueva carga explícita. No cambiar la clave para esquivar una operación aún incierta.

La conexión SQL disponible en este entorno es de lectura. No se cambió el registro productivo ni se reenvió la carga. Desplegar la vía rápida evita el recorrido problemático en operaciones futuras, pero no concilia por sí solo este registro histórico.

## Log de saldo

El mensaje `getPlayerBalance failed after 3 attempts` proviene de `GanamosClient.getPlayerBalance`, la variante que automatiza el navegador. Es coherente con el timeout de la consulta de `medici4384`; la captura muestra el modal de cambio de contraseña abierto. No demuestra por sí solo el resultado de la carga. En API2 local se eliminó la contraseña de ese log y se limita el error registrado a su nombre.

## Clasificación de respuestas de API2

La API general diferencia `message.reply` y `message.file`; el outbox y el cliente transportan el contenido y la identidad de entrega, pero no una categoría semántica completa. Los avisos confirmados de carga tienen un circuito específico independiente. Las intenciones de los chips y la información de comprobantes de Atrio tampoco equivalen a clasificar todas las respuestas generales de API2.

No se implementó un filtro de respuestas ni se ocultaron mensajes. Para decidir qué entregar a Full Carga hace falta propagar categorías explícitas desde el origen de cada respuesta, por ejemplo procesamiento de archivo, estado de carga, estado de retiro, conversación y promoción. Deben conservarse en el outbox y los reintentos; los errores financieros deben conservar su relación con el flujo y los mensajes antiguos sin categoría necesitan un comportamiento compatible. No clasificar ni suprimir mensajes por palabras del texto.

## Rendimiento y alta

Los tiempos cercanos a 2 segundos corresponden exclusivamente a saldos leídos con las variantes locales optimizadas. Las cargas y retiros optimizados requieren medición real después del despliegue de API2. El alta mantiene los recorridos optimizados del código local: API de Rey, formulario HTTP de Ases y modalidad `create_only` de Ganamos NET; se conserva la API completa existente de Ganamos. Esta revisión no creó jugadores ni vuelve a certificar los tiempos de alta de producción.

## Validación

Las 16 pruebas focalizadas de Atrio pasaron, incluida la ejecución del contexto real del servidor: saldo permitido a Full Carga, mutaciones denegadas y filtros de ownership preservados. Compilación de producción de Atrio y chequeo de tipos de API2 aprobados. Prueba visual sobre el widget publicado: Chromium y WebKit, anchos 320, 390 y 768 px, los tres temas, 18 casos sin desbordamiento horizontal; el botón de cierre envía el evento esperado al gateway. Las variantes de tema y el texto largo se inyectaron únicamente en el DOM del navegador de prueba, sin modificar mensajes ni configuración persistida.

En cuatro pruebas del inbox publicado (los dos navegadores, móvil y escritorio), Full Carga mostró Consultar saldo y mantuvo ocultos Cargar/Retirar. La lectura real llegó a API2 y devolvió la limitación de permiso anterior; no certificar su funcionamiento productivo antes del despliegue de la corrección local. La sesión temporal de prueba fue revocada y no se ejecutaron operaciones financieras.

API2 no se publicó. HG Cash, Panel3, tracking y envío a Meta no se modificaron.
