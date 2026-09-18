# Fase 1B.5: autenticación de entrada a conversions

**Estado: bloqueada por consumidores y contratos de origen no acreditados. Diseño propuesto, no implementado.** Base: `main`, `2aee0e927df7bd72b255c2d5996d405154ddcc22`. Sólo se agregan los cuatro documentos de este directorio; no hay migración 274 ni cambios en aplicación, configuración o repositorios relacionados.

## Contrato comprobado

`supabase/config.toml:405` declara `verify_jwt = false`. En `supabase/functions/conversions/index.ts:7713`, el handler acepta OPTIONS y POST; exige `name` en la query, crea el cliente con SERVICE_ROLE_KEY y resuelve `profiles.nombre` antes de interpretar el body, sin autenticar al emisor. El nombre identifica un tenant, pero no acredita autorización.

El cuerpo JSON conserva el contrato actual y sus alias: Contact, Lead, Purchase y también CompleteRegistration. Las respuestas funcionales son texto, con éxitos/duplicados 200, diferidos 202 y errores propios del negocio. El código también acepta flags internos de replay; deben quedar reservados al emisor interno autorizado, sin transformarlos en solicitudes legítimas. La validación futura debe preceder tanto al cliente privilegiado normal como al cliente del catch de errores.

## Consumidores encontrados

`consumers.json` contiene 12 recorridos ejecutables identificados en código, dos canales externos documentados sin censo verificable y referencias con líneas y hashes. Existencia en código no equivale a actividad ni versión desplegada acreditada.

El segundo pase recorrió el árbol CURSOR y encontró siete repositorios Git, sin otros checkouts relacionados. Revisó 24 tips distintos de ramas/tags/referencias locales, historial dirigido, manifiestos y nombres de variables extraídos del código, sin abrir archivos de entorno. Los recorridos actuales siguen siendo los mismos; se agregaron antecedentes históricos al inventario, no emisores activos inventados. La actividad productiva de todos permanece incierta hasta confirmar versiones y configuración no sensible.

| Canal | Sesión y autenticación actual hacia conversions | Resultado |
| --- | --- | --- |
| Prueba Contact del panel admin | Dispone de sesión; el fetch directo no la envía | Puede conservar llamada desde navegador con JWT y autorización real de tenant/admin; nunca firma secreta |
| Constructor público y su cola | Navegador → `/api/track` → servidor; upstream sólo Content-Type | Requiere firma en servidor y vincular destino, tenant y acción; no firmar ciegamente `postUrl` |
| Motor clásico y su cola | Mismo recorrido en `landing-prueba-1`; reglas de hosts propias | Debe migrarse coordinadamente; no fue modificado |
| Edge de reintentos | Tres POST sin credencial: Lead diferido, Purchase diferido y backfill de Lead | Emisor interno con firma y permiso exclusivo para sus flags de replay |
| WhatsApp Cloud redirect | Contact servidor a servidor con Bearer SERVICE_ROLE_KEY | El receptor hoy ignora ese header; reemplazo futuro por credencial acotada, sin alterar redirect ni evento |
| Intermediario Kommo | Worker envía Lead/Purchase sin credencial; dos probes opcionales tampoco firman | Hay que acreditar primero la identidad de entrada al webhook y el tenant; no basta con firmar la salida |
| Chatrace | La UI instruye un POST externo directo de Contact con sólo Content-Type | Falta contrato/exportación sanitizada del flujo y mecanismo de autenticación soportado |
| Otros integradores que copiaron la URL | La UI publica expresamente el endpoint para sistemas externos | No existe un registro local completo de emisores activos |

Las landings examinadas ya usan intermediario servidor; no requieren llamada directa del navegador a conversions. El test del panel sí la hace y puede conservarla con sesión. Atrio recibe el redirect después del Contact de la landing: no se encontró un POST a conversions originado por su código. El intermediario Chatrace local consulta landing-phone y devuelve datos; no envía ese Contact por sí mismo. Adelantarlo a ese intermediario cambiaría el momento funcional del envío.

## Nueva evidencia local e histórica

- **Chatrace:** la UI acredita dos solicitudes separadas: preparar datos en el intermediario y enviar Contact desde el botón. Su repositorio e historial local no contienen un emisor a conversions ni una exportación versionada de la automatización activa. Falta el flujo publicado, su manejo de respuestas/reintentos y la capacidad real de autenticar esa segunda solicitud.
- **Kommo:** el commit `f1960b6` exigía `x-kommo-secret`; `207d864` permitió query; `8827b8e` agregó un bypass por mera presencia de `x-amocrm-requestid`; `24d7099` retiró la autorización. Esto acredita la evolución local, no soporte actual del proveedor. Restaurar el bypass no sería autenticación. `TEST_EVENT_ENQUEUED` existió en `a2799df` y fue revertido en `0f15a82`; los otros dos probes siguen condicionados a una variable no consultada. El README los presenta como diagnóstico para un receptor temporal, no como eventos de negocio.
- **Recorrido Kommo:** webhook sin validar origen → parser → cola con `account`, `event`, `conversions_name` → job autenticado → processor → cliente HTTP. El query decide conversions_name; el scope de deduplicación se deriva por separado del receptor del evento. Debe validarse el origen y su correspondencia con el tenant antes de encolar o enriquecer, sin cambiar ese scope ni el payload. El job de reconciliación sólo cuenta faltantes, no recupera ni reenvía eventos.
- **WhatsApp Cloud:** el worker histórico `3d9343e` enviaba Contact por HTTP usando el ID/tiempo del mensaje. `cf87b9b` retiró ese envío; el checkout actual lo origina al primer click del redirect. La introducción de la guía local todavía describe el recorrido anterior. No actualizar automáticamente una versión antigua a la semántica nueva: hay que acreditar cuál está desplegada. La misma guía menciona un bot posterior que envía Lead/Purchase, sin identificar su implementación; queda dentro del canal externo C14.
- **Despliegue:** los manifiestos de intermediarios sólo indican Next.js; no incluyen versión activa ni cron. Los enlaces locales de Vercel del constructor raíz/frontend apuntan al mismo proyecto, pero no acreditan su despliegue activo ni Root Directory. `origin/*` son referencias locales sin fetch, no certificados de producción. El historial inicial del clásico ya usa `/api/track`.

## Por qué no se implementa

1. **Chatrace y emisores externos:** la plantilla/automatización activa, sus capacidades de firma, headers, respuestas y reintentos no están acreditados por código local. Hay instrucciones para enviar directamente, pero no prueba de que esos emisores puedan cumplir el nuevo protocolo. Tampoco está identificado el emisor activo de CompleteRegistration, si existe.
2. **Kommo:** el webhook acepta `name` por query y encola sin verificar firma o credencial de origen. `KOMMO_WEBHOOK_SECRET` se declara/exige como configuración, pero no se comprueba en esa ruta; su README lo indica como validación estricta a reactivar. Firmar únicamente la salida convertiría tráfico no verificado en tráfico firmado.
3. **Proxies públicos y colas:** el navegador proporciona `postUrl` y payload; se verifica el hostname, no una vinculación completa con tenant, ruta y acción. Las colas reenvían `post_url`. Deben acreditarse los destinos legítimos y proteger la decisión de firma, conservando los cuerpos y los contratos existentes.
4. **Coordinación:** el clásico y Kommo están en otros repositorios. Sus checkouts se inspeccionaron en lectura; no se acredita que representen las versiones desplegadas ni que todos los emisores puedan cambiar coordinadamente. No corresponde cortar los consumidores conocidos activando JWT globalmente.

La puerta exigía todos los consumidores activos acreditados, un mecanismo para cada uno y validación local completa. Esas condiciones no se cumplen. El bloqueo proviene de esa condición del pedido; no es un fallo de suites ni falta de valores secretos.

## Propuesta y decisiones pendientes

`threat-model.md` define sesión verificada para el panel, firma HMAC por emisor para servidores, vinculación de tenant/acción, canonicalización exacta, ventana temporal, nonce atómico, respuestas de autenticación, rollout, rotación, rollback y pruebas. Es una propuesta condicionada, no un contrato ya desplegado ni validado.

Para continuar se necesita un censo confirmado de integraciones/versiones activas, el contrato sanitizado de las acciones externas de Chatrace y otros emisores, una autenticación de origen compatible para Kommo y la coordinación de cambios con el clásico/otros intermediarios. También confirmar el destino lógico de los proxies/colas y el uso de los probes y CompleteRegistration. No se necesitan valores de claves productivas para resolver esas decisiones.

El orden condicionado es: acreditar origen/tenant/destinos y versiones; preparar y probar localmente cada emisor; actualizar de forma coordinada constructor, clásico, Kommo y automatizaciones externas; confirmar cobertura de colas, workers y clientes abiertos; activar el receptor estricto al final. No es todavía un plan ejecutable ni una garantía de recuperación. `threat-model.md` precisa la vinculación firmada y los límites del rollout.

## Cinco datos externos necesarios

1. **Chatrace:** conseguir la exportación o captura sanitizada del flujo publicado y de las dos acciones External Request, incluyendo headers por nombre, body con placeholders, respuestas/reintentos y capacidad de firma o header secreto servidor. Está en el editor de flujos y configuración de acciones de Chatrace. Decide firma directa o adaptador autenticado; asumirlo puede perder o duplicar Contact.
2. **Censo externo:** confirmar qué bots/sistemas llaman conversions, para qué acciones/tenants, incluidos el bot Lead/Purchase de WhatsApp Cloud, CompleteRegistration y los probes Kommo. Consultar responsables de automatizaciones e integraciones, sin exportar eventos ni credenciales. Decide qué emisores deben migrarse; omitir uno provoca rechazos o pérdida de eventos.
3. **Kommo:** conseguir la configuración sanitizada del webhook activo y una prueba documental de qué autenticación puede enviar, junto con la correspondencia cuenta/canal → tenant. Está en la integración/webhook de Kommo y su administración servidor. Decide cómo validar origen y tenant antes de encolar; asumirlo permitiría falsificar eventos entre clientes. Un request ID no sirve como credencial.
4. **Destinos:** confirmar si todos los proxies y colas apuntan exclusivamente a conversions, o si existen destinos alternativos/redirects legítimos y payloads históricos sin landing_id. Obtener un inventario no sensible de rutas, campos presentes y cantidades del responsable de configuración/colas. Decide el catálogo y la validación sin transformar filas; asumirlo puede filtrar firmas o rechazar backlog legítimo.
5. **Versiones:** obtener proyecto/dominio, Root Directory y SHA desplegado de constructor, clásico e intermediarios; versión de conversions, retries, worker y redirect de WhatsApp; destino de los jobs y mecanismo de actualización de sesiones abiertas. Está en Deployments de Vercel, registros de despliegue de Edge y definición sanitizada de Scheduler. Decide la coordinación exacta; asumirlo puede cortar un emisor viejo o cambiar cuándo se genera Contact.

## Validaciones y límites

Se ejecutaron búsquedas estáticas, trazado de llamadas, comprobación de referencias/hashes, auditoría documental y diff. Las suites de autenticación, reconstrucción, frontend, TypeScript, build, ESLint e inspección de bundles **no se ejecutaron**, porque no hay implementación. La matriz pendiente se encuentra en el modelo de amenazas; ningún test previsto se declara aprobado.

HEAD permanece igual, el índice está vacío y no hay conflictos. Sólo quedan cuatro documentos nuevos sin commit. Las 273 migraciones y toda la lógica de negocio permanecen intactas. `.env` sigue presente, ignorado y fuera de Git; no se leyó su contenido. Docker no se volvió a consultar en este pase documental; la observación anterior fue cero recursos propios y no se ejecutaron runners. No hubo solicitudes productivas, escrituras remotas, deploy, push, rotación ni cambios en repositorios hermanos. `review.json` registra el inventario y la evidencia de estas comprobaciones.

Se utilizó la skill oficial `supabase:supabase` para la revisión. La documentación oficial consultada está citada en `threat-model.md`; no se usaron herramientas de datos del proyecto remoto.
