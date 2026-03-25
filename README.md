# Landing Builder

Constructor de landings multi-tenant (admin + clientes) con Next.js y Supabase.

## Documentacion

- **Tecnica (arquitectura, flujos, APIs):** [frontend/README.md](frontend/README.md)  
  Tambien visible en **Admin -> Documentacion** cuando el proyecto se ejecuta desde `frontend/`.

- **Cron de telefonos (sync cada 5 min):** [CRON-SETUP.md](CRON-SETUP.md)

- **Migraciones y cron warm:** [supabase/migrations/README.md](supabase/migrations/README.md)

## Arranque rapido

```bash
cd frontend && npm install && npm run dev
```

Variables de entorno en `frontend/.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

Edge Functions: ver lista de deploy en [frontend/README.md](frontend/README.md#despliegue-y-entorno).

## Guard de encoding (anti-mojibake)

Este repo incluye:

- `.editorconfig` con `charset = utf-8`
- `.gitattributes` con `text=auto eol=lf`
- script `scripts/check-encoding.js`
- workflow CI `encoding-check.yml`

Para activar el bloqueo local antes de cada commit:

```bash
powershell -ExecutionPolicy Bypass -File scripts/install-git-hooks.ps1
```

o en Linux/macOS:

```bash
sh scripts/install-git-hooks.sh
```

Esto configura `core.hooksPath=.githooks` y ejecuta `check-encoding --changed` en cada commit.
