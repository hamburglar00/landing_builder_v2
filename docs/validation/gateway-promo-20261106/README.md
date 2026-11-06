# Acceso directo sin código de landing — 06/11/2026

El alta por gerencia podía crear correctamente la cuenta y recuperar su identidad en Atrio, pero fallar al establecer la sesión del gateway. Atrio devuelve `promo_code: ""` cuando el acceso no viene de una landing. El adaptador de Rey intentaba persistir ese valor y PostgreSQL rechazaba la fila por `player_bindings_landing_promo_code_check`.

Los handlers compartidos de ingreso por gerencia y recuperación manual convierten únicamente el código vacío o ausente en `null`, antes de establecer la sesión. Los códigos de campaña válidos se conservan. No se modifica la restricción de la base, el proveedor, el asesor, la cuenta, la contraseña ni el flujo de Template 7–9. No se agregan solicitudes de red.

## Validación

- 60 pruebas de ingreso, gerencia y routing aprobadas en cada gateway: 240 ejecuciones en total. Matriz de cuatro proveedores, alta/ingreso y código vacío, nulo, ausente o válido.
- TypeScript aprobado en los cuatro repositorios; sincronización canónica de ingreso y SDK comprobada desde Builder. SDK sin cambios.
- Tres pruebas con PostgreSQL 17 local aislado y las migraciones reales de Rey: reproducción del rechazo original, alta/reintento/ingreso con el adaptador real y conservación de atribución válida. Se comprueba una sola vinculación y una sola sesión activa; los códigos no vacíos inválidos siguen rechazados.
- Ejecutar esa regresión en Rey con Docker disponible y la imagen `postgres:17-alpine`: `node scripts/test-agency-entry-postgres.mjs`. El ejecutor usa una base temporal en loopback; no lee `.env` ni usa bases productivas.
- Build OpenNext aprobado con sus seis pruebas de adaptador. Archivo de entorno compilado de producción vacío. Deploy con `--keep-vars` para conservar las variables privadas existentes.
- Verificación pública de formularios de ingreso y acceso por gerencia, conservando el CSS publicado. Las rutas genéricas responden 401 con HTML de ingreso cuando no hay sesión; los enlaces válidos por gerencia responden 200.
- Verificación del commit y deployment de producción de los cuatro proyectos Vercel. Evidencia en los JSON adjuntos.

Las pruebas de alta, reintentos y sesiones se ejecutaron en PostgreSQL local con proveedor y puente simulados. En producción se verificaron versiones y páginas mediante GET; no se crearon jugadores, chats ni operaciones reales para probar el arreglo.

## Publicación

| Gateway | Commit | Deployment Vercel |
| --- | --- | --- |
| Rey de Ases | `db85fe1d4d18e0e222f6b61ba511e90e36189627` | `dpl_7iSJ15qHbUG1bD6dX75rNyJnqjHV` |
| Ases del Norte | `19be86a470d28d628f7c699b4ddb9198f9d2cc11` | `dpl_Ci9wCm1kKUbMntMk7Tfij8oZWv5G` |
| Ganamos NET | `8e79ff96ffb5b8ae7dbbbfd3b909be910d9f4809` | `dpl_Bnj4avpNr7dQvcMR1T2MUiVomY91` |
| Ganamos+ | `79316edf7343e578dfe55de3d1323f36b9065706` | `dpl_3jKrFSgBShDaTvZR9Z3iAp3dJn8m` |

Ganamos+ también publicado en el Worker `multi-skin-gateway`, versión `19c4c56c-cac6-4783-a075-8cd982dadfcf`, construido desde el mismo commit. Dominio público: `https://ganamosnet.global`.

No hay migraciones ni funciones Edge nuevas. API2, Panel3 y el runtime de Builder/Atrio no requieren cambios para esta corrección. La cuenta del incidente permanece intacta y se debe recuperar, sin recrearla.

## Reversión

Los deployments anteriores de Vercel están registrados en `deployments.json`; pueden promoverse sin migraciones. Worker anterior: `2efb7378-f003-41c5-a7cf-8ca7406f35ab`. Volver a esas versiones también restaura el fallo de alta sin código de landing. No borrar vínculos ni cuentas para revertir.
