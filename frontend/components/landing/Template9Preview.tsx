"use client";

import { useEffect, useRef, useState } from "react";

/** Full page in the editor; a full-width, inert thumbnail in the gallery. */
export function Template9Preview({ html, compact, gallery }: { html: string; compact: boolean; gallery: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const iframe = useRef<HTMLIFrameElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(844);
  const [availableHeight, setAvailableHeight] = useState(640);
  const editorHtml = html.replace("</head>", "<style>html,body{margin:0;overflow:visible!important}.template9--preview{height:auto;min-height:844px}.template9--preview .template9__wrap{flex:1 0 auto;overflow:visible}</style></head>");
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const resize = () => {
      setScale(element.clientWidth / 390);
      setAvailableHeight(Math.max(220, Math.min(640, window.innerHeight - 215)));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    window.addEventListener("resize", resize);
    return () => { observer.disconnect(); window.removeEventListener("resize", resize); };
  }, [gallery]);
  useEffect(() => {
    if (gallery) return;
    const frame = iframe.current;
    let observer: ResizeObserver | undefined;
    const observe = () => {
      observer?.disconnect();
      const body = frame?.contentDocument?.body;
      if (!body) return;
      const measure = () => setHeight(Math.max(844, Math.ceil(body.getBoundingClientRect().height), body.scrollHeight));
      observer = new ResizeObserver(measure); observer.observe(body); measure();
    };
    frame?.addEventListener("load", observe); observe();
    return () => { frame?.removeEventListener("load", observe); observer?.disconnect(); };
  }, [gallery, html]);
  const fitScale = Math.min(1, scale, availableHeight / height);
  return <div ref={ref} data-template9-preview className={`relative overflow-hidden ${gallery ? "h-full w-full" : "mx-auto w-full max-w-[390px] rounded-xl"}`} style={gallery ? undefined : { height: height * fitScale }}>
    {gallery ? (
      <iframe title="Vista previa de Plantilla 9" sandbox="" srcDoc={html} tabIndex={-1} className="pointer-events-none absolute left-1/2 top-1/2 border-0" style={{ width: 390, height: 520, maxWidth: "none", transform: `translate(-50%, -50%) scale(${scale})` }} />
    ) : (
      // Static document only. Same-origin lets us measure its natural height;
      // scripts, forms, popups and navigation remain disabled by the sandbox.
      <iframe ref={iframe} title="Vista previa de Plantilla 9" sandbox="allow-same-origin" srcDoc={editorHtml} tabIndex={-1} className="pointer-events-none absolute left-1/2 top-0 border-0" style={{ width: 390, height, maxWidth: "none", transformOrigin: "top center", transform: `translateX(-50%) scale(${fitScale})` }} />
    )}
  </div>;
}
