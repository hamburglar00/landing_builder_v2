# Publicación de atribución FBC y estado de Meta tracking

Publicado el 31/10/2026. La investigación corrigió la conclusión anterior: el identificador reutilizado ya aparecía en otras landings, monedas y píxeles antes de crearse Diana. No se acreditó su origen en un anuncio. [Origen y límites](fbc125988-origin-20261031.md).

## Versiones activas

| Servicio | Fuente | Publicación |
| --- | --- | --- |
| Builder | `ec71dae22d514c7398ecd21160331af47a626bcf` | `dpl_FnpPnS4eJ94p1HcSnUNZRJjmH2Xs`, promovido |
| Clásico | `f689bbe41c5f2d24b74a1fc5fb756d42d43cbfb8` | `dpl_6bjLoFaPncFsReLEp3B32fc3iLFs`, promovido |
| Atrio, tarjeta Meta | `b425cad19affabe35e47bb231a0dbca23c56a1fd` | `dpl_F997FRE8JP3wUQpKrECrDUoK6iKh`, promovido |
| Edge `conversions` | paquete de Builder | v171 `ACTIVE`, `verify_jwt=false`, SHA256 `1813628a434b7e6e633e172f362b6d9272219370ce3aaac37dafda126ab01cbd` |

Se desplegaron snapshots de los commits, excluyendo archivos de entorno. No se modificaron API2, operaciones financieras, permisos ni configuración de URLs en este lote. La URL del administrador Diana ya había sido corregida en la revisión anterior. La tarjeta usa el estado guardado de su Admin; los asesores siguen heredándolo.

La fuente de atribución es única para los cuatro proveedores y las catorce skins: UUID de landing, moneda y píxel, sin usar el proveedor como autoridad de atribución. Ambos motores incluyen el collector y el helper oficial EBP. Los gateways y el Worker no requieren publicación: reciben el FBC filtrado por el contrato de handoff existente.

## Validación

- 208 escenarios de collector/runtime en Chromium y WebKit; tipos y lint correctos en ambos motores, generadores y sincronización verificados.
- 38 casos del helper EBP oficial, y cuatro casos independientes del runtime completo: Contact e ingreso recibieron el clic actual sin rescatar la cookie ajena, con respuestas simuladas y cero solicitudes de negocio reales.
- 26 pruebas Deno del guard y regresiones, nueve escenarios del resolver/handler Contact real con DB simulada y `deno check` del entrypoint completo.
- Estado de Meta tracking: prueba focal y cuatro escenarios de componente real en Chromium/WebKit, móvil/escritorio; guardado, errores y aislamiento entre administradores.
- Antes de publicar Edge, las ocho dependencias productivas v170 coincidían con la base local comprometida; se conservaron sus funciones y `verify_jwt=false`, agregando sólo el guard y su dependencia. La lectura posterior confirmó v171 y nueve dependencias.
- [Smoke público posterior](scoped-fbc-public-20261031.json): **12/12 GET** correctos. HTML Diana en ambos motores, ocho archivos de runtime y dos helpers con SHA256 idéntico al local. Runtimes con caché anual immutable; helper con revalidación HTTP. Sin ejecutar JavaScript de producción, crear cuentas, enviar conversiones ni llamar operaciones.

No se requiere migración. La validación no cambia los históricos ni reemite eventos. La metadata V2 es una comprobación de consistencia contra la configuración de DB, no una firma ni prueba de un anuncio. Las reglas UTM y CTWA vigentes se conservan.

## Límites

El aislamiento se aplica a nuestros payloads y CAPI. El píxel oficial del navegador mantiene su manejo de cookies. El Journey inicial puede preceder al bridge EBP y quedar sin FBC; Contact recoge la atribución disponible al CTA. No se retrasó el ingreso ni se agregó un segundo Journey. Los navegadores nativos de Instagram/Facebook en iPhone y una nueva recepción real en Meta no se certifican mediante estas simulaciones o GET.

## Rollback

- Builder anterior: `5a774474bbe63d675823768eebf321d070176584`, `dpl_8peJxD8Mh3wxJ4p6yb62w5e3P81B`.
- Clásico anterior: `3f9c1bf6877936bef8dff9e30ae6934947d73e7f`, `dpl_GwqCGpkn3jHqvMhVbouxTD16VJra`.
- Atrio anterior: `38b4449ebd35f5a2431d75bcf6e9f912aafae9cd`, `dpl_DgthXtUdczYW2oFWupHjRkzvvHn1`.
- Edge anterior: v170, ocho archivos, SHA256 `8554a33d04a47d404aef75b5d997049cc2fe8367d2bdcf15e697d6fb4615eb33`, `verify_jwt=false`. Restaurar el paquete anterior sin el import/guard V2; no hay esquema que revertir.
- Se conservaron todos los assets publicados anteriores. Sólo se retiraron ocho archivos intermedios sin seguimiento que nunca se habían desplegado.
