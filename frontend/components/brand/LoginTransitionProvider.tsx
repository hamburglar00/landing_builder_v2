"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { LandingBuilderLaunch } from "./LandingBuilderLaunch";

type Controls = { start: () => void; cancel: () => void; finish: () => void };
const LoginTransitionContext = createContext<Controls | null>(null);

export function LoginTransitionProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<"idle" | "launching" | "leaving">("idle");
  const overlay = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const previousPath = useRef(pathname);
  const active = phase !== "idle";
  const start = useCallback(() => setPhase("launching"), []);
  const cancel = useCallback(() => setPhase("idle"), []);
  const finish = useCallback(() => setPhase(value => value === "launching" ? "leaving" : value), []);
  const controls = useMemo(() => ({ start, cancel, finish }), [start, cancel, finish]);

  useEffect(() => {
    const frame = pathname === "/login" && previousPath.current !== pathname ? requestAnimationFrame(cancel) : 0;
    previousPath.current = pathname;
    return () => cancelAnimationFrame(frame);
  }, [pathname, cancel]);

  useEffect(() => {
    if (phase !== "leaving") return;
    const timeout = window.setTimeout(cancel, 240);
    return () => window.clearTimeout(timeout);
  }, [phase, cancel]);

  useEffect(() => {
    if (!active) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    overlay.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [active]);

  return <LoginTransitionContext.Provider value={controls}>
    <div inert={active} style={{ display: "contents" }}>{children}</div>
    {active && <LandingBuilderLaunch leaving={phase === "leaving"} overlayRef={overlay} />}
  </LoginTransitionContext.Provider>;
}

export function useLoginTransition() {
  const context = useContext(LoginTransitionContext);
  if (!context) throw new Error("LoginTransitionProvider is required.");
  return context;
}

/** Wait until the destination (or its error state) has painted before revealing it. */
export function useLoginArrival(ready: boolean) {
  const { finish } = useLoginTransition();
  useEffect(() => {
    if (!ready) return;
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => { secondFrame = requestAnimationFrame(finish); });
    return () => { cancelAnimationFrame(firstFrame); cancelAnimationFrame(secondFrame); };
  }, [ready, finish]);
}
