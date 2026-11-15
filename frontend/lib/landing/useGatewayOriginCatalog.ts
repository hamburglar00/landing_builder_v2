"use client";
import { useEffect, useState } from "react";
import { fetchGatewayOriginCatalog, type GatewayOriginCatalog } from "./gatewayPublication";
export function useGatewayOriginCatalog(enabled = true) {
  const [catalog, setCatalog] = useState<GatewayOriginCatalog>({});
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    fetchGatewayOriginCatalog().then(value => { if (active) setCatalog(value); }).catch(() => {});
    return () => { active = false; };
  }, [enabled]);
  return catalog;
}
