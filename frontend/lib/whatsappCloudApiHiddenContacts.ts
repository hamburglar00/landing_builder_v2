"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const HIDDEN_CONTACTS_EVENT = "whatsapp-cloud-api-hidden-contacts-changed";

function storageKey(scope: string | null | undefined) {
  return `whatsapp-cloud-api:hidden-contacts:${scope || "ALL"}`;
}

function readHiddenContactIds(scope: string | null | undefined): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.sessionStorage.getItem(storageKey(scope));
    const ids = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(ids)) return new Set();
    return new Set(ids.map((id) => String(id)).filter(Boolean));
  } catch {
    return new Set();
  }
}

function writeHiddenContactIds(
  scope: string | null | undefined,
  ids: Set<string>,
) {
  if (typeof window === "undefined") return;
  const values = Array.from(ids).filter(Boolean);
  window.sessionStorage.setItem(storageKey(scope), JSON.stringify(values));
  window.dispatchEvent(
    new CustomEvent(HIDDEN_CONTACTS_EVENT, {
      detail: { scope: scope || "ALL" },
    }),
  );
}

export function useWhatsappCloudApiHiddenContacts(
  scope: string | null | undefined,
) {
  const normalizedScope = scope || "ALL";
  const [hiddenContactIds, setHiddenContactIds] = useState<Set<string>>(
    () => readHiddenContactIds(normalizedScope),
  );

  useEffect(() => {
    const refresh = () => setHiddenContactIds(readHiddenContactIds(normalizedScope));
    refresh();
    window.addEventListener(HIDDEN_CONTACTS_EVENT, refresh);
    return () => window.removeEventListener(HIDDEN_CONTACTS_EVENT, refresh);
  }, [normalizedScope]);

  const hideContactId = useCallback(
    (contactId: string) => {
      const id = String(contactId || "").trim();
      if (!id) return;
      const next = readHiddenContactIds(normalizedScope);
      next.add(id);
      writeHiddenContactIds(normalizedScope, next);
    },
    [normalizedScope],
  );

  return useMemo(
    () => ({ hiddenContactIds, hideContactId }),
    [hiddenContactIds, hideContactId],
  );
}
