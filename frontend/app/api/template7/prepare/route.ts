import type { NextRequest } from "next/server";
import { handleTemplate7Prepare } from "@/lib/reyDeAses/preparation-issue.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// This issuer has no database access. Its per-function GRU setting lives in
// vercel.json; it does not move Builder's database-backed routes out of PDX.

export async function POST(request: NextRequest): Promise<Response> {
  return handleTemplate7Prepare(request);
}
