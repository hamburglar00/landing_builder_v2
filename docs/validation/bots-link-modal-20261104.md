# Vincular Bots: selector, campos y tamaño del modal

El usuario pidió cambiar «Agregar gerencia» por «Vincular Bots» y corregir la selección, el ancho excesivo y el ID invisible en el modal de Bots.

La clase `ui-input` utilizada por esos campos no existe en el tema. Se reemplaza en el componente local por controles con altura, borde, fondo y foco explícitos del sistema visual. El selector nativo se sustituye por CustomSelect, con menú en portal para evitar recortes dentro del modal. El alta usa el ancho pequeño existente (máximo 448 px), conservando el ajuste móvil. Se actualizan título, botón y texto de estado vacío.

ModalShell reenfoca el cierre al cambiar su callback onClose. Los callbacks inline anteriores cambiaban en cada tecla/selección y hacían perder el foco. BotsManagement y la administración de gerencia del mismo componente ahora proporcionan callbacks estables. No se modifica ModalShell, CustomSelect ni el sistema global de modales.

Se conservan las cuatro modalidades, los permisos Atrio, los pedidos por Agency/Owner ID, las validaciones y la persistencia existentes. No cambia la sincronización de teléfonos, API2, Atrio ni las operaciones.

Verificación: componentes y CSS reales en Chromium/WebKit a 1280, 390 y 320 px. Seis combinaciones con once situaciones por combinación: tamaño, campos visibles, escritura sin perder foco, selección con mouse/táctil/teclado, previsualización Owner, guardado manual, vínculo Atrio, límites del menú, edición y permiso del superadmin sin Atrio. HTTP y persistencia son fixtures; no hubo pedidos reales a servicios, bots importados ni escrituras en producción. Artefactos en `C:/Users/Leo/.codex/tmp/bots-link-modal-20261104`.

TypeScript, lint focal y build de Builder aprobados. El recorrido anterior de prueba de Bots se actualiza al nombre y al selector personalizado. Publicación del frontend Builder; sin migraciones ni despliegues de los otros servicios.
