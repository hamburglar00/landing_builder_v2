## Landing Builder – Documentación técnica

Este proyecto es un **builder de landings multi‑tenant** para clientes y administradores, construido con **Next.js (App Router)** en el frontend y **Supabase** (Postgres + Auth + Edge Functions) en el backend.

La página **Admin → Documentación** muestra el contenido de este archivo para facilitar el mantenimiento futuro.

---

## Arquitectura general

- **Frontend** (`frontend/`)
  - Framework: **Next.js 14+ (app router)**, TypeScript y Tailwind.
  - Zonas principales:
    - `admin/*`: panel para administradores.
    - `dashboard/*`: panel para clientes.
  - Autenticación y datos vía **Supabase JS** (`supabaseClient`).
  - Páginas clave:
    - `admin/landings/[id]/editar` y `dashboard/landing/[id]/editar`: editor de landings.
    - `admin/gerencias` y `dashboard/gerencias`: gestión de gerencias.
    - `admin/telefonos` y `dashboard/telefonos`: monitoreo y mantenimiento de teléfonos.
    - `admin/settings`: configuración global (URL base, revalidación, preview para clientes).
    - `admin/tests`: pruebas de builder-config, landing-phone, sync-phones y revalidate.
    - `admin/documentacion`: muestra este README.

- **Backend Supabase** (`supabase/`)
  - Base de datos Postgres con RLS por `user_id` y políticas para admins.
  - Edge Functions en `supabase/functions/*`:
    - `builder-config`: devuelve la configuración visual de una landing (para la landing pública).
    - `landing-phone`: devuelve un teléfono para una landing (1 round-trip vía RPC).
    - `phone-click`: recibe el aviso de clic en el CTA e incrementa `usage_count`.
    - `sync-phones`: sincroniza teléfonos desde la API externa (y por cron cada 5 min en plan Pro).
    - `bootstrap-cron-config`: configuración inicial del cron de teléfonos (una sola vez).

---

## Entidades principales

- **Usuarios**
  - Autenticación manejada por Supabase.
  - El frontend diferencia **admin** vs **cliente** por rol en `profiles` (páginas bajo `/admin` solo para admin).

- **Gerencias** (`gerencias`)
  - `id`: PK interna.
  - `user_id`: dueño.
  - `gerencia_id`: ID externo (usado para la API externa de teléfonos).
  - `nombre`: nombre visible.

- **Landings** (`landings`)
  - `id`, `user_id`, `name` (slug público, **inmutable** una vez que deja de ser placeholder).
  - `config` (JSON con tema/colores/textos/plantilla).
  - `landing_config` (JSONB opcional): payload estandarizado para la landing pública (prioridad sobre derivar desde `config`).
  - Se editan desde el editor visual (`LandingEditorForm`). **Los admins pueden editar y guardar landings de clientes** (RLS lo permite).

- **Asignaciones de gerencias a landing** (`landings_gerencias`)
  - `landing_id`, `gerencia_id`.
  - `weight`: peso para el reparto entre gerencias.
  - `phone_mode`: `"random"` o `"fair"` (equitativo por `usage_count`).
  - `phone_kind`: `"carga"` o `"ads"`.
  - `interval_start_hour` / `interval_end_hour`: intervalo horario opcional (0–23).

- **Teléfonos de gerencias** (`gerencia_phones`)
  - `id`, `gerencia_id`, `phone`, `status` (`active`/`inactive`), `kind` (`carga`/`ads`).
  - `usage_count`: se incrementa **solo** cuando la landing pública notifica un clic vía `phone-click`, no al obtener el número.

- **Configuración global** (`settings`)
  - `url_base`: URL de la landing pública (para revalidación y enlaces).
  - `revalidate_secret`: secreto compartido con la landing para `POST /api/revalidate`.
  - `show_client_landing_preview`: si los clientes ven el preview en el editor.

---

## Flujo de teléfonos y CTA

### 1. Sincronización de teléfonos (`sync-phones`)

Función: `supabase/functions/sync-phones/index.ts`

- Entrada (POST JSON): `user_id` obligatorio; `gerencia_id` opcional.
- Lógica: obtiene gerencias, llama a la API externa por cada una, hace upsert en `gerencia_phones` y marca como inactivos los que no vinieron.
- Se invoca desde la página Teléfonos (botones Sincronizar) y desde el **cron cada 5 minutos** (plan Pro). Ver **CRON-SETUP.md**.

### 2. Obtención de teléfono para la landing (`landing-phone`)

Función: `supabase/functions/landing-phone/index.ts`  
Lógica en DB: `public.get_phone_for_landing(p_landing_name text)` (RPC, **1 round-trip**).

- **Entrada:** `GET /functions/v1/landing-phone?name={landingName}` o POST con body `{ "name": "..." }`.
- **Flujo (en la base de datos):**
  1. Busca la landing por `name`.
  2. Carga `landings_gerencias` y filtra por intervalo horario actual.
  3. Elige una **gerencia** por peso (aleatorio ponderado).
  4. Para esa gerencia, obtiene `gerencia_phones` con `status = 'active'` y `kind` igual al de la asignación.
  5. Según `phone_mode`: **random** → un teléfono al azar; **fair** → el de menor `usage_count` (desempate aleatorio).
  6. Si esa gerencia no tiene teléfonos, la quita del pool y repite desde el paso 3.
- **No incrementa** `usage_count`; eso lo hace `phone-click` cuando la landing avisa el clic.
- **Respuesta 200 (éxito):**
  ```json
  {
    "phoneId": 123,
    "phone": "5493518582368",
    "landingId": "uuid",
    "landingName": "kobe",
    "phoneMode": "random",
    "phoneKind": "carga",
    "gerencia": { "id": 17, "externalId": 17, "weight": 1 }
  }
  ```
- Uso: la **landing pública** llama a este endpoint al cargar (o al hacer clic, según implementación) para mostrar el número en el CTA; luego, al producirse el clic real, debe llamar a `phone-click` con `phoneId` y `phone`.

### 3. Registro de clic en el CTA (`phone-click`)

Función: `supabase/functions/phone-click/index.ts`

- **Entrada:** `POST /functions/v1/phone-click` con body JSON:
  ```json
  {
    "landingName": "kobe",
    "phoneId": 9121,
    "phone": "5493518582368"
  }
  ```
  Los tres campos son **obligatorios**. El contador se actualiza por **`phoneId`** (el `phone` se usa solo para validación de presencia).

- **Lógica:** comprueba que la landing exista, que el teléfono exista por `id`, que la gerencia del teléfono esté asignada a la landing; luego incrementa `usage_count` en 1 en `gerencia_phones`.

- Uso: la **landing pública** debe enviar este POST cuando el usuario hace clic en el botón de WhatsApp (después de redirigir o en paralelo), con el `phoneId` y `phone` que obtuvo de `landing-phone`.

### 4. Reseteo de contadores (`reset-phone-counters`)

- POST con `user_id` (y opcionalmente `gerencia_id`). Pone `usage_count = 0` en los teléfonos de las gerencias del usuario. Se usa desde la página Teléfonos.

### 5. Cron “warm” de landing-phone

- Entre **8:00 y 2:00**, cada **5 minutos**, un job de pg_cron invoca `GET landing-phone?name=...` (nombre de la primera landing o `warmup`) para mantener la Edge Function caliente y reducir cold starts. Ver **supabase/migrations/README.md** (migración `20260327220000_cron_warm_landing_phone.sql`).

---

## Configuración de la landing pública y revalidación

- **builder-config**  
  La landing pública obtiene la config con `GET {SUPABASE_URL}/functions/v1/builder-config?name={landingName}` (y header `Authorization: Bearer ANON_KEY`). La respuesta incluye, entre otros:
  - `phoneSelection.mode`: `"random"` o `"fair"` (equitativo).
  - Resto de tema, textos, colores, layout, etc.

- **Revalidación (ISR)**  
  Tras guardar una landing en el constructor, este hace:
  1. `POST {url_base}/api/revalidate` con body `{ "name": "<landingName>", "secret": "<revalidate_secret>" }`.
  2. `GET {url_base}/{landingName}?warm=1` para calentar la caché.
  - En **Configuración** (admin) se definen `url_base` y `revalidate_secret`. La landing pública debe exponer `/api/revalidate` y aceptar CORS desde el origen del constructor (variable de entorno `ALLOWED_ORIGINS` en la landing, por ejemplo `http://localhost:3001,https://tu-constructor.vercel.app`).

- **Tests (admin)**  
  En **Admin → Tests** se puede probar builder-config, landing-phone, sync-phones y el endpoint de revalidación de la landing pública.

---

## Editor de landings y preview

- **Plantillas:** En el editor se elige plantilla 1 o 2. La 1 permite configurar CTA, multimedia y textos con posición del CTA; la 2 no permite cambiar la posición del CTA.
- **Preview:** Debajo de la previsualización se muestra la nota: *"La vista previa es aproximada. Para una vista certera, abrí el enlace de la landing."* (admin y cliente). El ancho de la nota coincide con el del preview.
- **Sidebar:** El menú lateral (admin y cliente) es **fijo**; el índice y “Cerrar sesión” permanecen visibles al hacer scroll.
- **Admins:** Pueden editar y guardar landings de clientes; en el editor de admin se listan todas las gerencias (propias y de clientes) para asignar a la landing.

---

## Migraciones relevantes (Supabase)

- `20260227100000_landings.sql`: tabla landings y RLS.
- `20260306130000_lock_landing_name.sql`: trigger para que el nombre de la landing sea inmutable una vez fijado.
- `20260306120000_add_landing_config_column.sql`: columna `landing_config` (jsonb).
- `20260327200000_admins_can_update_delete_landings.sql`: políticas para que admins puedan update/delete en `landings` e insert/delete en `landings_gerencias`.
- `20260327210000_get_phone_for_landing_rpc.sql`: función `get_phone_for_landing(p_landing_name)` que concentra la lógica de selección de teléfono (1 round-trip desde la Edge).
- `20260327220000_cron_warm_landing_phone.sql`: cron cada 5 min entre 8:00 y 2:00 para invocar landing-phone y mantener la función caliente.
- `20260305120000_cron_sync_phones.sql`: cron cada 5 min para sync-phones.
- Settings: `show_client_landing_preview`, `revalidate_secret` (migraciones en `settings`).

Ver **supabase/migrations/README.md** para el listado completo y pasos del cron de teléfonos.

---

## Despliegue y entorno

- **Variables de entorno frontend:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **Edge Functions a desplegar:**
  ```bash
  npx supabase functions deploy sync-phones
  npx supabase functions deploy bootstrap-cron-config --no-verify-jwt
  npx supabase functions deploy landing-phone
  npx supabase functions deploy phone-click
  npx supabase functions deploy builder-config
  ```
- **Landing pública:** Configurar `ALLOWED_ORIGINS` (origen del constructor) y `REVALIDATE_SECRET` (mismo valor que en Configuración del constructor).

---

## Cómo extender el proyecto

- Nuevas métricas en teléfonos: columnas en `gerencia_phones`; actualización desde `phone-click` o funciones específicas.
- Mantener esta documentación actualizada al agregar tablas, políticas RLS, Edge Functions o flujos nuevos.
