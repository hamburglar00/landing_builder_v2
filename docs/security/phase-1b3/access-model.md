# Modelo propuesto y trabajo pendiente de Fase 1B.3

Este documento conserva la propuesta del diagnóstico inicial. El usuario autorizó posteriormente la excepción de los dos EXECUTE; consultar `implementation.md` para los cambios efectivamente realizados y los resultados. Las propuestas sobre otros RPC no forman parte de la implementación autorizada.

## Identidad y propiedad

La identidad efectiva de un cliente será el usuario verificado por Auth en servidor o `auth.uid()` bajo el JWT validado de Data API. Un `user_id` recibido del navegador no otorga permisos. Los handlers rechazarán una identidad ajena antes de cualquier escritura; no la reinterpretarán como usuario efectivo.

El administrador se acreditará consultando `profiles.role` para el usuario verificado. La migración 269 impide a `authenticated` cambiar ese campo. La creación administrativa existente utiliza aprobación backend y `raw_app_meta_data`; no se aceptará `user_metadata` editable, un prop React o una clave pública como prueba de rol.

La cadena de propiedad que deberá comprobarse es `gerencia_phones.gerencia_id → gerencias.id → gerencias.user_id`. La política debe referenciar explícitamente la fila externa de `gerencia_phones`. Para un administrador, seleccionar otro propietario sólo será válido después de verificar ese rol en el servidor que realiza la operación, incluida la base cuando se accede por Data API.

## Separación de accesos

| Flujo | Entrada actual | Autorización propuesta | Comportamiento que se conserva |
| --- | --- | --- | --- |
| Lectura y CRUD del cliente | Data API desde `TelefonosPageContent.tsx`; helpers de gerencias | JWT válido, RLS por propiedad y comprobación de la fila nueva | Listado, alta manual, edición, eliminación y límites existentes |
| Acceso administrativo | Misma pantalla con `isAdmin`; páginas de gerencias | Rol protegido comprobado en servidor; target ajeno sólo después del rol | Gestión de teléfonos de cualquier cliente |
| Sincronizar y reiniciar contadores/mensajes | Tres Edge Functions reciben `user_id` y `gerencia_id` opcional | Verificar sesión y rol; derivar cliente o validar target del administrador antes de usar `service_role` | Mismos efectos, campos de respuesta y opciones de gerencia |
| Asignación pública | Edge `landing-phone`, scripts de landing y helper público | Backend resuelve propietario desde landing/nombre; grants mínimos para las operaciones backend | Mismos teléfonos/resultados, errores, caché y modos |
| Caché pública desde Next.js | `getCachedLandingPhone.ts` llama al RPC con clave pública | Acceso exclusivamente servidor, sin entregar credencial al HTML | TTL, tags, payload inicial y fallback actuales |
| Click y reservas | Edge `phone-click` recibe landing y teléfono, no `user_id` | Mantener comprobación de asociación y funciones backend necesarias | Contrato de click, extensión y confirmación de reservas |
| Métricas y disponibilidad | Data API owner/admin y RPC `get_gerencia_availability_summaries` | Mantener lectura propia/admin y su comprobación de `auth.uid()`/rol | Datos operativos y filtros actuales |
| Procesos programados/backend | Jobs y funciones con privilegios de servidor | Conservar ejecución backend; cerrar las dos entradas públicas sólo con la excepción solicitada | Horarios, cuerpos, configuración y algoritmos sin cambios |

`get_gerencia_availability_summaries` ya verifica `auth.uid()` y exige rol admin cuando `p_user_id` es ajeno o nulo. No se debe tratar todo parámetro `user_id` como una vulnerabilidad ni reemplazar comprobaciones correctas sin necesidad.

## Políticas, grants e inmutabilidad previstos

Reemplazar la lectura global y la expresión de propiedad incorrecta por políticas explícitas de SELECT, INSERT, UPDATE y DELETE para `authenticated`. SELECT y DELETE usarán `USING`; INSERT usará `WITH CHECK`; UPDATE usará ambos. Comprobar propietario o rol admin con la fuente protegida, sin confiar en filtros del frontend. Revocar a `anon` las operaciones administrativas relevantes y comprobar los grants efectivos además de RLS.

Proteger la propiedad tanto al actualizar `gerencias.user_id` como al intentar cambiar `gerencia_phones.gerencia_id`. El upsert legítimo actual incluye `gerencia_id` en las columnas y en la clave de conflicto: revocar UPDATE de esa columna sin más podría romperlo incluso cuando no cambia. La implementación deberá permitir repetir el mismo valor y rechazar una reasignación real de forma atómica. Una comprobación de inmutabilidad con privilegios del invocante es una opción a verificar; no se propone agregar `SECURITY DEFINER`.

No se alterarán los identificadores externos de gerencias, su generación, la moneda, criterios, pesos, modos, normalización, reservas, intervalos, prioridades, estados ni canales. Las funciones privadas existentes de reservas y confirmación son dependencias de regresión, no objetivos de reescritura.

El acceso público legítimo no equivale a permiso de consultar o administrar arbitrariamente todas las filas de teléfonos. Mantener `landing-phone` y el backend acreditado como límite público; inventariar y cerrar acceso directo innecesario a RPC sin cambiar sus algoritmos. Conservar sólo los permisos backend demostrados por consumidores y pruebas. No se declara resuelto ningún permiso o hallazgo excluido, incluido TRUNCATE.

## Archivos previstos, aún sin modificar

| Archivo o conjunto | Trabajo previsto tras resolver el bloqueo |
| --- | --- |
| Nueva `supabase/migrations/<timestamp>_protect_phone_administration.sql` (271) | Crear con CLI después de consultar `--help`; RLS, permisos administrativos y protección de propiedad; excepción de dos EXECUTE sólo si se autoriza |
| `supabase/bootstrap/incremental-manifest.json` | Incorporar únicamente la nueva migración al manifiesto; preservar bytes de las 270 anteriores |
| `supabase/functions/sync-phones/index.ts` | Verificar identidad y autorización del camino interactivo antes del acceso backend; conservar sincronización y camino programado |
| `supabase/functions/reset-phone-counters/index.ts` | Verificar sesión/rol/propiedad antes de reiniciar |
| `supabase/functions/reset-phone-messages/index.ts` | Misma barrera antes del reinicio de mensajes |
| Nuevo helper en `supabase/functions/_shared/` | Compartir verificación de sesión, rol y selección autorizada de propietario, si evita duplicación sin ampliar la superficie pública |
| `frontend/components/telefonos/TelefonosPageContent.tsx` | Enviar JWT de sesión a operaciones administrativas; conservar UX y operaciones propias; no cambiar el toggle de reinicio diario |
| `frontend/app/(panel)/admin/tests/page.tsx` | Corregir sólo autenticación del test de sincronización de teléfonos; conservar intacta revalidación |
| `frontend/lib/gerencias/gerenciasDb.ts` | Revisar selección de propietario y compatibilidad de upserts; sólo adaptar lo necesario para el contrato autorizado |
| `frontend/components/public-landing/getCachedLandingPhone.ts` | Acreditar y usar acceso servidor si se retira el grant público del RPC de caché; no serializar credenciales |
| Tests de SQL/Data API/Edge/frontend y runner local de seguridad | Agregar fixtures sintéticos aislados y regresión; inventario final determinado por la implementación efectiva |
| `docs/security/phase-1b3/` | Registrar decisiones, implementación, resultados reales, hashes e inventario exacto |

Las páginas wrapper admin/dashboard de teléfonos, el HTML público, los consumidores de conversiones y canales se inventarían para comprobar compatibilidad; no se propone modificarlos. No hay rutas administrativas Next.js de teléfonos que deban migrarse desde una implementación existente.

## Pruebas necesarias

Todas están pendientes; detenerse ante el primer fallo sin ampliar el alcance:

1. Cliente A lista sólo propios y crea, edita y elimina uno propio; cliente B no puede leerlo, modificarlo, eliminarlo o crear para A.
2. Falsificar propietario en URL, body, filtros de Data API o cambio de `gerencia_id` no cambia la identidad efectiva. Payload mixto con cambios válidos y propietario ajeno falla sin cambios parciales; el upsert propio con la misma propiedad sigue funcionando.
3. `anon` no administra teléfonos; administrador con rol protegido gestiona distintos clientes; modificar metadatos del usuario no concede ese rol. Verificar rechazo antes de las primeras escrituras backend.
4. SQL/pgTAP y Data API verifican políticas y grants reales, incluidos los dos EXECUTE bloqueantes si se autoriza su cierre. Conservar únicamente acceso backend acreditado, sin probar mediante tráfico externo real.
5. Regresión de `landing-phone`, caché de constructor, Chatrace y `phone-click` con fixtures sintéticos: mismo resultado y contrato para ausencia, bloqueo de plan, sin asignaciones, sin teléfonos, warmup y modos existentes. No cambiar los canales para realizar estas pruebas.
6. Concurrencia real de reservas, extensión y confirmación en PostgreSQL local; locks, vencimientos y resultados iguales a los acreditados. No presentar mocks como prueba de concurrencia.
7. Reconstrucción completa 271/271, suites históricas relevantes y afectadas, Edge/Next, frontend, TypeScript, build y ESLint. Inspección de assets cliente exclusivamente con credenciales sintéticas identificables, separando artefactos servidor.
8. Auditoría final de secretos, datos personales, rutas, alcance e integridad; migraciones históricas intactas, inventario exacto y `git diff --check`.

## Rollout y rollback propuestos

No hay despliegue autorizado. Tras resolver el bloqueo, construir y validar exclusivamente en el entorno local sintético. La CLI se consultará con `--help` antes de crear la migración; no se tocarán servicios, datos ni secretos productivos para preparar pruebas.

Para un despliegue futuro y separado, coordinar el cierre de grants con los consumidores: primero acreditar el acceso backend de caché y los clientes que envían sesión; después habilitar la autorización de los handlers y aplicar la migración según el procedimiento ensayado localmente. Evitar dejar el frontend llamando como anónimo a una operación que ya exige sesión. Registrar una ventana de mantenimiento si no puede asegurarse la compatibilidad durante esa transición. Los grants de los dos jobs conservarían su ejecución como `postgres`; no reprogramar ni disparar jobs.

No hay cambios que revertir ahora salvo estos documentos locales. Una vez implementado, el rollback deberá partir de políticas/grants capturados y ensayarse localmente; preservar datos, algoritmos y las 270 migraciones históricas. No recomendar restaurar acceso público inseguro como recuperación ordinaria: ante una regresión, suspender temporalmente la administración afectada mientras se corrige, preservando la asignación pública acreditada. Cualquier excepción futura requiere una decisión separada; este documento no autoriza escrituras remotas.
