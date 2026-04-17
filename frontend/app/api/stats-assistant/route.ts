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

    const model = process.env.OPENAI_STATS_MODEL ?? "gpt-4.1-mini";
    const contextText = compactJson(body.context);
    const system = [
      "Sos un analista senior de performance para Meta Ads.",
      "Trabajas solo con los datos provistos por el dashboard.",
      "No inventes valores ni afirmes datos no presentes.",
      "Diferencia claramente: Hallazgos (datos) vs Inferencias (hipotesis) vs Acciones (recomendaciones).",
      "Prioriza recomendaciones practicas para mejorar calidad de leads, conversion a carga y recarga.",
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

    return NextResponse.json({ ok: true, answer: outputText });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    );
  }
}

