# Clave en la respuesta privada del autologin — 27/10/2026

La pantalla de cuenta creada reutiliza usuario y clave del JSON de `/start`, después de autenticar al proveedor y crear la sesión. Se elimina una petición de entrada a `/api/session/credentials`, sin añadir consultas de DB. No se midió una reducción de segundos en producción.

El módulo compartido `gateway-entry-response.ts` limita la clave a una petición JSON del mismo origen, comprobado mediante Fetch Metadata u Origin. Respuestas privadas sin caché, sin permiso CORS, con `nosniff`. Una navegación HTML, un origen ajeno, un error de login/persistencia o la recuperación de una sesión sin credenciales no entrega la clave. La pantalla valida el usuario antes de mostrarla mediante `textContent`; no la guarda en storage, URL ni tracking. El token de recuperación cifrado existente se conserva.

Se mantienen la confirmación de cookie, Continuar y la espera configurable. Una respuesta antigua o sin clave muestra «Disponible en Mi perfil» y permite continuar sin otra consulta. El endpoint de credenciales se conserva para Mi perfil y páginas antiguas.

## Validación

- Vitest sobre preactivación, presentación, privacidad, espera y recuperación: Rey 55 pruebas, Ases 45, NET 45 y Ganamos+ 46. Los adaptadores del proveedor y la persistencia usan fixtures; no se iniciaron operaciones reales.
- TypeScript correcto en los cuatro repositorios.
- `node scripts/check-gateway-entry-ux.mjs`: 40 escenarios Chromium/WebKit, incluidos los 16 recorridos de ambos motores por gateway. Una sola autenticación, confirmación de cookie conservada, clave disponible, Continuar y doble clic; el harness rechaza una petición adicional de credenciales. Incluye regresiones de movimiento/paleta existentes.
- Petición real a un servidor HTTP local desde Chromium/WebKit: ambos envían `Accept: application/json`, `Sec-Fetch-Site: same-origin` y `Sec-Fetch-Dest: empty`, también con `no-referrer`.
- Sincronización compartida, guardia de codificación y `git diff --check` correctos. Compilaciones Vercel y OpenNext correctas.
- La verificación pública lee únicamente el HTML de `/prepare`, sin ejecutarlo, consumir pases, crear cuentas ni generar conversiones. Comprueba ambos motores, ausencia de la consulta extra, respuesta reutilizada y confirmación de cookie. No certifica un alta real en producción ni el navegador de un iPhone físico.

Ganamos+ conserva la ausencia de integración PBAdmin para altas; se valida el protocolo de ingreso con fixtures y su publicación en el Worker. API2, Panel3, Atrio y los motores de landing no requieren cambios ni despliegues en este lote. Builder registra documentación y herramientas.

## Publicación

Rama `fix/template7-session-reentry`, cambios comiteados y pusheados:

| Gateway | Commit | Despliegue Vercel | Anterior para rollback |
|---|---|---|---|
| Rey de Ases | `a214d28` | `dpl_4fMtTUuTwWTnkEbD2i8SZJCzAFMc` | `dpl_9eUP5ttRLQvF2wHxnrqXiaM9mNv9` |
| Ases del Norte | `23fdd5a` | `dpl_92PkJ8NxB8uJWfUAd1gynJKGq6jo` | `dpl_C9dXSkhn4WCKGrrKSxP52K5xUnvb` |
| Ganamos NET | `44b8e36` | `dpl_3YZHX8NS5hvmbDZMHY5Lx35pj8NS` | `dpl_8JDDJsxLfMZWi5fEX2uDpKfLDUMr` |
| Ganamos+ | `902f04e` | `dpl_AFv2S9MHX27tLLw7bL6y1J88ZH29` | `dpl_7g9MydxWEohCMfXKv1rfSQtoth7N` |

Worker `multi-skin-gateway` publicado con `--keep-vars`: versión `57b2e5a7-7400-49ba-8024-75c89faac22b`, dominio `ganamosnet.global`. Anterior para rollback: `c88a29b6-e91e-4300-8d1f-a9c74831e03c`.

Los cuatro proyectos Vercel tienen el despliegue indicado como producción activa y READY, con el SHA correspondiente. [Verificación pública](entry-credentials-public-20261027.json): ocho respuestas HTML correctas, ambos motores en cada gateway, sin escrituras de negocio.
