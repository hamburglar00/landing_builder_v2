/** Request-scoped diagnostics. Never alter tracking payloads or idempotency keys. */
export type TrackingFailure = {
  error_code: string;
  message: string;
  retryable: boolean;
  details?: { signal: string; reason: string };
};

export type TrackingRecord = Record<string, unknown>;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIONS = new Set([
  "CONTACT",
  "LEAD",
  "COMPLETEREGISTRATION",
  "PURCHASE",
]);

/** Internal exception context stays in server logs, never in a public response. */
export function describeTrackingException(error: unknown): TrackingRecord {
  const record = error && typeof error === "object"
    ? error as TrackingRecord
    : {};
  const scrub = (value: unknown) =>
    String(value ?? "").slice(0, 2048)
      .replace(/https?:\/\/[^\s"<>]+/gi, "[url]")
      .replace(/\bBearer\s+\S+/gi, "Bearer [redacted]")
      .replace(/\beyJ[\w-]+\.[\w-]+(?:\.[\w-]+)?/g, "[redacted]")
      .replace(
        /\b(?:password|passwd|secret|token|api[_-]?key|authorization|cookie)\b\s*[=:]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
        "[redacted]",
      )
      .replace(/"[^"]*"|'[^']*'/g, "[quoted value]")
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
      .replace(/\b\d{7,}\b/g, "[number]")
      .slice(0, 512);
  return {
    error_type: /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(String(record.name))
      ? record.name
      : "UnknownError",
    exception_code: /^[A-Za-z0-9_]{1,48}$/.test(String(record.code ?? ""))
      ? record.code
      : null,
    error_message: scrub(record.message || "Error inesperado"),
    stack_frames: typeof record.stack === "string"
      ? record.stack.split("\n").slice(1, 5).map(scrub)
      : [],
  };
}

const identifier = (value: unknown) => {
  const text = String(value ?? "");
  return /^[a-zA-Z0-9_-]{1,96}$/.test(text) ? text : null;
};

export class TrackingDiagnostics {
  readonly requestId: string;
  readonly attempt: number;
  failure?: TrackingFailure;
  private event: TrackingRecord = {};

  constructor(req: Request) {
    const supplied = req.headers.get("x-request-id") ?? "";
    this.requestId = UUID.test(supplied) ? supplied : crypto.randomUUID();
    const attempt = Number(req.headers.get("x-tracking-attempt"));
    this.attempt = Number.isInteger(attempt) && attempt >= 1 && attempt <= 20
      ? attempt
      : 1;
  }

  setEvent(payload: Record<string, unknown>) {
    const action = String(payload.action ?? "").toUpperCase();
    this.event = {
      action: ACTIONS.has(action) ? action : "UNKNOWN",
      action_event_id: identifier(payload.action_event_id),
      manager_id: identifier(payload.manager_id),
      agency_id: identifier(payload.agency_id),
    };
  }

  reference(): TrackingRecord {
    return {
      request_id: this.requestId,
      request_attempt: this.attempt,
      ...this.event,
    };
  }

  /** Preserve existing structured log fields and plain text without logging a request body. */
  annotateDetail(detail: string): string {
    let original: unknown = detail;
    try {
      original = JSON.parse(detail);
    } catch { /* Existing plain-text detail. */ }
    const fields =
      original && typeof original === "object" && !Array.isArray(original)
        ? original as TrackingRecord
        : { detail };
    return JSON.stringify({
      ...this.reference(),
      ...(this.failure ? { error_code: this.failure.error_code } : {}),
      ...fields,
      request_id: this.requestId,
      request_attempt: this.attempt,
    });
  }
}

const KNOWN_ERRORS: Record<string, [string, string]> = {
  "Solo se permite POST": ["method_not_allowed", "Solo se permite POST"],
  "Falta parametro 'name' en la URL": [
    "client_name_required",
    "Falta parametro 'name' en la URL",
  ],
  "Configuracion del servidor incompleta": [
    "server_configuration_missing",
    "Configuracion del servidor incompleta",
  ],
  "Error al buscar cliente": [
    "client_lookup_failed",
    "Error al buscar cliente",
  ],
  "Cliente no encontrado": ["client_not_found", "Cliente no encontrado"],
  "Faltan parametros: phone requerido": [
    "phone_required",
    "Faltan parametros: phone requerido",
  ],
  "Faltan parametros validos: phone y amount monetario > 0": [
    "purchase_parameters_invalid",
    "Se requiere phone valido y amount monetario mayor a cero",
  ],
  "Error inesperado": ["internal_error", "Error inesperado"],
};

function describeFailure(status: number, text: string): TrackingFailure {
  const known = KNOWN_ERRORS[text];
  let error_code = known?.[0] ?? `tracking_http_${status}`;
  let message = known?.[1] ?? "No se pudo procesar el evento de conversion";
  if (text.startsWith("Action desconocida:")) {
    error_code = "action_invalid";
    message = "Action desconocida";
  } else if (text.startsWith("event_name invalido para Contact:")) {
    error_code = "event_name_invalid";
    message = "event_name invalido para Contact";
  } else if (
    /^Error al (crear|leer) fila (LEAD|PURCHASE|recompra)/.test(text)
  ) {
    error_code = "conversion_persistence_failed";
    message = "No se pudo guardar o consultar la conversion";
  }
  return {
    error_code,
    message,
    retryable: status >= 500 || status === 408 || status === 429,
  };
}

export async function observeTrackingRequest(
  req: Request,
  handler: (diagnostics: TrackingDiagnostics) => Promise<Response>,
  log: (record: TrackingRecord) => void = (record) => {
    const line = JSON.stringify(record);
    if (Number(record.status) >= 500) console.error(line);
    else if (Number(record.status) >= 400) console.warn(line);
    else console.log(line);
  },
): Promise<Response> {
  const started = performance.now();
  const diagnostics = new TrackingDiagnostics(req);
  let response: Response;
  let exception: TrackingRecord | undefined;
  try {
    response = await handler(diagnostics);
  } catch (error) {
    exception = describeTrackingException(error);
    // A diagnostic boundary must not expose unexpected exception text or credentials.
    response = new Response("Error inesperado", {
      status: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }
  const headers = new Headers(response.headers);
  headers.set("X-Request-ID", diagnostics.requestId);
  headers.set(
    "Access-Control-Expose-Headers",
    "X-Request-ID, X-Tracking-Error-Code",
  );
  let failure: TrackingFailure | undefined;
  if (response.status >= 400) {
    failure = diagnostics.failure ??
      describeFailure(response.status, await response.clone().text());
    headers.set("X-Tracking-Error-Code", failure.error_code);
  }
  if (req.method !== "OPTIONS") {
    try {
      log({
        component: "conversions",
        event: "tracking_request_completed",
        ...diagnostics.reference(),
        status: response.status,
        duration_ms: Math.round(performance.now() - started),
        ...(failure ? { error: failure } : {}),
        ...(exception ? { exception } : {}),
      });
    } catch {
      /* Logging must never change an accepted event or trigger a replay. */
    }
  }
  // Opt in explicitly: existing integrations retain their exact text and HTTP statuses.
  if (failure && req.headers.get("x-tracking-diagnostics") === "1") {
    headers.set("Content-Type", "application/json; charset=utf-8");
    headers.delete("Content-Length");
    return new Response(
      JSON.stringify({
        ok: false,
        ...failure,
        request_id: diagnostics.requestId,
      }),
      {
        status: response.status,
        headers,
      },
    );
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
