# Fase 1B.5: autenticación de entrada a conversions

**Estado: DIFERIDA voluntariamente por decisión del usuario. Fase diseñada y documentada; implementación no iniciada. No está cerrada técnicamente ni remediada.** Motivo: actualmente no es prioritaria y requiere cambios coordinados en api2 e intermediarios externos. Base documental: `716f920b1c48d41c7ba78bd05582ab668a7fe751`, main. Este checkpoint local incluye únicamente los cuatro documentos de la fase; las 273 migraciones y el código productivo permanecen intactos.

**Riesgo aceptado por el usuario:** conversions continúa aceptando solicitudes externas sin autenticación criptográfica propia. Esta exposición se conserva conscientemente mientras la fase permanezca diferida. Los eventos **no están protegidos por HMAC**; el protocolo descrito es una propuesta sin implementar.

## Contexto operativo confirmado

El usuario confirma el flujo activo landing → teléfono asignado → cajero conectado por QR → api2 → conversions. WhatsApp Cloud API pertenece a landing-builder. Kommo y Chatrace están **inactivos**: sus contratos pendientes se reservan para una futura reactivación, sin concederles credenciales ni excepciones unsigned.

La confirmación identifica el proyecto activo, no la versión exacta desplegada. Durante la acreditación anterior, api2 estaba en `guille_puertas`, HEAD `11045861fb50e626d50f9ad9e31d31fa86036fe7`, con 26 archivos modificados y 504 nuevos preexistentes. PurchaseTrackingService coincidía con su HEAD; varios callers tenían cambios locales anteriores. api2 permaneció sin modificaciones durante esa inspección. Este cierre documental reutiliza aquella evidencia: no vuelve a abrir ni modifica api2.

## Contrato api2

Emisor central: `api2:app/services/purchase_tracking.service.ts`. El destino se obtiene de Manager.ownerId → OwnerSetting.urlPost (`owner_settings.url_post`), no de una variable de entorno. Agrega https si falta protocolo y usa la URL completa: **no agrega el query name** que necesita el receptor. No se consultó el valor configurado.

| Función | Acción y origen | action_event_id |
| --- | --- | --- |
| trackFirstInteraction | LEAD: remitente del canal, promo del texto, manager/agencia y teléfono/canal del cajero; amount 0 | ManagerPurchaseLog.id |
| trackLoad | PURCHASE después de una carga acreditada por ActionService; teléfono de Player, importe y referencias de operación; exige interacción previa | Operation.id pasado por el caller |
| trackPurchaseFromMarketing | PURCHASE desde comprobante procesado por BuilderBot, Callbell/Wazzup o WhatsMiau; importe, nombre, validez y referencias existentes | Nuevo ManagerPurchaseLog.id |
| testPurchasePostUrl | Prueba administrativa: URL recibida por request; LEAD/PURCHASE concurrentes con datos de prueba existentes | 0, más test true |

Las tres rutas de negocio usan postWithRetry: POST Axios sin autenticación explícita, máximo tres intentos, pausas de cinco segundos y reintento de cualquier rechazo de Axios. El body se construye una vez antes del bucle. Cualquier 2xx es éxito; no se interpreta el texto de respuesta.

Axios local 1.10.0 serializa el objeto como JSON y aplica Content-Type application/json y Accept habitual. No se encontraron defaults/interceptors globales en app/start/config. El negocio no establece timeout: el default local es 0, sin timeout Axios; el adaptador permite redirects. La prueba administrativa tiene timeout de diez segundos, un envío por acción y no usa postWithRetry. Se leyó la dependencia, no se ejecutó.

Cuerpo común, sin agregar campos:

```text
action, promo_code, promo_code_prefix, promo_code_suffix, phone, amount,
manager_id, agency_id, player_username, full_name, is_valid_receipt,
action_event_id, bot_phone, transaction_id, coelsa_id, timestamp, dateTime
```

No envía landing_id, landing_name, user_id, event_id, event_time, currency ni purchase_type. player_username recibe el mismo valor que phone. El tenant de conversions proviene de la URL; manager_id/agency_id son IDs de api2, no identidad Supabase ni autorización. La atribución a landing queda en las reglas existentes del receptor.

**No puede afirmarse que preserva event_id/event_time: no los envía.** Dentro de los tres intentos conserva action_event_id, timestamp en milisegundos y dateTime ISO. Otra invocación puede crear nuevas fechas y, en LEAD/marketing, otro log/ID. Agregar event_time para resolverlo cambiaría el JSON y no forma parte del diseño mínimo.

## Comparación con conversions

El receptor mantiene verify_jwt false, resuelve `?name=` contra profiles.nombre y reconoce LEAD/PURCHASE y action_event_id. Purchase usa también transaction_id/coelsa_id. Completa event_time al recibir cada HTTP que no lo traiga. dateTime participa en atribución de Lead, pero no sustituye event_time en ensurePayloadEventTime.

Un 2xx puede significar recibido, diferido (202), duplicado o Purchase no procesado por is_valid_receipt false/null. api2 los considera éxito igualmente. La firma no debe reinterpretar esas respuestas.

No se encontró una cola durable dedicada al reenvío HTTP de PurchaseTrackingService después de agotar sus tres intentos. LEAD crea un log antes del envío y completa el payload tras éxito; marketing guarda el payload antes. Esos registros no acreditan replay automático. No se cambia ni se promete corregir ese comportamiento.

## HMAC y cambios futuros

HMAC es compatible en el transporte servidor sin cambiar el JSON: firmar los mismos bytes enviados, query y audiencia registrados, con timestamp/nonce de autenticación nuevos por intento. Conservar fechas funcionales ausentes o presentes exactamente como hoy. La clave debe ser servidor, acotada por emisor/entorno y owners/tenants autorizados.

url_post es editable por usuarios autorizados; por sí solo no puede autorizar una firma para otro tenant. Resolver el owner desde el manager y contrastarlo con un binding servidor owner → tenant → destino exacto. El test administrativo acepta una URL arbitraria y también necesita resolución autorizada antes de firmar. No seguir redirects con credenciales. Los destinos alternativos legítimos deben acreditarse antes de imponer esa restricción.

El catch actual registra el error Axios completo. Debe sanearse al incorporar headers secretos, sin expandir este trabajo a otros logs.

Archivos previstos, **sin cambios implementados**:

- **api2:** app/services/purchase_tracking.service.ts; helper nuevo de firma y catálogo servidor; tests nuevos de contrato; app/controllers/purchase_settings.controller.ts para vincular el test a un owner autorizado. Revisar start/env.ts si se eligen variables servidor. No cambiar ActionService, OCR, importes, normalización, condiciones, IDs, dedupe ni pausas.
- **landing-builder:** supabase/functions/conversions/index.ts, helpers nuevos de autenticación/replay y futura migración sólo con autorización. Coordinar los emisores internos, panel y proxies ya inventariados antes del corte global.
- **Clásico:** coordinar proxy y retry de landing-prueba-1. Kommo/Chatrace quedan fuera del despliegue activo hasta reactivación acreditada.

## Pruebas y rollout

No se encontraron tests dedicados del POST, serialización, headers o reintentos de PurchaseTrackingService. tests/helpers/bonus_load_action_fixture.ts:98 reemplaza trackLoad por un no-op; no acredita el transporte. El endpoint administrativo realiza solicitudes reales a su destino y no es una suite. No se ejecutaron tests, builds, migraciones, servicios ni endpoints.

Pruebas futuras: cuerpos idénticos de los cuatro recorridos; fechas/IDs estables dentro de retry; firma válida/inválida/ausente/expirada/replay; nonce nuevo por intento; owner/tenant/destino falsificados; redirects; errores sin firma; mismos 200/202/duplicados/recibos inválidos; respuesta perdida sin alterar dedupe.

Orden solicitado: **receptor compatible → api2 firmado → verificación de tráfico → receptor estricto**.

1. Preparar y probar localmente un receptor compatible con JWT/HMAC y una transición explícita para legacy. Firma presente pero inválida nunca cae a unsigned. La transición conserva exposición y no cierra la fase.
2. Actualizar api2 con binding autorizado y JSON idéntico; cubrir también los demás emisores activos. No activar integraciones inactivas.
3. En un futuro despliegue autorizado, verificar cobertura de versiones/emisores con métricas sanitizadas; no reemitir operaciones para probar. Confirmar instancias antiguas, peticiones en vuelo, colas y pestañas del panel. Si hay fallos, detener el rollout: api2 no acredita recuperación automática.
4. Exigir autenticación sólo con cobertura acreditada. No dejar fallback unsigned permanente; después del corte, rollback únicamente a combinaciones autenticadas.

## Pendientes e integridad

El emisor principal dejó de ser desconocido. La decisión actual es diferir la implementación, además de conservar los pendientes técnicos. No hacen falta valores secretos para resolverlos. api2 requiere autorización futura para modificarlo y no se accede a ese repositorio en este checkpoint.

La fase no está lista para activar autenticación estricta. [consumers.json](consumers.json) distingue actividad confirmada por el usuario, código inspeccionado y despliegue no verificado; [threat-model.md](threat-model.md) detalla el protocolo propuesto; [review.json](review.json) contiene estado, inventario y comprobaciones. Los hashes y referencias de fuentes externas pertenecen a la acreditación previa: aquí se verifica su coherencia documental sin reabrir esas fuentes.

La comparación SHA-256 anterior cubrió código/documentación no sensible de api2; los archivos sensibles sólo se controlaron por metadatos, sin abrirlos para hashing. No se presenta ese control como prueba criptográfica byte por byte de todo el repositorio. No se realizó allí ninguna escritura, instalación, ejecución de aplicación, cambio de rama ni operación Git mutante. El checkpoint documental no acredita implementación ni cierre de seguridad.

## Requisitos para retomar y cerrar técnicamente

Se requiere una nueva decisión del usuario para retomar la implementación. Deben cumplirse todos estos requisitos:

1. Definir bindings owner → tenant → destino permitido.
2. Resolver el contrato del test administrativo por URL.
3. Acreditar versiones desplegadas y cobertura de los emisores activos.
4. Implementar el receptor compatible en landing-builder.
5. Autorizar e implementar la firma servidor en api2.
6. Adaptar los intermediarios antes de reactivar Kommo o Chatrace; mientras sigan inactivos, no habilitarles excepciones.
7. Verificar tráfico firmado y cobertura de todos los consumidores activos.
8. Activar el rechazo estricto de solicitudes no autenticadas.
9. Ejecutar pruebas funcionales, replay, retries, rollout y rollback, preparando las validaciones antes de cada transición.
10. Crear el checkpoint final de implementación con evidencia de remediación.
