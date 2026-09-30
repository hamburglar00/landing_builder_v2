# Reconciliación de trabajo aprobado — 30/09/2026

## Alcance

Base renovada: `origin/main` en `f8ed2986ff584ee107f4f5ce18ce708b1548273d`. El candidato incorpora los commits documentales `f92fa53`, `f828a66` y `6e96c8a`, más una corrección acotada del validador local de migraciones y una excepción de whitespace para capturas SQL cuyos espacios forman parte de literales. No hay cambios de frontend, migraciones, funciones Edge, manifiesto Supabase, reglas de negocio ni datos comerciales. El contenido de aplicación es idéntico al baseline.

El ensayo retirado de Estadísticas queda documentado; su código, RPC 281 y manifiesto experimental se conservan exclusivamente en `feature/statistics-short-periods-20260925` (`84a9d38`). Ninguna ruta rápida se habilita. Estadísticas global/Máximo permanece diferida. También quedan fuera `budget_weighted_fair`, HMAC diferido, Telegram, Difusiones, roles nuevos y rediseño UI.

## Gates previos

- Inventario previo de 18 entradas: hashes y tamaños coincidentes. Archivos modificados: UTF-8 válido, cuatro JSON válidos, 15 referencias relativas existentes y sin patrones de credenciales/correos. `git diff --check` aprobó con los SQL originales intactos.
- Directorio de migraciones: 280 archivos registrados, orden válido y sin 281 en el release. Los 21 tests de seguridad del bootstrap aprobaron, incluido el caso `GRANT EXECUTE` corregido. No hubo cambios de esquema que exigieran reconstrucción o nuevo rollback SQL.
- Frontend: 78 tests focalizados aprobados; TypeScript y build Next.js con Node 24.21.0 aprobados usando valores públicos sintéticos sólo en el build local. ESLint focalizado: cero errores, dos avisos previos de hooks. Los bundles no contienen la RPC acotada ni la ruta rápida excluida.
- Atribución: 12 tests Deno aprobados, incluidos cruces entre tenants y los eventos Contact, Lead y Purchase. Los contratos de landing, teléfonos, autenticación, Conversiones e Inbox están incluidos en los 78 tests. Las comprobaciones de zona Buenos Aires, medianoche, RLS, aislamiento y rollback de las 280 migraciones ya constan en [la validación productiva anterior](../cross-tenant-phone-timezone-rollout/validation.json); las fuentes relacionadas no cambiaron.
- Preview protegido `dpl_CUgFie5y9GZx9W3gBbsm3zWGVPRv` del commit `7e8dbb5c029d3c29943b993819cae15964c9d7b9`: READY. Candidato con entorno Production y sin dominios `dpl_AMs4HnquyrPisShyjZaZNY2zPKRA`: READY. En el candidato, login, robots y ambas rutas de Conversiones respondieron 200; landing sintética inexistente y ruta rápida excluida respondieron 404.

## Estado de base y reversión

Supabase permaneció en 280 (`20260925023009`), índice 277 válido, objetos compensados de 278 ausentes y RPC acotada ausente. `landing-phone` siguió en v22 y `conversions` en v161; no se publicaron funciones. Las migraciones 279/280 ya estaban aplicadas, y no había otras pendientes aprobadas.

Deployment anterior para reversión: `dpl_989PRh3Z9dSo6GnkzoZUwEmPamFn`. Este release no aplica objetos SQL: el rollback consiste en devolver ambos dominios a ese deployment. No corresponde alterar el ledger ni ejecutar SQL compensatorio. El [rollback del rollout anterior](../cross-tenant-phone-timezone-rollout/rollback.sql) se conserva sólo para aquel cambio.

## Producción y observación

El deployment `dpl_AMs4HnquyrPisShyjZaZNY2zPKRA` fue promovido a `mkt.panelbotadmin.com` y `constructor.panelbotadmin.com`. Los smokes públicos devolvieron 200 en login, Conversiones, Inbox y landings; 404 en landing sintética inexistente y ruta rápida excluida. Las Edge Functions respondieron 200 al preflight OPTIONS, sin asignar teléfonos ni enviar eventos.

Observación: de `2026-09-30T16:53:47Z` a `2026-09-30T17:25:20Z` (más de 31 minutos), sin rollback. Los dos dominios permanecieron en el mismo deployment. Vercel registró cero errores y cero HTTP 5xx. En la ventana, los logs de Supabase registraron 3715 eventos Edge, 154 de funciones Edge y 146 de PostgreSQL, sin menciones de timeout ni deadlock. El corte de base tuvo cero deadlocks, cero locks en espera y cero consultas activas de más de 8 segundos. Entre los muestreos de las 16:58 y 17:25 UTC, los commits de base pasaron de 3.803.345 a 3.808.725, las inserciones acumuladas en Conversiones de 9029 a 9046 y los rollbacks acumulados de 31.555 a 31.557; no se atribuyen estos dos rollbacks al release documental. El ledger siguió en 280, el índice 277 válido y los objetos de Estadísticas diferidas ausentes.

El Preview y su alias temporal fueron eliminados. No se crearon fixtures, usuarios ni sesiones de prueba y no se enviaron eventos externos. Las comprobaciones públicas y de solo lectura no sustituyen un login autenticado de un cliente real; ese contrato conserva la validación del rollout anterior y el código de aplicación no cambió.
