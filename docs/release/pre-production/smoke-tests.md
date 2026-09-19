# Smoke tests posteriores al despliegue

**Diseñados; no ejecutados en producción durante esta auditoría.** Usar dos tenants de prueba A/B, administrador legítimo, landings de prueba classic/constructor y canal Meta de prueba acreditado. Sus identidades/credenciales no se guardan aquí. Las pruebas que crean/editan datos requieren autorización del despliegue y fixtures controlados; nunca usar contactos/campañas reales para ensayar envíos o Conversiones/CAPI.

## Lista ejecutable de aceptación

| Paso | Acción acotada | Éxito |
| --- | --- | --- |
| 1 | Consultar alias, commit, ledger y versiones Edge; abrir sesión de A y admin. | Candidato correcto, 274 versiones, sesión válida y menú accesible. |
| 2 | Editar nombre de A desde Perfil; con su sesión intentar UPDATE de role, id y created_at sólo sobre su fila sintética. Probar nombre+role juntos y releer. | Nombre permitido; columnas protegidas devuelven 42501/denegación; payload mixto no altera nombre ni rol. |
| 3 | A lista/crea/edita/elimina un teléfono de prueba propio; intentar gerencia/contacto de B y cambio de propietario; repetir como admin autorizado. | A aislado, admin autorizado, reasignación rechazada y atomicidad preservada. |
| 4 | Usar los tres botones/handlers con sesión; repetir con clave pública sin sesión y body/query con propietario de B. | Autorización owner/admin; anon 401/403 y target falso 400/403. No resetear datos reales. |
| 5 | GET autenticado administrativo /api/landings/revalidate; abrir las seis pantallas consumidoras; publicar las dos landings controladas. | Estado booleano y funcionalidad conservada; requests del navegador sólo action/landingId/publishTarget, nunca URL/secret. |
| 6 | Data API: columnas seguras de settings; columna sensible explícita y select=* con anon/authenticated. Intentar escritura sensible y mixta sobre fixture autorizado. | Proyección segura funciona; columna y escritura sensible denegadas; ningún valor secreto en respuestas/logs/errores. No guardar HAR con auth o cuerpos completos. |
| 7 | Cargar landings pública clásica/constructor y editores sin guardar contenido real. | Render, asignación pública y enlaces conservados; sin 42501 inesperados en rutas legítimas. |
| 8 | Abrir Conversiones y Audiencias, filtros ARS/PYG, página inicial/siguiente; seguir un evento sintético autorizado del flujo existente. | Aislamiento y contratos previos; no nuevas denegaciones ni pérdida/duplicación de eventos. 1B.5 sigue sin HMAC; no probar spoofing productivo. |
| 9 | Abrir Inbox ARS/Hoy/Todos/sin búsqueda. Registrar sólo endpoints, status, duración, cantidad de filas y bytes. Repetir PYG. | Una RPC de resúmenes por carga estable; hasta 20 filas, sin arrays de mensajes ni RPC de precarga vieja. |
| 10 | Página siguiente/final; filtros, búsqueda local, gerencia y chat vacío; seleccionar chat con más de 50 mensajes y pedir anteriores. | Orden histórico, empates estables para datos sin cambios, 50 por página de detalle, cursor exclusivo, sin duplicados/saltos ni mezcla A/B. |
| 11 | Marcar leído/no leído; recibir y enviar texto/CTA sintéticos por el canal Meta de prueba; actualizar estado durante carga y refrescar. | Conteos y ventana de atención correctos, CTA intacto, un solo mensaje por ID, sin descargas masivas de otros chats. |
| 12 | Consultar ACL de TRUNCATE/funciones y hashes de jobs; observar dos ciclos y siguiente reset natural. | 42 tablas sin TRUNCATE cliente, cron público revocado, postgres preservado, comandos/horarios/roles idénticos y sin backlog nuevo. |

No ejecutar TRUNCATE ni funciones cron en producción para verificar denegaciones: un fallo de permisos podría disparar efectos. Verificar permisos reales por catálogo y reutilizar las pruebas sintéticas de ejecución/rollback ya acreditadas.

Ejemplos de lectura de metadatos, dentro de una transacción READ ONLY con timeout estricto:

```sql
SELECT has_column_privilege('authenticated','public.profiles','nombre','UPDATE'),
       has_column_privilege('authenticated','public.profiles','role','UPDATE'),
       has_column_privilege('authenticated','public.settings','revalidate_secret','SELECT'),
       has_function_privilege('anon','public.cron_sync_phones_all()','EXECUTE'),
       has_function_privilege('postgres','public.cron_sync_phones_all()','EXECUTE');
-- Esperado: true, false, false, false, true.
```

Para las 42 tablas usar los nombres exactos de deployed-baseline.json/supabase.truncatePreflight.objects y has_table_privilege sobre anon/authenticated, más aclexplode para PUBLIC. No interpretar PUBLIC como un rol de sesión ni buscar una operación HTTP TRUNCATE.

## Umbrales de aceptación

- Cero fuga entre tenants o secretos: detener inmediatamente la reapertura ante una sola.
- Cero 57014 en 20 cargas controladas de listado/detalle repartidas entre monedas/filtros. Cada request debe terminar dentro del límite existente de 8 s de SQL. No aumentar timeout.
- Medir latencia HTTP real separada del SQL; investigar cualquier regresión sostenida. Los 94,5/12,3 ms locales no son un SLA productivo.
- Límites de datos estructurales: 20 resúmenes, 50 mensajes por página y cero detalle antes de selección. Los bytes absolutos varían con los textos; 20.987 es el fixture, no un máximo universal.
- Sin 400 por user_id faltante, RPC inexistente o 42501 inesperado para un consumidor legítimo tras la reapertura.
- Ninguna pérdida de estado, cambio de asignación ni crecimiento anómalo de colas frente al baseline agregado. Jobs exitosos sólo prueban la parte SQL; contrastar HTTP y backlog.

Ante fallo: cerrar la operación administrativa afectada, conservar ingestión y colas, recoger exclusivamente evidencia sanitizada y aplicar [rollback/forward-fix](rollback.md). No reenviar eventos ni restaurar permisos públicos automáticamente.

## Evidencia reutilizada

Fase 0: 446 comprobaciones y contratos de landings/audiencias/concurrencia. 1B.1: 536 únicas y dos reconstrucciones con fingerprints iguales. 1B.2: SQL/Data API, reconstrucción 270, 17 pruebas de revalidación, TypeScript/build/bundle. 1B.3: 185 controles de sus dos reportes, 13 tests de frontend/handlers y regresiones relevantes. 1B.4: 82 y 93 controles; pgTAP está incluido, no sumado dos veces. Inbox: 36 controles SQL/Data API con 10 aserciones pgTAP incluidas, 12 Chromium, 11 frontend, 274/274 y validación técnica final.

No sumar estos totales como pruebas únicas globales: hay regresiones repetidas entre fases. Las suites de alcance no afectado no se repiten en una auditoría documental. Node 24, despliegue Edge real, credenciales/contrato clásico y smoke productivo siguen siendo verificaciones de plataforma pendientes.
