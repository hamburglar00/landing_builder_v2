# Motor Gateway: implementación y validación

Base Builder: `5bde97943f437feb9543c6d56b955f741a979df4`; base Clásico: `7d24515065fa8906137794a0cfb311f174c42376`. Checkpoint del lote: `.checkpoints/gateway-engine-20261115T010249Z/manifest.json`, fuera de este repositorio. Se conservaron los cambios de tracking de la otra sesión.

## Contrato de publicación

- Motor optativo `gateway` para Templates 7/9, destino Atrio, publicación interna. Clásico y Constructor conservan sus rutas y motor guardado. El editor permanece en Builder.
- URL pública Builder: `/l/{slug}` dentro del gateway configurado. Nexo usa su espacio separado `/l/nexobet/{slug}`; el nombre `nexobet` queda reservado, sin distinción de mayúsculas, sólo para el motor Gateway de Builder.
- HTML, formulario, Pixel/CAPI, atribución y conversiones reutilizan los generadores actuales. El nuevo motor usa la identidad HttpOnly del Constructor, con cookie y recuperación separadas por backend.
- El servidor comprueba publicación vigente, titular habilitado, template, destino, proveedor, skin y origen exactos. No acepta un dominio indicado libremente por el navegador ni reenvía la sesión del casino.
- Los proxies tienen una lista cerrada de operaciones, cuerpos acotados y prueba HMAC con propósito específico, cuerpo/cookie vinculados y vencimiento corto. No se exponen los callbacks privados de alta/finalización.
- HTML sin identidad: máximo 15 segundos de caché compartida y sin `stale-while-revalidate`. APIs: `no-store`. Assets con hash/versionado: inmutables; logos sin hash: 300 segundos. Se mantienen los assets anteriores.
- La configuración pública conserva el contrato actual `config` + `landing_config`. No se inventó una separación entre borrador y publicación. El primer HTML aún obtiene la proyección canónica `builder-config`; no se afirma un ahorro en ese viaje.
- La nueva consulta privada `gateway_landing_context` reúne el row y `is_client_access_blocked` en un viaje de base de datos. No modifica la autorización existente, asignaciones, cuentas ni operaciones financieras.

## Validación acotada

- 86 pruebas de contrato, identidad, publicación, runtime, preparación, telemetría y regresión pasaron.
- Chromium local: T7/T9 en 390 y 1365 px, sin cuentas reales. Formulario utilizable, sin desborde horizontal; bootstrap/destino en la ruta correspondiente; un CTA produce una preparación; campaña, tracking y `telemetry_path` conservados.
- PostgreSQL PGlite: cuatro verificaciones, cero solicitudes de red. Incluye compatibilidad del motor guardado, rechazo de templates/destinos no admitidos, equivalencia del lookup, RLS/SECURITY INVOKER y denegación de EXECUTE a anon/authenticated.
- Generadores de runtime y Clásico comprobados contra sus archivos emitidos. Los cambios se versionan con hashes nuevos, sin borrar versiones previas.
- Las mediciones reales de los tres motores y la decisión regional pertenecen al informe coordinado del lote. Las pruebas locales no se presentan como tiempos de creación de cuentas reales.

## Migraciones remotas verificadas

Proyecto Builder `fdkjkzpjqfbaavylapun`:

- `20261115013415_gateway_landing_publish_target`.
- `20261115013424_gateway_landing_context`.

Después de aplicarlas: cero landings seleccionaron todavía Gateway; RLS continúa activo; el RPC es SECURITY INVOKER, sólo service_role tiene EXECUTE y una landing sin motor Gateway devuelve null. El índice único de `landings.name` ya existía.

Advisors de seguridad antes/después sin cambios: 6 avisos informativos RLS sin política, 25 search_path mutables, 1 extensión en public, 26 funciones definer ejecutables por anon, 42 por authenticated y 1 aviso de protección de contraseñas. Son hallazgos previos, no se modificaron como parte de este lote.

## Publicación Builder y Clásico

El 14/11 a las 22:46 de Argentina se comprobaron las seis páginas públicas de los tres proveedores, con respuestas 200, formulario HTML y recursos nuevos con SHA-256 coincidente. La entrada del bridge sin firma respondió 401. Estas comprobaciones no crearon cuentas ni cambiaron el motor de una landing. El piloto firmado y el recorrido completo Gateway quedan en el informe coordinado de Atrio.

| Producto | Git main publicado | Deployment productivo READY | Dominios |
| --- | --- | --- | --- |
| Builder | `4da7bedb41f9b81749e36c3cd2fb35fea1df8f83` | `dpl_EsT8pNSJitqaHFabfATCCX3pCbwa` | `mkt.panelbotadmin.com`, `constructor.panelbotadmin.com` |
| Clásico | `727637afc893baba563f98295e11df2e420a2b4a` | `dpl_Dhi5fnAQ8oZXFX3gJpD3yGhGwwA2` | `landing.panelbotadmin.com` |

Se verificaron las bases remotas y ascendencia antes del push fast-forward; no hubo force-push, sobrescritura de trabajo ajeno ni cambio regional. Builder `4da7bedb` añade únicamente la adenda de decisiones a la fuente probada `33fe3281`. Los candidatos READY `dpl_6uwhSXrFLSbk4bACurTKnrNuux6u` / `dpl_7DJHxs8PikDeKB8VumdeVEh5pVUK` se promovieron; los autodeploys Git de main quedaron luego como deployments productivos, con el mismo código. La metadata Git y los dominios se verificaron después.

Evidencia pública filtrada: [páginas y hashes](gateway-engine-public-smoke-20261114.json), [metadata de publicación](gateway-engine-publication-20261114.json). Este cierre documental se publica sólo en la rama del lote para evitar un build adicional sin cambios de código. No se cambia automáticamente el motor de una campaña existente.

## Corrección de paridad EBP detectada en el piloto

La comparación de solicitudes detectó que el colector EBP nativo de Meta no se descargaba desde Gateway: `landingFbc.collectNative` admitía sólo `/vendor/...`, mientras el renderer nuevo emitía `/l/{slug}/_assets/vendor/...`. Pixel y el envío de tracking seguían presentes; no se consideró equivalencia completa hasta corregir ese colector.

Se admite exclusivamente el mismo archivo versionado bajo la ruta original y los prefijos cerrados de Builder/Nexo. Se siguen rechazando URL externa, doble barra de host, traversal literal/codificado, query y archivos fuera del colector permitido. Ocho pruebas focalizadas pasaron, incluidas nueve variantes de URL y T7/T9 en móvil/desktop comprobando la solicitud real del colector. Los runtimes se regeneraron en Builder y Clásico sin retirar hashes antiguos. Nexo utiliza actualmente un adaptador Meta propio, no importa este helper y no incorpora EBP nativo; se conserva esa excepción sin conectar un helper inutilizado.

La corrección no modifica el motor de alta ni crea nuevas cuentas. Su publicación y comprobación GET del colector se agregan al informe coordinado; las cifras del primer piloto no se presentan como rendimiento de esta revisión posterior.
