## Edge Functions de Supabase

En este directorio iremos agregando las Edge Functions necesarias para el panel.

Un caso de uso clave de este MVP será una función para que el administrador pueda crear usuarios clientes utilizando la service role key de forma segura (sin exponerla al frontend).

### builder-config (API público)

- **Propósito**: exponer la configuración completa de una landing por nombre para consumir desde el dominio base (p. ej. `https://url_base/name`).
- **Uso**: `GET /functions/v1/builder-config?name=NombreLanding`
- **Respuesta**: JSON con `id`, `name`, `pixelId`, `comment` y `config` (todo el tema de la landing).
- **Público**: no requiere autenticación. En el Dashboard de Supabase (Edge Functions → builder-config → configuración) hay que **desactivar "Enforce JWT verification"** para que cualquiera pueda llamarla sin token.

