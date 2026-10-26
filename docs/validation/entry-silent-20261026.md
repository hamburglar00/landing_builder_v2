# Espera sin aviso de redirección — 26/10/2026

Se elimina «Vas a ingresar automáticamente.» sin reemplazarlo por otro aviso.
Durante la espera configurada, el estado queda vacío. Conserva el espacio del
estado para evitar saltos de posición. La duración, el adelanto con Continuar,
la autenticación única y el feedback del ingreso efectivo siguen igual.

La fuente común es `landing-autologuin/src/lib/preparation-page.ts` y se
sincroniza con los otros tres gateways. La pantalla compartida atiende ambos
motores. No cambia el código del constructor, clásico o Atrio ni requiere DB.

Pasaron las 56 pruebas existentes de preparación (14 por gateway), incluidas
espera de 4 y 60 segundos, adelanto con Continuar y autenticación única. Las
sincronizaciones de transición, renderer clásico, SDK y movimiento siguen
correctas. La revisión local de 80 estados con las marcas reales no detectó
desbordes, botones recortados ni avisos de redirección; las 16 vistas de cuenta
quedan sin ese texto. Capturas en `.vercel/validation-entry-silent-20261026/`.

## Publicación confirmada

| Gateway | Commit | Despliegue Vercel activo |
| --- | --- | --- |
| Rey de Ases | `d060b10` | `dpl_CUJVFgzEoZ1RhKfbZnBgugAxpMZf` |
| Ganamos NET | `dfab59b` | `dpl_4bNMx7HtRjkd1hovbgVgCvnwyrS3` |
| Ases del Norte | `51ae903` | `dpl_9dWoSAHiu782HVXp3qhqCYvSpsUT` |
| Ganamos+ | `8b84a9f` | `dpl_278fJtDA857BkWDXjn79UxP5UUBi` |

Ganamos+ también está publicado en Cloudflare, versión
`5a196d9d-770f-43b4-98b7-d24d385d26fc`, con sus variables conservadas.

Los builds terminaron correctamente y los alias públicos apuntan a las nuevas
versiones. El chequeo de los cuatro dominios confirmó que la preparación de
ambos motores contiene el estado vacío y no incluye el aviso eliminado ni
cuenta regresiva. No se activaron tickets ni se crearon cuentas o transacciones.
Evidencia: [chequeo público](entry-silent-public-20261026.json).

Versiones anteriores para rollback: Rey
`dpl_7VRvMMrTXUW9Kcf3MiFcT6hWa6hx`, NET
`dpl_E9xAogSQwDpYZ7f3fba6g8USngVX`, Ases
`dpl_Bxi7vod3eoFvFWWErT6tcXSVVydi` y Ganamos+
`dpl_9KvV2SGF2LHeCAbdANpgVw5jr22p`. Worker anterior:
`a208f50f-8c29-492e-b9fa-7d432f193b81`.
