"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getPublicLandingPhone } from "./getLandingPhone";
import type { PublicLandingConfig } from "./types";

type Props = {
  slug: string;
  config: PublicLandingConfig;
  templateVariant?: "default" | "template1" | "template2" | "template3";
  autoStart?: boolean;
  hideButton?: boolean;
  externalTriggerEvent?: string;
};

type FbqFn = (command: string, ...args: unknown[]) => void;
type MetaParamBuilderModule = typeof import("meta-capi-param-builder-clientjs");
let metaParamBuilderModule: MetaParamBuilderModule | null = null;

declare global {
  interface Window {
    fbq?: FbqFn;
    __META?: {
      PIXEL_ID?: string;
      userEmail?: string;
      userPhone?: string;
      userFn?: string;
      userLn?: string;
      externalId?: string;
      safeUUID?: () => string;
    };
  }
}

function getQueryParamsSnapshot() {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

function getDeviceType() {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent.toLowerCase();
  if (/tablet|ipad/.test(ua)) return "tablet";
  if (/mobi|iphone|android/.test(ua)) return "mobile";
  return "desktop";
}

function normalizePhone(raw: string) {
  let value = String(raw || "").replace(/\D+/g, "");
  if (value.length === 10) value = `54${value}`;
  return value;
}

function generatePromoCode(tag: string) {
  const random = Math.random().toString(16).slice(2, 14);
  return `${tag}-${random}`;
}

function buildMessage(promoCode: string, whatsappPrefillText?: string) {
  const baseMessage = `Hola! quiero mas informacion por favor! Mi codigo es: ${promoCode} y mi nombre es:`.trim();
  const extraText = String(whatsappPrefillText || "").trim();
  return extraText ? `${baseMessage}\n\n${extraText}` : baseMessage;
}

function getOrCreateExternalId() {
  if (typeof window === "undefined") return "";

  const existing = window.localStorage.getItem("external_id");
  if (existing) return existing;

  const created = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  window.localStorage.setItem("external_id", created);
  return created;
}

function firstNonEmpty(...values: Array<string | undefined>) {
  for (const value of values) {
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

function normalizeEmail(raw: string) {
  return raw.trim().toLowerCase();
}

function readMeta() {
  if (typeof window === "undefined") return {};
  return window.__META || {};
}

function getLocalStorageValue(key: string) {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

const CONTACT_DEDUP_TTL_MS = 5 * 60 * 1000;

function getContactDedupKey(slug: string, externalId: string) {
  return `contact_sent:${slug}:${externalId}`;
}

function wasContactRecentlySent(slug: string, externalId: string) {
  if (typeof window === "undefined") return false;
  if (!slug || !externalId) return false;

  try {
    const key = getContactDedupKey(slug, externalId);
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;

    const sentAt = Number(raw);
    if (!Number.isFinite(sentAt)) {
      window.localStorage.removeItem(key);
      return false;
    }

    const isFresh = Date.now() - sentAt < CONTACT_DEDUP_TTL_MS;
    if (!isFresh) {
      window.localStorage.removeItem(key);
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function markContactSent(slug: string, externalId: string) {
  if (typeof window === "undefined") return;
  if (!slug || !externalId) return;

  try {
    const key = getContactDedupKey(slug, externalId);
    window.localStorage.setItem(key, String(Date.now()));
  } catch {
    // Storage failures should not block the redirect.
  }
}

function resolveIdentity(params: URLSearchParams = getQueryParamsSnapshot()) {
  const meta = readMeta();
  const getParam = (name: string) => params.get(name) || "";

  const emailResolved = firstNonEmpty(
    getParam("email"),
    getParam("em"),
    getLocalStorageValue("em"),
    meta.userEmail || "",
  );

  const phoneResolved = firstNonEmpty(
    getParam("phone"),
    getParam("ph"),
    getLocalStorageValue("ph"),
    meta.userPhone || "",
  );

  const cityResolved = firstNonEmpty(getParam("ct"), getLocalStorageValue("ct"));
  const stateResolved = firstNonEmpty(getParam("st"), getLocalStorageValue("st"));
  const zipResolved = firstNonEmpty(getParam("zip"), getLocalStorageValue("zip"));
  const countryResolved = firstNonEmpty(
    getParam("country"),
    getLocalStorageValue("country"),
  );

  const fnResolved = firstNonEmpty(getParam("fn"), meta.userFn || "");
  const lnResolved = firstNonEmpty(getParam("ln"), meta.userLn || "");

  const externalIdResolved = firstNonEmpty(
    meta.externalId || "",
    getLocalStorageValue("external_id"),
  );

  const externalId = externalIdResolved || getOrCreateExternalId();
  const email = emailResolved ? normalizeEmail(emailResolved) : "";
  const ph = phoneResolved ? normalizePhone(phoneResolved) : "";

  return {
    emailRaw: emailResolved,
    phoneRaw: phoneResolved,
    ct: cityResolved,
    st: stateResolved,
    zip: zipResolved,
    country: countryResolved,
    email,
    ph,
    fn: fnResolved,
    ln: lnResolved,
    externalId,
  };
}

async function waitWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timeoutId = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function sendTrackBestEffort(body: string) {
  const fetchFallback = () =>
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });

  if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
    try {
      const blob = new Blob([body], { type: "application/json" });
      const queued = navigator.sendBeacon("/api/track", blob);
      if (queued) return;
    } catch {
      // Fallback to fetch.
    }
  }

  await fetchFallback();
}

async function loadMetaParamBuilder(): Promise<MetaParamBuilderModule> {
  if (metaParamBuilderModule) return metaParamBuilderModule;
  const sdk = await import("meta-capi-param-builder-clientjs");
  metaParamBuilderModule = sdk;
  return sdk;
}

async function collectMetaTrackingParams() {
  if (typeof window === "undefined") {
    return { fbc: "", fbp: "", clientIpAddress: "" };
  }

  try {
    const sdk = await loadMetaParamBuilder();
    await waitWithTimeout(sdk.processAndCollectAllParams(window.location.href), 400);
  } catch {
    try {
      const sdk = await loadMetaParamBuilder();
      sdk.processAndCollectParams(window.location.href);
    } catch {
      // Tracking params are best effort only.
    }
  }

  try {
    const sdk = await loadMetaParamBuilder();
    return {
      fbc: sdk.getFbc() || "",
      fbp: sdk.getFbp() || "",
      clientIpAddress: sdk.getClientIpAddress() || "",
    };
  } catch {
    return { fbc: "", fbp: "", clientIpAddress: "" };
  }
}

export default function WhatsAppButton({
  slug,
  config,
  templateVariant = "default",
  autoStart = false,
  hideButton = false,
  externalTriggerEvent,
}: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [isDisabled, setIsDisabled] = useState(false);
  const phonePromiseRef = useRef<Promise<Awaited<ReturnType<typeof getPublicLandingPhone>> | null> | null>(null);
  const metaTrackingRef = useRef<{ fbc: string; fbp: string; clientIpAddress: string }>({
    fbc: "",
    fbp: "",
    clientIpAddress: "",
  });
  const clickLockRef = useRef(false);
  const noPhoneTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoStartOnceRef = useRef(false);
  const handleClickRef = useRef<() => Promise<void>>(async () => {});

  function ensurePhonePromise() {
    if (!phonePromiseRef.current) {
      phonePromiseRef.current = getPublicLandingPhone(slug)
        .then((data) => data)
        .catch(() => null);
    }
    return phonePromiseRef.current;
  }

  useEffect(() => {
    let cancelled = false;

    const prewarmWithRetry = async () => {
      const delays = [0, 400, 1200];
      for (let i = 0; i < delays.length; i += 1) {
        if (cancelled) return;
        if (delays[i] > 0) {
          await new Promise((resolve) => setTimeout(resolve, delays[i]));
          if (cancelled) return;
        }
        const data = await ensurePhonePromise();
        if (data?.phone) return;
        phonePromiseRef.current = null;
      }
    };

    phonePromiseRef.current = null;
    void prewarmWithRetry();

    return () => {
      cancelled = true;
      if (noPhoneTimeoutRef.current) {
        clearTimeout(noPhoneTimeoutRef.current);
        noPhoneTimeoutRef.current = null;
      }
    };
  }, [slug]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const run = () => {
      void collectMetaTrackingParams().then((value) => {
        metaTrackingRef.current = value;
      });
    };

    const idleCb = (
      window as Window & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
        cancelIdleCallback?: (id: number) => void;
      }
    ).requestIdleCallback;

    if (typeof idleCb === "function") {
      const id = idleCb(run, { timeout: 1500 });
      return () => {
        const cancel = (window as Window & { cancelIdleCallback?: (idleId: number) => void }).cancelIdleCallback;
        if (typeof cancel === "function") cancel(id);
      };
    }

    const timeoutId = window.setTimeout(run, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!autoStart || autoStartOnceRef.current) return;
    autoStartOnceRef.current = true;
    void handleClick();
  }, [autoStart]);

  const ctaText = useMemo(() => config.content?.ctaText || "¡Contactar ya!", [config.content?.ctaText]);

  function extractPhoneId(
    phoneData: Awaited<ReturnType<typeof getPublicLandingPhone>> | null,
  ): number | null {
    if (!phoneData) return null;
    if (typeof phoneData.phoneId === "number") return phoneData.phoneId;
    const maybeId = (phoneData as { id?: unknown }).id;
    return typeof maybeId === "number" ? maybeId : null;
  }

  async function handleClick() {
    if (clickLockRef.current || isLoading || isDisabled) return;

    clickLockRef.current = true;
    setIsLoading(true);
    const tapStartedAt = Date.now();

    try {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });

      const params = getQueryParamsSnapshot();
      const promoCode = generatePromoCode(config.tracking.landingTag || "LP");
      const whatsappPrefillText =
        config.interactions?.enabled && config.interactions.whatsappPrefillText
          ? config.interactions.whatsappPrefillText
          : "";
      const message = buildMessage(promoCode, whatsappPrefillText);
      const eventId = globalThis.crypto?.randomUUID?.() || `${Date.now()}`;
      const sendContactPixel = config.tracking.sendContactPixel !== false;
      const identity = resolveIdentity(params);
      const externalId = identity.externalId;
      const emailRaw = identity.emailRaw;
      const email = identity.email;
      const phoneRaw = identity.phoneRaw;
      const ph = identity.ph;
      let metaTracking = metaTrackingRef.current;

      if (!metaTracking.fbp && !metaTracking.fbc) {
        metaTracking = await collectMetaTrackingParams();
        metaTrackingRef.current = metaTracking;
      } else {
        void collectMetaTrackingParams().then((value) => {
          metaTrackingRef.current = value;
        });
      }

      const fbp = metaTracking.fbp;
      const fbc = metaTracking.fbc;
      const clientIpAddress = metaTracking.clientIpAddress;
      const utmCampaign = params.get("utm_campaign") || "";
      const testEventCode = params.get("test_event_code") || "";
      const shouldSkipContact = testEventCode
        ? false
        : wasContactRecentlySent(slug, externalId);

      let phoneData = await waitWithTimeout(ensurePhonePromise(), 1500);
      if (!phoneData?.phone) {
        phonePromiseRef.current = null;
        phoneData = await waitWithTimeout(ensurePhonePromise(), 2500);
      }

      const effectivePhoneMode =
        phoneData?.phoneMode ?? phoneData?.phoneSelection?.mode ?? "";
      const phone = normalizePhone(phoneData?.phone || "");

      if (!phone) {
        setIsDisabled(true);
        if (noPhoneTimeoutRef.current) {
          clearTimeout(noPhoneTimeoutRef.current);
        }
        noPhoneTimeoutRef.current = setTimeout(() => {
          setIsDisabled(false);
          noPhoneTimeoutRef.current = null;
        }, 2000);
        clickLockRef.current = false;
        return;
      }

      try {
        if (
          sendContactPixel &&
          !shouldSkipContact &&
          typeof window !== "undefined" &&
          window.fbq
        ) {
          const contactData: Record<string, unknown> = {
            source: "main_button",
            external_id: externalId,
          };

          if (email) contactData.em = email;
          if (ph) contactData.ph = ph;
          if (identity.fn) contactData.fn = identity.fn;
          if (identity.ln) contactData.ln = identity.ln;
          if (fbp) contactData.fbp = fbp;
          if (fbc) contactData.fbc = fbc;

          window.fbq("track", "Contact", contactData, { eventID: eventId });
        }
      } catch {
        // Pixel errors must not affect WhatsApp redirect.
      }

      if (effectivePhoneMode === "fair" || effectivePhoneMode === "random") {
        try {
          const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
          const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
          const phoneId = extractPhoneId(phoneData);

          if (baseUrl && anonKey && phoneId != null) {
            const notifyUrl = `${baseUrl.replace(/\/+$/, "")}/functions/v1/phone-click`;
            const notifyBody = JSON.stringify({
              landingName: phoneData?.landingName || config.name,
              phoneId,
              phone,
            });

            void fetch(notifyUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                apikey: anonKey,
                Authorization: `Bearer ${anonKey}`,
              },
              body: notifyBody,
              keepalive: true,
            }).catch(() => undefined);
          }
        } catch {
          // Ignore phone-click errors.
        }
      }

      const payload = {
        event_name: "Contact",
        meta_pixel_id: String(config.tracking.pixelId || "").trim() || undefined,
        sendContactPixel,
        event_id: eventId,
        external_id: externalId,
        event_source_url: window.location.href,
        email: emailRaw,
        phone: phoneRaw,
        fn: identity.fn || undefined,
        ln: identity.ln || undefined,
        ct: identity.ct || undefined,
        st: identity.st || undefined,
        zip: identity.zip || undefined,
        country: identity.country || undefined,
        utm_campaign: utmCampaign,
        test_event_code: testEventCode || undefined,
        fbp,
        fbc,
        client_ip_address: clientIpAddress || undefined,
        client_user_agent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
        telefono_asignado: phone,
        promo_code: promoCode,
        source: "main_button",
        source_platform: "landing",
        brand: config.name,
        landing_id: config.id,
        landing_name: config.name,
        device_type: getDeviceType(),
        cta_tap_to_redirect_ms: Date.now() - tapStartedAt,
        mode: config.background?.mode,
        api_meta: null,
      };

      try {
        if (!shouldSkipContact) {
          const body = JSON.stringify({
            postUrl: config.tracking.postUrl,
            payload,
          });
          void sendTrackBestEffort(body).catch(() => undefined);
        }
      } catch {
        // Tracking should never block redirect.
      }

      if (!shouldSkipContact) {
        markContactSent(slug, externalId);
      }

      await new Promise((resolve) => setTimeout(resolve, 180));
      window.location.assign(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`);
    } catch {
      clickLockRef.current = false;
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    handleClickRef.current = handleClick;
  });

  useEffect(() => {
    if (!externalTriggerEvent || typeof window === "undefined") return;
    const listener = () => {
      void handleClickRef.current();
    };
    window.addEventListener(externalTriggerEvent, listener);
    return () => window.removeEventListener(externalTriggerEvent, listener);
  }, [externalTriggerEvent]);

  const ctaStyle = useMemo(
    () => ({
      color: config.colors?.ctaText ?? "#FFFFFF",
      background: config.colors?.ctaBackground ?? "#25D366",
      fontSize: `${config.typography?.cta?.sizePx ?? 18}px`,
      fontWeight: config.typography?.cta?.weight ?? 700,
    }),
    [
      config.colors?.ctaBackground,
      config.colors?.ctaText,
      config.typography?.cta?.sizePx,
      config.typography?.cta?.weight,
    ],
  );

  if (hideButton) return null;

  if (templateVariant === "template1" || templateVariant === "template2") {
    return (
      <a
        href="#"
        className="cta"
        aria-label="Enviar WhatsApp"
        onClick={(event) => {
          event.preventDefault();
          void handleClick();
        }}
        style={{
          ...ctaStyle,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,.1), 0 10px 24px rgba(0,0,0,.26)",
          pointerEvents: isLoading || isDisabled ? "none" : undefined,
          opacity: isLoading || isDisabled ? 0.75 : undefined,
          transform: isLoading ? "scale(0.97)" : undefined,
          transition: "transform 120ms ease, opacity 120ms ease",
        }}
        aria-busy={isLoading}
      >
        <span className="cta__fill">
          {isDisabled ? "Sin numero disponible" : isLoading ? "Abriendo..." : ctaText}
        </span>
        <img
          src="/whatsapp-icon.png"
          alt="WhatsApp"
          className="cta__icon"
          aria-hidden="true"
        />
      </a>
    );
  }

  return (
    <button
      type="button"
      className="whatsapp-button"
      onClick={() => void handleClick()}
      disabled={isLoading || isDisabled}
      style={{
        ...ctaStyle,
        boxShadow: `0 0 30px 8px ${config.colors?.ctaGlow ?? "#FFD700"}`,
        transform: isLoading ? "scale(0.97)" : undefined,
        transition: "transform 120ms ease, opacity 120ms ease",
      }}
      aria-label="Crear usuario por WhatsApp"
      aria-busy={isLoading}
    >
      <span>{isDisabled ? "Sin numero disponible" : isLoading ? "Abriendo..." : ctaText}</span>
      <img
        src="/whatsapp-icon.png"
        alt=""
        className="whatsapp-icon"
        aria-hidden="true"
      />
    </button>
  );
}
