# Auditoría de las catorce skins y Continuar

La corrección publicada `40ff15b`/`764859c` conserva todo el catálogo, no contiene un caso especial para Bet30. Se amplió la comprobación a cada skin de T7/T8, Builder/clásico, gateway y presentación de Atrio. No se cambiaron ajustes productivos ni se crearon cuentas o sesiones reales.

La [matriz de navegador](all-skin-entry-presentation-20261031.json) registra **224 casos correctos** en Chromium/WebKit, a 390 × 844: 112 combinaciones de landing (14 skins × T7/T8 × ambos motores × ambos navegadores) y 112 de Continuar (14 skins × ambos tipos de pase × ON/OFF × ambos navegadores). Se ejecutaron los renderers reales, incluido el bundle generado de la clásica, los cuatro recursos de runtime actuales y los assets locales oficiales; las respuestas de negocio fueron simuladas.

| Código | Nombre | Fondo | Acento | Resultado |
| --- | --- | --- | --- | --- |
| `ganamos_plus` | Ganamos+ | `#121212` | `#f5c518` | 16/16 |
| `jugamos` | Jugamos | `#101010` | `#885fff` | 16/16 |
| `casino_zeus` | Casino Zeus | `#101010` | `#da4167` | 16/16 |
| `bet30` | Bet30 | `#101010` | `#da4167` | 16/16 |
| `gana_en_casa` | Gana En Casa | `#101010` | `#f2ce00` | 16/16 |
| `celu_apuestas` | CeluApuestas | `#101010` | `#da4167` | 16/16 |
| `casino_zeta` | CasinoZeta | `#101010` | `#da4167` | 16/16 |
| `oro_puro` | OroPuro | `#0a0d11` | `#ffd459` | 16/16 |
| `fortu_bet` | FortuBet | `#101010` | `#13a0ff` | 16/16 |
| `gran_poseidon` | Gran Poseidon | `#000032` | `#00aef6` | 16/16 |
| `kona_bet` | Konabet | `#101010` | `#da4167` | 16/16 |
| `mega_faraon` | MegaFaraon | `#101010` | `#f2ce00` | 16/16 |
| `camel_bet` | CamelBet | `#101010` | `#ffb000` | 16/16 |
| `rhino_play` | RhinoPlay | `#101010` | `#e17e01` | 16/16 |

Los colores compartidos entre algunas skins reflejan el catálogo oficial existente; sus logos y nombres son distintos. La prueba verifica imagen decodificada, logo AVIF/WebP correcto, color del fondo/overlay/título, origen elegido y ausencia de desborde. En T8 se selecciona primero otra tarjeta y después la auditada para detectar logos o fuentes `<picture>` que conserven la skin anterior. Ganamos+ mantiene su origen independiente del gateway general Multi Skin.

Con Continuar **ON** aparecen el usuario y la clave de la sesión simulada, logo propio y botón con fondo/acento/texto de esa skin. La página conserva su marca tras tres minutos virtuales sin avanzar ni montar un chat oculto; sólo al pulsar se verifica la misma sesión antes de navegar. Con **OFF** el botón permanece oculto y el acceso sigue automáticamente. El ajuste y los renderers de preparación no necesitaron cambios funcionales por esta auditoría.

Se ejecutaron además 63 pruebas existentes de Multi Skin (marca de las 14, preparación y pase), y 8 de Atrio (avatares de las 14, archivos y dimensiones, ajuste Continuar, acceso de Super Admin y valores por defecto). Los avatares conservan `provider_skin_code` de la conversación; no se usa el asesor ni otra sesión para elegir la marca. Las fuentes oficiales de los assets permanecen registradas en `multi-skin-gateway/docs/validation/skin-brand-sources-20261030.json`.

## Hallazgo y corrección de la fuente de skin

La auditoría reprodujo una divergencia adicional con configuración desfasada: raíz `multiSkinCode:jugamos`, borrador activo T7 `multiSkinCode:bet30`. El HTML publicaba Bet30 y el servidor de ingreso tomaba Jugamos. El mismo desacuerdo podía aparecer en la skin de una tarjeta T8. El arreglo extrae la resolución pública a `effectiveLandingConfig.ts`, compartida por Edge, selección de destino y handlers de ambos motores. No cambia la cuenta compartida, el asesor, el bot ni la gerencia.

La cobertura nueva invoca los handlers completos de ambos motores: las 14 skins, T7/T8, configuración raíz, raíz desfasada, borrador inactivo y ambas vías de contexto autorizado. Verifica la misma cuenta, dispositivo, bot 1045 y gerencia 272 de la fixture, y que API2/pase reciban la skin efectiva aunque la URL o atribución soliciten otra. Comprueba legado de T7, legado por tarjeta de T8, nulos/valores inválidos y rechazo antes de resolver cuenta cuando el proveedor autorizado contradice el efectivo. El handler Edge también se ejercita para las 14 skins con y sin payload persistido y con raíz desfasada.

Resultados focales: **36 pruebas Builder** (incluyen los handlers Builder/clásico y las matrices de todas las skins) y **7 de regresión de start clásico**, correctas. El caso de T8 con proveedor/cardCount raíz desfasado conserva el rechazo del contexto SQL actual: no se inventa una asignación alternativa ni se amplía el alcance a reconstruir tarjetas sólo publicadas. No se requiere migración.

La regresión de Builder incluye el adaptador API2 de los cuatro proveedores: Rey de Ases, Ases del Norte, Ganamos NET y Multi Skin, con plataforma y política de creación comprobadas. Una comprobación aislada adicional del helper en ambos motores cubrió los tres proveedores originales y T7/T8: **12 casos, 60 aserciones correctas**. Conserva proveedor, destino y asesor globales de la raíz aunque la variante activa o el payload publicado indiquen otro; no modifica la configuración de origen. Estos casos complementan los handlers completos de Rey/Multi Skin y la matriz de las catorce skins.

## Publicación y rollback

Publicación coordinada completada el 31/10/2026. Los dos deployments Vercel quedaron `READY` y sus destinos de producción se verificaron contra el commit exacto:

| Componente | Commit / versión publicados | Deployment |
| --- | --- | --- |
| Builder | `5a774474bbe63d675823768eebf321d070176584` | `dpl_8peJxD8Mh3wxJ4p6yb62w5e3P81B` |
| Clásico | `3f9c1bf6877936bef8dff9e30ae6934947d73e7f` | `dpl_GwqCGpkn3jHqvMhVbouxTD16VJra` |
| Edge `builder-config` | v36 `ACTIVE`, `verify_jwt=false` | SHA256 `1ad69cfcfab0b71cbd617a2d0226f0ae3a498fa09eaa7267fb7716ad8cd96e8d` |

El [smoke público posterior](all-skins-source-public-smoke-20261031.json), finalizado a las `18:28:36Z`, pasó **6/6 GET de HTML**: Bet30 (`multi_skin`/`bet30`), Ganamos+ (`multi_skin`/`ganamos_plus`) y Diana (`ganamos_net`, sin skin Multi) respondieron 200 con la misma selección en ambos motores. No ejecutó JavaScript, cuentas, sesiones, conversiones ni solicitudes de negocio; no representa un E2E productivo de las catorce skins.

Rollback: promover Builder `40ff15b`, deployment `dpl_DYdbWnk2TE1pzaj1CuFmZUJ4r5vm`, y clásico `764859c`, deployment `dpl_3niLScEURXMcW4fiFJ9Pi6H47QEG`; volver a publicar el código de Edge v35, SHA256 `a2915618579bee903f8872090fded5cb6f9b7dc889af18b223e1e7e40dffe22d`, conservando `verify_jwt=false`. v36 incluye los cinco archivos de v35 más `_shared/effective-landing-config.ts`. No hay migración para revertir.

Sin cambios de runtime, assets, configuración productiva o API2. Las pruebas visuales son de escritorio con viewport móvil y servicios simulados: no certifican las aplicaciones nativas de iPhone ni un alta real en las catorce skins.
