import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export type Identity = {
  intent: "open" | "create" | "link";
  provider: "builder" | "atrio";
  userId: number;
  ownerId: number;
  role: number;
  email: string;
  name: string;
  ownerName: string;
  currency: "ARS";
  accountId: string | null;
  accountEmail: string | null;
};
export class AccessError extends Error {
  constructor(
    message: string,
    public status = 409,
  ) {
    super(message);
  }
}
export const nonce = () => randomBytes(32).toString("base64url");
export const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("base64url");
export const validCode = (value: unknown): value is string =>
  typeof value === "string" && /^[a-zA-Z0-9_-]{43}$/.test(value);
export function origin(value: string | undefined) {
  if (!value)
    throw new AccessError(
      "El acceso con PBAdmin todavía no está habilitado.",
      503,
    );
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      ))
  )
    throw new AccessError("Configuración de acceso no válida.", 503);
  return url.origin;
}
export function config() {
  if (
    process.env.PBADMIN_EXTENSIONS_ENABLED !== "true" ||
    (process.env.PBADMIN_EXTENSIONS_SECRET?.length ?? 0) < 32
  )
    throw new AccessError(
      "El acceso con PBAdmin todavía no está habilitado.",
      503,
    );
  return {
    api: origin(process.env.PBADMIN_EXTENSIONS_API_ORIGIN),
    panel: origin(process.env.PBADMIN_EXTENSIONS_PANEL_ORIGIN),
    app: origin(process.env.PBADMIN_EXTENSIONS_APP_ORIGIN),
    secret: process.env.PBADMIN_EXTENSIONS_SECRET!,
  };
}
export function trusted(request: Request) {
  const expected = config().secret;
  const actual = request.headers.get("x-extension-secret") ?? "";
  if (
    !timingSafeEqual(
      createHash("sha256").update(expected).digest(),
      createHash("sha256").update(actual).digest(),
    )
  )
    throw new AccessError("Acceso no autorizado.", 401);
}
export async function broker(
  provider: Identity["provider"],
  action: string,
  body: object,
) {
  const cfg = config();
  const response = await fetch(
    `${cfg.api}/api/v1/extensions/${provider}/${action}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-extension-secret": cfg.secret,
      },
      body: JSON.stringify(body),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    },
  );
  const data = await response.json();
  if (!response.ok)
    throw new AccessError(
      typeof data.message === "string"
        ? data.message
        : "No se pudo validar el acceso con PBAdmin.",
      response.status,
    );
  return data;
}
export async function start(provider: Identity["provider"]) {
  const cfg = config(),
    state = nonce(),
    verifier = nonce();
  const jar = await cookies();
  jar.set("pbadmin_handoff", JSON.stringify({ state, verifier }), {
    httpOnly: true,
    secure: cfg.app.startsWith("https:"),
    sameSite: "lax",
    path: "/",
    maxAge: 300,
  });
  const next = new URL("/extensiones/autorizar", cfg.panel);
  next.searchParams.set("provider", provider);
  next.searchParams.set("state", state);
  next.searchParams.set("challenge", sha256(verifier));
  return next.toString();
}
export async function redeem(
  provider: Identity["provider"],
  code: unknown,
  state: unknown,
) {
  const jar = await cookies();
  let saved: { state?: string; verifier?: string } = {};
  try {
    saved = JSON.parse(jar.get("pbadmin_handoff")?.value ?? "{}");
  } catch {
    /* reject below */
  }
  if (
    !validCode(code) ||
    !validCode(state) ||
    !validCode(saved.verifier) ||
    saved.state !== state
  )
    throw new AccessError(
      "Este acceso venció o pertenece a otro navegador. Volvé a ingresar.",
      401,
    );
  jar.delete("pbadmin_handoff");
  const identity: Identity = await broker(provider, "redeem", {
    code,
    verifier: saved.verifier,
  });
  if (
    identity.provider !== provider ||
    identity.intent !== "open" ||
    !Number.isSafeInteger(identity.ownerId) ||
    identity.ownerId < 1 ||
    !Number.isSafeInteger(identity.userId) ||
    identity.userId < 1 ||
    !(provider === "builder" ? [0] : [0, 3]).includes(identity.role)
  )
    throw new AccessError("Identidad no válida.", 403);
  return identity;
}
export async function redeemConnection(
  provider: Identity["provider"],
  code: unknown,
  verifier: unknown,
) {
  if (!validCode(code) || !validCode(verifier))
    throw new AccessError("Solicitud de vinculación no válida.", 400);
  const identity: Identity = await broker(provider, "redeem", {
    code,
    verifier,
  });
  if (
    identity.provider !== provider ||
    !["create", "link"].includes(identity.intent) ||
    !Number.isSafeInteger(identity.ownerId) ||
    identity.ownerId < 1 ||
    !Number.isSafeInteger(identity.userId) ||
    identity.userId < 1 ||
    !(provider === "builder" ? [0] : [0, 3]).includes(identity.role)
  )
    throw new AccessError("Identidad no válida.", 403);
  return identity;
}
export function errorResponse(error: unknown) {
  return Response.json(
    {
      error:
        error instanceof AccessError
          ? error.message
          : "No se pudo completar el acceso. Volvé a intentar; se conserva el avance.",
    },
    {
      status: error instanceof AccessError ? error.status : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
export function sameOrigin(request: Request) {
  if (request.headers.get("origin") !== config().app)
    throw new AccessError("Origen no permitido.", 403);
}
export function privateRedirect(url: string) {
  return new Response(null, {
    status: 303,
    headers: {
      Location: url,
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
export function accessErrorPage(error: unknown) {
  const message = (
    error instanceof AccessError
      ? error.message
      : "No se pudo completar el acceso. Podés volver a intentar; se conserva el avance."
  ).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
  return new Response(
    `<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Acceso desde PBAdmin</title></head><body style="margin:0;background:#0b0b12;color:#f4f4f5;font:16px system-ui;display:grid;place-items:center;min-height:100vh"><main style="max-width:440px;margin:24px;padding:28px;border:1px solid #353541;border-radius:14px;background:#16161f"><h1 style="font-size:22px">No pudimos abrir tu cuenta</h1><p style="color:#c4c4d0;line-height:1.6">${message}</p><a style="display:inline-block;background:#7c3aed;color:white;padding:12px 18px;border-radius:8px;text-decoration:none" href="/api/pbadmin/start">Volver a intentar</a><p><a style="color:#bdb4ff" href="/login">Usar el ingreso habitual</a></p></main></body></html>`,
    {
      status: error instanceof AccessError ? error.status : 503,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
      },
    },
  );
}
