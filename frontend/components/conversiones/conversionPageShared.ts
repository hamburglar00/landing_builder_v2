import type { DateRange } from "@/components/conversiones/DateRangeFilter";

export const ALL_COLUMNS = [
  "phone","email","form_fn","form_ln","form_email","form_phone","fn","ln","ct","st","zip","country","fbp","fbc","from_meta_ads","meta_pixel_id","pixel_id","pixel_attribution_source","pixel_attribution_conversion_id","source_platform","ctwa_clid",
  "contact_event_id","contact_event_time","sendContactPixel","contact_payload_raw","lead_event_id","lead_event_time","lead_payload_raw",
  "purchase_event_id","purchase_event_time","purchase_payload_raw","timestamp","clientIP","agentuser",
  "estado","valor","currency","purchase_type","purchase_capi_route","purchase_capi_route_reason","contact_status_capi","lead_status_capi","registration_status_capi","purchase_status_capi",
  "observaciones","external_id","test_event_code","utm_campaign","telefono_asignado","assigned_gerencia_label","promo_code",
  "lead_bot_phone","lead_player_username","lead_agency_id","lead_gerencia_label","lead_incoming_promo_code","lead_attribution_status","lead_attribution_conversion_id",
  "registration_event_id","registration_event_time","registration_player_username","registration_payload_raw",
  "registration_bot_phone","registration_agency_id","registration_gerencia_label","registration_incoming_promo_code","registration_attribution_status","registration_attribution_conversion_id",
  "purchase_bot_phone","purchase_player_username","purchase_agency_id","purchase_gerencia_label","purchase_incoming_promo_code","purchase_attribution_status","purchase_attribution_conversion_id",
  "device_type","geo_city","geo_region","geo_country","geo_source",
  "cuit_cuil","inferred_sex","sex_source",
] as const;

export type ConversionColumnKey = (typeof ALL_COLUMNS)[number];

export type ConversionTableView = "technical" | "friendly";

export const FRIENDLY_HIDDEN_COLUMNS = new Set<ConversionColumnKey>([
  "zip",
  "form_fn",
  "form_ln",
  "form_email",
  "form_phone",
  "fbc",
  "fbp",
  "meta_pixel_id",
  "ctwa_clid",
  "contact_event_time",
  "contact_payload_raw",
  "lead_event_time",
  "lead_payload_raw",
  "purchase_event_time",
  "purchase_payload_raw",
  "clientIP",
  "agentuser",
  "purchase_capi_route",
  "purchase_capi_route_reason",
  "device_type",
  "geo_city",
  "geo_region",
  "geo_country",
  "geo_source",
  "cuit_cuil",
  "inferred_sex",
  "sex_source",
  "lead_bot_phone",
  "lead_player_username",
  "lead_agency_id",
  "lead_gerencia_label",
  "lead_incoming_promo_code",
  "lead_attribution_status",
  "lead_attribution_conversion_id",
  "registration_event_id",
  "registration_event_time",
  "registration_player_username",
  "registration_payload_raw",
  "registration_bot_phone",
  "registration_agency_id",
  "registration_gerencia_label",
  "registration_incoming_promo_code",
  "registration_attribution_status",
  "registration_attribution_conversion_id",
  "purchase_bot_phone",
  "purchase_player_username",
  "purchase_agency_id",
  "purchase_gerencia_label",
  "purchase_incoming_promo_code",
  "purchase_attribution_status",
  "purchase_attribution_conversion_id",
]);

const FRIENDLY_COLUMN_LABELS: Record<ConversionColumnKey, string> = {
  phone: "Teléfono",
  email: "Correo electrónico",
  form_fn: "Nombre formulario",
  form_ln: "Apellido formulario",
  form_email: "Email formulario",
  form_phone: "Teléfono formulario",
  fn: "Nombre",
  ln: "Apellido",
  ct: "Ciudad",
  st: "Provincia / estado",
  zip: "Código postal",
  country: "País",
  fbp: "ID de navegador Meta",
  fbc: "ID de clic Meta",
  from_meta_ads: "Origen Meta Ads",
  meta_pixel_id: "Pixel recibido",
  pixel_id: "Pixel utilizado",
  pixel_attribution_source: "Origen del Pixel",
  pixel_attribution_conversion_id: "Conversión de referencia",
  source_platform: "Plataforma de origen",
  ctwa_clid: "ID de clic a WhatsApp",
  contact_event_id: "ID del evento Contact",
  contact_event_time: "Hora del evento Contact",
  sendContactPixel: "Contact enviado por Pixel",
  contact_payload_raw: "Datos técnicos de Contact",
  lead_event_id: "ID del evento Lead",
  lead_event_time: "Hora del evento Lead",
  lead_payload_raw: "Datos técnicos de Lead",
  purchase_event_id: "ID del evento Purchase",
  purchase_event_time: "Hora del evento Purchase",
  purchase_payload_raw: "Datos técnicos de Purchase",
  timestamp: "Fecha y hora",
  clientIP: "Dirección IP",
  agentuser: "Navegador",
  estado: "Etapa",
  valor: "Valor",
  currency: "Moneda",
  purchase_type: "Tipo de compra",
  purchase_capi_route: "Ruta de Purchase",
  purchase_capi_route_reason: "Motivo de la ruta",
  contact_status_capi: "Envío CAPI de Contact",
  lead_status_capi: "Envío CAPI de Lead",
  registration_status_capi: "Envío CAPI de registro",
  purchase_status_capi: "Envío CAPI de Purchase",
  observaciones: "Observaciones",
  external_id: "ID externo",
  test_event_code: "Código de prueba Meta",
  utm_campaign: "Campaña UTM",
  telefono_asignado: "Teléfono asignado",
  assigned_gerencia_label: "Gerencia asignada",
  promo_code: "Código promocional",
  lead_bot_phone: "Bot que recibió el Lead",
  lead_agency_id: "Agency ID del Lead",
  lead_gerencia_label: "Gerencia receptora del Lead",
  lead_incoming_promo_code: "Promoción recibida en Lead",
  lead_attribution_status: "Resolución del Lead",
  lead_attribution_conversion_id: "Linaje del Lead",
  purchase_bot_phone: "Bot que recibió la compra",
  purchase_agency_id: "Agency ID de la compra",
  purchase_gerencia_label: "Gerencia receptora de la compra",
  purchase_incoming_promo_code: "Promoción recibida en compra",
  purchase_attribution_status: "Resolución de la compra",
  purchase_attribution_conversion_id: "Linaje de la compra",
  device_type: "Dispositivo",
  geo_city: "Ciudad por geolocalización",
  geo_region: "Provincia por geolocalización",
  geo_country: "País por geolocalización",
  geo_source: "Origen de geolocalización",
  cuit_cuil: "CUIT / CUIL",
  inferred_sex: "Sexo inferido",
  sex_source: "Origen del sexo",
  lead_player_username: "Jugador recibido en Lead",
  registration_event_id: "ID de registro completo",
  registration_event_time: "Hora de registro completo",
  registration_player_username: "Jugador creado",
  registration_payload_raw: "Datos tecnicos de registro",
  registration_bot_phone: "Bot del registro",
  registration_agency_id: "Agency ID del registro",
  registration_gerencia_label: "Gerencia del registro",
  registration_incoming_promo_code: "Promocion recibida en registro",
  registration_attribution_status: "Resolucion del registro",
  registration_attribution_conversion_id: "Linaje del registro",
  purchase_player_username: "Jugador recibido en compra",
};

export function columnsForTableView(
  columns: readonly ConversionColumnKey[],
  view: ConversionTableView,
): ConversionColumnKey[] {
  return view === "friendly"
    ? columns.filter((column) => !FRIENDLY_HIDDEN_COLUMNS.has(column))
    : [...columns];
}

export const COLUMN_NOTES: Partial<Record<ConversionColumnKey | "id", string>> = {
  id: "ID interno de la fila de conversion en la tabla.",
  timestamp: "Fecha y hora de creacion de la fila (created_at).",
  phone: "Telefono recibido en payload (normalizado a digitos). Puede actualizarse con LEAD/PURCHASE.",
  email: "Email recibido en payload.",
  form_fn: "Nombre escrito en el formulario opcional previo a WhatsApp. Es trazabilidad: LEAD/registro/PURCHASE pueden pisar el campo Nombre principal.",
  form_ln: "Apellido escrito en el formulario opcional previo a WhatsApp. Es trazabilidad: LEAD/registro/PURCHASE pueden pisar el campo Apellido principal.",
  form_email: "Email escrito en el formulario opcional previo a WhatsApp, guardado solo si tiene formato valido.",
  form_phone: "Telefono escrito en el formulario opcional previo a WhatsApp, guardado solo si puede normalizarse como telefono plausible.",
  cuit_cuil: "CUIT/CUIL recibido en payload (normalizado a digitos).",
  inferred_sex: "Sexo inferido desde prefijo CUIT/CUIL: 20/23=male, 27=female, resto=unknown.",
  sex_source: "Origen del sexo inferido: cuit_cuil, name_catalog o unknown.",
  fn: "Nombre (first name) recibido en payload.",
  ln: "Apellido (last name) recibido en payload.",
  ct: "Ciudad recibida en payload o enriquecida por geolocalizacion.",
  st: "Provincia/estado recibido en payload o enriquecido por geolocalizacion.",
  zip: "Codigo postal recibido en payload o enriquecido por geolocalizacion.",
  country: "Pais recibido en payload o enriquecido por geolocalizacion.",
  fbp: "Parametro fbp de Meta enviado por la fuente.",
  fbc: "Parametro fbc de Meta enviado por la fuente.",
  from_meta_ads: "Indica origen probable en Meta Ads. True si trae fbc o utm_campaign; si solo trae promo_code valido (TAG-SUFIX), cuenta solo cuando source_platform es chatrace.",
  geo_source: "Fuente usada para completar geo: payload, ip, phone_prefix o none.",
  meta_pixel_id: "Pixel ID recibido en el payload de entrada (landing/chatrace/backend).",
  pixel_id: "Pixel ID efectivo usado para CAPI.",
  pixel_attribution_source: "Origen confiable usado para resolver el pixel de Purchase: payload, Contact raiz, landing o configuracion unica.",
  pixel_attribution_conversion_id: "UUID de la conversion raiz que aporto el pixel, cuando la atribucion se resolvio por una fila anterior.",
  source_platform: "Origen declarado del payload (ej: landing, chatrace).",
  ctwa_clid: "Click ID crudo de anuncios Click-to-WhatsApp. Solo se conserva para el recorrido Chatrace.",
  contact_event_id: "Event ID del Contact (dedupe Pixel/CAPI).",
  contact_event_time: "Event time (unix) del Contact.",
  sendContactPixel: "Bandera enviada por la fuente para indicar si Contact tambien salio por Pixel browser.",
  contact_payload_raw: "Payload crudo recibido para Contact (trazabilidad).",
  lead_event_id: "Event ID del Lead enviado por CAPI.",
  lead_event_time: "Event time (unix) del Lead.",
  lead_payload_raw: "Payload crudo recibido para action=LEAD (trazabilidad).",
  purchase_event_id: "Event ID del Purchase enviado por CAPI.",
  purchase_event_time: "Event time (unix) del Purchase.",
  purchase_payload_raw: "Payload crudo recibido para action=PURCHASE (trazabilidad).",
  clientIP: "IP recibida en payload (clientIP/client_ip_address).",
  agentuser: "User-Agent recibido en payload (agentuser/client_user_agent).",
  estado: "Estado actual de la conversion (contact, lead o purchase).",
  valor: "Monto de compra/carga recibido para Purchase.",
  currency: "Moneda ISO asociada a la conversion y al monto (por ejemplo ARS o PYG).",
  purchase_type: "Tipo de compra: first (primera) o repeat (recompra).",
  purchase_capi_route: "Ruta fijada antes del primer envío de Purchase: website o business_messaging.",
  purchase_capi_route_reason: "Motivo por el que se eligió la ruta de envío de Purchase.",
  contact_status_capi: "Resultado de envio CAPI para Contact. Puede ser omitido si detectamos crawler de Meta.",
  lead_status_capi: "Resultado de envio CAPI para Lead. Puede ser omitido por configuracion del pixel.",
  registration_status_capi: "Resultado de envio CAPI para CompleteRegistration. Por defecto queda omitido hasta activar su switch.",
  purchase_status_capi: "Resultado de envio CAPI para Purchase. Indica si First o Repeat fue omitido por su switch del pixel.",
  observaciones: "Notas internas de procesamiento (tokens de estado/error).",
  external_id: "ID externo de usuario/contacto para matching en Meta (hasheado al enviar).",
  test_event_code: "Codigo de test de Meta (si se envio en modo prueba).",
  utm_campaign: "UTM campaign recibida en payload.",
  telefono_asignado: "Telefono de destino asignado para derivacion (landing/chatrace).",
  assigned_gerencia_label: "Gerencia historica asociada al telefono asignado al momento de crear/procesar la fila.",
  promo_code: "Codigo de promo/track para matchear Contact->Lead->Purchase.",
  lead_bot_phone: "Bot de WhatsApp que realmente recibio el Lead segun el payload.",
  lead_agency_id: "agency_id crudo recibido con el Lead.",
  lead_gerencia_label: "Gerencia resuelta para el receptor real del Lead.",
  lead_incoming_promo_code: "promo_code recibido, aunque no se use por ser incompatible con el receptor.",
  lead_attribution_status: "Explica como se resolvieron receptor, promo y linaje del Lead.",
  lead_attribution_conversion_id: "Fila confiable usada como linaje para el Lead.",
  purchase_bot_phone: "Bot de WhatsApp que realmente recibio la compra segun el payload.",
  purchase_agency_id: "agency_id crudo recibido con la compra.",
  purchase_gerencia_label: "Gerencia resuelta para el receptor real de la compra.",
  purchase_incoming_promo_code: "promo_code recibido, aunque no se use por ser incompatible con el receptor.",
  purchase_attribution_status: "Explica como se resolvieron receptor, promo, first/repeat y linaje de la compra.",
  purchase_attribution_conversion_id: "Fila confiable de la misma gerencia usada para heredar la atribucion de la compra.",
  device_type: "Tipo de dispositivo reportado por la fuente (mobile/tablet/desktop).",
  geo_city: "Ciudad enriquecida por geolocalizacion IP.",
  geo_region: "Region/provincia enriquecida por geolocalizacion IP.",
  geo_country: "Pais enriquecido por geolocalizacion IP.",
  lead_player_username: "player_username recibido con action=LEAD. Puede venir vacio o igual al telefono.",
  registration_event_id: "Event/action ID recibido con action=COMPLETEREGISTRATION.",
  registration_event_time: "Event time (unix) del registro completo.",
  registration_player_username: "player_username creado por la gerencia para ese jugador.",
  registration_payload_raw: "Payload crudo recibido para action=COMPLETEREGISTRATION.",
  registration_bot_phone: "Bot de WhatsApp que recibio/creo el registro.",
  registration_agency_id: "agency_id crudo recibido con el registro.",
  registration_gerencia_label: "Gerencia resuelta para el registro.",
  registration_incoming_promo_code: "promo_code recibido en el registro.",
  registration_attribution_status: "Explica como se vinculo el registro con una fila previa.",
  registration_attribution_conversion_id: "Fila usada como linaje para el registro.",
  purchase_player_username: "player_username recibido con action=PURCHASE.",
};

export function truncateId(id: string, len = 8): string {
  if (!id) return "-";
  return id.length > len ? `${id.slice(0, len)}...` : id;
}

export function truncateText(value: string, len = 35): string {
  if (!value) return "-";
  return value.length > len ? `${value.slice(0, len)}...` : value;
}

export function formatIntegerWithThousands(value: number): string {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(
    Math.max(0, Math.trunc(value || 0)),
  );
}

export function normalizePhone(value: string | null | undefined): string {
  return String(value ?? "").replace(/\D/g, "");
}

export function normalizeSexValue(value: unknown): string {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return "";
  if (raw === "m" || raw === "male" || raw === "masculino" || raw === "hombre") return "male";
  if (raw === "f" || raw === "female" || raw === "femenino" || raw === "mujer") return "female";
  return "unknown";
}

export function todayRange(): DateRange {
  const now = new Date();
  return {
    start: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
    end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999),
  };
}

export function isSameDateRange(a: DateRange | null, b: DateRange | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return a.start.getTime() === b.start.getTime() && a.end.getTime() === b.end.getTime();
}

export function sexLabel(value: string): string {
  if (value === "male") return "Masculino";
  if (value === "female") return "Femenino";
  return "Sin inferir";
}

export function columnLabel(
  col: ConversionColumnKey,
  view: ConversionTableView = "technical",
): string {
  if (view === "friendly") return FRIENDLY_COLUMN_LABELS[col];
  if (col === "assigned_gerencia_label") return "Nombre gerencia (ID)";
  return col;
}

export function friendlyPurchaseType(value: unknown): string {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "first") return "Primera compra";
  if (normalized === "repeat") return "Recompra";
  return normalized || "-";
}

export function friendlySourcePlatform(value: unknown): string {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "landing") return "Landing";
  if (normalized === "chatrace") return "Chatrace";
  return normalized || "-";
}

export function friendlyPixelAttributionSource(value: unknown): string {
  const normalized = String(value ?? "").trim().toLowerCase();
  const labels: Record<string, string> = {
    explicit_payload: "Evento recibido",
    stored_attribution: "Atribución guardada",
    contact_context: "Contact de origen",
    explicit_stored_payload: "Evento anterior",
    chatrace_context: "Contexto de Chatrace",
    promo_root: "Promoción de origen",
    landing_id: "Landing asignada",
    landing_tag: "Etiqueta de la landing",
    single_configured_pixel: "Único Pixel configurado",
  };
  return labels[normalized] ?? (normalized || "-");
}
