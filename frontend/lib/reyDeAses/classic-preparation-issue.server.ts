import { CLIENT_ID_COOKIE_NAME, isDeviceId } from "./clientIdentity.server";
import { handleTemplate7Prepare, json, readJson, validJsonRequest, type PreparationEnvironment } from "./preparation-issue.server";

/** Preserve the classic browser identity when issuing the same opaque preparation
 * used by Builder. This endpoint creates no player, provider account or session.
 * The account endpoint still checks the saved landing/advisor/provider scope. */
export async function handleClassicTemplate7Prepare(
  request: Request,
  env: PreparationEnvironment = process.env,
  now = Date.now(),
): Promise<Response> {
  const invalid = validJsonRequest(request);
  if (invalid) return invalid;
  let body: unknown;
  try { body = await readJson(request); }
  catch { return json({ error: "invalid_request" }, 400); }
  const deviceId = body && typeof body === "object" && !Array.isArray(body)
    ? Reflect.get(body, "device_id") : null;
  if (!isDeviceId(deviceId)) return json({ error: "invalid_request" }, 400);

  // This is an in-process adaptation, never an upstream Cookie header. Classic
  // already resolves its assigned advisor and account with this exact device ID.
  // A Builder cookie on a different host must not replace that identity.
  const headers = new Headers(request.headers);
  headers.delete("content-length");
  headers.set("cookie", `${CLIENT_ID_COOKIE_NAME}=${deviceId}`);
  return handleTemplate7Prepare(new Request(request.url, {
    method: "POST", headers, body: JSON.stringify(body),
  }), env, now);
}
