import fs from "fs";
import path from "path";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import type { ComponentPropsWithoutRef } from "react";
import remarkGfm from "remark-gfm";

export default async function AdminDocumentacionPage() {
  const readmePath = path.join(process.cwd(), "README.md");
  let content = "";
  try {
    content = fs.readFileSync(readmePath, "utf-8");
  } catch {
    content = "No se encontró README en el proyecto.";
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Link
          href="/admin/landings"
          className="text-sm text-zinc-400 transition hover:text-zinc-200"
        >
          ← Listado
        </Link>
      </div>
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">
          DOCUMENTACION
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          README del proyecto.
        </p>
      </div>
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
        <div className="max-h-[70vh] overflow-auto text-sm text-zinc-200">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => (
                <h1 className="mt-0 mb-4 text-xl font-semibold text-zinc-100">
                  {children}
                </h1>
              ),
              h2: ({ children }) => (
                <h2 className="mt-6 mb-3 text-lg font-semibold text-zinc-100">
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 className="mt-4 mb-2 text-sm font-semibold text-zinc-100">
                  {children}
                </h3>
              ),
              p: ({ children }) => (
                <p className="mb-2 text-sm leading-relaxed text-zinc-200">
                  {children}
                </p>
              ),
              ul: ({ children }) => (
                <ul className="mb-2 list-disc pl-5 space-y-1 text-sm text-zinc-200">
                  {children}
                </ul>
              ),
              ol: ({ children }) => (
                <ol className="mb-2 list-decimal pl-5 space-y-1 text-sm text-zinc-200">
                  {children}
                </ol>
              ),
              li: ({ children }) => (
                <li className="leading-relaxed">{children}</li>
              ),
              code: (props: ComponentPropsWithoutRef<"code"> & { inline?: boolean }) => {
                const { children, inline } = props;
                return inline ? (
                  <code className="rounded bg-zinc-900/70 px-1.5 py-0.5 text-[11px] text-zinc-100">
                    {children}
                  </code>
                ) : (
                  <code className="block rounded-md border border-zinc-800 bg-zinc-950/80 p-3 text-[11px] leading-relaxed text-zinc-100 overflow-auto">
                    {children}
                  </code>
                );
              },
              pre: ({ children }) => <>{children}</>,
              a: ({ href, children }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-zinc-200 underline underline-offset-2 hover:text-zinc-50"
                >
                  {children}
                </a>
              ),
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

