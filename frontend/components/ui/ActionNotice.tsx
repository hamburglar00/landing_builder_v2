"use client";

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore,
  type Dispatch, type ReactNode, type SetStateAction,
} from "react";
import { createPortal } from "react-dom";
import styles from "./ActionNotice.module.css";

type Tone = "success" | "error";
type Notice = { id: number; message: string; tone: Tone; children?: ReactNode };
type Feedback = (message: string, tone?: Tone, children?: ReactNode) => void;
const FeedbackContext = createContext<Feedback | null>(null);
const subscribeToBrowser = () => () => {};

/** One host survives page navigation, including successful saves that redirect. */
export function ActionFeedbackProvider({ children }: { children: ReactNode }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const sequence = useRef(0);
  const portalRoot = useSyncExternalStore(subscribeToBrowser, () => document.body, () => null);
  const notify = useCallback<Feedback>((message, tone = "success", content) => {
    if (!message) return;
    const notice = { id: ++sequence.current, message, tone, children: content };
    setNotices(previous => [...previous.filter(item => item.message !== message || item.tone !== tone), notice].slice(-3));
  }, []);
  const dismiss = useCallback((id: number) => setNotices(previous => previous.filter(item => item.id !== id)), []);
  return <FeedbackContext.Provider value={notify}>
    {children}
    {portalRoot ? createPortal(<div className={styles.stack} aria-label="Resultados de acciones">
      {notices.map(notice => <TimedNotice key={notice.id} {...notice} onDismiss={() => dismiss(notice.id)} />)}
    </div>, portalRoot) : null}
  </FeedbackContext.Provider>;
}

export function useActionFeedback() {
  const notify = useContext(FeedbackContext);
  if (!notify) throw new Error("useActionFeedback debe usarse dentro de ActionFeedbackProvider");
  return notify;
}

/** The revision makes identical consecutive results restart their three seconds. */
export function useActionMessage<T>(initial: T): [T, Dispatch<SetStateAction<T>>, number] {
  const [state, setState] = useState({ value: initial, revision: 0 });
  const update = useCallback<Dispatch<SetStateAction<T>>>(next => {
    setState(previous => ({
      value: typeof next === "function" ? (next as (value: T) => T)(previous.value) : next,
      revision: previous.revision + 1,
    }));
  }, []);
  return [state.value, update, state.revision];
}

/** Mixed result messages carry an explicit tone; backend wording never picks it. */
export function useActionResult() {
  const [result, setResult, revision] = useActionMessage<{ message: string; tone: Tone } | null>(null);
  const report = useCallback((message: string | null, tone: Tone = "error") => {
    setResult(message ? { message, tone } : null);
  }, [setResult]);
  return [result?.message ?? null, report, revision, result?.tone ?? "error"] as const;
}

/** Action feedback shares the host; isolated forms retain the same presentation. */
export function ActionNotice({ message, tone = "success", children, noticeKey }: {
  message?: string | null;
  tone?: Tone;
  children?: ReactNode;
  noticeKey?: string | number;
}) {
  const notify = useContext(FeedbackContext);
  const content = useRef(children);
  useEffect(() => { content.current = children; }, [children]);
  useEffect(() => {
    if (message && notify) notify(message, tone, content.current);
  }, [message, tone, noticeKey, notify]);
  const key = useMemo(() => `${tone}:${noticeKey ?? ""}:${message}`, [tone, noticeKey, message]);
  return !notify && message ? <TimedNotice key={key} message={message} tone={tone}>{children}</TimedNotice> : null;
}

function TimedNotice({ message, tone, children, onDismiss }: {
  message: string; tone: Tone; children?: ReactNode; onDismiss?: () => void;
}) {
  const [visible, setVisible] = useState(true);
  const dismiss = useRef(onDismiss);
  useEffect(() => { dismiss.current = onDismiss; }, [onDismiss]);
  useEffect(() => {
    const timer = setTimeout(() => { setVisible(false); dismiss.current?.(); }, 3300);
    return () => clearTimeout(timer);
  }, []);
  if (!visible) return null;
  return <div role={tone === "error" ? "alert" : "status"} className={styles.notice} data-tone={tone}>
    <span aria-hidden="true" className={styles.icon}>{tone === "error" ? "!" : "✓"}</span>
    <div className={styles.message}>{message}{children}</div>
    <button type="button" className={styles.close} onClick={() => { setVisible(false); dismiss.current?.(); }} aria-label="Cerrar aviso">×</button>
  </div>;
}
