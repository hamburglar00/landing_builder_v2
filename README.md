# Landing Builder v2

Constructor multi-tenant de landings y conversiones (admin + clientes), con Next.js + Supabase.

## Estado actual (resumen)

- Paneles separados para `CONVERSIONES`, `SEGUIMIENTO` y `NOTIFICACIONES`.
- Soporte de landings `internas` y `externas (conectadas)`.
- Flujo de conversiones por endpoint:
  - `Contact` desde landing.
  - `LEAD` / `PURCHASE` por JSON de backend externo.
- Logs de conversiones en DB (`conversion_logs`) visibles en UI.
- Notificaciones de inactividad por Telegram con webhook y destinos multiples por cliente.
- Filtros de fecha y filtro por `landing` en Estadisticas (solo visualizacion).
- Guard anti-mojibake activo (hooks + CI).

## Estructura principal

- `frontend/`: aplicacion Next.js (UI admin/cliente).
- `supabase/functions/`: Edge Functions (conversions, notify-inactive-contacts, telegram-webhook, etc.).
- `supabase/migrations/`: esquema y evolucion de base de datos.
- `scripts/`: utilidades locales (encoding check, instalacion de hooks).

## Documentacion

- Tecnica de frontend, arquitectura y despliegue:
  - [frontend/README.md](frontend/README.md)
- Cron y consideraciones operativas:
  - [CRON-SETUP.md](CRON-SETUP.md)
- Migraciones:
  - [supabase/migrations/README.md](supabase/migrations/README.md)

## Arranque rapido

```bash
cd frontend
npm install
npm run dev
```

Variables minimas en `frontend/.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Deploy y operaciones

- Frontend: Vercel (branch `main`).
- Edge Functions: Supabase CLI (`supabase functions deploy ...`).
- Cron jobs: `pg_cron` + `pg_net` en Supabase.

Para funciones y entorno exacto, ver:
[frontend/README.md#despliegue-y-entorno](frontend/README.md#despliegue-y-entorno)

## Guard de encoding (anti-mojibake)

Incluye:

- `.editorconfig` (`charset = utf-8`)
- `.gitattributes` (`text=auto eol=lf`)
- `scripts/check-encoding.js`
- workflow CI `encoding-check.yml`

Activar hooks locales:

```bash
powershell -ExecutionPolicy Bypass -File scripts/install-git-hooks.ps1
```

Linux/macOS:

```bash
sh scripts/install-git-hooks.sh
```

Esto configura `core.hooksPath=.githooks` y ejecuta `check-encoding --changed` antes de cada commit.
