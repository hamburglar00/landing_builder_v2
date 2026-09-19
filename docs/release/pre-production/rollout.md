# Rollout coordinado — plan no ejecutado

No está autorizado aplicar este plan en esta auditoría. El objetivo de código es 6287c9ae; la documentación posterior no añade cambios productivos. Resolver B1–B5 de [README](README.md) antes de iniciar.

## Orden exacto

1. **Preparación y configuración.** Revalidar origin/main, alias Vercel, 268 versiones remotas, hashes/ACL/owners y protección de esquemas. Configurar REVALIDATION_ENV=production sólo en Vercel Production; mantener claves servidor privadas ya existentes. No modificar Preview/staging. Preparar candidato bajo Node 24 y un artefacto de reversión desde ad436ff1 con la configuración segura. Mantener el deployment previo identificado. No promover aún ni hacer push a main que dispare publicación automática.
2. **Ventana del panel.** Acordar suspensión de edición/publicación y administración de teléfonos, cerrar pestañas antiguas y exigir recarga posterior. Landings públicas, recepción y colas deben seguir operando; no prometer cero interrupción de DB por locks. Evitar un canary que mezcle versiones incompatibles. Si se exige cero interrupción del panel, hace falta otro release puente autorizado: no se implementó aquí.
3. **Supabase: 269 → 270 → 271 → 272 → 273 → 274.** Aplicar exclusivamente esos archivos con ledger y transacciones controladas. Validar cada paso según [migration-plan.md](migration-plan.md). Si falla uno, detener los siguientes y no promover frontend. No ejecutar la compatibilidad del bootstrap en remoto.
4. **Edge Functions administrativas.** Desplegar sólo sync-phones, reset-phone-counters y reset-phone-messages con _shared/phone-administration.ts incluido. Conservar verify_jwt respectivamente false, false, true; no aplicar un --no-verify-jwt global. Capturar versión/bundle de cada nuevo deployment y comprobar su auth. La rama cron de sync sigue aceptando sólo su secreto servidor acreditado; SERVICE_ROLE_KEY sigue presente. No desplegar todas las funciones ni modificar cron_config.
5. **Vercel.** Promover el artefacto de producción del candidato desde frontend, Node 24, con las variables de Production. Confirmar los dos dominios y el commit efectivo. No usar un Preview con REVALIDATION_ENV falsificada: el catálogo lo rechaza y su secreto servidor está ausente intencionalmente.
6. **Verificación y reapertura.** Ejecutar [smoke-tests.md](smoke-tests.md), registrar resultados sin valores personales/secretos y reabrir el panel sólo si pasan. Observar al menos dos ciclos de sync y worker; verificar el reset diario por metadatos y en su siguiente horario natural, sin dispararlo manualmente. Coordinar por separado la rotación con el clásico tras cerrar acceso viejo y registrar cualquier aceptación temporal del riesgo.

Antes de usar comandos de CLI, consultar su --help instalado y verificar objetivo/proyecto. No se proporciona un comando que mezcle configuración, aplicación de SQL y despliegue sin puntos de control.

## Coexistencia por etapa

| Combinación | Resultado acreditado/esperado |
| --- | --- |
| 269 + frontend/Edge viejos legítimos | Compatible para nombre y creación de perfiles; escrituras prohibidas dejan de funcionar intencionalmente. |
| 270 + frontend/receptor constructor viejos | Incompatible: lectura del secreto y verify_revalidate_secret revocados. Mantener cerrada la operación administrativa. |
| Frontend nuevo + DB menor que 274 | Inbox falla por RPC inexistente; no promover. |
| Frontend nuevo + handlers antiguos de teléfonos | Los botones normales omiten user_id; el handler viejo devuelve 400. |
| Frontend antiguo + handlers nuevos | Bearer público/ausente no es sesión; devuelve 401/403. |
| 271–273 + asignación pública/cron acreditados | Contratos preservados localmente. Postgres mantiene ejecución; no tocar los handlers públicos. |
| 274 + lector Inbox previo | Compatible; SQL optimizado conserva firma y respuesta anteriores. |
| Seis migraciones + tres handlers + candidato + configuración | Combinación validada localmente; falta aceptación en plataforma desplegada. |

Las funciones públicas sin cambios incluyen landing-phone, phone-click, builder-config, conversions y los workers de WhatsApp. Sus versiones actuales están en baseline. Las rutas del nuevo backend no aceptan URL/secret del cliente; url_base sólo permanece como enlace público. Todos los destinos que portan credencial salen del catálogo cerrado, con redirects rechazados.

El secreto existente no debe copiarse a variables públicas ni a los documentos. Los tests clásicos servidor-servidor esperan POST {name, secret}, HTTP 200 y revalidated/warmedConfig/warmedPage/warmedPageRetry. El frontend sólo recibe resultados proyectados. No se supone que la configuración de Production de Vercel cambie un deployment ya construido.

La ausencia de errores SQL en cron.job_run_details no acredita éxito HTTP posterior: observar también estado/agregados del receptor y backlog. No consumir, vaciar, reenviar ni alterar colas durante el preflight.

Fuentes de plataforma: [autorización Edge](https://supabase.com/docs/guides/functions/auth), [promoción de deployments](https://vercel.com/docs/deployments/promoting-a-deployment) y [rollback inmutable](https://vercel.com/docs/instant-rollback).
