"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** A single scale for an inert, full mobile mockup; the editor never clips it. */
export function EditorPreviewFrame({ children }: { children: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 360, height: 640, scale: .8 });
  useEffect(() => {
    const outer = frame.current, inner = content.current;
    if (!outer || !inner) return;
    const measure = () => {
      const height = Math.max(640, inner.scrollHeight);
      const availableHeight = Math.max(220, Math.min(640, window.innerHeight - 215));
      const scale = Math.min(1, outer.clientWidth / 360, availableHeight / height);
      setSize(previous => previous.height === height && previous.scale === scale ? previous : { width: 360, height, scale });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(outer); observer.observe(inner);
    window.addEventListener("resize", measure); measure();
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, []);
  return <div ref={frame} data-editor-preview-frame className="relative w-full" style={{ height: size.height * size.scale }}>
    <div ref={content} className="absolute left-1/2 top-0 w-[360px] origin-top" style={{ transform: `translateX(-50%) scale(${size.scale})` }}>
      {children}
    </div>
  </div>;
}
