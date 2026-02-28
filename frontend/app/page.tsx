import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-8">
      <main className="w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6 text-center shadow-xl shadow-black/40 backdrop-blur sm:p-8">
        <h1 className="mb-3 text-xl font-semibold text-zinc-50 sm:text-2xl">
          Panel de gestión de clientes
        </h1>
        <p className="mb-6 text-sm text-zinc-400 sm:mb-8">
          MVP inicial para administrar usuarios finales conectando Next.js con
          Supabase.
        </p>

        <Link
          href="/login"
          className="inline-flex items-center justify-center rounded-lg bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200"
        >
          Entrar al panel
        </Link>
      </main>
    </div>
  );
}
