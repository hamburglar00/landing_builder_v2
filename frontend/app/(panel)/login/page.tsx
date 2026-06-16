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
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg-0)] px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-1)] p-6 shadow-xl shadow-black/40 backdrop-blur sm:p-8">
        <h1 className="mb-6 text-center text-xl font-semibold text-[var(--color-text-strong)] sm:text-2xl">
          Iniciar sesión
        </h1>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-[var(--color-text)]"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-2)] px-3 py-2 text-sm text-[var(--color-text-strong)] outline-none ring-0 transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-ring-primary)] placeholder:text-[var(--color-text-disabled)]"
              placeholder="admin@tudominio.com"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-[var(--color-text)]"
            >
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
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-2)] px-3 py-2 pr-10 text-sm text-[var(--color-text-strong)] outline-none ring-0 transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-ring-primary)] placeholder:text-[var(--color-text-disabled)]"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)]"
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                <svg
                  aria-hidden="true"
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {showPassword ? (
                    <>
                      <path d="M3 3l18 18" />
                      <path d="M10.58 10.58A3 3 0 0 0 12 15a3 3 0 0 0 2.42-4.42" />
                      <path d="M9.88 5.09A9.77 9.77 0 0 1 12 5c5 0 9 4 10 7-0.274.81-.72 1.64-1.32 2.4" />
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
            <p className="text-sm text-[var(--color-danger)]" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-bg-0)] shadow-sm transition-colors duration-150 hover:bg-[var(--color-primary-hover)] active:bg-[var(--color-primary-press)] disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring-primary)]"
          >
            {isSubmitting ? "Iniciando sesión..." : "Entrar"}
          </button>
        </form>

      </div>
    </div>
  );
}

