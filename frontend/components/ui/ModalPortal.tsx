"use client";

import {
  useEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

let openPortalCount = 0;
let previousBodyOverflow = "";
let lockedPanelContent: HTMLElement | null = null;
let previousPanelOverflow = "";

const subscribeToBrowser = () => () => {};
const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function isTopmostPortal(container: HTMLElement) {
  const portals = document.querySelectorAll<HTMLElement>(".app-modal-portal");
  return portals.item(portals.length - 1) === container;
}

function getFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(focusableSelector),
  ).filter((element) => {
    const style = window.getComputedStyle(element);
    return style.visibility !== "hidden" && style.display !== "none";
  });
}

export default function ModalPortal({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    const container = containerRef.current;
    if (!portalRoot || !container) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const focusFrame = window.requestAnimationFrame(() => {
      if (!isTopmostPortal(container) || container.contains(document.activeElement)) {
        return;
      }
      const firstFocusable = getFocusableElements(container)[0];
      (firstFocusable ?? container).focus();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !isTopmostPortal(container)) return;

      const focusable = getFocusableElements(container);
      if (focusable.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !container.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", onKeyDown);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [portalRoot]);

  if (!portalRoot) return null;

  return createPortal(
    <div ref={containerRef} className="app-modal-portal" tabIndex={-1}>
      {children}
    </div>,
    portalRoot,
  );
}
