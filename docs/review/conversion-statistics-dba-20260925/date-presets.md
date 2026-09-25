# Fechas de Estadísticas

Fuente productiva: `frontend/components/conversiones/DateRangeFilter.tsx:11`, `:23`, `:30`, `:104`. Ambas páginas montan el filtro con `initialPreset="hoy"` (admin `page.tsx:1292`, dashboard `page.tsx:1690`), aunque el valor por defecto del componente aislado es `maximo`.

## Semántica implementada

| Filtro | Inicio | Fin | Observación |
| --- | --- | --- | --- |
| Hoy | Hoy 00:00:00.000 | Hoy 23:59:59.999 | Día completo; no termina en la hora actual |
| Ayer | Ayer 00:00:00.000 | Ayer 23:59:59.999 | Se resta un día de calendario con `setDate` |
| Semana / «Esta semana» | Lunes de la semana actual 00:00:00.000 | Hoy 23:59:59.999 | El domingo retrocede seis días; no son siete días móviles |
| Mes / «Este mes» | Día 1 del mes actual 00:00:00.000 | Último día del mismo mes 23:59:59.999 | Incluye el resto del mes, incluso días futuros |
| Mes pasado | Día 1 del mes anterior 00:00:00.000 | Último día del mes anterior 23:59:59.999 | Respeta duración del mes y cambio de año |
| Máximo | Sin límite de fecha del selector | Sin límite de fecha del selector | `DateRange = null`; todavía se aplican visibilidad y RLS |
| Personalizado | Fecha elegida 00:00:00.000 | Fecha elegida 23:59:59.999 | Se aplica sólo con ambas fechas válidas y comienzo ≤ fin; abrir el selector no cambia la consulta |

La UI usa `new Date(año, mes, día, ...)`: **zona local del navegador**, sin imponer Buenos Aires. `toISOString()` convierte esos límites a UTC. La migración 279 sobre intervalos de asignación telefónica no cambia esta semántica. En el candidato, `readRequest.timezone` usa `Intl.DateTimeFormat().resolvedOptions().timeZone`; esa zona también guía los agrupamientos SQL/Node.

## Ejemplos exactos

Ejemplo reproducible con reloj de calendario 2026-09-25 y navegador en `America/Argentina/Buenos_Aires` (UTC−03:00). No son valores extraídos de filas ni rangos acreditados de medición.

| Filtro | `from` UTC | `to` UTC, inclusivo |
| --- | --- | --- |
| Hoy | `2026-09-25T03:00:00.000Z` | `2026-09-26T02:59:59.999Z` |
| Ayer | `2026-09-24T03:00:00.000Z` | `2026-09-25T02:59:59.999Z` |
| Semana | `2026-09-21T03:00:00.000Z` | `2026-09-26T02:59:59.999Z` |
| Mes | `2026-09-01T03:00:00.000Z` | `2026-10-01T02:59:59.999Z` |
| Mes pasado | `2026-08-01T03:00:00.000Z` | `2026-09-01T02:59:59.999Z` |
| Máximo | `null` | `null` |
| Personalizado, 10–12/09 | `2026-09-10T03:00:00.000Z` | `2026-09-13T02:59:59.999Z` |

## Aplicación real de los límites

Producción usa `latestIso(range?.start, visibleFrom)` y `toIsoIfValid(range?.end)` en `frontend/lib/conversionsDb.ts:919`, `:961`. Emite `.gte("created_at", from)` y `.lte("created_at", to)` para conversiones; para starts usa `first_seen_at`. Sólo agrega el predicado cuando existe un límite válido. El filtro JavaScript adicional usa comparaciones inclusivas (`DateRangeFilter.tsx:188`). No filtra estas lecturas por `purchase_event_time` o `lead_event_time`.

El fin es milisegundo `.999` inclusivo, tal como está implementado; no debe describirse como `< inicio del día siguiente`. PostgreSQL puede conservar fracciones más precisas que JavaScript, por lo que esa distinción importa para revisar extremos. Cada navegador resuelve su propia zona y cambios de horario mediante fechas locales; no se reemplazan por sumar siempre 24 horas.

El candidato usa `from_at := greatest(from_at, visible_from)` y comparaciones `>=` / `<=` equivalentes. `now` es una referencia de cálculo y no agrega por sí mismo un límite superior. Máximo elimina los límites del selector, no el corte del visor, los ocultos, el tenant o la moneda.

## Rango exacto del timeout hosted terminal

El constructor del harness `stats280-hosted-terminal.mjs`, líneas originales 36–43, sobrevivió en el registro local de creación del 2026-09-25T02:01:58.069Z. Se recuperó sólo este fragmento técnico; el harness operativo y las credenciales no se exportaron. Fragmento y hash en `execution-plan.json.hostedTimeoutRequestProvenance`.

```json
{
  "admin": true,
  "view": "stats",
  "currency": "ARS",
  "from": null,
  "to": null,
  "timezone": "America/Argentina/Buenos_Aires",
  "premium": 200000,
  "phoneLabels": {},
  "filters": {
    "landing": "__all__", "pixel": "__all__", "gerencias": [],
    "phone": "__all__", "meta": "__all__", "source": "__all__",
    "sex": "__all__", "campaigns": [], "device": "__all__"
  },
  "options": {}
}
```

Por lo tanto, el rango enviado fue **Máximo: sin `from` ni `to`**, con administrador global ARS y sin filtros de selectores. No hay fecha inicial/final finita que reconstruir. La ruta asignó `now` al recibir el request; su instante exacto no quedó persistido. Tampoco se exporta una fila de `visible_from` del visor sintético: se distingue el request acreditado de un valor de fila no capturado.

El ensayo terminal empezó a las `2026-09-25T02:05:15.722Z`, registró SQLSTATE `57014` a las `02:05:40.934Z` y terminó a las `02:05:51.816Z`. La primera muestra tardó **15.502,8 ms**, sin resumen visible; se ejecutó 1/5 muestras ARS y ninguna PYG. Son tiempos del ensayo, no los límites del rango de negocio. La evidencia del primer intento a 8 segundos se conserva por separado; no se le atribuye un request no recuperado.
