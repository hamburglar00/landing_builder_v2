## Migraciones de Supabase

Este directorio está reservado para las migraciones SQL del proyecto.

- Aquí se agregan los archivos `.sql` que definan el esquema (usuarios, perfiles, landings, gerencias, etc.).
- Usar `supabase db push` para aplicar migraciones pendientes al proyecto remoto.

### Migraciones destacadas

| Archivo | Descripción |
|--------|-------------|
| `20260227100000_landings.sql` | Tabla `landings`, RLS (dueño + admins pueden leer). |
| `20260306130000_lock_landing_name.sql` | Trigger: nombre de landing inmutable una vez fijado. |
| `20260306120000_add_landing_config_column.sql` | Columna `landing_config` (jsonb) en `landings`. |
| `20260327200000_admins_can_update_delete_landings.sql` | Admins pueden update/delete en `landings` e insert/delete en `landings_gerencias`. |
| `20260327210000_get_phone_for_landing_rpc.sql` | Función `get_phone_for_landing(p_landing_name)`: toda la lógica de selección de teléfono en la DB (1 round-trip desde la Edge Function `landing-phone`). |
| `20260327220000_cron_warm_landing_phone.sql` | Cron cada 5 min entre 8:00 y 2:00 que invoca `landing-phone` para mantener la función caliente (menos cold starts). |
| `20260305120000_cron_sync_phones.sql` | Cron cada 5 min que invoca `sync-phones` para actualizar teléfonos de todas las gerencias. |

### Cron: sincronizar teléfonos cada 5 minutos

La migración `20260305120000_cron_sync_phones.sql` programa un job que cada 5 minutos actualiza la tabla `gerencia_phones` para todas las gerencias (llamando a la Edge Function `sync-phones` en modo cron). Requiere **plan Pro** (pg_cron) y la extensión **pg_net**. El secret del cron se genera en la migración; no hace falta configurar `CRON_SECRET` en sync-phones.

**Pasos (una sola vez):**

1. Aplicar la migración y desplegar las Edge Functions (`sync-phones` y `bootstrap-cron-config`).
2. En el Dashboard: **Edge Functions** → **bootstrap-cron-config** → **Secrets** → añadí `BOOTSTRAP_SECRET` (un string seguro, ej. 32 caracteres aleatorios).
3. Llamar una vez a la función bootstrap para escribir la URL del proyecto en `cron_config`:

```bash
curl -X POST "https://TU_PROJECT_REF.supabase.co/functions/v1/bootstrap-cron-config" \
  -H "Content-Type: application/json" \
  -d "{\"bootstrap_secret\": \"TU_BOOTSTRAP_SECRET\"}"
```

O desde PowerShell:

```powershell
Invoke-RestMethod -Method Post -Uri "https://TU_PROJECT_REF.supabase.co/functions/v1/bootstrap-cron-config" -ContentType "application/json" -Body '{"bootstrap_secret":"TU_BOOTSTRAP_SECRET"}'
```

Tras eso, el cron cada 5 minutos invocará `sync-phones` y actualizará los teléfonos de todas las gerencias. Opcional: podés borrar el secret `BOOTSTRAP_SECRET` después.

### Cron: warm de landing-phone (8:00–2:00, cada 5 min)

La migración `20260327220000_cron_warm_landing_phone.sql` programa un job que, entre las 8:00 y las 2:00, cada 5 minutos hace un `GET` a la Edge Function `landing-phone` (con el nombre de la primera landing o `warmup`). Así la función se mantiene “caliente” y se reducen los cold starts cuando la landing pública pide un número. Usa la misma URL base que el cron de sync-phones (derivada de `cron_config.sync_phones_url`). No requiere configuración adicional si el cron de sync-phones ya está configurado.

