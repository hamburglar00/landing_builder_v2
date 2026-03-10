# Configuración del cron de teléfonos (una sola vez)

El cron hace **lo mismo que el botón "Sincronizar"** en la pantalla de Teléfonos, pero **automáticamente cada 5 minutos** para todas las gerencias.

**Requisito:** plan **Pro** de Supabase (pg_cron no está en el plan Free).

---

## Pasos (en orden)

### 1. Aplicar la migración

En tu proyecto de Supabase:

- **Opción A:** Si usás la CLI de Supabase, en la carpeta del proyecto ejecutá:
  ```bash
  supabase db push
  ```
- **Opción B:** En el Dashboard de Supabase: **SQL Editor** → New query → pegá el contenido del archivo `supabase/migrations/20260305120000_cron_sync_phones.sql` → Run.

Si estás en plan Free, la migración puede fallar al crear la extensión pg_cron; en ese caso el cron no estará disponible hasta que pases a Pro.

---

### 2. Desplegar las Edge Functions

Desplegá las funciones de Supabase (incluida la nueva `bootstrap-cron-config`). Por ejemplo con la CLI:

```bash
supabase functions deploy sync-phones
supabase functions deploy bootstrap-cron-config --no-verify-jwt
```

`--no-verify-jwt` en `bootstrap-cron-config` permite llamarla desde el script de setup sin pasar la anon key; la función sigue protegida por el `bootstrap_secret` en el body.

(O desplegá todas las funciones que uses.)

---

### 3. Crear el secret de bootstrap

En el **Dashboard de Supabase**:

1. Entrá a **Edge Functions**.
2. Abrí **bootstrap-cron-config**.
3. En **Secrets**, agregá:
   - **Name:** `BOOTSTRAP_SECRET`
   - **Value:** un texto largo y aleatorio (por ejemplo 20–30 caracteres). Podés usar un generador online de “random string” o inventar una frase larga que solo vos conozcas.

Anotalo porque lo vas a usar en el paso siguiente.

---

### 4. Llamar a la función bootstrap (una sola vez)

Con eso le indicás a Supabase la URL de tu proyecto para que el cron pueda llamar a sync-phones.

**Desde PowerShell** (reemplazá los valores):

```powershell
cd scripts
.\setup-cron.ps1 -SupabaseUrl "https://TU_PROJECT_REF.supabase.co" -BootstrapSecret "EL_SECRET_QUE_PUSISTE_EN_PASO_3"
```

`TU_PROJECT_REF` es la parte de la URL de tu proyecto en Supabase (la ves en el Dashboard, en la URL del proyecto o en **Settings** → **API**).

**O con curl** (en cualquier terminal):

```bash
curl -X POST "https://TU_PROJECT_REF.supabase.co/functions/v1/bootstrap-cron-config" \
  -H "Content-Type: application/json" \
  -d "{\"bootstrap_secret\": \"EL_SECRET_QUE_PUSISTE_EN_PASO_3\"}"
```

Si todo salió bien, la respuesta dirá algo como: `cron_config actualizado. El cron cada 5 min ya puede invocar sync-phones.`

---

## Listo

A partir de ahí, **cada 5 minutos** se actualizarán solos los teléfonos de todas las gerencias, igual que cuando tocás “Sincronizar” en la pantalla de Teléfonos.

Opcional: después de terminar, podés borrar el secret `BOOTSTRAP_SECRET` de la función bootstrap-cron-config; no se vuelve a usar.

---

## Cron adicional: warm de landing-phone

Si aplicaste la migración `20260327220000_cron_warm_landing_phone.sql`, hay un segundo job que **cada 5 minutos entre 8:00 y 2:00** invoca la Edge Function `landing-phone` para mantenerla caliente (menos cold starts). Usa la misma URL que el cron de sync-phones (desde `cron_config`), no hace falta configurar nada más. Ver `supabase/migrations/README.md` para detalles.
