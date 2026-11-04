# Entrega Bots, secciones opcionales y presentación T9 — 04/11/2026

El usuario autorizó commit, push y publicación de los proyectos propios. API2 se conserva sólo en local; el programador gestiona su despliegue.

## Alcance verificado

- Builder: pestaña Bots, importación por Agency ID/Owner ID, galería y layout T9, paletas negro/dorado y negro/plateado, país automático oculto, Planes oculto y secciones opcionales por cliente. El checkpoint anterior es `027d4db`.
- Atrio: puente privado de inventario de bots; no modifica el chat ni las operaciones.
- Clásico: renderer canónico regenerado con la presentación T9.
- API2: endpoint del directorio y mejoras de recuperación/diagnóstico en desarrollo local; nada de este lote API2 se publica desde esta máquina.

Pruebas previas: Bots Builder 26, API2 6, Atrio 6, SQL aislado y navegador 26; T9 112 escenarios de layout, 36 comprobaciones de editor, 48 recorridos de ambos motores y 17 pruebas focales. Compilaciones de Builder/Atrio aprobadas. No hubo operaciones financieras ni creación de cuentas reales.

## Base productiva

Verificados schema y RLS existentes antes de aplicar cambios. Se aplicaron por MCP las migraciones `client_module_visibility_opt_in` y `bots_display_inventory`, con las mismas sentencias de los archivos locales. Se verificaron columnas y defaults posteriores; no cambian valores guardados ni permisos de filas.

Publicadas por CLI, sin cambiar su autenticación existente (`verify_jwt=false` y autorización propia), las funciones `list-clients`, `create-client` y `update-client`.

## Estado web

| Proyecto | Commit publicado | Deployment READY y promovido |
| --- | --- | --- |
| Builder | `a43f857c0d7d423993b4b52d1f6407a2f62b0592` | `dpl_6Wc6rKuMcKSLPPLrnV5wdkqgmGyh` |
| Atrio | `a4659315b4a7945061b5b3f4bd152bbcda03c03d` | `dpl_8613qXm8gUV7PuWxvKKL6PeGSgeG` |
| Clásico | `2ea6c55e262ac548cd8a04102af2028f7b6cb055` | `dpl_3cE8FrdMpt2cAhMUnUnHSr3hPAzk` |

Deploys desde snapshots de esos commits, sin archivos de entorno locales. Antes de promover se verificaron READY, commit y ausencia de cambios de producción ajenos a esta publicación. Los commits fueron pusheados a sus ramas existentes; el checkpoint `027d4db` también forma parte de la historia del Builder publicada.

Smoke público por HTTP, sin ejecutar scripts de negocio: login de Builder 200, importación sin sesión 401, login de Atrio 200, puente sin clave 401, landing Diana 200 y logo de T9 200. No se crearon cuentas, eventos ni acreditaciones.

Los timestamps efectivos de las migraciones aplicadas por MCP son `20261104163005_client_module_visibility_opt_in` y `20261104163007_bots_display_inventory`. Los archivos locales y los fixtures SQL se alinearon con esos timestamps para evitar que una futura ejecución del CLI intente aplicarlas otra vez.

La importación por Agency ID/Owner ID depende del nuevo endpoint de API2; mientras falte, se informa su actualización pendiente y permanece disponible la administración existente. La recuperación financiera de API2 también sigue solamente en local y requiere la migración/API2 del programador.
