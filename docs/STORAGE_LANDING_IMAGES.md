# Imágenes de landings en Supabase Storage

## Crear el bucket (una sola vez)

Las políticas RLS ya están aplicadas por la migración `20260227110000_storage_landing_images.sql`. Falta crear el bucket desde el Dashboard:

1. Entra en [Supabase Dashboard](https://supabase.com/dashboard) → tu proyecto.
2. **Storage** → **New bucket**.
3. **Name**: `landing-images` (debe ser exactamente este id).
4. **Public bucket**: activado (para que las URLs sean accesibles desde cualquier deploy).
5. Opcional: **File size limit** 5 MB, **Allowed MIME types** `image/avif`.
6. Crear.

A partir de ahí, las subidas desde el constructor de landings guardan las imágenes en este bucket y las URLs se almacenan en la config (y en la tabla `landings.config`).

---

## Coste de almacenamiento en Supabase (imágenes)

- **Plan Free**: 1 GB incluido. No se cobra por uso por debajo del límite.
- **Plan Pro**: 100 GB incluidos. Por encima: **0,021 USD por GB/mes** (aprox. 0,02 €/GB/mes).
- **Plan Team**: 100 GB incluidos; mismo overage.

Solo se cobra el espacio que exceda lo incluido en tu plan. Las transformaciones de imagen (resize, etc.) tienen coste adicional si las usas.

Ejemplo: 500 MB de imágenes de landings en Pro = 0 GB de overage = **0 € extra**.
