# Fase 1B.3: diagnóstico previo de administración de teléfonos

Seguimiento: el usuario autorizó retirar únicamente EXECUTE público sobre las dos funciones de cron identificadas. La implementación local y su estado de verificación se documentan en [implementation.md](implementation.md); el inventario completo se registra en `implementation-review.json`. Los cuatro documentos del diagnóstico describen la base anterior a esos cambios.

Estado al terminar el diagnóstico inicial: **bloqueada antes de implementar**. Base verificada: `main`, commit `d7d57637032b02f93639481d8483b1800ad1bac3`, inicialmente sin cambios, staging ni conflictos. Ese diagnóstico agregó los cuatro documentos enumerados en `review.json`. En ese momento no se había creado la migración 271 ni ejecutado suites, reconstrucciones o llamadas a servicios.

## Bloqueo que requiere una decisión de alcance

La instrucción de no tocar cron entra en conflicto con cerrar dos entradas públicas que permiten iniciar operaciones administrativas sobre teléfonos:

| Función | Evidencia local | Efecto sin autorización del usuario |
| --- | --- | --- |
| `public.cron_sync_phones_all()` | `supabase/migrations/20260305120000_cron_sync_phones.sql:59` | Invoca `sync-phones` con la credencial del proceso backend y selecciona todas las gerencias PBAdmin. La llamada sólo se produce si existe configuración válida. |
| `public.cron_reset_phone_operational_daily()` | `supabase/migrations/20260829013755_reset_scoped_phone_counters.sql:1` | Reinicia contadores y fecha de mensajes de los usuarios con reinicio diario habilitado y todavía pendiente; también actualiza su marcador de reinicio. No limita esos usuarios a la identidad del invocante. |

Ambas son `SECURITY DEFINER`, pertenecen a `postgres`, tienen `search_path=public` y no verifican sesión ni rol. El catálogo conservado en `docs/security/phase-1a/evidence.json`, fechado el 17 de septiembre de 2026, acredita `EXECUTE` para `PUBLIC`, `anon` y `authenticated`. Los cuerpos se contrastaron con las migraciones actuales y sus MD5 históricos; `review.json` registra la integridad. Las migraciones posteriores de las fases 1B.1 y 1B.2 no cierran estas entradas.

Esto es evidencia del repositorio y de su catálogo histórico, no una consulta al estado remoto actual ni una explotación ejecutada. Restringir las políticas de filas o autenticar los tres endpoints interactivos no impide invocar estas funciones con los privilegios de su propietario.

Decisión mínima solicitada: autorizar exclusivamente retirar `EXECUTE` a `PUBLIC`, `anon` y `authenticated` sobre esas dos funciones dentro de la futura migración 271. Conservar cuerpos, horarios, jobs, configuración y credenciales; no ejecutar los jobs. El catálogo acredita que ambos jobs usan `postgres`, por lo que no dependen de los permisos públicos que se propone retirar. Esa continuidad debe comprobarse en el entorno local antes de dar la fase por válida.

La excepción no estaba autorizada al cerrar este diagnóstico y fue autorizada después, limitada a esos dos permisos. No implica autorización para intervenir otros jobs, permisos excluidos o hallazgos. Los resultados de su verificación pertenecen a la implementación posterior.

## Hallazgos acreditados en el código

- La propiedad de un teléfono es indirecta: `gerencia_phones.gerencia_id` → `gerencias.id` → `gerencias.user_id`; `gerencia_phones` no tiene columna `user_id`.
- La política `All users can select gerencia phones` permite a cualquier usuario autenticado leer todas las filas.
- La expresión de `Users manage own gerencia phones` quedó enlazada como `g.id = g.gerencia_id` en el catálogo. No compara la gerencia con la fila externa del teléfono. Si el usuario tiene una gerencia que satisface esa igualdad, la política no restringe las filas externas a ese propietario.
- `sync-phones`, `reset-phone-counters` y `reset-phone-messages` aceptan `user_id` del cuerpo y operan con `service_role` sin verificar la sesión en el handler. El comentario de `sync-phones` que exige JWT no constituye una validación ejecutable.
- `TelefonosPageContent.tsx` envía la clave pública como Bearer a esas operaciones. El test administrativo de sincronización envía `user_id` y `apikey`, sin sesión en Authorization. La clave de aplicación no acredita una identidad administrativa.
- El rol válido procede de `public.profiles.role`, protegido por la migración 269. Los handlers existentes de administración de clientes verifican el usuario y consultan ese rol. El prop visual `isAdmin` y los metadatos editables no son fuentes de autorización.
- El cliente Supabase del navegador usa `NEXT_PUBLIC_SUPABASE_ANON_KEY`. La búsqueda estática no encontró nombres `NEXT_PUBLIC_*` de credenciales privadas en el código de aplicación. No se leyeron archivos de entorno ni se inspeccionó un bundle en esta fase; no se declara aprobada la prueba de bundles.

`consumers.json` conserva el inventario y la procedencia de cada conjunto. `access-model.md` separa los flujos y propone el trabajo posterior sin implementarlo.

## Asignación pública y límites de la conclusión

`landing-phone` deriva el propietario desde el nombre de la landing o del cliente Chatrace y consulta con credenciales backend. Conserva las respuestas de asignación, caché, modos y errores. `phone-click` valida la relación landing/teléfono y usa las funciones de reserva e incremento desde backend. Ninguno necesita aceptar un `user_id` administrativo del navegador.

Existe además un consumidor Next.js servidor: `getCachedLandingPhone.ts`, importado por `app/(public)/l/[slug]/route.ts`, llama actualmente con clave pública a `get_cached_constructor_landing_phone`. Un cierre de acceso directo a los RPC de asignación debe adaptar ese consumidor a acceso exclusivamente servidor manteniendo caché, respuesta y fallback. Es una dependencia técnica identificada, no un cambio funcional aprobado ni ya realizado.

No se encontró en el flujo público inspeccionado una necesidad de cambiar selección, reservas, intervalos, normalización, prioridades, estados o canales. Esta conclusión es estática: las pruebas de equivalencia y concurrencia siguen pendientes. No se modifican las funciones de conversión/confirmación, canales ni cron para demostrarla.

## Documentación oficial revisada

Consulta durante este diagnóstico, sin acceder a proyectos o datos productivos:

- [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security): `USING` filtra filas existentes; `WITH CHECK` controla la fila propuesta. INSERT usa CHECK; DELETE usa USING; UPDATE necesita ambos y lectura compatible.
- [Seguridad de Data API](https://supabase.com/docs/guides/api/securing-your-api): los permisos de objetos y RLS son capas distintas; los RPC necesitan controlar `EXECUTE`, además de lo que haga su cuerpo.
- [Privilegios por columna](https://supabase.com/docs/guides/database/postgres/column-level-security): los permisos amplios de tabla no se restringen con una revocación aislada de columna.
- [Auth en servidor](https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs) y [getUser](https://supabase.com/docs/reference/javascript/auth-getuser): verificar la identidad en servidor, sin confiar en datos de sesión enviados por el navegador.
- [Headers de Edge Functions](https://supabase.com/docs/guides/functions/auth-headers): `apikey` identifica la aplicación; el JWT de usuario y la autorización del recurso cumplen funciones distintas.
- [Changelog: exposición explícita de tablas](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically), 28 de abril de 2026: el cambio de defaults para tablas nuevas no retira los grants existentes. Se deben comprobar los permisos efectivos de las tablas y funciones de este repositorio.
- [Changelog: versiones de extensiones](https://supabase.com/changelog/extension-version-pinning-ignored) y [gateway de self-hosting](https://supabase.com/changelog/48048-self-hosted-supabase-envoy-becomes-the-default-api-gateway-b): revisados como contexto del entorno de pruebas; no se actualizaron dependencias ni el runtime local acreditado.

## Pruebas y estado de ejecución

Durante el diagnóstico inicial no se ejecutó ninguna prueba de Fase 1B.3 ni una reconstrucción 271/271. Las comprobaciones registradas en `review.json` son de diagnóstico e integridad documental, no pruebas de seguridad del comportamiento. Consultar los reportes de implementación para la ejecución posterior.

`review.json` enumera las pruebas solicitadas como pendientes. Los tests existentes `frontend/tests/phase0PhoneHandlers.test.ts`, `landingPhoneNormalization.test.ts`, `whatsappDisplayPhone.test.ts` y el runner `scripts/phase0/run-concurrency.mjs` son puntos de partida para regresión; su presencia o sus resultados anteriores no validan esta fase. Los mocks de handlers tampoco demuestran ejecución real de Edge ni concurrencia de PostgreSQL.

No hubo lecturas de datos reales, escrituras remotas, staging, commit, push o deploy. Las 270 migraciones permanecen intactas y `.env` se comprobó sólo mediante metadatos e información de Git.
