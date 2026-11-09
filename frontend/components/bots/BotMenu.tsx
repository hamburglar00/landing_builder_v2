"use client";

import { useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import styles from "./BotsDirectory.module.css";

const subscribe = () => () => {};

/** A portal keeps row menus inside the viewport, independently of table scrolling.
 * Children stay mounted when closed so their existing dialogs keep their state. */
export function BotMenu({ label, children, text }: { label: string; children: ReactNode; text?: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const lastFocusedItem = useRef<HTMLElement | null>(null);
  const body = useSyncExternalStore(subscribe, () => document.body, () => null);

  useLayoutEffect(() => {
    if (!open || !body) return;
    const position = () => {
      if (!trigger.current || !menu.current) return;
      const anchor = trigger.current.getBoundingClientRect();
      const bounds = menu.current.getBoundingClientRect();
      menu.current.style.left = `${Math.max(12, Math.min(anchor.right - bounds.width, document.documentElement.clientWidth - bounds.width - 12))}px`;
      menu.current.style.top = `${Math.max(12, anchor.bottom + bounds.height + 6 > innerHeight - 12 ? anchor.top - bounds.height - 6 : anchor.bottom + 6)}px`;
    };
    position();
    menu.current?.querySelector<HTMLElement>('[role^="menuitem"]:not([disabled])')?.focus();
    const dismiss = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setOpen(false);
    };
    // Disabling an in-flight switch/radio can move focus to the body. Keep keyboard
    // navigation in this menu while existing handlers update their loading state.
    const observer = new MutationObserver(() => {
      if (document.activeElement !== document.body || !menu.current) return;
      const previous = lastFocusedItem.current;
      const candidate = previous?.isConnected && !previous.hasAttribute("disabled") ? previous : menu.current.querySelector<HTMLElement>('[role^="menuitem"]:not([disabled])');
      candidate?.focus();
    });
    if (menu.current) observer.observe(menu.current, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled"] });
    document.addEventListener("pointerdown", dismiss);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      observer.disconnect();
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
    };
  }, [open, body]);

  return <>
    <button ref={trigger} type="button" className={text ? "ui-button ui-button-secondary gap-2" : styles.iconButton}
      aria-label={label} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined}
      onClick={event => { event.stopPropagation(); setOpen(value => !value); }}
      onKeyDown={event => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); event.stopPropagation(); setOpen(true); }
        if (open && (event.key === "Escape" || event.key === "Tab")) { event.stopPropagation(); setOpen(false); }
      }}>
      {text ? <>{text}<span aria-hidden="true" className="text-[10px]">⌄</span></> : <span aria-hidden="true">⋯</span>}
    </button>
    {body && createPortal(<div ref={menu} id={id} role="menu" aria-label={label} className={styles.menu} style={{ display: open ? undefined : "none" }}
      onFocusCapture={event => { if (event.currentTarget.contains(event.target)) lastFocusedItem.current = event.target; }}
      onClick={event => {
        event.stopPropagation();
        if (!event.currentTarget.contains(event.target as Node)) return;
        const item = (event.target as HTMLElement).closest('[role="menuitem"]');
        if (item && !item.hasAttribute("disabled")) setOpen(false);
      }}
      onKeyDown={event => {
        if (!event.currentTarget.contains(event.target as Node)) return;
        if (event.key === "Escape" || event.key === "Tab") {
          if (event.key === "Escape") event.preventDefault();
          event.stopPropagation(); setOpen(false); trigger.current?.focus(); return;
        }
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([disabled])'));
        const current = items.indexOf(document.activeElement as HTMLElement);
        const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
        items[next]?.focus();
      }}>{children}</div>, body)}
  </>;
}
