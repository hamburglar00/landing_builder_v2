"use client";

import { useEffect } from "react";

type MetaTracking = {
  fbc: string;
  fbp: string;
  clientIpAddress: string;
};

declare global {
  interface Window {
    __PUBLIC_META_TRACKING?: MetaTracking;
    __PUBLIC_META_COLLECT_PARAMS?: () => Promise<MetaTracking>;
  }
}

function cookieValue(name: string): string {
  try {
    const parts = document.cookie ? document.cookie.split("; ") : [];
    for (const part of parts) {
      const separator = part.indexOf("=");
      const key = separator >= 0 ? part.slice(0, separator) : part;
      if (key === name) return decodeURIComponent(separator >= 0 ? part.slice(separator + 1) : "");
    }
  } catch {
    // Ignore unavailable cookies.
  }
  return "";
}

async function waitWithTimeout<T>(value: Promise<T> | T, timeoutMs: number): Promise<T | null> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      Promise.resolve(value),
      new Promise<null>((resolve) => {
        timeoutId = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export default function MetaTrackingBootstrap() {
  useEffect(() => {
    let cancelled = false;

    const collect = async (): Promise<MetaTracking> => {
      try {
        const sdk = await import("meta-capi-param-builder-clientjs");
        await waitWithTimeout(sdk.processAndCollectAllParams(window.location.href), 400);
        return {
          fbc: sdk.getFbc() || cookieValue("_fbc"),
          fbp: sdk.getFbp() || cookieValue("_fbp"),
          clientIpAddress: sdk.getClientIpAddress() || "",
        };
      } catch {
        return {
          fbc: cookieValue("_fbc"),
          fbp: cookieValue("_fbp"),
          clientIpAddress: "",
        };
      }
    };

    window.__PUBLIC_META_COLLECT_PARAMS = collect;

    const warmTracking = async () => {
      for (const delay of [0, 300, 1200, 3000]) {
        if (delay > 0) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
        if (cancelled) return;

        const value = await collect();
        if (cancelled) return;
        window.__PUBLIC_META_TRACKING = value;
        if (value.fbc && value.fbp) return;
      }
    };

    void warmTracking();

    return () => {
      cancelled = true;
      if (window.__PUBLIC_META_COLLECT_PARAMS === collect) {
        delete window.__PUBLIC_META_COLLECT_PARAMS;
      }
    };
  }, []);

  return null;
}
