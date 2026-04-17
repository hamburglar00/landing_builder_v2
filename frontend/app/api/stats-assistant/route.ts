import { NextResponse } from "next/server";

type StatsAssistantBody = {
  question?: string;
  context?: unknown;
};

function compactJson(value: unknown, maxLen = 14000): string {
  const raw = JSON.stringify(value ?? {}, null, 2);
  if (raw.length <= maxLen) return raw;
  return `${raw.slice(0, maxLen)}\n... [truncated]`;
}

const MONTHLY_REQUEST_LIMIT = 750;

async function getAuthUserIdFromBearer(
  bearer: string,
): Promise<{ userId: string | null; error?: string }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!supabaseUrl || !supabaseAnon) {
    return { userId: null, error: "Faltan variables de Supabase en servidor." };
  }

  const authRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: supabaseAnon,
      Authorization: `Bearer ${bearer}`,
    },
    cache: "no-store",
  });
  if (!authRes.ok) return { userId: null, error: "Sesion invalida." };
  const authJson = (await authRes.json()) as { id?: string };
  return { userId: authJson.id ?? null };
}

async function consumeAssistantQuota(
  bearer: string,
): Promise<{ allowed: boolean; used: number; remaining: number; limit: number; error?: string }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!supabaseUrl || !supabaseAnon) {
    return { allowed: false, used: 0, remaining: 0, limit: MONTHLY_REQUEST_LIMIT, error: "Supabase no configurado." };
  }

  const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/consume_ai_assistant_quota`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseAnon,
      Authorization: `Bearer ${bearer}`,
    },
    body: JSON.stringify({ p_limit: MONTHLY_REQUEST_LIMIT }),
    cache: "no-store",
  });

  if (!rpcRes.ok) {
    const detail = await rpcRes.text();
    return { allowed: false, used: 0, remaining: 0, limit: MONTHLY_REQUEST_LIMIT, error: `No se pudo validar cuota: ${detail.slice(0, 200)}` };
  }

  const payload = (await rpcRes.json()) as Array<{ allowed?: boolean; used?: number; remaining?: number; limit_count?: number }>;
  const row = payload?.[0] ?? {};
  const allowed = !!row.allowed;
  const used = Number(row.used ?? 0);
  const limit = Number(row.limit_count ?? MONTHLY_REQUEST_LIMIT);
  const remaining = Math.max(0, Number(row.remaining ?? (limit - used)));
  return { allowed, used, remaining, limit };
}

async function readAssistantQuota(
  bearer: string,
): Promise<{ used: number; remaining: number; limit: number; error?: string }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!supabaseUrl || !supabaseAnon) {
    return { used: 0, remaining: MONTHLY_REQUEST_LIMIT, limit: MONTHLY_REQUEST_LIMIT, error: "Supabase no configurado." };
  }

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const url =
    `${supabaseUrl}/rest/v1/ai_assistant_usage_monthly` +
    `?select=requests_count&month_key=eq.${encodeURIComponent(monthKey)}&limit=1`;

  const res = await fetch(url, {
    headers: {
      apikey: supabaseAnon,
      Authorization: `Bearer ${bearer}`,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = await res.text();
    return { used: 0, remaining: MONTHLY_REQUEST_LIMIT, limit: MONTHLY_REQUEST_LIMIT, error: `No se pudo leer cuota: ${detail.slice(0, 200)}` };
  }
  const rows = (await res.json()) as Array<{ requests_count?: number }>;
  const used = Number(rows?.[0]?.requests_count ?? 0);
  const limit = MONTHLY_REQUEST_LIMIT;
  const remaining = Math.max(0, limit - used);
  return { used, remaining, limit };
}

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!bearer) {
      return NextResponse.json({ error: "Missing bearer token." }, { status: 401 });
    }
    const { userId, error: authError } = await getAuthUserIdFromBearer(bearer);
    if (authError || !userId) {
      return NextResponse.json({ error: authError ?? "No autorizado." }, { status: 401 });
    }
    const quota = await readAssistantQuota(bearer);
    if (quota.error) {
      return NextResponse.json({ error: quota.error }, { status: 500 });
    }
    return NextResponse.json({ ok: true, quota });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY ?? "";
    if (!apiKey) {
      return NextResponse.json(
        { error: "Falta OPENAI_API_KEY en el servidor." },
        { status: 500 },
      );
    }

    const body = (await req.json()) as StatsAssistantBody;
    const question = String(body.question ?? "").trim();
    if (!question) {
      return NextResponse.json({ error: "La pregunta es requerida." }, { status: 400 });
    }
    const authHeader = req.headers.get("authorization") ?? "";
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!bearer) {
      return NextResponse.json({ error: "Missing bearer token." }, { status: 401 });
    }
    const { userId, error: authError } = await getAuthUserIdFromBearer(bearer);
    if (authError || !userId) {
      return NextResponse.json({ error: authError ?? "No autorizado." }, { status: 401 });
    }
    const quota = await consumeAssistantQuota(bearer);
    if (quota.error) {
      return NextResponse.json({ error: quota.error }, { status: 500 });
    }
    if (!quota.allowed) {
      return NextResponse.json(
        {
          error: `Alcanzaste el limite mensual del asistente (${quota.limit} consultas).`,
          quota: {
            used: quota.used,
            remaining: quota.remaining,
            limit: quota.limit,
          },
        },
        { status: 429 },
      );
    }

    const model = process.env.OPENAI_STATS_MODEL ?? "gpt-4.1-mini";
    const contextText = compactJson(body.context);
    const system = [
      "Sos un analista senior de performance para Meta Ads.",
      "Trabajas solo con los datos provistos por el dashboard.",
      "No inventes valores ni afirmes datos no presentes.",
      "No ejecutes acciones operativas ni propongas cambios automaticos sobre datos, funciones o logica de negocio.",
      "Diferencia claramente: Hallazgos (datos) vs Inferencias (hipotesis) vs Acciones (recomendaciones).",
      "Prioriza recomendaciones practicas para mejorar calidad de leads, conversion a carga y recarga.",
      "Para recomendaciones de Meta, apoyate en buenas practicas oficiales y agrega una seccion breve de 'Referencias oficiales sugeridas de Meta' (sin afirmar consulta en tiempo real).",
      "Responde en espanol, breve y accionable.",
    ].join(" ");

    const user = [
      "Pregunta del usuario:",
      question,
      "",
      "Contexto de metricas y series del dashboard:",
      contextText,
      "",
      "Formato de salida:",
      "1) Hallazgos clave (max 5)",
      "2) Que optimizar primero (max 5)",
      "3) Experimentos concretos en Meta Ads para 7 dias (max 5)",
      "4) Riesgos/validaciones pendientes (max 3)",
    ].join("\n");

    const openaiRes = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: [
          { role: "system", content: [{ type: "input_text", text: system }] },
          { role: "user", content: [{ type: "input_text", text: user }] },
        ],
        max_output_tokens: 1200,
      }),
      cache: "no-store",
    });

    const raw = await openaiRes.text();
    if (!openaiRes.ok) {
      return NextResponse.json(
        { error: `OpenAI error ${openaiRes.status}`, detail: raw.slice(0, 1000) },
        { status: 502 },
      );
    }

    let parsed: unknown = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }
    const outputText =
      (parsed as { output_text?: string } | null)?.output_text ??
      "No se pudo generar una respuesta en este momento.";

    return NextResponse.json({
      ok: true,
      answer: outputText,
      quota: {
        used: quota.used,
        remaining: quota.remaining,
        limit: quota.limit,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    );
  }
}
