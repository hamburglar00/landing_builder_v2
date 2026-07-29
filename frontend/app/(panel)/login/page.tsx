"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({ email, password });

    setIsSubmitting(false);

    if (signInError) {
      setError(signInError.message || "No se pudo iniciar sesión.");
      return;
    }

    const userId = signInData.user?.id;
    if (!userId) {
      router.push("/admin");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    const role = profile?.role ?? "client";
    if (role === "admin") {
      router.push("/admin");
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div className="panel-shell relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 sm:px-6">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[1.5rem] border border-[var(--color-border)] bg-[rgba(11,15,21,0.86)] shadow-[var(--shadow-raised)] backdrop-blur-xl lg:grid-cols-[1.08fr_0.92fr]">
        <section className="relative hidden min-h-[620px] overflow-hidden border-r border-[var(--color-border-subtle)] p-10 lg:flex lg:flex-col lg:justify-between">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(163,230,53,0.13),transparent_32rem),linear-gradient(145deg,rgba(255,255,255,0.025),transparent_48%)]" />
          <div className="relative z-10 flex items-center gap-3">
            <div className="panel-brand-mark flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold">PB</div>
            <div>
              <p className="text-xs font-semibold tracking-[0.13em] text-[var(--color-text-strong)]">PANEL BOT ADMIN</p>
              <p className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">Constructor de landings</p>
            </div>
          </div>

          <div className="relative z-10 max-w-md">
            <span className="ui-badge border-[var(--color-primary-soft-border)] bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)]">
              Operación centralizada
            </span>
            <h2 className="mt-5 text-4xl font-semibold leading-[1.08] tracking-[-0.045em] text-[var(--color-text-strong)]">
              Todo tu ecosistema comercial, en un solo lugar.
            </h2>
            <p className="mt-5 max-w-sm text-sm leading-6 text-[var(--color-text-muted)]">
              Gestioná landings, conversiones e integraciones con una experiencia rápida, clara y consistente.
            </p>
          </div>

          <div className="relative z-10 flex items-center gap-2 text-[10px] text-[var(--color-text-disabled)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-success)] shadow-[0_0_10px_rgba(52,211,153,0.5)]" />
            Entorno seguro y operativo
          </div>
        </section>

        <section className="flex min-h-[560px] items-center p-6 sm:p-10 lg:p-12">
          <div className="mx-auto w-full max-w-sm">
            <div className="mb-8 lg:hidden">
              <div className="flex items-center gap-3">
                <div className="panel-brand-mark flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold">PB</div>
                <div>
                  <p className="text-xs font-semibold tracking-[0.12em] text-[var(--color-text-strong)]">PANEL BOT ADMIN</p>
                  <p className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">Constructor de landings</p>
                </div>
              </div>
            </div>

            <p className="ui-page-eyebrow">Bienvenido</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--color-text-strong)]">
              Iniciar sesión
            </h1>
            <p className="mt-2 text-xs leading-5 text-[var(--color-text-muted)]">
              Ingresá tus credenciales para acceder a tu workspace.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div className="space-y-2">
                <label htmlFor="email" className="block text-xs font-medium text-[var(--color-text)]">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] px-3.5 text-sm text-[var(--color-text-strong)] outline-none transition placeholder:text-[var(--color-text-disabled)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-ring-primary)]"
                  placeholder="tu@email.com"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="block text-xs font-medium text-[var(--color-text)]">
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] px-3.5 pr-11 text-sm text-[var(--color-text-strong)] outline-none transition placeholder:text-[var(--color-text-disabled)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-ring-primary)]"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-[var(--color-text-muted)] transition hover:text-[var(--color-text-strong)]"
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                      {showPassword ? (
                        <>
                          <path d="M3 3l18 18" />
                          <path d="M10.58 10.58A3 3 0 0 0 12 15a3 3 0 0 0 2.42-4.42" />
                          <path d="M9.88 5.09A9.77 9.77 0 0 1 12 5c5 0 9 4 10 7-.274.81-.72 1.64-1.32 2.4" />
                          <path d="M6.61 6.61C4.27 7.76 2.64 9.7 2 12c.46 1.52 1.6 3.16 3.2 4.46A11.4 11.4 0 0 0 12 19c1.3 0 2.55-.23 3.72-.66" />
                        </>
                      ) : (
                        <>
                          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z" />
                          <circle cx="12" cy="12" r="3.5" />
                        </>
                      )}
                    </svg>
                  </button>
                </div>
              </div>

              {error && (
                <div className="ui-alert border-[rgba(251,113,133,0.25)] bg-[rgba(251,113,133,0.07)] text-xs text-[var(--color-danger)]" role="alert">
                  {error}
                </div>
              )}

              <button type="submit" disabled={isSubmitting} className="ui-button ui-button-primary h-11 w-full">
                {isSubmitting ? "Iniciando sesión…" : "Entrar al panel"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
