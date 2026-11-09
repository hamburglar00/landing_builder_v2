# Redirección y canal: publicación del 09/11/2026

El usuario autoriza commit, push, migraciones y despliegue de todos los cambios solicitados de LandingBuilder. Se publica Builder desde `main` y el adaptador privado de Atrio por separado. Se conserva la base ya publicada, incluida la instalación nativa que avanzó en paralelo. Las decisiones locales de otros lotes se conservan y no se incluyen en este commit.

## Alcance y fuentes

- Builder: directorio Redirección, paginación por demanda de 50 grupos, acciones sobre todo el workspace, teléfonos/iconos/chips, título e identidad, selector de Canal antes de Plantilla, y permiso global `show_atrio` para 7/8/9.
- Atrio: metadatos del directorio sin calcular todas las métricas y reinicio diario idempotente por asesor/fecha, único para Rey, Ases del Norte, Ganamos NET y Multi Skin.
- NexoBet conserva su canal y sus contadores propios. Marketing 1.2.0 y sus 24 fuentes no cambiaron; 14 pruebas de marketing/eventos/renderer aprobadas. SDK y Worker de los gateways no cambian en este lote; las cuatro copias coinciden con el canónico actual.
- API2 y Panel3 no se modifican ni se publican; ninguna operación financiera se usa para comprobar esta entrega.

## Preparación y migraciones

- Ambos proyectos Supabase están saludables. Se revisaron esquema, permisos y advisors antes de aplicar cambios. Dry-run: exactamente dos migraciones de Builder y una de Atrio, sin seeds, roles ni Vault pendientes.
- Atrio `didrpwkdqizivfbapofx`: aplicada `20261109185343_builder_daily_reset_and_directory_projection.sql` con CLI, conservando su versión.
- Builder `fdkjkzpjqfbaavylapun`: aplicadas `20261109185337_bots_directory_pagination_and_daily_reset.sql` y `20261109191054_atrio_channel_global_template_permission.sql` con CLI, conservando sus versiones.
- RLS en ambas colas/registros. El reinicio de Atrio no tiene EXECUTE anon/authenticated; sólo service_role. La consulta paginada no tiene acceso anon. La cola de Builder no tiene SELECT authenticated.
- Ninguna cuenta tenía los permisos anteriores de plantillas habilitados con Atrio deshabilitado. La transición al permiso global no elimina accesos existentes de ese grupo.
- Credencial nueva exclusiva de este enlace: `ATRIO_DAILY_RESET_KEY` en Builder Edge y `BUILDER_DAILY_RESET_KEY` sensible en Atrio Vercel. Se generó para esta operación; no se extrajeron ni copiaron las claves generales de producción. No registrar su valor ni incluir los archivos privados de despliegue en Git.
- Funciones de Builder ACTIVE: `reset-bots-daily` v1 y `sync-atrio-directory` v4. JWT de plataforma deshabilitado con autenticación propia conservada (secret cron/credencial privada).
- Reconciliación productiva HTTP 200: tres asesores recorridos, cero proyecciones pendientes. Dispatcher autenticado HTTP 200, `completed: 0`, sin forzar reinicios de usuarios.
- Cron de medianoche activo `0 3 * * *` (Buenos Aires); dispatcher activo cada minuto. No se ejecutó manualmente el reinicio de medianoche ni se crearon trabajos o métricas de prueba en producción.
- Lectura real bajo rol authenticated y usuario de cliente: límite de 50, propietario correcto y segunda página sin duplicados. No se devolvieron datos personales en la evidencia.

## Verificación y publicación

Las pruebas locales del lote están en [el informe funcional](bots-redesign-20261109.md): build, 126 controles de navegador, pruebas del editor en ambos navegadores y móvil/escritorio, contratos y PostgreSQL descartable para scope, permisos e idempotencia. Atrio también pasó build/TypeScript y sus cuatro pruebas privadas. El dispatcher pasó pérdida de respuesta, rechazo y acuse fallido con el mismo identificador de reintento.

- Atrio código: `531874ea6c4da80440cfc2f2404affdb3426b394`, pusheado a `fix/atrio-inbox-validation`.
- Atrio despliegue productivo READY y promovido: `dpl_HcfnhywCk51hkVYPMQJxyKtNbR8r`, `https://internal-chat-hp44nhq6g-juanclouds-projects.vercel.app`.
- Endpoint público privado de Atrio: 401 con credencial inválida; 400 con la credencial exclusiva y un array vacío inválido. No se pidió reiniciar ningún asesor.
- Builder: entrega de código a `main` y verificación de los dos dominios en curso. El registro final se completa al comprobar el despliegue.

Los artefactos privados de operación se mantienen en `.vercel/redirection-release-20261109/` de cada proyecto, fuera de Git. No incorporan secretos al informe ni al commit. Los dominios de Builder son `constructor.panelbotadmin.com` y `mkt.panelbotadmin.com`; un Preview no acredita producción.
