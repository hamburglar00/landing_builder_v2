import "server-only";
import { BlockList, isIP } from "node:net";
import type { RevalidationMotor } from "./types";

export type RevalidationEnvironment = "production" | "local";
export type Destination = {
  environment: RevalidationEnvironment;
  motor: RevalidationMotor;
  url: string;
};

const destinations = {
  production: {
    classic: "https://landing.panelbotadmin.com/api/revalidate",
    constructor: "https://mkt.panelbotadmin.com/api/revalidate",
  },
  local: {
    classic: "http://localhost:3000/api/revalidate",
    constructor: "http://localhost:3001/api/revalidate",
  },
} as const;

export function environmentFromServer(env: NodeJS.ProcessEnv): RevalidationEnvironment {
  if (env.VERCEL_ENV && env.VERCEL_ENV !== "production") throw new Error("unavailable");
  if (env.VERCEL && env.VERCEL_ENV !== "production") throw new Error("unavailable");
  if (env.REVALIDATION_ENV === "production" && env.NODE_ENV === "production") return "production";
  if (env.REVALIDATION_ENV === "local" && env.REVALIDATION_LOCAL_SYNTHETIC === "1"
    && env.NODE_ENV !== "production" && !env.VERCEL && !env.VERCEL_ENV) return "local";
  throw new Error("unavailable");
}

export function destinationFor(environment: RevalidationEnvironment, motor: RevalidationMotor): Destination {
  if ((environment !== "production" && environment !== "local")
    || (motor !== "classic" && motor !== "constructor")) throw new Error("invalid_destination");
  return { environment, motor, url: destinations[environment][motor] };
}

export function assertExactUrl(candidate: string, expected: string): URL {
  const url = new URL(candidate);
  const reference = new URL(expected);
  const port = (value: URL) => value.port || (value.protocol === "https:" ? "443" : "80");
  if (url.protocol !== reference.protocol || url.hostname !== reference.hostname
    || port(url) !== port(reference) || url.pathname !== reference.pathname
    || url.username || url.password || url.search || url.hash
    || candidate.includes("\\") || /[\u0000-\u0020]/.test(candidate)) throw new Error("invalid_destination");
  return url;
}

export function validateDestination(destination: Destination): URL {
  return assertExactUrl(destination.url, destinationFor(destination.environment, destination.motor).url);
}

const blockedV4 = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 3],
] as const) blockedV4.addSubnet(address, prefix, "ipv4");
const globalV6 = new BlockList();
globalV6.addSubnet("2000::", 3, "ipv6");
const blockedV6 = new BlockList();
for (const [address, prefix] of [["2001::", 23], ["2001:db8::", 32], ["2002::", 16], ["3fff::", 20]] as const) {
  blockedV6.addSubnet(address, prefix, "ipv6");
}

export function isPublicAddress(address: string): boolean {
  if (isIP(address) === 4) return !blockedV4.check(address, "ipv4");
  if (isIP(address) === 6) return globalV6.check(address, "ipv6") && !blockedV6.check(address, "ipv6");
  return false;
}

export function isLandingName(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,199}$/.test(value);
}

export function assertLocalSyntheticSecret(environment: RevalidationEnvironment, value: string) {
  if (environment === "local" && !/^phase1b2-local-[a-zA-Z0-9_-]{16,128}$/.test(value)) {
    throw new Error("unavailable");
  }
}
