import type { PublishTarget } from "./types";
import {
  buildLandingPublicUrl,
  getLandingPublicBaseUrl,
} from "./publicUrls";

type PublishLandingParams = {
  name: string;
  publishTarget: PublishTarget;
  classicBaseUrl?: string | null;
  revalidateSecret?: string | null;
};

type RevalidateResponse = {
  ok?: boolean;
  error?: string;
  warmed?: {
    ok?: boolean;
    status?: number;
    url?: string;
    error?: string;
  };
};

async function readRevalidateResponse(response: Response): Promise<RevalidateResponse> {
  try {
    return (await response.json()) as RevalidateResponse;
  } catch {
    return {};
  }
}

function buildPublishError(response: Response, body: RevalidateResponse) {
  const warmedStatus = body.warmed?.status ? ` warm=${body.warmed.status}` : "";
  const detail = body.error || body.warmed?.error || response.statusText || "error";
  return `La landing se guardó, pero no se pudo publicar al instante (${response.status}${warmedStatus}: ${detail}). Probá guardar de nuevo o esperá unos segundos.`;
}

export async function publishLandingChanges({
  name,
  publishTarget,
  classicBaseUrl,
  revalidateSecret,
}: PublishLandingParams) {
  const publicUrl = buildLandingPublicUrl(name, publishTarget, classicBaseUrl);

  if (!revalidateSecret) {
    if (publishTarget === "constructor") {
      throw new Error(
        "La landing se guardó, pero falta el secreto de revalidación para publicarla al instante.",
      );
    }

    return { publicUrl, revalidated: false };
  }

  const base = getLandingPublicBaseUrl(publishTarget, classicBaseUrl);
  let response: Response;
  try {
    response = await fetch(`${base}/api/revalidate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        secret: revalidateSecret,
      }),
    });
  } catch (error) {
    if (publishTarget === "constructor") {
      throw new Error(
        `La landing se guardó, pero no se pudo contactar la revalidación del constructor (${error instanceof Error ? error.message : "error"}).`,
      );
    }

    return { publicUrl, revalidated: false };
  }

  const body = await readRevalidateResponse(response);

  if (!response.ok || body.ok === false) {
    if (publishTarget === "constructor") {
      throw new Error(buildPublishError(response, body));
    }

    return { publicUrl, revalidated: false };
  }

  return { publicUrl, revalidated: true };
}
