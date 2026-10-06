# Payload enviado a Meta Conversions API

## Resumen

Los datos que ves en la **tabla** de conversiones son los que se guardan en la BD. Lo que se envía a **Meta** es un subconjunto normalizado y hasheado según los requisitos de la API.

## event_time (timestamp)

- **Meta exige**: Unix timestamp en **segundos** (entero), UTC.
- **Enviamos**: `contact_event_time` / `lead_event_time` / `purchase_event_time` (ej: `1773792243`).
- **Tabla**: La columna `timestamp` muestra `created_at` en hora local (Argentina). La columna `contact_event_time` muestra el valor Unix que se envía a Meta.

El timestamp Unix es siempre UTC; la hora en Argentina es solo para visualización.

## user_data enviado a Meta

| Campo BD / Tabla | Parámetro Meta | Formato |
|------------------|----------------|---------|
| email | em | SHA-256 (lowercase, trim) |
| phone | ph | SHA-256 (solo dígitos, con código país) |
| fn | fn | SHA-256 (lowercase) |
| ln | ln | SHA-256 (lowercase) |
| ct | ct | SHA-256 (lowercase, sin espacios) |
| st | st | SHA-256 (2 letras lowercase) |
| zip | **zp** | SHA-256 (lowercase, sin espacios ni guiones) |
| country | country | SHA-256 (2 letras ISO lowercase) |
| fbp | fbp | Sin hashear |
| fbc | fbc | Sin hashear |
| client_ip | client_ip_address | Sin hashear (IPv4/IPv6) |
| agent_user | client_user_agent | Sin hashear |
| external_id | external_id | SHA-256 |

## Event payload

```json
{
  "event_name": "Contact" | "Lead" | "Purchase",
  "event_time": 1773792243,
  "event_id": "uuid",
  "action_source": "website",
  "event_source_url": "https://...",
  "user_data": { ... },
  "custom_data": { "currency": "ARS", "value": 1234 }
}
```

## Restricciones Meta

- `event_time`: hasta 7 días en el pasado, no futuro.
- Al menos un parámetro en `user_data` con formato correcto.
- `client_user_agent` obligatorio para eventos website.

## Filtro opcional de Purchase por monto

Cada píxel tiene su propio switch y monto mínimo. El monto se expresa en la
moneda configurada para ese píxel y sólo se compara con compras cuya moneda
real coincide. No hay conversión entre monedas. El filtro está apagado por
defecto para píxeles nuevos. La migración de este cambio copia a cada píxel
existente el umbral global previo correspondiente a su moneda.

El control se aplica únicamente antes de la llamada a Meta CAPI y no modifica
el registro, la clasificación, la atribución ni los reportes internos. Aplica a
compras de landing, Chatrace y WhatsApp Cloud API. Las compras de otra moneda
continúan enviándose sin ese umbral.

## Plazo opcional de Repeat Purchase

Cuando están activos Purchase, la clasificación first/repeat y Repeat Purchase,
cada píxel puede limitar el envío de Repeat a Meta a 1–30 días de 24 horas
desde la primera carga del mismo cliente, teléfono y moneda. `NULL` significa
sin límite y es el valor por defecto. Se compara la fecha del evento original,
también durante los reintentos; no se compara la fecha en que corre el retry.

Las filas de `conversions`, sus montos y las métricas internas no se alteran.
Fuera del plazo se guarda el estado `skipped_repeat_purchase_outside_window`.
Para filas históricas sin `purchase_event_time`, se usa `created_at` como
respaldo; si falta también esa fecha, el envío queda en error reintentable.
Sin clasificación, la configuración actual
continúa enviando Purchase estándar sin separar first/repeat.
