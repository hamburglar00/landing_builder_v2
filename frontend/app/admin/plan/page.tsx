"use client";

type PlanCard = {
  code: string;
  title: string;
  price: string;
  landings: string;
  phones: string;
  colorClass: string;
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
    phones: "Hasta 5 telefonos",
    colorClass: "border-zinc-700 bg-zinc-900/40",
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
    price: "USD 79 / mes",
    landings: "Hasta 4 landings",
    phones: "Hasta 10 telefonos",
    colorClass: "border-yellow-700 bg-yellow-950/30",
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
    price: "USD 129 / mes",
    landings: "Hasta 8 landings",
    phones: "Hasta 20 telefonos",
    colorClass: "border-orange-700 bg-orange-950/30",
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
    price: "USD 229 / mes",
    landings: "Hasta 12 landings",
    phones: "Hasta 50 telefonos",
    colorClass: "border-purple-700 bg-purple-950/30",
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
    price: "Desde USD 399 / mes",
    landings: "Escalable",
    phones: "Escalable",
    colorClass: "border-zinc-500 bg-black",
    conversiones:
      "Funnel y Estadisticas para analizar clics CTA, leads, primeras cargas, recargas, ingresos y tasas de conversion.",
    seguimientos:
      "Listado de jugadores para detectar mejores usuarios, ordenarlos por criterio y contactarlos por WhatsApp.",
    notificaciones:
      "Programacion de alertas a Telegram para recordar seguimiento de usuarios inactivos.",
  },
];

export default function AdminPlanPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-50">PLANES</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Catalogo de planes disponibles para clientes.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-200">Comparacion de planes</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {PLAN_CARDS.map((plan) => (
            <article key={plan.code} className={`rounded-2xl border p-4 ${plan.colorClass}`}>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-50">
                {plan.title}
              </h3>
              <p className="mt-2 text-lg font-bold text-zinc-100">{plan.price}</p>
              <ul className="mt-3 space-y-1 text-sm text-zinc-100">
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
