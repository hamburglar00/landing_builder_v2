# Directorio unificado Bots — 04/11/2026

Publicación de Builder, Atrio y clásico autorizada el 04/11. Las dos migraciones de Builder fueron aplicadas y verificadas, junto con `list-clients`, `create-client` y `update-client`. API2 permanece solamente en local por indicación expresa; su despliegue corresponde al programador. El estado final de las webs se registra en [la entrega](../../release/bots-template9-20261104/README.md).

## Checkpoint

Antes de modificar la pantalla se guardó todo el trabajo pendiente del constructor en `027d4db` y se creó la etiqueta local `checkpoint/constructor-pre-bots-20261104`. Incluye el lote anterior de Planes y visibilidad de módulos. `git show checkpoint/constructor-pre-bots-20261104` permite revisar ese estado; se puede abrir en un worktree separado sin borrar el trabajo nuevo.

Durante la revisión final se incorporó por `git pull --ff-only origin feature/atrio-integration` el commit del programador `c09680b3` de API2: cambia `MAX_MKT_MANAGERS_PER_USER` de 2 a 999. Sólo tocó `manager.service.ts`; no hubo conflictos ni cambios en nuestros archivos. Las pruebas del directorio y TypeScript se ejecutaron de nuevo sobre esa base. Builder continúa con el checkpoint un commit por delante del remoto y sin avance remoto pendiente; Atrio estaba sincronizado.

## Interfaz y compatibilidad

- Una entrada «Bots» en `/dashboard/bots` y `/admin/bots`. Teléfonos, Gerencias y Atrio redirigen a esta pantalla en ambas áreas; no se eliminan datos ni se cambian asignaciones de landings.
- Tarjetas desplegables y tablas con el diseño de Teléfonos. Cada gerencia reúne teléfonos y conexiones de Atrio. Buscar por gerencia, ID, teléfono, bot, asesor o proveedor; filtros por canal y actividad.
- Conservar las gerencias manuales, edición y eliminación existentes, administración de teléfonos, comentarios, distribución equitativa y grupos de trabajo. El alta central permite Agency ID, Owner ID, gerencia manual y vínculo manual a asesor Atrio existente.
- Conservar edición del vínculo Atrio, acceso directo al asesor/bot y reinicios por asesor y workspace. La confirmación explica cuando el alcance comprende todos los bots del asesor, aunque estén en otras gerencias, o todo el workspace aunque haya filtros.
- `show_atrio` aparece como «Bots de Atrio». Cuando está apagado no se carga el directorio Atrio ni aparecen esos registros o referencias en la previsualización de importación. Bots y la administración WhatsApp siguen accesibles.
- Identidad de agrupación: propietario del workspace más gerencia PBAdmin. Una gerencia manual con el mismo número no representa esa gerencia externa. Las tarjetas virtuales tienen claves estables; asesores sin conexiones permanecen visibles.
- `gerencias.pbadmin_bots` conserva el inventario visual de WhatsApp, incluidos inactivos y sin teléfono. `atrio_clients.pbadmin_bots` conserva el inventario del asesor para mostrar también los bots pendientes de vinculación; sólo las conexiones reales habilitan acceso directo al chat y aportan métricas. Estos snapshots no modifican `gerencia_phones`, disponibilidad, selección pública, contadores o permisos operativos. Los lectores compartidos no descargan el JSON salvo que Bots lo solicite explícitamente. Al cambiar el ID de un asesor o gerencia no se hereda el snapshot de la identidad anterior.

## Importación

1. API2 agrega `GET /api/v1/bot/directory?agency_id=...` o `?owner_id=...`, protegido por el middleware existente de API key/secret. El owner es el propietario PBAdmin, no el UUID del cliente Builder. Devuelve metadatos agrupados; conserva asociaciones MKT por configuración de compras y conexiones Atrio por su gerencia operativa. No cambia los endpoints públicos `random-contact`.
2. Atrio agrega `POST /api/gateway/bot-directory`, privado con la clave de servicio existente. Consulta API2 y completa el slug/nombre desde perfiles actuales. La previsualización es de lectura; la confirmación puede usar la sincronización de inventario existente de los asesores encontrados.
3. Builder agrega `POST /api/bots/import`: sesión real y perfil, RLS del usuario y workspace seleccionado, origen y estructura del pedido comprobados. Reconsulta el inventario al confirmar; el navegador no puede aportar filas ni otro propietario de destino. El superadmin sólo puede indicar otro usuario en el refresco de registros ya existentes, usando los permisos actuales.
4. La importación es reintentable: conserva nombres y opciones existentes, agrega vínculos faltantes y actualiza sólo el snapshot visual. Los conflictos se informan por registro; un resultado parcial no se presenta como una importación completa. No mueve gerencias ni asesores entre clientes/workspaces. Los asesores Atrio sin perfil válido se informan sin inventar identidades.
5. Tras importar WhatsApp se utiliza la sincronización existente de teléfonos. El refresco de metadatos no crea gerencias o asesores nuevos. Agrupa por propietario al sincronizar el workspace y usa Agency ID en una acción individual; máximo cuatro consultas concurrentes y ningún nuevo cron.

Límites de transporte: API2 devuelve hasta 1000 managers por consulta, sin truncar silenciosamente. Builder limita cada importación a 100 gerencias y 200 perfiles; el refresco inmediato en Atrio admite hasta 20 asesores, en grupos de cuatro. Si un propietario excede esos límites, se indica importar por gerencia. No son restricciones para crear u operar bots. Los fallos o respuestas antiguas de API2 conservan los registros guardados y muestran que falta actualizar la integración.

## Verificación

- 26 pruebas Builder: agrupación entre canales, separación por propietario y gerencia manual, asesores sin bots, IDs de tarjetas estables, validación de snapshots, visibilidad, autenticación, origen, destino de usuario, fuente fresca, repetición, resultados parciales, actualización acotada a metadatos y transporte de teléfonos existente.
- 6 pruebas API2: parámetros, agrupación WhatsApp/Atrio, inactivos/sin teléfono, gerencia operativa MKT, asociaciones legacy por configuración de compras, aislamiento del scope y whitelist sin credenciales. TypeScript del proyecto aprobado después de incorporar `c09680b3`.
- 6 pruebas del handler real de Atrio con transportes simulados: secreto, límites, perfil vigente, whitelist, previsualización sin sincronización, error recuperable y API2 pendiente.
- PostgreSQL aislado (`scripts/security/bots-display-inventory-tests.mjs`): migración, defaults, RLS del propietario, límites JSON y conservación de nombres, contadores y filas de teléfonos. Sin conexión a una base productiva.
- Compilaciones Next de Builder y Atrio, incluyendo TypeScript, aprobadas.
- Chromium con tamaños de escritorio (1280 px) y móvil (390 px): 26 comprobaciones de navegación unificada, tablas de ambos canales, bot sin teléfono, búsqueda, filtros, importación por propietario, edición sin reiniciar contadores, reinicio global Atrio independiente del filtro, ancho de pantalla y rutas anteriores. Se prueban cliente, superadmin y Atrio deshabilitado.
- Todas las llamadas de la prueba de navegador se interceptan con servicios sintéticos; no hay creación de cuentas reales, eventos Meta ni operaciones financieras. Contextos y navegadores se cierran en `finally`. No certifica Safari nativo ni los navegadores internos de Instagram/Facebook.
- `git diff --check`, encoding y revisión de archivos afectados. No hay cambios en servicios financieros, APIs de jugadores, gateways ni el SDK compartido.

Capturas con datos sintéticos: [escritorio](desktop.png), [móvil](mobile.png).

## Publicación pendiente

1. Programador: publicar el endpoint de API2 desde su rama `feature/atrio-integration`; no requiere migración API2.
2. Builder: aplicar `20261104143552_bots_display_inventory.sql`. El lote previo del checkpoint también necesita `20261104134536_client_module_visibility_opt_in.sql` y sus Edge Functions si todavía no se publicó.
3. Publicar el puente de Atrio y luego el frontend Builder, conservando las claves de integración actuales. No se agregan secretos ni endpoints de operaciones.
4. Verificar con una sesión real el listado y la importación de una gerencia conocida. La implementación local y las simulaciones no prueban que el nuevo endpoint ya exista en producción.
