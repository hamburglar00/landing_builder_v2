# Ordenación de Redirección y tipo mkt — 10/11/2026

Producto: LandingBuilder, cliente y administrador. Fuente canónica: tabla común, controlador de teléfonos, hook paginado y RPC de lectura de Builder. No se modifica Atrio, API2, gateways, Worker, NexoBet ni el motor clásico.

GERENCIA e ID tienen botones con triángulo, dirección activa, `aria-sort`, foco visible y activación por teclado. Estado inicial: nombre ascendente. Cambiar de columna comienza ascendente; repetir invierte la dirección. Cambiar el orden vuelve a la primera página y cierra el detalle desplegado. El orden participa en la identidad de cada petición: se cancela la anterior, se ocultan sus acciones mientras llega la nueva y se mantiene la selección al refrescar/paginar.

La migración `20261110163651_bots_directory_sorting.sql`, aplicada a Builder (`fdkjkzpjqfbaavylapun`), añade `read_bots_directory_page_sorted`. Valida columnas/direcciones permitidas y ordena antes de seleccionar 50 grupos. ID usa `gerencia_id` o el ID real mostrado para gerencias manuales; evita los IDs virtuales internos y coloca N.A. al final en ambas direcciones. Los empates usan nombre/clave estable. Teléfonos y métricas siguen limitados a los grupos seleccionados. La RPC previa delega al orden por nombre ascendente para conservar clientes abiertos. Ambas funciones son invoker, con search path vacío, sin acceso anónimo y con los mismos permisos authenticated/service_role. No se actualizan filas de negocio.

La presentación de TIPO convierte solo MKT/mkt en `mkt`, después de resolver el tipo del origen. La normalización no sale de la celda ni modifica snapshots, managers, teléfonos o valores persistidos.

## Verificación

- PostgreSQL aislado: 109 aserciones sobre 121+ gerencias, cuatro órdenes, páginas sin duplicados/omisiones, ID numérico, ID mostrado frente al interno, N.A. al final, filtros, tenants, workspace, permisos y compatibilidad completa de la RPC previa; conserva también las pruebas existentes de acciones globales/reinicios/históricos.
- Producción: transacción de solo lectura y snapshot repetible, con rol authenticated. Los cuatro órdenes, primera/segunda página y respuesta previa compatible se comprueban sin modificar datos. Invoker/search path y ACL comprobados; advisors comparados antes/después: ninguna incidencia nueva (6 avisos de seguridad y 7 de rendimiento preexistentes, sin cambios).
- TypeScript sin emisión aprobado. ESLint sin errores; conserva una advertencia previa del controlador sobre dependencias de hooks.
- 17 pruebas de workspace y acciones globales aprobadas. Vista con componentes/CSS reales revisada en Chromium/WebKit a 320, 390, 768, 1280 y 1440 px: cabecera de 54 px, columnas alineadas y scroll contenido.
- Regresión de navegador con servicios sintéticos: cubrir alternancia, orden global de filas fuera de la primera página, reset de paginación, conservación al filtrar/paginar, teclado y `mkt` en ambos canales, sin escrituras reales. El fixture simula ambos endpoints de lectura para conservar compatibilidad.

Referencias técnicas revisadas: [funciones invoker y permisos](https://supabase.com/docs/guides/database/functions), [orden y tratamiento de nulos](https://www.postgresql.org/docs/current/queries-order.html). Se mantiene el contrato existente de páginas numeradas; este lote no cambia a paginación por cursor.

## Publicación

La migración se aplica antes del despliegue y conserva la API anterior. Publicar el frontend por `main`, verificar READY y los alias `constructor.panelbotadmin.com` y `mkt.panelbotadmin.com`. Evidencia local en `.vercel/redirection-sort-20261110/`: `database-verified.json`, `results.json`, capturas y registro productivo. Un rollback del frontend conserva la consulta previa operativa.
