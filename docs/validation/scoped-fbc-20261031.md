# Procedencia de FBC por landing, moneda y píxel

La atribución nueva usa un registro `landing-fbc:v2:<landing UUID>:<moneda>:<píxel>` de la configuración efectiva. No importa `_fbc` global, aunque el SDK oficial lo devuelva. Esa cookie queda intacta y su presencia se indica como cuarentena cuando no coincide con la atribución admisible. La causa del caso real y sus límites están en [el informe de origen](fbc125988-origin-20261031.md).

Un `fbclid` actual válido tiene prioridad sobre la atribución guardada; se admite el referrer de Meta o de la misma landing. La recolección EBP usa [el helper oficial acotado](meta-ebp-collector-20261031.md), incluso cuando hay una cookie global ajena. Un regreso directo conserva solamente la atribución válida de su mismo contexto. Se validan formato, 90 días de antigüedad y cinco minutos de tolerancia futura; el timestamp original no se renueva al releer o repetir el mismo clic. Se conserva el timestamp de un registro vencido para impedir renovarlo al reabrir su URL.

`landing_attribution` versión 2 contiene scope, `entry_source` actual, `fbc_source`, `captured_at` en milisegundos exactos al FBC y `legacy_fbc_quarantined`. No es una firma ni prueba criptográfica: la validación de servidor debe contrastar el scope con su configuración confiable. CONTACT y Journey/PageView reciben esta metadata; el handoff T7 existente conserva su contrato de strings y recibe el FBC filtrado. Las políticas y disparadores de Contact, LEAD y Purchase no cambian.

El bridge EBP memoriza una lectura por documento. El collector impide asignarla a otra landing, moneda, píxel o navegación con otro clic. Se permite que T8 cambie `card_index`/`target_provider`, cambie el hash o se limpien parámetros personales. El helper tiene 800 ms de límite interno y su carga más consulta tiene 2200 ms de límite; ambos corren en paralelo al ingreso, sin esperar desde el CTA.

## Verificación local

- `node scripts/check-scoped-fbc-browser.mjs`: **208/208** (26 escenarios × Chromium/WebKit × cuatro runtimes generados T7/T8 Builder/clásico). Usa los collectors y merge generados, SDK oficial 1.3.1 y helper EBP reales. Todo request se cumple con fixtures locales; cookies, nombres y clicks son sintéticos. No hay llamadas Meta, altas, contactos reales ni limpieza del navegador del usuario.
- Los nueve escenarios de la auditoría anterior se reutilizaron con expectativas corregidas. Se agregaron retorno con scope válido, otros scopes/monedas/píxeles, timestamps vencidos/futuros, repetición de URL vencida, referrers admitidos/rechazados, bridge nuevo con cookie ajena, prioridad de URL, storage bloqueado, fallback del SDK y navegación SPA/selección T8.
- `npx tsc --noEmit`: Builder y clásico pasan.
- ESLint focal de helper y runtime Builder pasa; `git diff --check` pasa en ambos repositorios.
- `node scripts/build-template7-runtime-assets.mjs` y `node scripts/build-classic-template7.mjs`: fuentes y copias sincronizadas. Los assets publicados anteriores se conservan.
- Evidencia detallada local: `.vercel/audit-fbc-20261031/scoped-browser-results.json`. Prueba independiente del runtime entero: [EBP e ingreso](meta-ebp-full-entry-20261031.json).

La prueba independiente del runtime entero comprobó CONTACT con EBP nuevo y scope V2 en 4/4 casos; el CTA respondió en 75–196 ms aun con el SDK principal pendiente indefinidamente. El Journey inicial puede preceder al bridge y conservar `direct/none`: sucedió en 3/4 casos. Este lote no retrasa la visita inicial ni emite otro journey para enriquecerlo; CONTACT recoge el estado disponible al tocar el CTA. No se afirma cobertura del bridge real de Facebook/Instagram en un iPhone físico.

## Assets finales

| Runtime | Archivo | SHA256 |
| --- | --- | --- |
| T7 Builder | `t7-builder-08cb850ccb85f0b05bae8cff.js` | `08cb850ccb85f0b05bae8cff35f1ece9c6462c2d0d1e20028b7720925d093133` |
| T7 clásico | `t7-classic-2b52adfd64c74bcbd1d47dd9.js` | `2b52adfd64c74bcbd1d47dd9a22a123b11e397808890abd562b880a58e6874bf` |
| T8 Builder | `t8-builder-ec6ffe3251af6d5177833db6.js` | `ec6ffe3251af6d5177833db6bb0ed8cb93d814b0f3294d0ac612f8b90784d6e3` |
| T8 clásico | `t8-classic-891b40bb2fbd3fa637743a16.js` | `891b40bb2fbd3fa637743a16e64b6a08da7c48cbe4205ce8ce433b8b3732a8a4` |

Estado de esta evidencia: implementación local validada, sin commit ni despliegue realizados por este agente.
