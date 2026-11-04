"use client";

import { useEffect, useRef, useState } from "react";

/** Fit the entire mobile page, including its footer, in every preview container. */
export function Template9Preview({ html, compact, gallery }: { html: string; compact: boolean; gallery: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const resize = () => setScale(Math.min(element.clientWidth / 390, element.clientHeight / 844));
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className={`relative overflow-hidden ${gallery ? "h-full w-full" : compact ? "h-full min-h-[240px] w-full rounded-3xl" : "mx-auto aspect-[390/844] w-full max-w-[390px] rounded-3xl"}`}>
    <iframe title="Vista previa de Plantilla 9" sandbox="" srcDoc={html} tabIndex={-1} className="pointer-events-none absolute left-1/2 top-1/2 border-0" style={{ width: 390, height: 844, maxWidth: "none", transform: `translate(-50%, -50%) scale(${scale})` }} />
  </div>;
}
