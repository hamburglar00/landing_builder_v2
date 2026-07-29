"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

let openPortalCount = 0;
let previousBodyOverflow = "";
let lockedPanelContent: HTMLElement | null = null;
let previousPanelOverflow = "";

const subscribeToBrowser = () => () => {};

export default function ModalPortal({ children }: { children: ReactNode }) {
  const portalRoot = useSyncExternalStore<HTMLElement | null>(
    subscribeToBrowser,
    () => document.body,
    () => null,
  );

  useEffect(() => {
    if (!portalRoot) return;
    if (openPortalCount === 0) {
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      lockedPanelContent = document.querySelector<HTMLElement>(".panel-main-content");
      if (lockedPanelContent) {
        previousPanelOverflow = lockedPanelContent.style.overflow;
        lockedPanelContent.style.overflow = "hidden";
      }
    }
    openPortalCount += 1;

    return () => {
      openPortalCount = Math.max(0, openPortalCount - 1);
      if (openPortalCount !== 0) return;

      document.body.style.overflow = previousBodyOverflow;
      if (lockedPanelContent) {
        lockedPanelContent.style.overflow = previousPanelOverflow;
      }
      lockedPanelContent = null;
      previousPanelOverflow = "";
    };
  }, [portalRoot]);

  if (!portalRoot) return null;

  return createPortal(<div className="app-modal-portal">{children}</div>, portalRoot);
}
