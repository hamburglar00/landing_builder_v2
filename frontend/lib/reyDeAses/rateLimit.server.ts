import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { createClient } from "@supabase/supabase-js";

function serviceKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
  if (!key) throw new Error("rate limit service unavailable");
  return key;
}

function clientIp(request: Request): string {
  for (const header of ["x-vercel-forwarded-for", "cf-connecting-ip", "x-real-ip", "x-forwarded-for"]) {
    const value = request.headers.get(header);
    if (!value) continue;
    const first = value.split(",")[0]?.trim() || "";
    if (isIP(first)) return first;
  }
  return "unknown";
}

function bucketKey(value: string): string {
  const secret = process.env.TEMPLATE7_RATE_LIMIT_HMAC_KEY || serviceKey();
  return createHmac("sha256", secret).update(value).digest("hex");
}

async function consume(value: string, maxHits: number, windowSeconds: number): Promise<boolean> {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("rate limit database unavailable");
  const db = createClient(url, serviceKey(), { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await db.rpc("consume_template7_rate_limit", {
    p_bucket_key: bucketKey(value), p_max_hits: maxHits, p_window_seconds: windowSeconds,
  });
  if (error || typeof data !== "boolean") throw new Error("rate limit database unavailable");
  return data;
}

export async function allowBootstrap(request: Request): Promise<boolean> {
  const ip = clientIp(request);
  if (!await consume(`global-ip:${ip}`, 120, 60)) return false;
  return consume(`bootstrap-ip:${ip}`, 40, 60);
}

export async function allowTemplate7Start(request: Request, landingId: string, deviceId: string, needsCookie: boolean): Promise<boolean> {
  const ip = clientIp(request);
  if (!await consume(`global-ip:${ip}`, 120, 60)) return false;
  // Cuando bootstrap no llegó a fijar una cookie, serializar el primer start
  // por IP/landing para que dos clics simultáneos no creen dos identidades.
  if (needsCookie && !await consume(`unbound-start:${landingId}:${ip}`, 1, 45)) return false;
  // El primer intento ocupa un lock durable de 45 s. Dos solicitudes concurrentes
  // con la misma landing y cookie no pueden avanzar a la creación de cuenta.
  return consume(`start:${landingId}:${deviceId}`, 1, 45);
}
