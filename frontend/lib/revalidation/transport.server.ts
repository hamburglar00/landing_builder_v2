import "server-only";
import { lookup } from "node:dns/promises";
import type { LookupAddress } from "node:dns";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import type { LookupFunction } from "node:net";
import {
  assertLocalSyntheticSecret, destinationFor, isLandingName, isPublicAddress,
  validateDestination, type Destination, type RevalidationEnvironment,
} from "./catalog.server";
import type { RevalidationResult } from "./types";

type Resolver = (host: string) => Promise<LookupAddress[]>;
const resolveAll: Resolver = host => lookup(host, { all: true, verbatim: true });

export async function pinnedLookup(environment: RevalidationEnvironment, hostname: string, resolve: Resolver = resolveAll): Promise<LookupFunction> {
  if (environment !== "production" && environment !== "local") throw new Error("invalid_destination");
  // Bound DNS too; the request deadline starts before any credential is sent.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const addresses = await Promise.race([
    resolve(hostname),
    new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("unavailable")), 5000); }),
  ]).finally(() => clearTimeout(timer));
  if (!addresses.length || addresses.some(a => (a.family !== 4 && a.family !== 6)
    || (environment === "production" ? !isPublicAddress(a.address)
      : hostname !== "localhost" || !["127.0.0.1", "::1"].includes(a.address)))) throw new Error("invalid_destination");
  // Return the validated addresses to the actual socket lookup: no second DNS resolution.
  return (host, options, callback) => {
    if (host !== hostname) { callback(new Error("invalid_destination"), ""); return; }
    const candidates = addresses.filter(a => !options.family || a.family === options.family);
    if (!candidates.length) { callback(new Error("invalid_destination"), ""); return; }
    if (options.all) callback(null, candidates.map(a => ({ ...a })));
    else callback(null, candidates[0].address, candidates[0].family);
  };
}

async function requestFixedUrl(url: URL, environment: RevalidationEnvironment, method: "GET" | "POST", body?: string, timeout = 20000) {
  const pinned = await pinnedLookup(environment, url.hostname);
  return new Promise<{ status: number; body: string }>((resolve, reject) => {
    const request = url.protocol === "https:" ? httpsRequest : httpRequest;
    const req = request(url, {
      method, agent: false, lookup: pinned, signal: AbortSignal.timeout(timeout),
      headers: body === undefined ? {} : {
        "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body),
      },
    }, res => {
      const status = res.statusCode || 0;
      // Node HTTP never follows redirects; reject every 3xx explicitly.
      if (status >= 300 && status < 400) { res.destroy(); reject(new Error("upstream_failed")); return; }
      if (method === "GET") {
        res.on('error', () => reject(new Error('upstream_failed')));
        res.on('end', () => resolve({ status, body: '' }));
        res.resume(); return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      res.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > 32768) { res.destroy(); reject(new Error("upstream_failed")); }
        else chunks.push(chunk);
      });
      res.on("error", () => reject(new Error("upstream_failed")));
      res.on("end", () => resolve({ status, body: Buffer.concat(chunks).toString("utf8") }));
    });
    req.on("error", () => reject(new Error("upstream_failed")));
    req.end(body);
  });
}

export async function postRevalidation(destination: Destination, name: string, secret: string): Promise<RevalidationResult> {
  const url = validateDestination(destination);
  if (!isLandingName(name) || !secret) throw new Error("unavailable");
  assertLocalSyntheticSecret(destination.environment, secret);
  const response = await requestFixedUrl(url, destination.environment, "POST", JSON.stringify({ name, secret }));
  if (response.status !== 200) throw new Error("upstream_failed");
  let value: Record<string, unknown>;
  try { value = JSON.parse(response.body); } catch { throw new Error("upstream_failed"); }
  if (!value || typeof value !== "object") throw new Error("upstream_failed");
  if (destination.motor === "classic") {
    if (value.revalidated !== true || typeof value.warmedConfig !== "boolean"
      || typeof value.warmedPage !== "boolean" || typeof value.warmedPageRetry !== "boolean") throw new Error("upstream_failed");
  } else if (value.ok !== true || value.revalidated !== true) {
    throw new Error('upstream_failed');
  }
  // The invalidating request must finish before warming. Warming inside its
  // handler creates a page that Next invalidates again at response completion.
  let page=await warmPublishedLanding(destination, name), retried=false;
  if(!page){retried=true;page=await warmPublishedLanding(destination, name);}
  return { ok: true, revalidated: true, warmed: { config: null, page, retried } };
}

export async function warmPublishedLanding(destination: Destination, name: string): Promise<boolean> {
  if (!isLandingName(name)) return false;
  const target = validateDestination(destination);
  const url = new URL(`${destination.motor === 'constructor' ? '/l' : ''}/${encodeURIComponent(name)}`, target.origin);
  try {
    const response = await requestFixedUrl(url, destination.environment, "GET", undefined, 8000);
    return response.status >= 200 && response.status < 300;
  } catch { return false; }
}

export async function warmConstructor(environment: RevalidationEnvironment, name: string): Promise<boolean> {
  return warmPublishedLanding(destinationFor(environment, 'constructor'), name);
}
