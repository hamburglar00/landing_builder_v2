"use client";

import { useEffect, useRef, useState } from "react";

/** Full page in the editor; a full-width, inert thumbnail in the gallery. */
export function Template9Preview({ html, compact, gallery }: { html: string; compact: boolean; gallery: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const element = ref.current;
    if (!element || !gallery) return;
    const resize = () => setScale(element.clientWidth / 390);
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [gallery]);
  return <div ref={ref} className={`relative overflow-hidden ${gallery ? "h-full w-full" : compact ? "h-full min-h-[240px] w-full rounded-xl" : "mx-auto aspect-[390/844] w-full max-w-[390px] rounded-xl"}`}>
    {gallery ? (
      <iframe title="Vista previa de Plantilla 9" sandbox="" srcDoc={html} tabIndex={-1} className="pointer-events-none absolute left-1/2 top-1/2 border-0" style={{ width: 390, height: 520, maxWidth: "none", transform: `translate(-50%, -50%) scale(${scale})` }} />
    ) : (
      // Use the available width as a real viewport. Scaling a second time in the
      // editor rasterized the text and clipped the footer/cookie notice.
      <iframe title="Vista previa de Plantilla 9" sandbox="" srcDoc={html} className="absolute inset-0 h-full w-full border-0" />
    )}
  </div>;
}
