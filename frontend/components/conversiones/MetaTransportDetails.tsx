import React from "react";
import type { ConversionLogRow } from "@/lib/conversionsDb";

export function MetaTransportDetails({ log }: { log: Pick<ConversionLogRow, "meta_api_version" | "meta_http_status" | "meta_attempt"> }) {
  const version = /^v\d{1,3}\.\d{1,3}$/.test(log.meta_api_version ?? "") ? log.meta_api_version : null;
  const status = Number.isInteger(log.meta_http_status) && Number(log.meta_http_status) >= 100 && Number(log.meta_http_status) <= 599
    ? log.meta_http_status : null;
  const attempt = Number.isSafeInteger(log.meta_attempt) && Number(log.meta_attempt) > 0 ? log.meta_attempt : null;
  if (!version && status === null && attempt === null) return null;
  return <div className="mt-1 text-[10px] font-normal text-zinc-400" title="El intento HTTP se cuenta dentro de esta ejecución; cada ejecución posterior de la cola comienza en 1.">
    {[version ? `Graph ${version}` : null, status !== null ? `HTTP ${status}` : attempt !== null ? "Sin respuesta HTTP" : null,
      attempt !== null ? `Intento HTTP ${attempt}` : null].filter(Boolean).join(" · ")}
  </div>;
}
