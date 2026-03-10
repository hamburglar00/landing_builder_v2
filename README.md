# Landing Builder

Constructor de landings multi-tenant (admin + clientes) con Next.js y Supabase.

## Documentación

- **Técnica (arquitectura, flujos, APIs):** [frontend/README.md](frontend/README.md)  
  También visible en **Admin → Documentación** cuando el proyecto se ejecuta desde `frontend/`.

- **Cron de teléfonos (sync cada 5 min):** [CRON-SETUP.md](CRON-SETUP.md)

- **Migraciones y cron warm:** [supabase/migrations/README.md](supabase/migrations/README.md)

## Arranque rápido

```bash
cd frontend && npm install && npm run dev
```

Variables de entorno en `frontend/.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

Edge Functions: ver lista de deploy en [frontend/README.md](frontend/README.md#despliegue-y-entorno).
