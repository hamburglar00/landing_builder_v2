# Publicación acumulada del 5 de noviembre de 2026

Se publicaron todos los cambios locales autorizados de Atrio, Builder, renderer clásico y los cuatro gateways. API2 y Panel3 no se modificaron, comitearon, pushearon, migraron ni desplegaron: el hash de HEAD y del contenido de todos sus cambios locales, incluidos archivos sin seguimiento, coincide con el capturado antes de publicar.

## Código y aplicaciones

| Aplicación | Commit publicado | Deployment Vercel |
| --- | --- | --- |
| Atrio | `a164731` | `dpl_4ydgLYLM32YtcJLPgxi84YhRxXAp` |
| Landing Builder | `71eb65a` | `dpl_D874TBTdxRphzrp2u1mYYepf2tpk` |
| Renderer clásico | `5eb1e22` | `dpl_coYsuqhe5468exfWrQ95W88N7eBt` |
| Rey de Ases | `62458aa` | `dpl_DyZ7s6XDjEUxFwhogTbqN4pY3R4m` |
| Ases del Norte | `8863a3a` | `dpl_3scCkcKgvS4gQxjFxXSFb3t7e7DW` |
| Ganamos NET | `479ded9` | `dpl_H1KSJBUh5raucQxfYTmBgRQrhUv8` |
| Ganamos+ / Multi Skin | `4653079` | `dpl_6vfSGMGA8LpU5s2fKdrvT11azdG3` |

Los siete commits se pushearon a sus ramas actuales. Los siete builds finalizaron READY y fueron promovidos; el destino productivo de cada proyecto coincide con el deployment y commit esperado. Referencias completas y versiones anteriores: [deployments.json](deployments.json).

Cloudflare sirve `ganamosnet.global` con la versión `2bbbb66d-91da-4f73-b4d1-aae7b8e285ed` al 100 %, deployment `7da54d0e-c25c-471d-82ed-206762ef07ab`. Se validó primero su URL de preview. Versión previa para rollback: `1cde6922-84fe-4ac5-87bd-547725c14de7`. Se preservaron bindings y secretos productivos con `--keep-vars`; no cambió el relay. El build se hizo desde el commit sin archivos de entorno: `next-env.mjs` contiene únicamente objetos vacíos para development, production y test.

## Base y funciones

- Builder: aplicada `20261105193317_entry_render_timings`.
- Atrio: aplicadas `20261105193319_internal_user_deletion` y `20261105201307_internal_profile_setup_fixes`.
- Ambos proyectos reportan `upToDate: true`, sin migraciones pendientes.
- Se alineó el archivo histórico de diagnósticos con la versión remota `20261031132341`, comprobando igualdad del SQL; no se volvió a aplicar ni se alteró el historial remoto.
- Verificación posterior: corrección de invalidación activa, RPC de avatar y eliminación presentes; Pili tiene tres chips y Gera conserva sus cuatro. No se eliminó ningún usuario productivo ni se cambió su estilo para probarlo.
- Las rutas y funciones de servidor Next quedaron incluidas en sus deployments. No había cambios pendientes de Edge Functions: se compararon fuentes locales y remotas, incluidos imports compartidos, de Builder `create-client` v38, `builder-config` v39 y `entry-catalog-source` v1; Atrio `send-push` v9, `send-telegram` v2 y `telegram-webhook` v2. Todas ACTIVE e idénticas; no se republicaron versiones sin cambios.
- Advisors de Atrio revisados. Las nuevas tablas de auditoría/limpieza sólo admiten service_role y tienen RLS; los avisos informativos sin policies corresponden al acceso deliberadamente cerrado a clientes. Los avisos sobre RPC públicos anteriores y protección de contraseñas permanecen como antecedentes, sin ampliar permisos por este lote.

## Verificación

- Gateways: 1.785 pruebas aprobadas y TypeScript en los cuatro; siete pruebas previas de Rey omitidas por sus condiciones de entorno.
- Builder: 412 pruebas aprobadas, una omitida por necesitar fixture Data API; clásico: 40 aprobadas. Tipos aprobados y siete builds Vercel completos.
- Migraciones: 41 comprobaciones de telemetría en PostgreSQL aislado; siete pruebas de eliminación atómica y permisos; reproducción y reparación del error safeupdate, recuperación idempotente de chips, tres estilos y fotos por rol en PostgreSQL Supabase desechable.
- Vinculación: 17 escenarios reales aislados de Auth/PostgreSQL/PostgREST, incluyendo token automático y conservación de cuentas y contraseñas nativas.
- Cloudflare: build completo y seis pruebas del adaptador de parámetros aprobadas.
- Se actualizaron pruebas que conservaban expectativas anteriores de las tarjetas de canal, versión de caché y presencia textual de un endpoint en el observador. La prueba HTTP local usa sockets efímeros, conservando la validación de destinos, para no colisionar con las vistas previas del usuario.
- SDK, ingreso compartido, catálogo de skins y renderer clásico sincronizados. [Comprobación HTTP pública](public-smoke.json): recursos coincidentes con los commits, formularios nuevos, salud de gateways, telemetría nueva en T7/T9 de ambos motores y login de Atrio. Sólo lecturas; sin altas, activación de pases, conversiones, operaciones financieras ni eliminaciones reales.

## Dependencias que siguen pendientes

Extensiones y la resolución de gerencias siguen dependiendo de publicar/configurar API2 y Panel3. Las consultas de prueba a `/17` muestran «Enlace no disponible» y no crean una cuenta cuando el circuito no está disponible. Los subdominios nuevos por skin requieren que el usuario indique el dominio y su posterior configuración DNS/HTTPS; los dominios actuales se conservan.

El commit posterior de esta evidencia sólo agrega documentación; no requiere otro despliegue. Para revertir aplicaciones, promover sus deployments anteriores y la versión previa del Worker. Las migraciones son compatibles con las aplicaciones previas; no revertirlas borrando datos.
