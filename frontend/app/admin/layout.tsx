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
  variant:
    | "inicio"
    | "clientes"
    | "landings"
    | "gerencias"
    | "telefonos"
    | "conversiones"
    | "seguimiento"
    | "tests"
    | "documentacion"
    | "settings";
  active: boolean;
}) {
  const base = active ? "text-zinc-50" : "text-zinc-500";

  const accent =
    variant === "telefonos"
      ? active
        ? "text-pink-400"
        : "text-pink-300"
      : variant === "gerencias"
        ? active
          ? "text-sky-400"
          : "text-sky-300"
        : variant === "landings"
          ? active
            ? "text-emerald-400"
            : "text-emerald-300"
          : variant === "clientes"
            ? active
              ? "text-indigo-400"
              : "text-indigo-300"
            : variant === "conversiones"
              ? active
                ? "text-orange-400"
                : "text-orange-300"
              : variant === "seguimiento"
                ? active
                  ? "text-amber-300"
                  : "text-amber-200"
              : variant === "tests"
                ? active
                  ? "text-amber-400"
                  : "text-amber-300"
                : active
                  ? "text-zinc-200"
                  : "text-zinc-400";

  if (variant === "landings") {
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
          <rect x="3" y="3" width="7" height="7" className={accent} />
          <rect x="14" y="4" width="7" height="5" />
          <rect x="4" y="14" width="5" height="7" />
          <rect x="13" y="13" width="8" height="8" />
        </svg>
      </span>
    );
  }

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

  if (variant === "gerencias") {
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
          <rect x="3" y="11" width="6" height="9" className={accent} />
          <rect x="10" y="7" width="6" height="13" />
          <rect x="17" y="4" width="4" height="16" />
        </svg>
      </span>
    );
  }

  if (variant === "telefonos") {
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

  if (variant === "clientes") {
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
          <circle cx="8" cy="8" r="3" className={accent} />
          <circle cx="17" cy="8" r="2.5" />
          <path d="M3 20c0-2.8 2.2-5 5-5s5 2.2 5 5" />
          <path d="M14.5 18.5c.4-1.9 1.9-3.5 4-3.5 2.3 0 4 1.8 4 4" />
        </svg>
      </span>
    );
  }

  if (variant === "conversiones") {
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
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" className={accent} />
          <polyline points="16 7 22 7 22 13" />
        </svg>
      </span>
    );
  }

  if (variant === "seguimiento") {
    return (
      <span className={base}>
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 10v4" />
          <path d="M5 9.5l10-4v13l-10-4z" className={accent} />
          <path d="M15 9l4-2.5v11L15 15" />
          <path d="M7.5 15.5v2.2a1.8 1.8 0 0 0 1.8 1.8h.2" />
        </svg>
      </span>
    );
  }

  if (variant === "tests") {
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
          <rect x="4" y="3" width="16" height="4" className={accent} />
          <rect x="6" y="7" width="4" height="14" />
          <rect x="14" y="7" width="4" height="14" />
        </svg>
      </span>
    );
  }

  if (variant === "documentacion") {
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
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" className={accent} />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          <path d="M8 7h8" />
          <path d="M8 11h8" />
        </svg>
      </span>
    );
  }

  // settings
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
        <circle cx="12" cy="12" r="3" className={accent} />
        <path d="M19.4 15a1.8 1.8 0 0 0 .37 2l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.8 1.8 0 0 0-2-.37 1.8 1.8 0 0 0-1 1.62V21a2 2 0 1 1-4 0v-.09a1.8 1.8 0 0 0-1-1.62 1.8 1.8 0 0 0-2 .37l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.8 1.8 0 0 0 .37-2 1.8 1.8 0 0 0-1.62-1H3a2 2 0 0 1 0-4h.09a1.8 1.8 0 0 0 1.62-1 1.8 1.8 0 0 0-.37-2l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.8 1.8 0 0 0 2 .37H9A1.8 1.8 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09a1.8 1.8 0 0 0 1 1.62 1.8 1.8 0 0 0 2-.37l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.8 1.8 0 0 0-.37 2V11c0 .74.42 1.4 1.1 1.73" />
      </svg>
    </span>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const { data, error } = await supabase.auth.getUser();

      if (error || !data.user) {
        router.replace("/login");
        return;
      }

      setUser(data.user);

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profileError) {
        setRoleError("No se pudo verificar tu rol de usuario.");
        setIsAdmin(false);
        setIsCheckingSession(false);
        return;
      }

      if (!profile || profile.role !== "admin") {
        setIsAdmin(false);
        setIsCheckingSession(false);
        return;
      }

      setIsAdmin(true);
      setIsCheckingSession(false);
    };

    void checkSession();
  }, [router]);

  useEffect(() => {
    if (!isCheckingSession && !isAdmin && pathname === "/admin/clientes") {
      router.replace("/admin");
    }
  }, [isAdmin, isCheckingSession, pathname, router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  if (isCheckingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg-0)]">
        <p className="text-sm text-[var(--color-text-muted)]">
          Cargando panel...
        </p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg-0)] px-4">
        <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-1)] p-6 text-center shadow-xl shadow-black/40">
          <h1 className="mb-3 text-base font-semibold text-[var(--color-text-strong)]">
            Acceso restringido
          </h1>
          <p className="mb-4 text-sm text-[var(--color-text-muted)]">
            Esta sección es solo para usuarios con rol de administrador.
          </p>
          {roleError && (
            <p className="mb-4 text-xs text-[var(--color-danger)]" role="alert">
              {roleError}
            </p>
          )}
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-xl border border-[var(--color-border)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-xs font-medium text-[var(--color-text)] transition hover:bg-[rgba(255,255,255,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring-neutral)]"
          >
            Volver al login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[var(--color-bg-0)] text-[var(--color-text)]">
      {/* Overlay móvil cuando el menú está abierto */}
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
            href="/admin/inicio"
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium tracking-[0.18em] transition ${
              pathname === "/admin/inicio"
                ? "bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)] border border-[var(--color-primary-soft-border)]"
                : "text-[var(--color-text-muted)] hover:bg-[var(--color-bg-3)] hover:text-[var(--color-text)]"
            }`}
          >
            <NavIcon
              variant="inicio"
              active={pathname === "/admin/inicio"}
            />
            <span>INICIO</span>
          </Link>
          <Link
            href="/admin/clientes"
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium tracking-[0.18em] transition ${
              pathname === "/admin/clientes"
                ? "bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)] border border-[var(--color-primary-soft-border)]"
                : "text-[var(--color-text-muted)] hover:bg-[var(--color-bg-3)] hover:text-[var(--color-text)]"
            }`}
          >
            <NavIcon
              variant="clientes"
              active={pathname === "/admin/clientes"}
            />
            <span>CLIENTES</span>
          </Link>
          <Link
            href="/admin/landings"
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium tracking-[0.18em] transition ${
              pathname?.startsWith("/admin/landings")
                ? "bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)] border border-[var(--color-primary-soft-border)]"
                : "text-[var(--color-text-muted)] hover:bg-[var(--color-bg-3)] hover:text-[var(--color-text)]"
            }`}
          >
            <NavIcon
              variant="landings"
              active={Boolean(pathname?.startsWith("/admin/landings"))}
            />
            <span>LANDINGS</span>
          </Link>
          <Link
            href="/admin/gerencias"
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium tracking-[0.18em] transition ${
              pathname?.startsWith("/admin/gerencias")
                ? "bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)] border border-[var(--color-primary-soft-border)]"
                : "text-[var(--color-text-muted)] hover:bg-[var(--color-bg-3)] hover:text-[var(--color-text)]"
            }`}
          >
            <NavIcon
              variant="gerencias"
              active={Boolean(pathname?.startsWith("/admin/gerencias"))}
            />
            <span>GERENCIAS</span>
          </Link>
          <Link
            href="/admin/telefonos"
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium tracking-[0.18em] transition ${
              pathname?.startsWith("/admin/telefonos")
                ? "bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)] border border-[var(--color-primary-soft-border)]"
                : "text-[var(--color-text-muted)] hover:bg-[var(--color-bg-3)] hover:text-[var(--color-text)]"
            }`}
          >
            <NavIcon
              variant="telefonos"
              active={Boolean(pathname?.startsWith("/admin/telefonos"))}
            />
            <span>TELÉFONOS</span>
          </Link>
          <Link
            href="/admin/conversiones"
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium tracking-[0.18em] transition ${
              pathname?.startsWith("/admin/conversiones")
                ? "bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)] border border-[var(--color-primary-soft-border)]"
                : "text-[var(--color-text-muted)] hover:bg-[var(--color-bg-3)] hover:text-[var(--color-text)]"
            }`}
          >
            <NavIcon
              variant="conversiones"
              active={Boolean(pathname?.startsWith("/admin/conversiones"))}
            />
            <span>CONVERSIONES</span>
          </Link>
          <Link
            href="/admin/seguimiento"
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium tracking-[0.18em] transition ${
              pathname?.startsWith("/admin/seguimiento")
                ? "bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)] border border-[var(--color-primary-soft-border)]"
                : "text-[var(--color-text-muted)] hover:bg-[var(--color-bg-3)] hover:text-[var(--color-text)]"
            }`}
          >
            <NavIcon
              variant="seguimiento"
              active={Boolean(pathname?.startsWith("/admin/seguimiento"))}
            />
            <span>SEGUIMIENTO</span>
          </Link>
          <Link
            href="/admin/settings"
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium tracking-[0.18em] transition ${
              pathname === "/admin/settings"
                ? "bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)] border border-[var(--color-primary-soft-border)]"
                : "text-[var(--color-text-muted)] hover:bg-[var(--color-bg-3)] hover:text-[var(--color-text)]"
            }`}
          >
            <NavIcon
              variant="settings"
              active={pathname === "/admin/settings"}
            />
            <span>CONFIGURACIÓN</span>
          </Link>
          <Link
            href="/admin/tests"
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium tracking-[0.18em] transition ${
              pathname === "/admin/tests"
                ? "bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)] border border-[var(--color-primary-soft-border)]"
                : "text-[var(--color-text-muted)] hover:bg-[var(--color-bg-3)] hover:text-[var(--color-text)]"
            }`}
          >
            <NavIcon variant="tests" active={pathname === "/admin/tests"} />
            <span>TESTS</span>
          </Link>
          <Link
            href="/admin/documentacion"
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium tracking-[0.18em] transition ${
              pathname === "/admin/documentacion"
                ? "bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)] border border-[var(--color-primary-soft-border)]"
                : "text-[var(--color-text-muted)] hover:bg-[var(--color-bg-3)] hover:text-[var(--color-text)]"
            }`}
          >
            <NavIcon
              variant="documentacion"
              active={pathname === "/admin/documentacion"}
            />
            <span>DOCUMENTACIÓN</span>
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
