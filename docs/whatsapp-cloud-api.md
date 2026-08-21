# WhatsApp Cloud API

Guia operativa para configurar WhatsApp Cloud API oficial de Meta.

Esta seccion permite usar un numero de WhatsApp Cloud API como punto de entrada de un anuncio Click-to-WhatsApp. Internamente se comporta como una landing porque asigna gerencias, genera promo code y deriva al asesor, pero para el cliente y para Meta es una conexion oficial de WhatsApp Cloud API.

## 1. Que hace este modulo

Flujo esperado:

1. El usuario toca un anuncio Click-to-WhatsApp.
2. WhatsApp abre el numero conectado a Cloud API.
3. Cuando el usuario envia el primer mensaje, Meta manda el webhook completo al constructor.
4. El constructor guarda el payload crudo, incluyendo `referral` y `ctwa_clid` cuando Meta lo envia.
5. El sistema selecciona un telefono usando la misma matriz de gerencias que una landing.
6. Se genera un `promo_code`.
7. Se crea un Contact interno en `conversions` con `source_platform = whatsapp_cloud_api`.
8. El sistema responde por WhatsApp con el mensaje configurado, incluyendo telefono, link y promo.
9. Si el envio de la derivacion fue exitoso, se incrementa el contador del telefono asignado.
10. LEAD y PURCHASE siguen entrando por el endpoint actual de conversiones.

Importante: para este flujo el evento Contact es interno. No se envia Contact CAPI a Meta desde WhatsApp Cloud API.

## 2. Que se necesita antes de configurar

En Meta:

- Una app de Meta para el cliente.
- Un WhatsApp Business Account conectado.
- Un numero oficial agregado a WhatsApp Cloud API.
- `Phone Number ID`.
- `WhatsApp Business Account ID`.
- Access token con permisos para enviar mensajes por WhatsApp Cloud API.
- App Secret para validar la firma del webhook.

En el constructor:

- Cliente creado.
- Gerencias creadas.
- Telefonos activos cargados en cada gerencia.
- Pixel cargado en Integraciones.
- Workspace correcto: ARS o PYG.

## 3. Campos de Identificacion

Se configuran en `WhatsApp Cloud API > Identificacion`.

### Nombre interno

Nombre visible interno de esta configuracion. Se usa tambien como `{{name}}` en el mensaje automatico.

```text
WhatsApp Martin Test
Golden Cajeros Cloud API
```

Puede tener mayusculas, minusculas, numeros y espacios.

### Telefono visible

Numero que vera el usuario o que usa el equipo para reconocer la linea. Es informativo.

Ejemplo:

```text
5491122334455
```

### Phone Number ID

ID tecnico del numero dentro de WhatsApp Cloud API. Lo entrega Meta.

Se usa para enviar mensajes desde:

```text
https://graph.facebook.com/{version}/{phone_number_id}/messages
```

### WhatsApp Business Account ID

ID de la cuenta WABA del cliente. Lo entrega Meta.

### Verify token

Token que se pega en Meta cuando se configura el webhook.

Debe coincidir exactamente con el token que muestra el constructor. El boton de copiar evita errores manuales.

### Meta access token

Token que usa el worker para responderle al usuario por WhatsApp.

Debe tener permisos validos para enviar mensajes desde ese Phone Number ID.

### App Secret / token de la app

Secret de la app de Meta. Se copia desde `Configuracion de la app > Informacion basica`.

Se usa para validar `X-Hub-Signature-256` en los webhooks reales. No es el mismo valor que el Meta access token.

### Version WhatsApp Cloud API

Version de Graph API usada para enviar mensajes por WhatsApp Cloud API.

No es la version de Meta CAPI para eventos de conversion. CAPI se configura desde Integraciones.

## 4. Card Tracking

Esta card mantiene la misma logica visual del editor de landings, pero adaptada a WhatsApp Cloud API.

### Dataset Business Messaging ID

Identificador del dataset de Conversions API for Business Messaging asociado al WABA.

Si la cuenta publicitaria y el dataset/WABA estan en portafolios distintos, no conviene crear un dataset nuevo. Desde el portafolio que es dueno del dataset, compartir o asignar ese dataset al portafolio/cuenta publicitaria que pauta en `Meta Business Settings > Data sources > Datasets > Assign partners/ad accounts`. Luego seleccionar ese dataset en el conjunto de anuncios correspondiente.

Por defecto, `LeadSubmitted` y `Purchase` se envian con el `user_data` minimo documentado para WhatsApp:

```json
{
  "whatsapp_business_account_id": "WABA_ID",
  "ctwa_clid": "CTWA_CLID"
}
```

La opcion `Enriquecer user_data` es opt-in. Si se activa, se agregan solamente los datos disponibles en la fila de `conversions`: telefono, email, nombre, apellido, ciudad, provincia, codigo postal, pais y `external_id`. Esos valores se envian hasheados con SHA-256. No se inventan datos faltantes y `ctwa_clid` nunca se hashea.

### Pixel ID

Se selecciona desde los pixels cargados en Integraciones.

Se usa para guardar trazabilidad en la fila de `conversions` y para que LEAD/PURCHASE posteriores puedan resolver el pixel correcto.

Para WhatsApp Cloud API, aunque el pixel tenga Contact CAPI activo en Integraciones, el Contact no se envia a Meta.

### Contact CAPI omitido

Esta regla es fija en WhatsApp Cloud API:

- Se crea Contact interno.
- No se envia Contact CAPI a Meta.
- La fila queda con `contact_status_capi = skipped_whatsapp_cloud_api_contact`.

### Webhook URL

URL que se pega en Meta para recibir eventos:

```text
https://fdkjkzpjqfbaavylapun.supabase.co/functions/v1/whatsapp-cloud-webhook
```

Meta usa esta URL para:

- Verificar el webhook con `hub.challenge`.
- Enviar mensajes entrantes.
- Enviar estados de mensajes enviados.

### Tag

Prefijo base para generar `promo_code`.

Ejemplo:

```text
gt1
```

El sistema puede generar algo como:

```text
gt1-a1b2c3d4e5f6
```

Usar solo letras y numeros, sin espacios.

## 5. Card Respuesta

Define el mensaje que recibe el usuario cuando escribe al numero conectado.

Tokens disponibles:

```text
{{name}}
{{phone}}
{{promo_code}}
{{wa_link}}
```

Ejemplo:

```text
Hola, gracias por comunicarte con {{name}}.

Para continuar escribile a tu asesor: {{wa_link}}

Tu codigo es: {{promo_code}}
```

Tambien existe un mensaje fallback para cuando no hay telefonos disponibles.

## 6. Card Redireccion

Funciona como la card Redireccion del editor de landings.

Permite configurar:

- Grupos de trabajo.
- Gerencias asignadas.
- Peso por gerencia.
- Modo aleatorio o equitativo.
- Criterio por contador o mensajes recibidos.
- Tipo de telefono: carga, asistente, ads o mkt.
- Intervalos horarios.

La seleccion real del telefono la hace:

```text
get_phone_for_whatsapp_cloud_api(p_config_id)
```

Si la derivacion se envia correctamente por WhatsApp Cloud API, se incrementa:

```text
gerencia_phones.usage_count
```

Esto replica el contador que en una landing aumenta cuando el usuario toca el CTA.

## 7. Como configurar el webhook en Meta

En Meta Developers:

URL oficial:

```text
https://developers.facebook.com/apps
```

1. Crear una app nueva o abrir la app del cliente.
2. En casos de uso, elegir `Conecta con los clientes a traves de WhatsApp`.
3. Ir directo a `Paso 2. Configuracion de produccion` y registrar el numero real del cliente.
4. Copiar el `Phone Number ID` y el `Identificador de la cuenta de WhatsApp Business` del numero real registrado.
5. Generar el identificador de acceso para ese numero/WABA y pegarlo como `Meta access token`.
6. En `Configuracion de la app > Informacion basica`, copiar el `App Secret` y pegarlo como `App Secret / token de la app`.
7. Activar `Suscribirse a webhooks` sobre el numero registrado.
8. Pegar la `Webhook URL` del constructor.
9. Pegar el `Verify token` del constructor.
10. Verificar y guardar.
11. En campos de webhook, suscribirse al campo `messages`.
12. Publicar la app. Si Meta pide politica de privacidad, usar:

```text
https://mkt.panelbotadmin.com/privacy-policy
```

13. Volver al constructor, activar la integracion y guardar.

`Paso 1. Probar` y el numero de prueba de Meta son opcionales. Sirven para validar el sandbox antes de produccion, pero no son necesarios cuando se conecta directamente un numero propio del cliente.

El webhook valida:

- `hub.verify_token` para GET de verificacion.
- `X-Hub-Signature-256` para POST reales.

Para POST reales se usa exclusivamente el App Secret guardado en la configuracion del cliente. Si falta o no coincide, el webhook rechaza el evento.

## 8. Como probar

Prueba minima:

1. Activar la integracion en el constructor.
2. Verificar que haya gerencias y telefonos activos.
3. Enviar un mensaje al numero Cloud API.
4. Confirmar que se cree un registro en `whatsapp_cloud_api_webhook_events`.
5. Confirmar que el worker cree:
   - `whatsapp_cloud_api_contacts`
   - `whatsapp_cloud_api_attribution_sessions`
   - `whatsapp_cloud_api_assignments`
   - `whatsapp_cloud_api_outbound_messages`
6. Confirmar que exista una fila Contact en `conversions`.
7. Confirmar que `source_platform = whatsapp_cloud_api`.
8. Confirmar que `contact_status_capi = skipped_whatsapp_cloud_api_contact`.
9. Confirmar que el usuario reciba el mensaje con link y promo.

Prueba de embudo:

1. Desde el WhatsApp del usuario, tocar el link recibido.
2. Escribir al telefono asignado usando el promo code.
3. Confirmar que el bot envie LEAD/PURCHASE al endpoint actual.
4. Confirmar que LEAD/PURCHASE matcheen con la fila Contact creada por WhatsApp Cloud API.

## 9. Que revisar si falla

### Meta no verifica el webhook

Revisar:

- Verify token copiado correctamente.
- URL sin espacios.
- Config activa.
- Phone Number ID correcto.

### Meta envia POST pero el constructor responde 401

Revisar:

- Secret `META_APP_SECRET`.
- App Secret correcto.
- Header `X-Hub-Signature-256` presente.

### Llega el webhook pero no sale el mensaje

Revisar:

- `whatsapp_cloud_api_webhook_events.last_error`.
- Access token.
- Phone Number ID.
- Version WhatsApp Cloud API.
- Permisos del token.

### Dice que no hay telefono disponible

Revisar:

- Gerencias asignadas en Redireccion.
- Telefonos activos en esas gerencias.
- Tipo de telefono configurado.
- Intervalos horarios.
- Workspace ARS/PYG correcto.

### Se crea Contact pero no aparece Contact CAPI en Meta

Es correcto. Para WhatsApp Cloud API el Contact CAPI se omite por diseno.

## 10. Tablas y funciones tecnicas

Tablas:

- `whatsapp_cloud_api_configs`
- `whatsapp_cloud_api_gerencias`
- `whatsapp_cloud_api_webhook_events`
- `whatsapp_cloud_api_contacts`
- `whatsapp_cloud_api_attribution_sessions`
- `whatsapp_cloud_api_assignments`
- `whatsapp_cloud_api_outbound_messages`

Edge Functions:

- `whatsapp-cloud-webhook`
- `whatsapp-cloud-worker`
- `conversions`

RPC:

- `get_phone_for_whatsapp_cloud_api(p_config_id uuid)`
- `increment_gerencia_phone_usage(p_phone_id bigint)`

## 11. Estado actual

Implementado:

- UI de configuracion.
- Webhook publico.
- Validacion de firma Meta.
- Worker interno.
- Creacion de Contact interno.
- Bypass de Contact CAPI para WhatsApp Cloud API.
- Asignacion de telefono por gerencias.
- Envio de mensaje por WhatsApp Cloud API.
- Auditoria de eventos y mensajes salientes.

Pendiente de validacion real:

- Prueba end-to-end con app Meta real.
- Confirmar formato exacto del payload real de Click-to-WhatsApp en produccion.
- Confirmar matching posterior LEAD/PURCHASE con backend del bot usando promo code.
