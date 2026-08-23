import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Json = Record<string, unknown>;
type RedirectClickRow = {
  wa_link?: string;
  redirect_id?: string;
  config_id?: string;
  user_id?: string;
  contact_id?: string;
  assignment_id?: string;
  conversion_id?: string | null;
  phone_number_id?: string;
  config_name?: string;
  workspace_currency?: string;
  meta_messaging_dataset_id?: string;
  assigned_phone?: string;
  assigned_gerencia_id?: number | null;
  assigned_gerencia_external_id?: number | null;
  assigned_gerencia_label?: string | null;
  promo_code?: string;
  wa_id?: string;
  profile_name?: string;
  first_message_id?: string;
  first_message_at?: string;
  ctwa_clid?: string;
  referral?: Json;
  first_click?: boolean;
};

function getDb() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SERVICE_ROLE_KEY");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function textResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function redirectResponse(url: string): Response {
  return new Response(null, {
    status: 302,
    headers: {
      Location: url,
      "Cache-Control": "no-store",
    },
  });
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function digits(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

function firstName(fullName: string): string {
  return fullName.split(/\s+/).filter(Boolean).slice(0, -1).join(" ") ||
    fullName;
}

function lastName(fullName: string): string {
  const parts = fullName.split(/\s+/).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value.trim().toLowerCase());
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function eventTimeFromNow(): number {
  return Math.floor(Date.now() / 1000);
}

async function ensureInternalContactOnRedirect(
  db: ReturnType<typeof getDb>,
  row: RedirectClickRow,
): Promise<void> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "") ?? "";
  const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") ?? "";
  const userId = firstString(row.user_id);
  const assignmentId = firstString(row.assignment_id);
  const redirectId = firstString(row.redirect_id);
  const waId = digits(row.wa_id);
  const promoCode = firstString(row.promo_code);
  if (
    !supabaseUrl || !serviceRoleKey || !userId || !assignmentId ||
    !redirectId || !waId
  ) {
    console.error(
      "[whatsapp-cloud-redirect] contact skipped: missing context",
      {
        userId: Boolean(userId),
        assignmentId: Boolean(assignmentId),
        redirectId: Boolean(redirectId),
        waId: Boolean(waId),
      },
    );
    return;
  }
  if (firstString(row.conversion_id)) return;

  const { data: profile } = await db
    .from("profiles")
    .select("nombre")
    .eq("id", userId)
    .maybeSingle();
  const clientName = firstString(
    (profile as { nombre?: string } | null)?.nombre,
  );
  if (!clientName) {
    console.error(
      "[whatsapp-cloud-redirect] contact skipped: profile nombre missing",
      {
        userId,
        assignmentId,
      },
    );
    return;
  }

  const contactEventId = `whatsapp_cloud_api_redirect:${redirectId}`;
  const profileName = firstString(row.profile_name);
  const contactEventTime = eventTimeFromNow();
  const payload = {
    event_name: "Contact",
    event_id: contactEventId,
    contact_event_id: contactEventId,
    event_time: contactEventTime,
    contact_event_time: contactEventTime,
    phone: waId,
    fn: firstName(profileName),
    ln: lastName(profileName),
    external_id: await sha256(`whatsapp_cloud_api:${row.config_id}:${waId}`),
    promo_code: promoCode,
    telefono_asignado: digits(row.assigned_phone),
    assigned_gerencia_id: row.assigned_gerencia_id ?? null,
    assigned_gerencia_external_id: row.assigned_gerencia_external_id ?? null,
    assigned_gerencia_label: firstString(row.assigned_gerencia_label),
    meta_pixel_id: "",
    pixel_id: "",
    dataset_id: firstString(row.meta_messaging_dataset_id),
    currency: firstString(row.workspace_currency),
    workspace_currency: firstString(row.workspace_currency),
    source_platform: "whatsapp_cloud_api",
    ctwa_clid: firstString(row.ctwa_clid),
    from_meta_ads: Boolean(firstString(row.ctwa_clid)),
    sendContactPixel: false,
    event_source_url: `whatsapp-cloud-api://${
      firstString(row.phone_number_id)
    }`,
    whatsapp_cloud_api_config_id: firstString(row.config_id),
    whatsapp_cloud_api_referral: row.referral ?? {},
  };

  const res = await fetch(
    `${supabaseUrl}/functions/v1/conversions?name=${
      encodeURIComponent(clientName)
    }`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );
  const text = await res.text();
  if (!res.ok) {
    console.error("[whatsapp-cloud-redirect] contact creation failed", {
      assignmentId,
      status: res.status,
      response: text.slice(0, 1000),
    });
    return;
  }

  const byEvent = await db
    .from("conversions")
    .select("id")
    .eq("user_id", userId)
    .eq("contact_event_id", contactEventId)
    .maybeSingle();
  let conversionId = firstString((byEvent.data as { id?: string } | null)?.id);
  if (!conversionId && promoCode) {
    const byPromo = await db
      .from("conversions")
      .select("id")
      .eq("user_id", userId)
      .eq("promo_code", promoCode)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    conversionId = firstString((byPromo.data as { id?: string } | null)?.id);
  }

  if (!conversionId) {
    console.error(
      "[whatsapp-cloud-redirect] contact created but conversion id not found",
      {
        assignmentId,
        contactEventId,
        promoCode,
      },
    );
    return;
  }

  const { error } = await db
    .from("whatsapp_cloud_api_assignments")
    .update({ conversion_id: conversionId })
    .eq("id", assignmentId)
    .is("conversion_id", null);
  if (error) {
    console.error(
      "[whatsapp-cloud-redirect] assignment conversion link failed",
      {
        assignmentId,
        conversionId,
        error: error.message,
      },
    );
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return textResponse("ok");

  try {
    const url = new URL(req.url);
    const token = firstString(
      url.searchParams.get("t"),
      url.searchParams.get("token"),
    );
    if (!token) return textResponse("Missing redirect token", 400);

    const db = getDb();
    const ip = firstString(
      req.headers.get("cf-connecting-ip"),
      req.headers.get("x-forwarded-for")?.split(",")[0],
      req.headers.get("x-real-ip"),
    );
    const userAgent = firstString(req.headers.get("user-agent"));

    const { data, error } = await db.rpc(
      "record_whatsapp_cloud_api_redirect_click",
      {
        p_token: token,
        p_ip: ip,
        p_user_agent: userAgent,
      },
    );
    if (error) {
      console.error("[whatsapp-cloud-redirect] click record failed", {
        token,
        error: error.message,
      });
      return textResponse("Redirect unavailable", 500);
    }

    const rows = Array.isArray(data) ? data as RedirectClickRow[] : [];
    const clickRow = rows[0] ?? {};
    const target = firstString(clickRow.wa_link);
    if (!target) return textResponse("Redirect not found", 404);
    if (!target.startsWith("https://wa.me/")) {
      console.error("[whatsapp-cloud-redirect] blocked unsafe target", {
        token,
        target,
      });
      return textResponse("Redirect target blocked", 400);
    }

    if (clickRow.first_click === true) {
      try {
        await ensureInternalContactOnRedirect(db, clickRow);
      } catch (error) {
        console.error(
          "[whatsapp-cloud-redirect] contact ensure unexpected error",
          error,
        );
      }
    }

    return redirectResponse(target);
  } catch (error) {
    console.error("[whatsapp-cloud-redirect] unexpected error", error);
    return textResponse("Redirect error", 500);
  }
});
