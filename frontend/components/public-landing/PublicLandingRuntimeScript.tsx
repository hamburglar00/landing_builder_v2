import type { PublicLandingConfig } from "./types";

type Props = {
  slug: string;
  config: PublicLandingConfig;
};

const SOCIAL_PROOF_ITEMS = [
  { quote: "Muy buena atencion. Me respondieron rapido y sin vueltas.", name: "Nico R." },
  { quote: "Excelente servicio, todo claro desde el primer mensaje.", name: "Juan P." },
  { quote: "Siempre responden rapido y con muy buena predisposicion.", name: "Mica F." },
  { quote: "Atencion super amable. Me resolvieron todo en minutos.", name: "Seba L." },
  { quote: "Me ayudaron en todo el proceso, muy claros y confiables.", name: "Romi D." },
  { quote: "Atencion impecable. Responden al toque por WhatsApp.", name: "Lau T." },
  { quote: "Servicio muy confiable, siempre cumplen con lo que dicen.", name: "Dario C." },
  { quote: "Todo simple, rapido y bien explicado. Recomiendo.", name: "Cami V." },
  { quote: "Muy buena experiencia. La atencion fue rapida y cordial.", name: "Pablo M." },
  { quote: "Excelente trato, buena onda y respuesta inmediata.", name: "Gise A." },
];

function escapeScriptJson(value: unknown) {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (character) => {
    switch (character) {
      case "<":
        return "\\u003c";
      case ">":
        return "\\u003e";
      case "&":
        return "\\u0026";
      case "\u2028":
        return "\\u2028";
      case "\u2029":
        return "\\u2029";
      default:
        return character;
    }
  });
}

export default function PublicLandingRuntimeScript({ slug, config }: Props) {
  const runtimeConfig = {
    slug,
    landingId: config.id,
    landingName: config.name,
    pixelId: String(config.tracking?.pixelId || "").trim(),
    postUrl: config.tracking?.postUrl || "",
    landingTag: config.tracking?.landingTag || "LP",
    sendContactPixel: config.tracking?.sendContactPixel !== false,
    ctaText: config.content?.ctaText || "¡Contactar ya!",
    phoneSelectionMode: config.phoneSelection?.mode || "",
    backgroundMode: config.background?.mode || "",
    whatsappPrefillText:
      config.interactions?.enabled && config.interactions.whatsappPrefillText
        ? config.interactions.whatsappPrefillText
        : "",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    socialProofItems: SOCIAL_PROOF_ITEMS,
  };

  const script = `
    (function () {
      var cfg = ${escapeScriptJson(runtimeConfig)};
      var clickLocked = false;
      var noPhoneTimer = null;
      var metaTracking = { fbp: "", fbc: "", clientIpAddress: "" };
      var CONTACT_DEDUP_TTL_MS = 5 * 60 * 1000;
      var SOCIAL_PROOF_INTERVAL_MS = 5000;

      function queryParams() {
        try { return new URLSearchParams(window.location.search); }
        catch (e) { return new URLSearchParams(); }
      }

      function deviceType() {
        var ua = (navigator.userAgent || "").toLowerCase();
        if (/tablet|ipad/.test(ua)) return "tablet";
        if (/mobi|iphone|android/.test(ua)) return "mobile";
        return "desktop";
      }

      function normalizePhone(raw) {
        var value = String(raw || "").replace(/\\D+/g, "");
        if (value.length === 10) value = "54" + value;
        return value;
      }

      function generatePromoCode(tag) {
        return String(tag || "LP") + "-" + Math.random().toString(16).slice(2, 14);
      }

      function buildMessage(promoCode) {
        var baseMessage = ("Hola! quiero mas informacion por favor! Mi codigo es: " + promoCode + " y mi nombre es:").trim();
        var extraText = String(cfg.whatsappPrefillText || "").trim();
        return extraText ? baseMessage + "\\n\\n" + extraText : baseMessage;
      }

      function safeUUID() {
        if (window.crypto && typeof window.crypto.randomUUID === "function") {
          return window.crypto.randomUUID();
        }
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
          var r = Math.random() * 16 | 0;
          var v = c === "x" ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      }

      function getLocalStorageValue(key) {
        try { return window.localStorage.getItem(key) || ""; }
        catch (e) { return ""; }
      }

      function setLocalStorageValue(key, value) {
        try { window.localStorage.setItem(key, value); }
        catch (e) {}
      }

      function getOrCreateExternalId() {
        var existing = getLocalStorageValue("external_id");
        if (existing) return existing;
        var created = safeUUID();
        setLocalStorageValue("external_id", created);
        return created;
      }

      function firstNonEmpty(values) {
        for (var i = 0; i < values.length; i += 1) {
          var value = values[i];
          if (value == null) continue;
          var text = String(value).trim();
          if (text) return text;
        }
        return "";
      }

      function normalizeEmail(raw) {
        return String(raw || "").trim().toLowerCase();
      }

      function readMeta() {
        try { return window.__META || {}; }
        catch (e) { return {}; }
      }

      function resolveIdentity(params) {
        var meta = readMeta();
        function getParam(name) { return params.get(name) || ""; }

        var emailRaw = firstNonEmpty([
          getParam("email"),
          getParam("em"),
          getLocalStorageValue("em"),
          meta.userEmail || ""
        ]);
        var phoneRaw = firstNonEmpty([
          getParam("phone"),
          getParam("ph"),
          getLocalStorageValue("ph"),
          meta.userPhone || ""
        ]);
        var externalId = firstNonEmpty([
          meta.externalId || "",
          getLocalStorageValue("external_id")
        ]) || getOrCreateExternalId();

        setLocalStorageValue("external_id", externalId);
        if (emailRaw) setLocalStorageValue("em", normalizeEmail(emailRaw));
        if (phoneRaw) setLocalStorageValue("ph", normalizePhone(phoneRaw));

        return {
          emailRaw: emailRaw,
          phoneRaw: phoneRaw,
          ct: firstNonEmpty([getParam("ct"), getLocalStorageValue("ct")]),
          st: firstNonEmpty([getParam("st"), getLocalStorageValue("st")]),
          zip: firstNonEmpty([getParam("zip"), getLocalStorageValue("zip")]),
          country: firstNonEmpty([getParam("country"), getLocalStorageValue("country")]),
          email: emailRaw ? normalizeEmail(emailRaw) : "",
          ph: phoneRaw ? normalizePhone(phoneRaw) : "",
          fn: firstNonEmpty([getParam("fn"), meta.userFn || ""]),
          ln: firstNonEmpty([getParam("ln"), meta.userLn || ""]),
          externalId: externalId
        };
      }

      function cookieValue(name) {
        try {
          var parts = document.cookie ? document.cookie.split("; ") : [];
          for (var i = 0; i < parts.length; i += 1) {
            var part = parts[i];
            var eq = part.indexOf("=");
            var key = eq >= 0 ? part.slice(0, eq) : part;
            if (key === name) return decodeURIComponent(eq >= 0 ? part.slice(eq + 1) : "");
          }
        } catch (e) {}
        return "";
      }

      function collectMetaTrackingParams(params) {
        var fbp = cookieValue("_fbp");
        var fbc = cookieValue("_fbc");
        var fbclid = params.get("fbclid") || "";
        if (!fbc && fbclid) {
          fbc = "fb.1." + Date.now() + "." + fbclid;
        }
        metaTracking = { fbp: fbp || "", fbc: fbc || "", clientIpAddress: "" };
        return metaTracking;
      }

      function waitWithTimeout(promise, timeoutMs) {
        var timeoutId;
        var timeout = new Promise(function (resolve) {
          timeoutId = window.setTimeout(function () { resolve(null); }, timeoutMs);
        });
        return Promise.race([promise, timeout]).then(function (value) {
          if (timeoutId) window.clearTimeout(timeoutId);
          return value;
        }, function () {
          if (timeoutId) window.clearTimeout(timeoutId);
          return null;
        });
      }

      function ensurePhonePromise() {
        window.__PUBLIC_LANDING_PHONE_PROMISES = window.__PUBLIC_LANDING_PHONE_PROMISES || {};
        var existing = window.__PUBLIC_LANDING_PHONE_PROMISES[cfg.slug];
        if (existing) return existing;
        var baseUrl = cfg.supabaseUrl;
        var anonKey = cfg.supabaseAnonKey;
        if (!baseUrl || !anonKey) return Promise.resolve(null);
        var endpoint = baseUrl.replace(/\\/+$/, "") + "/functions/v1/landing-phone?name=" + encodeURIComponent(cfg.slug);
        var promise = fetch(endpoint, {
          headers: { apikey: anonKey, Authorization: "Bearer " + anonKey },
          cache: "no-store",
          keepalive: true
        }).then(function (response) {
          if (!response.ok) return null;
          return response.json();
        }).catch(function () {
          return null;
        });
        window.__PUBLIC_LANDING_PHONE_PROMISES[cfg.slug] = promise;
        return promise;
      }

      function clearPrewarmedPhonePromise() {
        try {
          if (window.__PUBLIC_LANDING_PHONE_PROMISES) {
            delete window.__PUBLIC_LANDING_PHONE_PROMISES[cfg.slug];
          }
        } catch (e) {}
      }

      function sendTrackBestEffort(body) {
        if (navigator && "sendBeacon" in navigator) {
          try {
            var blob = new Blob([body], { type: "application/json" });
            if (navigator.sendBeacon("/api/track", blob)) return Promise.resolve();
          } catch (e) {}
        }
        return fetch("/api/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: body,
          keepalive: true
        }).catch(function () {});
      }

      function contactDedupKey(slug, externalId) {
        return "contact_sent:" + slug + ":" + externalId;
      }

      function wasContactRecentlySent(slug, externalId) {
        if (!slug || !externalId) return false;
        try {
          var key = contactDedupKey(slug, externalId);
          var raw = window.localStorage.getItem(key);
          if (!raw) return false;
          var sentAt = Number(raw);
          if (!isFinite(sentAt)) {
            window.localStorage.removeItem(key);
            return false;
          }
          var isFresh = Date.now() - sentAt < CONTACT_DEDUP_TTL_MS;
          if (!isFresh) window.localStorage.removeItem(key);
          return isFresh;
        } catch (e) {
          return false;
        }
      }

      function markContactSent(slug, externalId) {
        if (!slug || !externalId) return;
        try {
          window.localStorage.setItem(contactDedupKey(slug, externalId), String(Date.now()));
        } catch (e) {}
      }

      function extractPhoneId(phoneData) {
        if (!phoneData || typeof phoneData !== "object") return null;
        var direct = phoneData.phoneId != null ? phoneData.phoneId : phoneData.phone_id;
        if (direct != null && direct !== "") {
          var asNumber = Number(direct);
          return isFinite(asNumber) ? asNumber : direct;
        }
        return null;
      }

      function setButtonText(button, text) {
        var label = button.querySelector("[data-public-landing-cta-label]");
        if (label) label.textContent = text;
      }

      function setNoPhoneState(button) {
        button.disabled = true;
        setButtonText(button, "Sin numero disponible");
        if (noPhoneTimer) window.clearTimeout(noPhoneTimer);
        noPhoneTimer = window.setTimeout(function () {
          button.disabled = false;
          setButtonText(button, cfg.ctaText);
          clickLocked = false;
          noPhoneTimer = null;
        }, 2000);
      }

      function notifyPhoneClick(phoneData, phone) {
        try {
          var baseUrl = cfg.supabaseUrl;
          var anonKey = cfg.supabaseAnonKey;
          var effectivePhoneMode = phoneData && (phoneData.phoneMode || (phoneData.phoneSelection && phoneData.phoneSelection.mode) || "");
          var phoneId = extractPhoneId(phoneData);
          if ((effectivePhoneMode === "fair" || effectivePhoneMode === "random") && baseUrl && anonKey && phoneId != null) {
            var notifyUrl = baseUrl.replace(/\\/+$/, "") + "/functions/v1/phone-click";
            fetch(notifyUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                apikey: anonKey,
                Authorization: "Bearer " + anonKey
              },
              body: JSON.stringify({
                landingName: (phoneData && phoneData.landingName) || cfg.landingName,
                phoneId: phoneId,
                phone: phone
              }),
              keepalive: true
            }).catch(function () {});
          }
        } catch (e) {}
      }

      function firePixelContact(eventId, identity, tracking) {
        try {
          if (!cfg.sendContactPixel || !window.fbq) return;
          var contactData = {
            source: "main_button",
            external_id: identity.externalId
          };
          if (identity.email) contactData.em = identity.email;
          if (identity.ph) contactData.ph = identity.ph;
          if (identity.fn) contactData.fn = identity.fn;
          if (identity.ln) contactData.ln = identity.ln;
          if (tracking.fbp) contactData.fbp = tracking.fbp;
          if (tracking.fbc) contactData.fbc = tracking.fbc;
          window.fbq("track", "Contact", contactData, { eventID: eventId });
        } catch (e) {}
      }

      function handleCtaClick(button) {
        if (clickLocked || button.disabled) return;
        clickLocked = true;
        button.disabled = true;
        setButtonText(button, "Abriendo...");
        var tapStartedAt = Date.now();

        window.requestAnimationFrame(function () {
          var params = queryParams();
          var promoCode = generatePromoCode(cfg.landingTag || "LP");
          var message = buildMessage(promoCode);
          var eventId = safeUUID();
          var identity = resolveIdentity(params);
          var tracking = collectMetaTrackingParams(params);
          var testEventCode = params.get("test_event_code") || "";
          var shouldSkipContact = testEventCode ? false : wasContactRecentlySent(cfg.slug, identity.externalId);

          waitWithTimeout(ensurePhonePromise(), 1500)
            .then(function (phoneData) {
              if (phoneData && phoneData.phone) return phoneData;
              clearPrewarmedPhonePromise();
              return waitWithTimeout(ensurePhonePromise(), 2500);
            })
            .then(function (phoneData) {
              var phone = normalizePhone((phoneData && phoneData.phone) || "");
              if (!phone) {
                setNoPhoneState(button);
                return;
              }

              if (!shouldSkipContact) {
                firePixelContact(eventId, identity, tracking);
              }

              notifyPhoneClick(phoneData, phone);

              var payload = {
                event_name: "Contact",
                meta_pixel_id: String(cfg.pixelId || "").trim() || undefined,
                sendContactPixel: cfg.sendContactPixel,
                event_id: eventId,
                external_id: identity.externalId,
                event_source_url: window.location.href,
                email: identity.emailRaw,
                phone: identity.phoneRaw,
                fn: identity.fn || undefined,
                ln: identity.ln || undefined,
                ct: identity.ct || undefined,
                st: identity.st || undefined,
                zip: identity.zip || undefined,
                country: identity.country || undefined,
                utm_campaign: params.get("utm_campaign") || "",
                test_event_code: testEventCode || undefined,
                fbp: tracking.fbp,
                fbc: tracking.fbc,
                client_ip_address: tracking.clientIpAddress || undefined,
                client_user_agent: navigator.userAgent || undefined,
                telefono_asignado: phone,
                promo_code: promoCode,
                source: "main_button",
                source_platform: "landing",
                brand: cfg.landingName,
                landing_id: cfg.landingId,
                landing_name: cfg.landingName,
                device_type: deviceType(),
                cta_tap_to_redirect_ms: Date.now() - tapStartedAt,
                mode: cfg.backgroundMode,
                api_meta: null
              };

              try {
                if (!shouldSkipContact) {
                  sendTrackBestEffort(JSON.stringify({
                    postUrl: cfg.postUrl,
                    payload: payload
                  }));
                }
              } catch (e) {}

              if (!shouldSkipContact) markContactSent(cfg.slug, identity.externalId);

              window.setTimeout(function () {
                window.location.assign("https://wa.me/" + phone + "?text=" + encodeURIComponent(message));
              }, 180);
            })
            .catch(function () {
              clickLocked = false;
              button.disabled = false;
              setButtonText(button, cfg.ctaText);
            });
        });
      }

      function initCtas() {
        var ctas = Array.prototype.slice.call(document.querySelectorAll("[data-public-landing-cta]"));
        ctas.forEach(function (button) {
          button.addEventListener("click", function () { handleCtaClick(button); });
        });

        Array.prototype.slice.call(document.querySelectorAll("[data-public-landing-trigger]")).forEach(function (trigger) {
          trigger.addEventListener("click", function () {
            var firstCta = document.querySelector("[data-public-landing-cta]");
            if (firstCta) firstCta.click();
          });
        });

        var autoCta = document.querySelector("[data-public-landing-cta][data-public-landing-auto-start='true']");
        if (autoCta) {
          window.setTimeout(function () { autoCta.click(); }, 40);
        }
      }

      function parseImages(value) {
        try {
          var parsed = JSON.parse(value || "[]");
          return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
        } catch (e) {
          return [];
        }
      }

      function initialRotatingIndex(images, rotateEveryHours) {
        if (images.length <= 1) return 0;
        var everyMs = Math.max(1, Number(rotateEveryHours) || 24) * 60 * 60 * 1000;
        return Math.floor(Date.now() / everyMs) % images.length;
      }

      function initRotatingBackgrounds() {
        Array.prototype.slice.call(document.querySelectorAll("[data-public-landing-rotating-background]")).forEach(function (node) {
          var images = parseImages(node.getAttribute("data-public-landing-images"));
          if (!images.length) return;
          var hours = node.getAttribute("data-public-landing-rotate-hours") || "24";
          var index = initialRotatingIndex(images, hours);
          node.style.backgroundImage = "url(" + images[index] + ")";
          if (images.length <= 1) return;
          var everyMs = Math.max(1, Number(hours) || 24) * 60 * 60 * 1000;
          window.setInterval(function () {
            index = (index + 1) % images.length;
            node.style.backgroundImage = "url(" + images[index] + ")";
          }, everyMs);
        });

        Array.prototype.slice.call(document.querySelectorAll("[data-public-landing-rotating-image]")).forEach(function (node) {
          var images = parseImages(node.getAttribute("data-public-landing-images"));
          if (!images.length) return;
          var hours = node.getAttribute("data-public-landing-rotate-hours") || "24";
          var index = initialRotatingIndex(images, hours);
          node.setAttribute("src", images[index]);
          if (images.length <= 1) return;
          var everyMs = Math.max(1, Number(hours) || 24) * 60 * 60 * 1000;
          window.setInterval(function () {
            index = (index + 1) % images.length;
            node.setAttribute("src", images[index]);
          }, everyMs);
        });
      }

      function renderSocialProof(section, index) {
        var items = cfg.socialProofItems || [];
        if (!items.length) return;
        var item = items[index % items.length];
        var quote = section.querySelector("[data-public-landing-social-quote]");
        var meta = section.querySelector("[data-public-landing-social-meta]");
        var progress = section.querySelector("[data-public-landing-social-progress]");
        if (quote) quote.textContent = '"' + item.quote + '"';
        if (meta) meta.innerHTML = item.name + ' <span aria-hidden="true">-</span> <span class="social-proof__stars">★★★★★</span>';
        if (progress) {
          progress.style.animation = "none";
          void progress.offsetHeight;
          progress.style.animation = "";
        }
      }

      function initSocialProof() {
        Array.prototype.slice.call(document.querySelectorAll("[data-public-landing-social-proof]")).forEach(function (section) {
          var index = 0;
          renderSocialProof(section, index);
          window.setInterval(function () {
            index = (index + 1) % (cfg.socialProofItems || []).length;
            renderSocialProof(section, index);
          }, SOCIAL_PROOF_INTERVAL_MS);
        });
      }

      function init() {
        initRotatingBackgrounds();
        initCtas();
        initSocialProof();
      }

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
      } else {
        init();
      }
    })();
  `;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
