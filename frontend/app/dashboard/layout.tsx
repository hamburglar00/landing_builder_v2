"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 6h16M4 12h16M4 18h16"
      />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

function NavIcon({
  variant,
  active,
}: {
  variant: "inicio" | "landings" | "gerencias" | "telefonos" | "conversiones";
  active: boolean;
}) {
  const base = active
    ? "text-[var(--color-text-strong)]"
    : "text-[var(--color-text-muted)]";
  const accent =
    variant === "telefonos"
      ? active
        ? "text-pink-400"
        : "text-pink-300"
      : variant === "gerencias"
        ? active
          ? "text-sky-400"
          : "text-sky-300"
        : variant === "conversiones"
          ? active
            ? "text-orange-400"
            : "text-orange-300"
          : active
            ? "text-emerald-400"
            : "text-emerald-300";

  if (variant === "inicio") {
    return (
      <span className={base}>
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 11L12 3l9 8" className={accent} />
          <path d="M5 10v10h14V10" />
          <path d="M10 21v-6h4v6" />
        </svg>
      </span>
    );
  }

  if (variant === "landings") {
    return (
      <span className={`${base}`}>
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="7" height="7" className={accent} />
          <rect x="14" y="4" width="7" height="5" />
          <rect x="4" y="14" width="5" height="7" />
          <rect x="13" y="13" width="8" height="8" />
        </svg>
      </span>
    );
  }

  if (variant === "gerencias") {
    return (
      <span className={`${base}`}>
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="11" width="6" height="9" className={accent} />
          <rect x="10" y="7" width="6" height="13" />
          <rect x="17" y="4" width="4" height="16" />
        </svg>
      </span>
    );
  }

  if (variant === "conversiones") {
    return (
      <span className={`${base}`}>
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" className={accent} />
          <polyline points="16 7 22 7 22 13" />
        </svg>
      </span>
    );
  }

  return (
    <span className={`${base}`}>
      <svg
        className="h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect
          x="5"
          y="3"
          width="14"
          height="18"
          rx="2"
          ry="2"
          className={accent}
        />
        <circle cx="12" cy="17" r="1.2" />
        <path d="M9 7h6" />
        <path d="M9 10h4" />
      </svg>
    </span>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isClient, setIsClient] = useState<boolean | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const { data, error } = await supabase.auth.getUser();

      if (error || !data.user) {
        router.replace("/login");
        return;
      }

      setUser(data.user);

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .maybeSingle();

      const role = profile?.role ?? "client";
      if (role === "admin") {
        router.replace("/admin");
        return;
      }

      setIsClient(true);
      setIsCheckingSession(false);
    };

    void checkSession();
  }, [router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  if (isCheckingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg-0)]">
        <p className="text-sm text-[var(--color-text-muted)]">Cargando...</p>
      </div>
    );
  }

  if (!isClient) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-[var(--color-bg-0)] text-[var(--color-text)]">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
        />
      )}

      {/* Sidebar: siempre fijo; drawer en móvil, visible en desktop */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-1)] transition-transform duration-200 ease-out md:translate-x-0 md:w-56 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-4 md:block">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-bg-2)] text-sm font-semibold text-[var(--color-text-strong)] shadow-sm">
              PB
            </div>
            <div>
              <h2 className="text-[11px] font-semibold tracking-[0.2em] text-[var(--color-text-muted)]">
                CONSTRUCTOR DE LANDINGS
              </h2>
            </div>
          </div>
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-3)] hover:text-[var(--color-text-strong)] md:hidden"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-2 p-3">
          <Link
            href="/dashboard/inicio"
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium tracking-[0.18em] transition ${
              pathname === "/dashboard/inicio"
                ? "bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)] border border-[var(--color-primary-soft-border)]"
                : "text-[var(--color-text-muted)] hover:bg-[var(--color-bg-3)] hover:text-[var(--color-text)]"
            }`}
          >
            <NavIcon variant="inicio" active={pathname === "/dashboard/inicio"} />
            <span>INICIO</span>
          </Link>
          <Link
            href="/dashboard"
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium tracking-[0.18em] transition ${
              pathname === "/dashboard"
                ? "bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)] border border-[var(--color-primary-soft-border)]"
                : "text-[var(--color-text-muted)] hover:bg-[var(--color-bg-3)] hover:text-[var(--color-text)]"
            }`}
          >
            <NavIcon variant="landings" active={pathname === "/dashboard"} />
            <span>LANDINGS</span>
          </Link>
          <Link
            href="/dashboard/gerencias"
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium tracking-[0.18em] transition ${
              pathname?.startsWith("/dashboard/gerencias")
                ? "bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)] border border-[var(--color-primary-soft-border)]"
                : "text-[var(--color-text-muted)] hover:bg-[var(--color-bg-3)] hover:text-[var(--color-text)]"
            }`}
          >
            <NavIcon
              variant="gerencias"
              active={Boolean(pathname?.startsWith("/dashboard/gerencias"))}
            />
            <span>GERENCIAS</span>
          </Link>
          <Link
            href="/dashboard/telefonos"
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium tracking-[0.18em] transition ${
              pathname?.startsWith("/dashboard/telefonos")
                ? "bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)] border border-[var(--color-primary-soft-border)]"
                : "text-[var(--color-text-muted)] hover:bg-[var(--color-bg-3)] hover:text-[var(--color-text)]"
            }`}
          >
            <NavIcon
              variant="telefonos"
              active={Boolean(pathname?.startsWith("/dashboard/telefonos"))}
            />
            <span>TELÉFONOS</span>
          </Link>
          <Link
            href="/dashboard/conversiones"
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium tracking-[0.18em] transition ${
              pathname?.startsWith("/dashboard/conversiones")
                ? "bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)] border border-[var(--color-primary-soft-border)]"
                : "text-[var(--color-text-muted)] hover:bg-[var(--color-bg-3)] hover:text-[var(--color-text)]"
            }`}
          >
            <NavIcon
              variant="conversiones"
              active={Boolean(pathname?.startsWith("/dashboard/conversiones"))}
            />
            <span>CONVERSIONES</span>
          </Link>
        </nav>
        <div className="border-t border-[var(--color-border)] p-3 space-y-2">
          <p className="truncate px-1 text-[11px] text-[var(--color-text-muted)]" title={user?.email ?? undefined}>
            {user?.email}
          </p>
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs font-medium text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg-3)]"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main content: margen izquierdo en desktop para no quedar bajo el sidebar fijo */}
      <div className="flex min-w-0 flex-1 flex-col md:ml-56">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3 sm:px-6">
          <button
            type="button"
            aria-label="Abrir menú"
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-3)] hover:text-[var(--color-text-strong)] md:hidden"
          >
            <MenuIcon className="h-6 w-6" />
          </button>
        </header>
        <main className="min-h-0 flex-1 overflow-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}
