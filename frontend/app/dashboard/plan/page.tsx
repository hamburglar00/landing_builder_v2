"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type PlanCode = "starter" | "plus" | "pro" | "premium" | "scale";

type Subscription = {
  plan_code: PlanCode;
  starts_at: string | null;
  expires_at: string | null;
  max_landings: number;
  max_phones: number;
};

type PlanCard = {
  code: PlanCode;
  title: string;
  price: string;
  landings: string;
  phones: string;
  colorClass: string;
  bulletClass: string;
  conversiones: string;
  seguimientos: string;
  notificaciones: string;
};

const PLAN_CARDS: PlanCard[] = [
  {
    code: "starter",
    title: "Starter",
    price: "USD 49 / mes",
    landings: "Hasta 2 landings",
    phones: "Hasta 2 telefonos",
    colorClass: "border-zinc-700 bg-zinc-900/40",
    bulletClass: "text-zinc-200",
    conversiones:
      "Funnel y Estadisticas para analizar clics CTA, leads, primeras cargas, recargas, ingresos y tasas de conversion.",
    seguimientos:
      "Listado de jugadores para detectar mejores usuarios, ordenarlos por criterio y contactarlos por WhatsApp.",
    notificaciones:
      "Programacion de alertas a Telegram para recordar seguimiento de usuarios inactivos.",
  },
  {
    code: "plus",
    title: "Plus",
    price: "USD 123 / mes",
    landings: "Hasta 4 landings",
    phones: "Hasta 5 telefonos",
    colorClass: "border-yellow-700 bg-yellow-950/30",
    bulletClass: "text-yellow-200",
    conversiones:
      "Funnel y Estadisticas para analizar clics CTA, leads, primeras cargas, recargas, ingresos y tasas de conversion.",
    seguimientos:
      "Listado de jugadores para detectar mejores usuarios, ordenarlos por criterio y contactarlos por WhatsApp.",
    notificaciones:
      "Programacion de alertas a Telegram para recordar seguimiento de usuarios inactivos.",
  },
  {
    code: "pro",
    title: "Pro",
    price: "USD 245 / mes",
    landings: "Hasta 8 landings",
    phones: "Hasta 10 telefonos",
    colorClass: "border-orange-700 bg-orange-950/30",
    bulletClass: "text-orange-200",
    conversiones:
      "Funnel y Estadisticas para analizar clics CTA, leads, primeras cargas, recargas, ingresos y tasas de conversion.",
    seguimientos:
      "Listado de jugadores para detectar mejores usuarios, ordenarlos por criterio y contactarlos por WhatsApp.",
    notificaciones:
      "Programacion de alertas a Telegram para recordar seguimiento de usuarios inactivos.",
  },
  {
    code: "premium",
    title: "Premium",
    price: "USD 490 / mes",
    landings: "Hasta 12 landings",
    phones: "Hasta 20 telefonos",
    colorClass: "border-purple-700 bg-purple-950/30",
    bulletClass: "text-purple-200",
    conversiones:
      "Funnel y Estadisticas para analizar clics CTA, leads, primeras cargas, recargas, ingresos y tasas de conversion.",
    seguimientos:
      "Listado de jugadores para detectar mejores usuarios, ordenarlos por criterio y contactarlos por WhatsApp.",
    notificaciones:
      "Programacion de alertas a Telegram para recordar seguimiento de usuarios inactivos.",
  },
  {
    code: "scale",
    title: "Scale",
    price: "Desde USD 799 / mes",
    landings: "Escalable",
    phones: "Escalable",
    colorClass: "border-zinc-500 bg-black",
    bulletClass: "text-zinc-100",
    conversiones:
      "Funnel y Estadisticas para analizar clics CTA, leads, primeras cargas, recargas, ingresos y tasas de conversion.",
    seguimientos:
      "Listado de jugadores para detectar mejores usuarios, ordenarlos por criterio y contactarlos por WhatsApp.",
    notificaciones:
      "Programacion de alertas a Telegram para recordar seguimiento de usuarios inactivos.",
  },
];

export default function DashboardPlanPage() {
  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState<Subscription | null>(null);

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("client_subscriptions")
        .select("plan_code, starts_at, expires_at, max_landings, max_phones")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) {
        setSub({
          plan_code: (data.plan_code ?? "starter") as PlanCode,
          starts_at: data.starts_at ?? null,
          expires_at: data.expires_at ?? null,
          max_landings: Number(data.max_landings ?? 2),
          max_phones: Number(data.max_phones ?? 2),
        });
      }
      setLoading(false);
    };
    void load();
  }, []);

  const currentPlan = useMemo(() => {
    const code = (sub?.plan_code ?? "starter") as PlanCode;
    return PLAN_CARDS.find((p) => p.code === code) ?? PLAN_CARDS[0];
  }, [sub]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-50">PLAN</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Consulta tu plan actual y compara los planes disponibles.
        </p>
      </div>

      <section className={`rounded-2xl border p-5 ${currentPlan.colorClass}`}>
        <h2 className="text-base font-semibold text-zinc-50">
          Plan actual: {currentPlan.title}
        </h2>
        {loading ? (
          <p className="mt-2 text-sm text-zinc-400">Cargando...</p>
        ) : (
          <div className="mt-3 grid gap-2 text-sm text-zinc-200 sm:grid-cols-2">
            <p>
              <span className="text-zinc-400">Incluye:</span>{" "}
              {sub?.max_landings ?? 2} landings · {sub?.max_phones ?? 2} telefonos
            </p>
            <p>
              <span className="text-zinc-400">Precio:</span> {currentPlan.price}
            </p>
            <p>
              <span className="text-zinc-400">Alta:</span>{" "}
              {sub?.starts_at ? new Date(sub.starts_at).toLocaleDateString() : "-"}
            </p>
            <p>
              <span className="text-zinc-400">Vencimiento:</span>{" "}
              {sub?.expires_at
                ? new Date(sub.expires_at).toLocaleDateString()
                : "Sin vencimiento"}
            </p>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-200">
          Comparacion de planes
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {PLAN_CARDS.map((plan) => (
            <article
              key={plan.code}
              className={`rounded-2xl border p-4 ${plan.colorClass} ${
                currentPlan.code === plan.code ? "ring-2 ring-zinc-400/50" : ""
              }`}
            >
              <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-50">
                {plan.title}
              </h3>
              <p className="mt-2 text-lg font-bold text-zinc-100">{plan.price}</p>
              <ul className={`mt-3 space-y-1 text-sm ${plan.bulletClass}`}>
                <li>• {plan.landings}</li>
                <li>• {plan.phones}</li>
              </ul>
              <div className="mt-8 space-y-3 text-xs text-zinc-200">
                <div>
                  <p className="font-semibold uppercase">CONVERSIONES:</p>
                  <p>{plan.conversiones}</p>
                </div>
                <div>
                  <p className="font-semibold uppercase">SEGUIMIENTOS:</p>
                  <p>{plan.seguimientos}</p>
                </div>
                <div>
                  <p className="font-semibold uppercase">NOTIFICACIONES:</p>
                  <p>{plan.notificaciones}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
