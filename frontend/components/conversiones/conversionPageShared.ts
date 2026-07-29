import type { DateRange } from "@/components/conversiones/DateRangeFilter";

export const ALL_COLUMNS = [
  "phone","email","fn","ln","ct","st","zip","country","fbp","fbc","from_meta_ads","meta_pixel_id","pixel_id","pixel_attribution_source","pixel_attribution_conversion_id","source_platform","ctwa_clid",
  "contact_event_id","contact_event_time","sendContactPixel","contact_payload_raw","lead_event_id","lead_event_time","lead_payload_raw",
  "purchase_event_id","purchase_event_time","purchase_payload_raw","timestamp","clientIP","agentuser",
  "estado","valor","currency","purchase_type","purchase_capi_route","purchase_capi_route_reason","contact_status_capi","lead_status_capi","purchase_status_capi",
  "observaciones","external_id","test_event_code","utm_campaign","telefono_asignado","assigned_gerencia_label","promo_code",
  "device_type","geo_city","geo_region","geo_country","geo_source",
  "cuit_cuil","inferred_sex","sex_source",
] as const;

export type ConversionColumnKey = (typeof ALL_COLUMNS)[number];

export const COLUMN_NOTES: Partial<Record<ConversionColumnKey | "id", string>> = {
  id: "ID interno de la fila de conversion en la tabla.",
  timestamp: "Fecha y hora de creacion de la fila (created_at).",
  phone: "Telefono recibido en payload (normalizado a digitos). Puede actualizarse con LEAD/PURCHASE.",
  email: "Email recibido en payload.",
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
  purchase_status_capi: "Resultado de envio CAPI para Purchase. Indica si First o Repeat fue omitido por su switch del pixel.",
  observaciones: "Notas internas de procesamiento (tokens de estado/error).",
  external_id: "ID externo de usuario/contacto para matching en Meta (hasheado al enviar).",
  test_event_code: "Codigo de test de Meta (si se envio en modo prueba).",
  utm_campaign: "UTM campaign recibida en payload.",
  telefono_asignado: "Telefono de destino asignado para derivacion (landing/chatrace).",
  assigned_gerencia_label: "Gerencia historica asociada al telefono asignado al momento de crear/procesar la fila.",
  promo_code: "Codigo de promo/track para matchear Contact->Lead->Purchase.",
  device_type: "Tipo de dispositivo reportado por la fuente (mobile/tablet/desktop).",
  geo_city: "Ciudad enriquecida por geolocalizacion IP.",
  geo_region: "Region/provincia enriquecida por geolocalizacion IP.",
  geo_country: "Pais enriquecido por geolocalizacion IP.",
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

export function columnLabel(col: ConversionColumnKey): string {
  if (col === "assigned_gerencia_label") return "Nombre gerencia (ID)";
  return col;
}
