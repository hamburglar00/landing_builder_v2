## Landing Builder – Documentación técnica

Este proyecto es un **builder de landings multi‑tenant** para clientes y administradores, construido con **Next.js (App Router)** en el frontend y **Supabase** (Postgres + Auth + Edge Functions) en el backend.

La página **Admin → Documentación** muestra el contenido de este archivo para facilitar el mantenimiento futuro.

---

## Arquitectura general

### Parámetros de anuncios y selección de landing

La aplicación clásica (`../landing-prueba-1`) admite `/?landing=bianca2` y
`/otra?landing=bianca2`: el parámetro tiene prioridad sobre la ruta, mediante una
reescritura interna que conserva UTM y `fbclid`. Si falta o está vacío, se usa la
ruta. Un parámetro inválido o una landing inexistente devuelve 404.

El motor constructor también admite `/?landing=bianca2`, `/l?landing=bianca2`
y `/l/otra?landing=bianca2`. El proxy reescribe internamente a `/l/bianca2`
antes de servir el HTML, conservando los parámetros de atribución y la caché
por landing. No modifica el panel, las API, las promociones ni los recursos.
Sin parámetro o con uno vacío conserva la ruta; en la raíz mantiene el acceso
al login. Valores inválidos o repetidos devuelven 404. La tarjeta de parámetros
del editor de administrador y cliente está disponible para ambos motores.

Validación del constructor desde `frontend`: `npx tsx --test tests/constructorUrlRouting.test.ts`
y `node scripts/check-constructor-url-routing.mjs`. La segunda compila y sirve
el proyecto en producción local con datos sintéticos; comprueba selección,
aislamiento de caché y Template 7 para los cuatro proveedores, sin crear cuentas
ni enviar conversiones.

En el motor clásico, al entrar a la raíz sin `landing`, se elige una landing publicada de
`goldencajeros` (configurable mediante `LANDING_FALLBACK_CLIENT`, solo servidor).
La RPC `get_random_active_landing` exige un cliente único y selecciona destinos
WhatsApp con un número activo de adquisición, del tipo y horario asignados.
No crea reservas ni incrementa contadores. La selección no se cachea y redirige
temporalmente conservando los parámetros; si no hay candidatos, se muestra que
no hay atención disponible. Requiere la clave de servicio del runtime.

Las conversiones guardan `landing` (slug mostrado), `campana`, `conjunto` y
`anuncio`, y los conservan en lead, registro y compras vinculadas. Estos campos
aparecen como columnas configurables, se pueden buscar y exportar. `utm_campaign`
permanece independiente; los registros anteriores no reciben campañas inventadas.

Ejemplo para “Parámetros de URL” de Meta, sin `?` inicial:

```text
landing=bianca2&campana={{campaign.name}}&conjunto={{adset.name}}&anuncio={{ad.name}}&utm_campaign={{campaign.name}}
```

Orden de publicación: migración `20261015172240_landing_url_attribution.sql`,
Edge Function `conversions`, panel y runtime clásico. Para las pruebas de base
local aislada: `node scripts/security/landing-url-attribution-tests.mjs` desde la
raíz del repositorio. No usa filas ni credenciales del proyecto remoto.

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
  - `url_base`: URL de la landing pública para enlaces; nunca determina destinos con credenciales.
  - La configuración de revalidación se muestra como estado; su credencial se administra exclusivamente desde servidor.
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
  1. El navegador llama a `POST /api/landings/revalidate` con sesión, acción, ID de landing y motor. El servidor valida usuario, rol, acceso y motor persistido.
  2. El servidor consulta la credencial protegida en `settings` y envía `POST {name, secret}` al receptor del catálogo. El navegador no recibe ni envía esa credencial.
  3. Los receptores invalidan y calientan sus cachés. No se usa `url_base` ni se siguen redirects para el transporte.
  - Producción: clásico `https://landing.panelbotadmin.com/api/revalidate`; constructor `https://mkt.panelbotadmin.com/api/revalidate`.
  - Configuración privada del builder: `REVALIDATION_ENV=production`, `SUPABASE_SERVICE_ROLE_KEY` y URL Supabase del proyecto. Staging/previews quedan deshabilitados. No usar prefijos `NEXT_PUBLIC_` para configuración privada.
  - Local: `REVALIDATION_ENV=local`, `REVALIDATION_LOCAL_SYNTHETIC=1`, modo desarrollo/test, Supabase local en puerto 54321, receptor clásico en 3000 y constructor en 3001. Sólo acepta credenciales sintéticas con formato `phase1b2-local-` seguido de 16 a 128 caracteres alfanuméricos, guiones o guiones bajos.
  - Configuración muestra “Configurado / No configurado”; no ofrece edición de credenciales. La rotación futura es un procedimiento servidor coordinado con los receptores.
  - Detalles de implementación y límites: `../docs/security/phase-1b2/implementation.md`. El receptor clásico del repositorio hermano no fue modificado.

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
- Settings: proyección explícita `id, url_base, show_client_landing_preview`; la credencial sólo es legible desde backend.

Ver **supabase/migrations/README.md** para el listado completo y pasos del cron de teléfonos.

---

## Despliegue y entorno

- **Variables de entorno frontend:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **IP dual-stack para Meta (opcional):** `NEXT_PUBLIC_META_IP_COLLECTOR_URL` apunta al Worker de `infra/meta-ip-collector` y `META_IP_PROOF_SECRET` contiene el mismo secreto HMAC configurado en el Worker. La consulta se ejecuta en segundo plano y mantiene la IP observada por Vercel como fallback.
- **Edge Functions a desplegar:**
  ```bash
  npx supabase functions deploy sync-phones
  npx supabase functions deploy bootstrap-cron-config --no-verify-jwt
  npx supabase functions deploy landing-phone
  npx supabase functions deploy phone-click
  npx supabase functions deploy builder-config
  ```
- **Landing pública clásica:** su variable servidor `REVALIDATE_SECRET` debe coincidir con la credencial protegida del backend. Su configuración y rotación no se realizan desde el navegador. El POST nuevo es entre servidores y no necesita CORS del navegador al receptor.

---

## Cómo extender el proyecto

- Nuevas métricas en teléfonos: columnas en `gerencia_phones`; actualización desde `phone-click` o funciones específicas.
- Mantener esta documentación actualizada al agregar tablas, políticas RLS, Edge Functions o flujos nuevos.
## Visibilidad de módulos por cliente

En **Clientes → Administrar** y al crear un cliente, el administrador puede
mostrar u ocultar Seguimientos, WhatsApp API, Atrio y, dentro de Integraciones,
Kommo y Chatrace de forma independiente. Meta CAPI y el endpoint del constructor
siguen disponibles.

Los permisos se guardan en `client_module_permissions`, separados de la
configuración de conversiones que el cliente puede editar. Los clientes solo
pueden leer su propia fila; `create-client`, `update-client` y `list-clients`
administran los valores después de verificar el rol del administrador. Sin fila,
los cinco módulos siguen visibles para conservar el comportamiento existente.

El dashboard filtra el menú y sus precargas, bloquea las pantallas ocultas por
URL (también las subpáginas de WhatsApp API) y filtra las tarjetas y secciones
directas de Kommo/Chatrace. Los permisos se recargan al abrir el dashboard y al
volver a enfocar la ventana. Un fallo de lectura permite reintentar sin abrir
los módulos. Estos controles son de visibilidad: no desactivan integraciones,
automatizaciones, webhooks ni conexiones existentes.

Publicar primero `20261015181921_client_module_visibility.sql`, después las
tres funciones administrativas y finalmente el frontend. Pruebas:
`node scripts/security/client-module-visibility-tests.mjs` y
`npx tsx --import ./tests/revalidation-server-loader.mjs --test tests/clientModules.test.ts`
(la segunda desde `frontend`).

# Destino del CTA

El editor permite elegir el destino del CTA:

- `WhatsApp`: comportamiento historico, con asignacion de telefono por gerencia y redireccion a `wa.me`.
- `Atrio`: redireccion al webchat configurado con `promo_code` en la URL. El tracking de `Contact` se conserva igual que en WhatsApp, pero no se solicita telefono ganador.

## Origen publicitario en conversiones

Templates 1 a 7, tanto clásico como constructor, leen `facebook`, `portofolio`
y `cp` del enlace. Son valores proporcionados por el anunciante, no datos
inferidos del visitante. Se admite un nombre o un ID; `cp` se trata como texto
para conservar ceros iniciales e identificadores largos. Ejemplo:

```text
?landing=mi-landing&facebook=Facebook%20Norte&portofolio=Equipo%20A&cp=001234567890&campana=Octubre&conjunto=Grupo%201&anuncio=Video
```

`conversions.facebook`, `.portofolio` y `.cp` conservan la atribución del
contacto en Lead, CompleteRegistration y Purchase, incluidas compras
recurrentes. Un dato original conocido tiene prioridad; un campo faltante
puede completarse. Se recortan espacios, controles y longitudes superiores a
300 caracteres; los valores ausentes quedan NULL. No se atribuyen conversiones
históricas sin evidencia.

Las columnas de Admin y cliente quedan entre Landing y Campaña, en el orden
Facebook, Portofolio, Cuenta publicitaria. Están disponibles en ambas vistas,
búsqueda y exportación. Los IDs numéricos completos se pueden buscar sin
alterar la coincidencia exacta de teléfonos.

En el alta de clientes nuevos, estas tres columnas quedan desmarcadas por
defecto. El administrador puede habilitarlas; tanto la vista reducida como la
técnica del cliente respetan esa selección. La ayuda del editor conserva los
parámetros y el ejemplo sin el texto de persistencia/compatibilidad con UTM.

La columna **Resolución de landing**, después de Landing, muestra **Parámetro
URL**, **Ruta**, **Automática** o **Sin dato**. El campo `landing_resolution`
conserva el criterio inicial en Contact, Lead, CompleteRegistration y Purchase;
no se completa retroactivamente a partir de URLs históricas. La selección
automática mantiene el fallback actual del clásico. Su redirección añade una
marca interna de un solo uso que se consume antes de compartir el enlace;
el constructor conserva el login en la raíz sin `landing`. La columna está
disponible en ambas vistas, búsqueda y exportación, y su visibilidad inicial
acompaña a Landing. Publicar primero la migración
`20261020003440_landing_resolution_attribution.sql` y las funciones `conversions`
y `create-client`; ambos motores usan la misma captura, con runtime v6 en el
constructor y bundle regenerado de Template 7 en el clásico.

Para publicar este lote: aplicar primero
`20261019212429_landing_advertising_origin_attribution.sql`, luego las funciones
`conversions` y `create-client`, y publicar constructor y clásico con builds
nuevos. El constructor referencia `landing-runtime-v4.js` para evitar la
caché inmutable de v3; Template 7 conserva su runtime inline compartido.
La ayuda de parámetros está disponible en los dos editores.

Validación local: `npx tsx scripts/landing-advertising-attribution-check.ts`
desde `frontend` ejecuta 20 casos de navegador con tráfico interceptado.
Desde la raíz, `node scripts/phase0/atrio-builder-origin.mjs` comprueba el
recorrido completo contra PostgreSQL/PostgREST temporales y
`node scripts/security/landing-url-attribution-tests.mjs` valida migración,
lectura, búsqueda, exportación y permisos tras reconstruir el historial.
Este último runner conserva su referencia de bootstrap con Supabase CLI
2.75.0; la versión 2.121.0 cambia la instalación inicial de `pg_net` y no
cumple esa referencia. No cambiar las garantías del runner para omitirla.
