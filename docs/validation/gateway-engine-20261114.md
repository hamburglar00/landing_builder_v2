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

Los despliegues candidatos y las pruebas públicas finales se registran al concluir la coordinación con los cuatro gateways y Nexo. No se cambia automáticamente el motor de una campaña existente.
