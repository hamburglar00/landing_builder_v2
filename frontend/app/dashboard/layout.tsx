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
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <p className="text-sm text-zinc-400">Cargando...</p>
      </div>
    );
  }

  if (!isClient) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-50">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-zinc-800 bg-zinc-950 transition-transform duration-200 ease-out md:relative md:translate-x-0 md:w-56 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-4 md:block">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">
              Mis landings
            </h2>
            <p className="mt-0.5 truncate text-xs text-zinc-500">
              {user?.email ?? ""}
            </p>
          </div>
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 md:hidden"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 p-3">
          <Link
            href="/dashboard"
            onClick={() => setSidebarOpen(false)}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              pathname === "/dashboard"
                ? "bg-zinc-800 text-zinc-50"
                : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
            }`}
          >
            Mis Landings
          </Link>
          <Link
            href="/dashboard/gerencias"
            onClick={() => setSidebarOpen(false)}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              pathname?.startsWith("/dashboard/gerencias")
                ? "bg-zinc-800 text-zinc-50"
                : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
            }`}
          >
            Gerencias
          </Link>
        </nav>
        <div className="border-t border-zinc-800 p-3">
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3 sm:px-6">
          <button
            type="button"
            aria-label="Abrir menú"
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 md:hidden"
          >
            <MenuIcon className="h-6 w-6" />
          </button>
          <span className="truncate rounded-full bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
            {user?.email}
          </span>
        </header>
        <main className="min-h-0 flex-1 overflow-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}
