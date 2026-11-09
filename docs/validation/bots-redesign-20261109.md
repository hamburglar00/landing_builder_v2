# Redirección y selector de canal — 09/11/2026

La sección pasa a llamarse Redirección, con icono de flechas, conservando `/dashboard/bots` y `/admin/bots`. La [maqueta aportada](../design/bots-redesign-reference-20261109.md) define la estética y se conservan las funciones existentes. Se incorporan las ampliaciones posteriores autorizadas: páginas reales de 50 grupos, reinicio diario de ambos canales y selector de canal en el editor con permiso global de Atrio.

## Contrato funcional

La consulta `read_bots_directory_page` filtra, cuenta y selecciona 50 grupos bajo RLS antes de devolver teléfonos, métricas y vínculos. El navegador obtiene métricas actuales de Atrio sólo para asesores de esa página, agrupados por propietario. El directorio de conexiones se reconcilia como metadatos; no calcula métricas de todo el workspace ni autoriza accesos. Un vínculo nuevo actualiza esa proyección y permite volver a consultar una vez la página. Se abortan consultas obsoletas; buscar, limpiar filtros y cambiar workspace vuelven a la página 1. Un refresh de la misma página conserva filas y menús mientras consulta.

Los reinicios manuales de WhatsApp conservan handlers, autenticación y alcance anteriores, con confirmación previa. Los reinicios generales de Atrio y el borrado de inactivos resuelven su ámbito en servidor, independiente de página/filtros. Los grupos de trabajo cargan sólo sus metadatos al abrirse. Los límites de teléfonos usan el total del workspace, incluyendo las otras páginas. Se conservan alta manual, uso, comentarios, disponibilidad, criterios, importación y edición de vínculos.

«Reinicio automático 00:00» queda después de los reinicios de Atrio y antes de la papelera roja. La configuración por cuenta existente ahora reinicia WhatsApp y encola los asesores de Atrio de todos sus workspaces. El cron conserva medianoche de Buenos Aires. Atrio aplica ventanas operativas por asesor/fecha, con deduplicación y reintentos durables; no elimina mensajes, cuentas, asignaciones ni históricos. Se cubren Rey de Ases, Ases del Norte, Ganamos NET y Multi Skin. La reconciliación real de inventario cada cinco minutos conserva su cuenta regresiva y es distinta del reinicio diario.

El aviso «Origen no permitido» se reprodujo con Next normalizando `request.url` a localhost mientras el navegador utilizaba 127.0.0.1. La comparación usa el Host real y conserva autorización; no confía en forwarded headers arbitrarios. Las cuatro rutas privadas afectadas responden 401 sin sesión al origen local válido y 403 a un origen ajeno.

En el editor, Canal precede a Plantilla y usa los logos originales como selector: WhatsApp muestra 1–6; Atrio, 7–9. Se conserva la última plantilla elegida por canal durante la edición y sus borradores. Plataforma/skin se mantienen junto al canal. Tracking conserva país, Pixel y eventos. `show_atrio` gobierna todas las plantillas de Atrio en selector, guardado y RLS; los antiguos flags individuales ya no conceden acceso. Se eliminan sus dos checkboxes del formulario de administración. No se conceden permisos automáticamente al migrar ni se borran landings existentes.

## Inventario de acciones y nueva ubicación

| Funcionalidad existente | Ubicación en el rediseño |
| --- | --- |
| Grupos de trabajo | Encabezado; conserva su visibilidad por rol, formulario y operaciones |
| Vincular/importar por Agency ID, Owner ID, vínculo anterior, manual o Atrio | Encabezado; mismo formulario, errores, previsualización e importación |
| Sincronización global, por gerencia e inventario | Enlace del encabezado y menú de gerencia; mismos handlers y ámbitos |
| Cuenta regresiva y última actualización de métricas | Línea bajo el título y tooltip, sin cambiar temporizadores |
| Buscador por nombre, ID, asesor, bot y teléfono | Barra de filtros; consulta en servidor sobre todo el directorio |
| Canal Todos/WhatsApp/Atrio | Selector con contadores; conserva permiso de Atrio |
| Solo activos | Switch; misma condición de filtrado |
| Reinicios WhatsApp globales y diarios | Menú Acciones; alcance manual anterior y reinicio diario extendido a Atrio |
| Reinicios globales de Atrio | Menú Acciones; conserva todos los clientes del workspace, aun con filtros activos |
| Borrar teléfonos inactivos | Última acción global; papelera roja, confirmación y selección del workspace en servidor |
| Administrar/eliminar gerencia | Menú de gerencia; mismo formulario y confirmación de eliminación |
| Reparto por contador/mensajes | Menú de gerencia; mismas opciones y persistencia |
| Reinicios WhatsApp por gerencia | Menú de gerencia; confirmación previa al handler original |
| Teléfonos, tipos, usos, contadores y mensajes | Filas con columnas comunes; datos ausentes como guion centrado |
| Activar/desactivar teléfono | Menú del teléfono; mismos límites y restricción de disponibilidad |
| Cambiar uso de teléfono | Menú → Cambiar uso; conserva propiedad de PBAdmin y límites del plan |
| Abrir en WhatsApp | Menú del teléfono; mismo enlace `wa.me` |
| Añadir teléfonos manuales | Menú de gerencia manual; formulario y validaciones originales |
| Comentarios de teléfonos manuales | Tooltip y menú → Editar comentario; mismo guardado al perder foco |
| Bots sin teléfono sincronizado | Filas del mismo directorio, con inventario/estado e identificación; sin inventar métricas |
| Abrir asesor/chat del bot | Menú de asesor; conserva destinos y ausencia de chat para inventario pendiente |
| Editar vínculo Atrio | Menú de asesor; mismo formulario, validaciones y actualización |
| Reiniciar asignaciones/chats del asesor | Menú de asesor; mismas confirmaciones y alcance por cliente |
| Quitar asesor | Menú de asesor; mismo aviso y eliminación del vínculo |
| Origen de gerencia y última sync | Tooltip del nombre/estado y formulario de administración |
| Errores, reintentos y límites del plan | Avisos y modales actuales; no se ocultan |
| Rutas anteriores Teléfonos/Gerencias/Atrio | Conservan sus redirecciones a Bots |

## Comprobaciones

| Verificación | Resultado |
| --- | --- |
| `npm run build` en `frontend` | Correcto, incluido TypeScript y generación de 72 páginas estáticas |
| Contratos de inventario/importación, administración/asignación de teléfonos y origen | 29 pruebas aprobadas |
| Rutas de acciones generales y destinos Atrio | 28 pruebas aprobadas |
| Plantillas, permiso global y conservación de borradores | 23 pruebas aprobadas |
| PostgreSQL descartable: paginación, aislamiento y reinicio de WhatsApp | 33 aserciones aprobadas |
| PostgreSQL descartable: permiso global Atrio | 17 aserciones aprobadas |
| PostgreSQL descartable: reinicio Atrio, cuatro casinos e idempotencia | 15 aserciones aprobadas |
| Dispatcher diario | Autorización, respuesta perdida, rechazo, acuse fallido y reintento idéntico aprobados |
| Contrato privado de Atrio y TypeScript | 4 pruebas aprobadas y `tsc --noEmit` correcto |
| Pantalla real compilada con servicios simulados — Chromium | 63 comprobaciones aprobadas |
| Pantalla real compilada con servicios simulados — WebKit | 63 comprobaciones aprobadas |
| Editor real aislado: Chromium y WebKit | Cliente, administrador, guardado T7/T8, retorno de canal y permisos en móvil aprobados |
| ESLint de controladores y rutas nuevos | Correcto |
| `node scripts/sync-nexobet-marketing.mjs` | Marketing 1.2.0: 24 archivos verificados, sin diferencias |
| NexoBet: marketing, eventos y renderer público | 14 pruebas aprobadas; no requiere copiar estos cambios propios del editor de Builder |
| `node scripts/sync-gateway-app-sdk.mjs --check` | Los cuatro SDK coinciden con el canónico |
| Codificación y `git diff --check` | Correctos |

Los controles de navegador cubren escritorio (1440 y 1280 px), móvil (390 px), cabecera única, columnas alineadas sin invasión de texto, scroll dentro de la tabla, gerencia de un único bot, detalle por fila, inventario pendiente, filtros, permisos de cliente/administrador, cambio de uso/estado, comentarios, alta manual, edición de vínculos y gerencias, importación por Owner ID, grupos, sincronización, reinicios individuales/globales, cancelación/confirmación de borrados y alcance de los payloads. La prueba con más de 50 grupos comprueba que no se solicita la página 2 ni las métricas de sus asesores antes de avanzar. Los filtros no reducen un reinicio global y la cuenta regresiva no resetea la página.

Los menús usan portal para quedar dentro del viewport y conservar los modales abiertos. Escape/Tab, flechas, Inicio/Fin y foco durante las actualizaciones se resuelven en el componente de presentación. Los callbacks de cierre de edición son estables para mantener el foco al escribir. Las confirmaciones existentes y las restricciones de uso administrado/disponibilidad no se omiten.

Se actualizó `scripts/test-unified-bots-browser.mjs` a los controles nuevos y se amplió la cobertura de operaciones. Ejecutar con servidor local en el puerto 3137: `node scripts/test-unified-bots-browser.mjs`; para WebKit, establecer `BOTS_TEST_BROWSER=webkit`. Todas las solicitudes operativas se interceptan con datos ficticios: las pruebas no crean cuentas ni modifican servicios productivos.

Capturas con datos ficticios: [escritorio](bots-redesign-20261109/chromium-initial-1440.png), [móvil](bots-redesign-20261109/chromium-initial-390.png), [detalle desplegado](bots-redesign-20261109/chromium-expanded-1440.png), [acciones](bots-redesign-20261109/chromium-actions-desktop.png) y [WebKit móvil](bots-redesign-20261109/webkit-initial-390.png).

## Entrega

Implementación local para revisión, sin commit/push/publicación ni mutaciones de las bases productivas. El servidor compilado queda en `http://127.0.0.1:3137`; las pruebas usaron servicios sintéticos y PostgreSQL descartable. Para usar la consulta nueva con datos reales se requieren las migraciones y el despliegue coordinado indicados abajo; no se agrega una descarga completa como fallback.

Orden de activación, después de revisar este lote:

1. Atrio: aplicar `20261109185343_builder_daily_reset_and_directory_projection.sql` y publicar su endpoint privado de reinicio diario y metadatos. Conservar su única implementación para los cuatro proveedores; no modificar ni publicar SDK/Worker.
2. Builder: aplicar `20261109185337_bots_directory_pagination_and_daily_reset.sql` y `20261109191054_atrio_channel_global_template_permission.sql`.
3. Desplegar `sync-atrio-directory` y `reset-bots-daily`. El segundo reutiliza `ATRIO_DIRECTORY_ORIGIN` y recibe una clave exclusiva `ATRIO_DAILY_RESET_KEY`, validada como `BUILDER_DAILY_RESET_KEY` en el endpoint privado de Atrio. Generar esta credencial sólo para el reinicio diario; no reutilizar ni copiar claves generales de otros productos. Conservar la configuración Supabase/cron existente y no imprimir valores ni exponerlos al navegador.
4. Ejecutar la reconciliación de metadatos y comprobar la proyección de todos los asesores vinculados antes de habilitar la pantalla paginada. No calcular métricas de todos ellos durante esa carga. Confirmar cron de medianoche y dispatcher por minuto, con cola/acuse recuperables.
5. Publicar Builder desde `main` y verificar en ambos dominios las páginas 1/2, búsqueda, permisos y acciones generales. Publicar/verificar Atrio por separado. Esta entrega local no certifica esos despliegues futuros.

NexoBet conserva su canal, permisos, contadores y módulo de marketing fijado; estos adaptadores privados de Builder no forman parte de su copia. API2/Panel3 no cambian. Evidencias del canal: [Atrio habilitado en móvil](bots-redesign-20261109/canal-atrio-mobile.png) y [permiso deshabilitado](bots-redesign-20261109/canal-whatsapp-mobile.png).
