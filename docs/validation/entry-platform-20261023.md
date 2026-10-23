# Transiciones de acceso — 23/10/2026

Se conserva la espera configurada en Atrio, de hasta 60 segundos, pero su UI no
muestra una cuenta regresiva. El aviso es «Vas a ingresar automáticamente.».
El temporizador utiliza el tiempo restante completo y Continuar puede adelantar
el ingreso sin repetir autenticación. La confirmación de sesión sigue siendo
obligatoria.

Las etapas usan «Ingresando a la plataforma», «Continuar a la plataforma» y
«Tu sesión en la plataforma está lista». La creación de cuenta y la conexión
con el asesor conservan sus etapas reales. El texto secundario se simplifica;
las descripciones y errores mantienen un mínimo de 12 px, con saltos de línea
centrados y equilibrados. El CTA se adapta al ancho de pantalla. Se preservan
los logos grandes y los colores de cada marca.

Fuentes comunes: `preparation-page.ts`, `transition-layout.ts` y
`gateway-entry-transition.ts` de Rey. `sync-entry-transition.mjs` incluye ahora
también el layout. Se sincronizan los cuatro gateways y el módulo público del
constructor. El renderer generado del clásico se actualiza desde Builder.

Validación realizada:

- 72 pruebas unitarias existentes de preparación y conexión entre los cuatro
  gateways: espera de 4 y 60 segundos, adelanto, autenticación única, fallo y
  recuperación, origen del iframe y datos de carga reales.
- 40 casos de ingreso y movimiento del widget en Chromium/WebKit, incluidos
  ambos motores; 32 de SDK y notificaciones pospuestos y cuatro de hidratación.
- Revisión visual de 80 estados con renderers, temas y logos reales, usando
  respuestas locales: 320×568, 390×844, 844×390 y 1366×768. Creación, tarjeta
  de usuario, creación sobre la landing, conexión y error de conexión. Sin
  scroll horizontal, botones recortados, párrafos menores a 12 px ni contador.
  Capturas y métricas en `.vercel/validation-entry-platform/`.

Las pruebas no crean jugadores, mensajes ni operaciones financieras productivas.
Ganamos+ se valida en presentación y protocolo; su alta PBAdmin sigue pendiente
de integración propia.

Además pasaron seis pruebas del renderer clásico. Los seis builds de Vercel y
el build OpenNext terminaron correctamente. La revisión visual usa charset UTF-8,
igual que las páginas productivas, incluidos los textos con acentos del runtime.

## Publicación confirmada

| Proyecto | Commit | Despliegue activo |
| --- | --- | --- |
| Constructor | `0a128ac` | `dpl_4kpvJAYjBpryb96ThjSSjWTSjnU6` |
| Clásico | `ff87462` | `dpl_BK2aCxM8t729ZGqthc4q9KKGoqme` |
| Rey de Ases | `f9442aa` | `dpl_7VRvMMrTXUW9Kcf3MiFcT6hWa6hx` |
| Ganamos NET | `f18b546` | `dpl_E9xAogSQwDpYZ7f3fba6g8USngVX` |
| Ases del Norte | `b80a8c8` | `dpl_Bxi7vod3eoFvFWWErT6tcXSVVydi` |
| Ganamos+ | `22dff78` | `dpl_9KvV2SGF2LHeCAbdANpgVw5jr22p` |

Ganamos+ está publicado también en el Worker de `ganamosnet.global`, versión
`a208f50f-8c29-492e-b9fa-7d432f193b81`, conservando configuración y secretos.

Se verificaron los alias de los dominios públicos. Los cuatro gateways sirven
el JS/CSS correspondiente, las dos variantes de preparación usan plataforma y
el aviso fijo, y la consulta de credenciales sigue exigiendo sesión. Las ocho
landings demo (cuatro marcas × dos motores) respondieron 200 con la transición
actualizada. No se activaron tickets de acceso ni se crearon cuentas.

Evidencia: [gateways públicos](entry-platform-gateways-20261023.json) y
[landings públicas](entry-platform-landings-20261023.json).

Rollback: los despliegues previos son Constructor
`dpl_65s1fVCrbqk7DeRc4jhXVSF3k9FS`, Clásico
`dpl_BEGwPeJfLquAy9i1Kqi3GXGM5Cgz`, Rey
`dpl_mpTx7ftkSuN2JSNYR86KBt5bQMfu`, NET
`dpl_HFna8z4okVQtAe3cFLeT3XH2xXGS`, Ases
`dpl_3fwiHwkxiQbdacKM3EVGZ68ZpH8Q` y Ganamos+
`dpl_5Ev3spe9pujtSrQjEBUtgcDUHM6r`. Worker anterior:
`f0c95eb7-61c7-49c0-93f7-e985e33b3d34`. Este lote no requiere migraciones.
