# Skin publicada de Template 7/8

La función pública `builder-config` v34 reemplazaba la skin guardada por `ganamos_plus` tanto al leer `landing_config` como al compilar desde `config`. Bet30 conservaba título y logo, pero ambos motores recibían otra skin para el acceso. La compilación de tarjetas de Template 8 también omitía `multiSkinCode`.

La corrección conserva la skin del borrador activo o la publicada cuando falta el campo antiguo, valida contra el catálogo canónico y mantiene la selección independiente de cada tarjeta de T8. Ganamos+ sólo es el valor de compatibilidad cuando falta una skin; un valor explícitamente inválido no elige otro casino. Ambos lectores pasan a versión de caché 4.

La [comparación antes/después](builder-config-skin-regression-20261031.json) ejecuta el código descargado de la función desplegada v34 y la corrección local con una DB simulada. Reproduce `Bet30 → ganamos_plus` antes y `Bet30 → bet30` después, en ambas ramas y ambos renderers, sin crear cuentas ni consultar proveedores.

Validación local: 11 pruebas Node (handler real con DB simulada, 14 skins, renderers Builder/clásico, tarjetas T8, legado y valores inválidos), 5 pruebas Deno existentes, `deno check` de la función, TypeScript de ambos motores, ESLint focal y sincronización del catálogo correctos. No equivale a una prueba dentro de Instagram/Facebook en iPhone.

Publicación completada por el coordinador: Builder `40ff15b`, despliegue `dpl_DYdbWnk2TE1pzaj1CuFmZUJ4r5vm`; clásico `764859c`, despliegue `dpl_3niLScEURXMcW4fiFJ9Pi6H47QEG`; Edge Function `builder-config` v35 del proyecto `fdkjkzpjqfbaavylapun`, conservando `verify_jwt=false`, SHA-256 `a2915618579bee903f8872090fded5cb6f9b7dc889af18b223e1e7e40dffe22d`. Dependencias de la función: `builder-config/index.ts`, `builder-config/market.ts`, `builder-config/provider.ts`, `builder-config/skin.ts` y `_shared/multi-skin-catalog.ts`. No requirió migración SQL ni regenerar runtimes.

Smoke público finalizado el 31/10/2026 a las 17:52 UTC: seis GET de HTML, con `curl` y límite de 45 segundos, correctos. No se ejecutó JavaScript de página, no se crearon cuentas ni se iniciaron logins u operaciones de negocio. Los dos dominios respondieron 200 y serializaron el proveedor y la skin esperados:

| Landing | Builder `/l/{slug}` | Clásico `/{slug}` | Configuración observada en ambos |
| --- | --- | --- | --- |
| `golden-e2e-bet30` | 200 | 200 | `targetProvider:"multi_skin"`, `skinCode:"bet30"` |
| `golden-e2e-ganamosplus` | 200 | 200 | `targetProvider:"multi_skin"`, `skinCode:"ganamos_plus"` |
| `diana` | 200 | 200 | `targetProvider:"ganamos_net"`, `skinCode:""` |

Los títulos propios de Bet30 y Ganamos+ se conservaron. La [evidencia pública](builder-config-skin-public-smoke-20261031.json) incluye URLs, configuración observada, hashes del HTML y tiempos individuales de transporte. Esos tiempos incluyen la conectividad de esta red y no miden el recorrido del cliente ni certifican su rendimiento. El smoke confirma la publicación del arreglo; el E2E con cuenta real y las aplicaciones nativas de iPhone sigue fuera del alcance de esta comprobación.
