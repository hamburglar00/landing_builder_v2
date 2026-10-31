# Skin publicada de Template 7/8

La función pública `builder-config` v34 reemplazaba la skin guardada por `ganamos_plus` tanto al leer `landing_config` como al compilar desde `config`. Bet30 conservaba título y logo, pero ambos motores recibían otra skin para el acceso. La compilación de tarjetas de Template 8 también omitía `multiSkinCode`.

La corrección conserva la skin del borrador activo o la publicada cuando falta el campo antiguo, valida contra el catálogo canónico y mantiene la selección independiente de cada tarjeta de T8. Ganamos+ sólo es el valor de compatibilidad cuando falta una skin; un valor explícitamente inválido no elige otro casino. Ambos lectores pasan a versión de caché 4.

La [comparación antes/después](builder-config-skin-regression-20261031.json) ejecuta el código descargado de la función desplegada v34 y la corrección local con una DB simulada. Reproduce `Bet30 → ganamos_plus` antes y `Bet30 → bet30` después, en ambas ramas y ambos renderers, sin crear cuentas ni consultar proveedores.

Validación local: 11 pruebas Node (handler real con DB simulada, 14 skins, renderers Builder/clásico, tarjetas T8, legado y valores inválidos), 5 pruebas Deno existentes, `deno check` de la función, TypeScript de ambos motores, ESLint focal y sincronización del catálogo correctos. No equivale a una prueba dentro de Instagram/Facebook en iPhone.

Publicación pendiente a cargo del coordinador: Edge Function `builder-config` del proyecto `fdkjkzpjqfbaavylapun`, conservando `verify_jwt=false` (confirmado en producción v34 y en ambos TOML locales), seguida por los dos motores y su revalidación. Dependencias de la función: `builder-config/index.ts`, `builder-config/market.ts`, `builder-config/provider.ts`, `builder-config/skin.ts` y `_shared/multi-skin-catalog.ts`. No requiere migración SQL ni regenerar runtimes. Verificar después que el HTML real de `golden-e2e-bet30` serialice `skinCode:"bet30"` en ambos dominios.
