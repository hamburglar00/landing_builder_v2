import {
  trusted,
  redeemConnection,
  errorResponse,
} from "@/lib/pbadmin/protocol.server";
import { connect } from "@/lib/pbadmin/provider.server";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    trusted(request);
    const raw = await request.text();
    if (raw.length > 4096)
      return Response.json(
        { message: "Solicitud demasiado grande." },
        { status: 413 },
      );
    const input = JSON.parse(raw);
    const identity = await redeemConnection(
      "builder",
      input.code,
      input.verifier,
    );
    return Response.json(await connect(identity, input.code, input), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
