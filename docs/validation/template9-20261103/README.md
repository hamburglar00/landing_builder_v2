# Template 9 — 03/11/2026

Implementado en local. No hay commit, push, migración aplicada ni deployment de este lote.

## Resultado

Nueva opción «Plantilla 9 (registro)» en los editores de Admin y cliente. El casino/bot se elige con los controles existentes. La presentación y la vista previa comparten el mismo HTML/CSS: tarjeta de la referencia, logo de 76 × 76, degradados, nombre, CTA, pie y aviso informativo de cookies. El aviso no cambia las políticas de tracking existentes. No se copian el backend, los controles comerciales ni los scripts publicitarios de la referencia.

- Ganamos NET y Ganamos+: logo de la referencia y paleta `#7c34e8` / `#b02cf0`, según el pedido. Fuente visual: `https://ganamosmayor.com/landing`, icono `/app-icon.png`, capturados el 03/11. El original queda fuera de `public`; sólo se sirven derivados locales WebP de 4.548 bytes.
- Rey de Ases y Ases del Norte: iconos ya existentes de sus gateways, con oro/negro y azul respectivamente. Las otras trece skins Multi Skin conservan su catálogo de marca; no cambian la skin ni el proveedor del servidor.
- Sin descarga de fondo ni fuentes. Logo con espacio reservado; un runtime funcional compartido con T7, con hash de contenido. Placeholder de ejemplo fijo como la referencia; el foco no se fuerza, conservando la recuperación automática y evitando interferir con quien ya está escribiendo.
- Cuenta, destino, atribución, Contact, LEAD, Purchase y Continuar utilizan la implementación de T7. T9 no incorpora un segundo pipeline ni cambia API2, Atrio, finanzas, credenciales, bonos o retiros.

## Verificación

| Comprobación | Resultado |
| --- | --- |
| Builder: 18 archivos focales de configuración, T7/T8/T9, permisos, ingreso, preparación, recuperación, runtimes y tracking | 148 pruebas pasaron |
| Clásico: ingreso real del handler e instrumentación | 8 pruebas pasaron |
| Cuatro gateways: funnel, transición, preparación y handoff | 74 por gateway, 296 en total |
| T9: Chromium + WebKit, ambos motores, cuatro proveedores, Bet30, orgánico con FBC ajeno, clic Meta, reintento, clic previo al runtime, reingreso, móvil 320 px, escritorio y viewport reducido | 48 escenarios pasaron |
| Componentes reales del editor: selector T9, cuatro plataformas, skin Bet30, vista previa y cambio T7 → T9 → T7 → T9, sin escrituras | 10 verificaciones pasaron en Chromium/WebKit |
| T7/T8: programa de regresión del recorrido rápido en Chromium + WebKit | 44 escenarios pasaron |
| PostgreSQL 18.6 mediante PGlite 0.5.15, sin red/DB de producción | 30 verificaciones pasaron |
| TypeScript | Builder, clásico y los cuatro gateways pasaron |
| Build de producción de Builder | Pasó |
| Sync de renderer, runtime, destinos, funnel, transición, login, SDK y logos | Pasó |
| Encoding y diff | Pasaron |

La prueba T9 observa el cuerpo de Contact, el píxel, landing, nombre, proveedor, FBC y la deduplicación al reintentar. En WebKit se observa además el Blob del beacon nativo porque Playwright puede omitir su cuerpo en la intercepción; el transporte continúa siendo el nativo. Todos los servicios son fixtures: no se crean jugadores, no se envían eventos reales a Meta y no se ejecutan movimientos financieros.

La prueba PostgreSQL compara las definiciones antes/después: sólo cambian las condiciones de template. También comprueba grants, aislamiento de dueño/workspace, plan pausado, permiso de edición, diagnósticos T7/8/9 e idempotencia. La migración no habilita T9 a clientes sin el permiso de ingreso existente de T7. Dos aserciones antiguas del test T7 se actualizaron para reconocer el helper acotado `__T7_FETCH_JSON__`, ya presente en HEAD; no se cambió bootstrap para satisfacer esas aserciones.

Capturas de la implementación:

- [Ganamos NET, móvil](ganamos_net-390.png) y [escritorio](ganamos_net-1440.png).
- [Ganamos+](multi_skin-390.png), [Rey de Ases](rey_de_ases-390.png), [Ases del Norte](ases_del_norte-390.png).
- [Resultados T9](browser-results.json).
- [Resultados del editor](editor-results.json).

Esto verifica los recorridos con red y servicios simulados. No certifica el proveedor real ni el navegador físico de Instagram/Facebook en un iPhone.

## Base productiva consultada, sin escrituras

Proyecto Builder `fdkjkzpjqfbaavylapun`: las tres funciones tienen la firma y las guardas esperadas por la migración, `SECURITY INVOKER` y `search_path` vacío. MD5 de `pg_get_functiondef` antes de este lote:

| Función | MD5 |
| --- | --- |
| `resolve_template7_start_context(uuid,text,uuid,text,text,text,text,text)` | `a0bfe2a2cd5bc6a1a385d7c5fc501fab` |
| `resolve_template7_destination_context(uuid,text)` | `cffa6fc7cae1e0068bca4f0750658be7` |
| `record_entry_funnel_events(uuid,uuid,integer,jsonb)` | `298644d52cba9ad17803bb9afb13684f` |

## Publicación pendiente

1. Entregar/publicar los cuatro gateways con soporte de diagnóstico T9. Ganamos+ incluye build y publicación del Worker de `wrangler.jsonc`; conservar sus variables/secretos. Sólo cambian el contrato y el helper de diagnósticos, no el adaptador del casino ni el SDK de app.
2. Aplicar en Builder `20261103184354_template9_gateway_entry.sql` y publicar `builder-config`. Verificar primero las firmas/guardas anteriores y las políticas existentes; no modificar su negocio para resolver una diferencia de versión.
3. Publicar **clásico antes del editor Builder**, para que una landing T9 creada desde el editor no caiga en el renderer anterior del dominio clásico. Después publicar Builder. Verificar assets/health por GET, sin producir conversiones reales.
4. API2 no cambia ni requiere despliegue por este lote. Atrio tampoco cambia. No habilitar ni convertir landings de clientes automáticamente.

Generadores: `node scripts/sync-template9-assets.mjs`, `node scripts/build-template7-runtime-assets.mjs --write`, `node scripts/build-classic-template7.mjs --write`. Verificación sin escrituras con `--check` para los scripts sync y sin `--write` para los dos builds.

Repetir navegador con `node --import tsx scripts/template9-browser-check.ts` y editor con `node scripts/template9-editor-check.mjs` desde `frontend`. El fixture SQL usa `node frontend/scripts/template9-database-check.mjs`, con `PGLITE_MODULE` apuntando a una instalación local de `@electric-sql/pglite/dist/index.js`; no se añadió una dependencia productiva.
