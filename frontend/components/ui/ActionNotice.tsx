"use client";

import { useEffect, useState, type ReactNode } from "react";
import styles from "./ActionNotice.module.css";

/** A transient result of a user action. Form validation stays next to its field. */
export function ActionNotice({ message, tone = "success", children }: {
  message?: string | null;
  tone?: "success" | "error";
  children?: ReactNode;
}) {
  return message ? <TimedNotice key={message} message={message} tone={tone}>{children}</TimedNotice> : null;
}

function TimedNotice({ message, tone, children }: { message: string; tone: "success" | "error"; children?: ReactNode }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 5500);
    return () => clearTimeout(timer);
  }, []);
  if (!visible) return null;
  return <div role={tone === "error" ? "alert" : "status"} className={styles.notice} data-tone={tone}>
    <span aria-hidden="true" className={styles.icon}>{tone === "error" ? "!" : "✓"}</span>
    <div className={styles.message}>{message}{children}</div>
    <button type="button" className={styles.close} onClick={() => setVisible(false)} aria-label="Cerrar aviso">×</button>
  </div>;
}
