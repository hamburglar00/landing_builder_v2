import {
  start,
  accessErrorPage,
  privateRedirect,
} from "@/lib/pbadmin/protocol.server";
export const runtime = "nodejs";
export async function GET() {
  try {
    return privateRedirect(await start("builder"));
  } catch (error) {
    return accessErrorPage(error);
  }
}
