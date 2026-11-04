
    (function () {
      var cfg = window.__PUBLIC_LANDING_RUNTIME_CONFIG__ || {};
      try { delete window.__PUBLIC_LANDING_RUNTIME_CONFIG__; } catch (e) {}
      
      var clickLocked = false;
      var landingResolution = (function captureLandingResolution(slug, allowAutomatic = false) {
  if (!globalThis.window) return null;
  const browser = window;
  const saved = browser.__LANDING_RESOLUTION__;
  if (saved?.slug === slug && saved.url === window.location.href) return saved.value;
  const url = new URL(window.location.href);
  const selections = url.searchParams.getAll("landing");
  const automatic = url.searchParams.getAll("__landing_auto");
  let value = null;
  let pathname = url.pathname.replace(/\/$/, "");
  try {
    pathname = decodeURIComponent(pathname);
  } catch {
  }
  if (selections.length === 1 && selections[0].trim() === slug) {
    value = "url_parameter";
  } else if (!selections.length || selections.length === 1 && !selections[0].trim()) {
    const expectedPath = allowAutomatic ? `/${slug}` : `/l/${slug}`;
    if (pathname === expectedPath) {
      value = allowAutomatic && automatic.length === 1 && automatic[0] === slug ? "automatic" : "path";
    }
  }
  if (url.searchParams.has("__landing_auto")) {
    url.searchParams.delete("__landing_auto");
    try {
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    } catch {
    }
  }
  browser.__LANDING_RESOLUTION__ = { slug, url: window.location.href, value };
  return value;
})(cfg.slug, cfg.automaticLandingSelection === true);
      var template7ContactSent = false;
      var template7AttemptContext = null;
      var noPhoneTimer = null;
      var scopedFbc = ((function(){var __name=function(fn){return fn;};return (function getLandingFbc(config) {
  const browser = window;
  const landing = String(config.landingId || "");
  const currency = String(config.workspaceCurrency || "ARS").trim().toUpperCase();
  const pixel = String(config.pixelId || "").replace(/\D/g, "");
  const scope = [landing, currency, pixel || "no-pixel"].join(":");
  const key = "landing-fbc:v2:" + scope;
  function pageContext() {
    const url = new URL(location.href);
    return url.origin + url.pathname.replace(/\/$/, "") + JSON.stringify([
      url.searchParams.getAll("landing"),
      url.searchParams.getAll("fbclid")
    ]);
  }
  const entryUrl = pageContext();
  const context = key + "|" + entryUrl;
  const cache = browser.__LANDING_FBC_V2__ || (browser.__LANDING_FBC_V2__ = {});
  if (cache[context]) return cache[context];
  const validScope = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(landing) && /^[A-Z]{3}$/.test(currency);
  const maxAge = 90 * 864e5, futureTolerance = 3e5;
  let record = null;
  let entrySource = "direct";
  let currentSource = "persisted";
  let nativePromise = null;
  function clickId(value) {
    return typeof value === "string" && /^[A-Za-z0-9_-]{1,450}$/.test(value) ? value : "";
  }
  function parse(raw) {
    if (typeof raw !== "string" || raw.length > 500) return null;
    const match = /^fb\.1\.(\d+)\.([A-Za-z0-9_-]+)(?:\.([A-Za-z0-9_-]+))?$/.exec(raw);
    if (!match) return null;
    const numeric = Number(match[1]), at = numeric < 1e12 ? numeric * 1e3 : numeric;
    if (!Number.isSafeInteger(at) || at <= 0) return null;
    return { at, click: match[2], fbc: "fb.1." + at + "." + match[2] + (match[3] ? "." + match[3] : "") };
  }
  function fresh(value) {
    const now = Date.now();
    return !!value && value.at <= now + futureTolerance && now - value.at <= maxAge;
  }
  function globalCookie() {
    try {
      const value = document.cookie.split(";").find((part) => part.trim().startsWith("_fbc="));
      return value ? decodeURIComponent(value.trim().slice(5)) : "";
    } catch {
      return "";
    }
  }
  try {
    const saved = JSON.parse(localStorage.getItem(key) || "null");
    const parsed = parse(saved?.fbc);
    if (validScope && saved?.version === 2 && saved.scope === scope && parsed && ["url", "referrer", "sdk_fresh"].includes(saved.source) && Number.isSafeInteger(saved.captured_at) && saved.captured_at === parsed.at && saved.captured_at <= Date.now() + futureTolerance) record = { ...saved, fbc: parsed.fbc };
  } catch {
  }
  function accept(value, source) {
    const click = clickId(value);
    if (!validScope || !click) return;
    if (source === "sdk_fresh" && (entrySource === "url" || entrySource === "referrer")) return;
    const previous = parse(record?.fbc);
    if (previous?.click !== click) {
      const now = Date.now();
      record = { version: 2, scope, fbc: "fb.1." + now + "." + click, source, captured_at: now };
      try {
        localStorage.setItem(key, JSON.stringify(record));
      } catch {
      }
    }
    entrySource = source;
    currentSource = source;
  }
  function fromUrl(url) {
    const values = url.searchParams.getAll("fbclid");
    return values.length === 1 ? clickId(values[0]) : "";
  }
  try {
    const current = new URL(location.href), direct = fromUrl(current);
    if (direct) accept(direct, "url");
    else if (!current.searchParams.has("fbclid") && document.referrer) {
      const referrer = new URL(document.referrer);
      const host = referrer.hostname.toLowerCase();
      const metaHost = ["facebook.com", "instagram.com", "fb.com"].some((domain) => host === domain || host.endsWith("." + domain));
      const selections = referrer.searchParams.getAll("landing");
      const sameLanding = referrer.origin === current.origin && (selections.length === 1 ? selections[0] === config.slug : !selections.length && ["/" + config.slug, "/l/" + config.slug].includes(referrer.pathname.replace(/\/$/, "")));
      if (referrer.protocol === "https:" && (metaHost || sameLanding)) accept(fromUrl(referrer), "referrer");
    }
  } catch {
  }
  function collect() {
    const parsed = validScope ? parse(record?.fbc) : null;
    const fbc = fresh(parsed) ? parsed.fbc : "";
    const global = parse(globalCookie());
    return { fbc, landing_attribution: {
      version: 2,
      landing_id: landing,
      workspace_currency: currency,
      pixel_id: pixel,
      entry_source: entrySource,
      fbc_source: fbc ? currentSource : "none",
      captured_at: fbc ? record.captured_at : null,
      legacy_fbc_quarantined: !!globalCookie() && (!fbc || global?.click !== parsed?.click)
    } };
  }
  function collectNative(source) {
    if (nativePromise) return nativePromise;
    if (browser.__LANDING_FBC_NATIVE_CONTEXT__ && browser.__LANDING_FBC_NATIVE_CONTEXT__ !== context) return Promise.resolve();
    browser.__LANDING_FBC_NATIVE_CONTEXT__ = context;
    nativePromise = new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(finish, 2200);
      const run = () => {
        const fn = browser.__ATRIO_META_COLLECT_CLICK_ID__;
        if (!fn) {
          finish();
          return;
        }
        try {
          Promise.resolve(fn()).then((value) => {
            if (!settled && pageContext() === entryUrl) accept(value, "sdk_fresh");
          }).catch(() => {
          }).finally(finish);
        } catch {
          finish();
        }
      };
      if (browser.__ATRIO_META_COLLECT_CLICK_ID__) {
        run();
        return;
      }
      if (!/^\/vendor\/atrio-meta-click\/v1\/collect-click-id\.[a-f0-9]+\.js$/.test(source)) {
        finish();
        return;
      }
      let script = document.querySelector('script[data-atrio-meta-click="v1"]');
      let created = false;
      if (!script) {
        script = document.createElement("script");
        script.src = source;
        script.async = true;
        script.setAttribute("data-atrio-meta-click", "v1");
        created = true;
      }
      script.addEventListener("load", run, { once: true });
      script.addEventListener("error", finish, { once: true });
      if (created) document.head.appendChild(script);
    });
    return nativePromise;
  }
  return cache[context] = { collect, collectNative };
});})())({landingId:cfg.landingId,slug:cfg.slug,workspaceCurrency:cfg.workspaceCurrency,pixelId:cfg.pixelId});
      var metaTracking = {
        fbp: "",
        fbc: "",
        clientIpAddress: "",
        clientIpIssuedAt: null,
        clientIpProof: ""
      };
      var metaIpCollectorPromise = null;
      var metaParamBuilderPromise = null;
      var officialMetaTracking = null;
      var prearmedContact = null;
      var journeyStartInFlight = false;
      var leadCaptureModal = null;
      var pendingLeadCaptureButton = null;
      var CONTACT_DEDUP_TTL_MS = 5 * 60 * 1000;
      var JOURNEY_START_DEDUP_TTL_MS = CONTACT_DEDUP_TTL_MS;
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

      function normalizePhone(raw, rawCountryCallingCode) {
  var digits = String(raw || "").replace(/\D+/g, "");
  var countryCallingCode = String(rawCountryCallingCode || "").replace(/\D+/g, "");
  if (!digits) return "";
  if (digits.indexOf("00") === 0) digits = digits.slice(2);
  if (countryCallingCode && digits.indexOf(countryCallingCode) === 0) return digits;

  var national = digits.replace(/^0+/, "");
  if (countryCallingCode === "54") {
    national = national.replace(/^15/, "");
    return national.length === 10 ? "54" + national : digits;
  }
  if (countryCallingCode === "595") {
    return national.length === 9 ? "595" + national : digits;
  }
  return digits;
}
      function normalizeArgentinaWhatsapp(rawValue){var digits=String(rawValue==null?"":rawValue).replace(/\D/g,"");if(!digits)return"";if(digits.indexOf("00")===0)digits=digits.slice(2);digits=digits.replace(/^0+/,"");var national=digits;if(digits.indexOf("54")===0)national=digits.slice(2);else if(digits.indexOf("9")===0&&digits.length===11)national=digits.slice(1);national=national.replace(/^0+/,"");if(national.indexOf("9")===0&&national.length===11)national=national.slice(1);if(national.length===12){var lengths=[2,3,4];for(var i=0;i<lengths.length;i++){var areaLength=lengths[i];if(national.slice(areaLength,areaLength+2)!=="15")continue;var candidate=national.slice(0,areaLength)+national.slice(areaLength+2);if(candidate.length===10){national=candidate;break}}}return/^[1-9]\d{9}$/.test(national)?"549"+national:""}
      
    function template7WebviewKind(ua) {
      var text = String(ua || "");
      var inApp = /Instagram|FBAN|FBAV|FB_IAB|FB4A|Messenger|TikTok|Bytedance|Musical_ly/i.test(text);
      if (/Android/i.test(text) && (inApp || /(?:;|\s)wv(?:;|\))/i.test(text))) return "android";
      if (/iPhone|iPad|iPod/i.test(text) && inApp) return "ios";
      return "normal";
    }

    function template7CheckedHandoff(raw) {
      var url = new URL(String(raw || ""));
      if (url.protocol !== "https:" || url.username || url.password || url.hash ||
          (url.pathname !== "/prepare" && url.pathname !== "/start") ||
          url.searchParams.getAll("t").length !== 1 || !url.searchParams.get("t") || url.searchParams.get("t").length > 12000 ||
          url.searchParams.getAll("ef").length > 1 || (url.searchParams.has("ef") &&
          (!url.searchParams.get("ef") || url.searchParams.get("ef").length > 2003))) {
        throw new Error("invalid handoff");
      }
      if(url.pathname==="/prepare"&&url.searchParams.has("skin")&&(url.searchParams.getAll("skin").length!==1||
          ["ganamos_plus","jugamos","casino_zeus","bet30","gana_en_casa","celu_apuestas","casino_zeta","oro_puro","fortu_bet","gran_poseidon","kona_bet","mega_faraon","camel_bet","rhino_play"].indexOf(url.searchParams.get("skin"))===-1||
          (typeof cfg!=="undefined"&&cfg.targetProvider&&cfg.targetProvider!=="multi_skin")))throw new Error("invalid handoff skin");
      // Attribution is captured on the landing before this navigation. Future
      // advertising parameters must neither reject nor authorize an entry.
      var token=url.searchParams.get("t"),funnel=url.searchParams.get("ef"),skin=url.pathname==="/prepare"?url.searchParams.get("skin"):null;
      url.search="";url.searchParams.set("t",token);
      if(funnel)url.searchParams.set("ef",funnel);
      if(skin)url.searchParams.set("skin",skin);
      return url;
    }

    function template7HandoffIntent(raw) {
      var url = template7CheckedHandoff(raw);
      return "intent://" + url.host + url.pathname + url.search +
        "#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=" +
        encodeURIComponent(url.href) + ";end";
    }

    function navigateTemplate7Handoff(raw) {
      var url = template7CheckedHandoff(raw);
      try { window.localStorage.setItem("template7:gateway-visited:" + url.origin, String(Date.now())); } catch(e) {}
      // A Meta in-app browser can complete this same first-party navigation.
      // User-agent detection alone is not evidence of a failed entry.
      try { window.location.assign(url.href); return; }
      catch (error) { showTemplate7HandoffFallback(url.href); }
    }

    function showTemplate7HandoffFallback(raw) {
      var url = template7CheckedHandoff(raw);
      var kind = template7WebviewKind(navigator.userAgent);
      var panel = document.querySelector("[data-template7-handoff-panel]");
      if (!panel) {
        panel = document.createElement("div");
        panel.className = "template7__handoff-panel";
        panel.setAttribute("data-template7-handoff-panel", "");
        panel.setAttribute("role", "dialog");
        panel.setAttribute("aria-modal", "true");
        panel.innerHTML = '<div class="template7__handoff-card"><h2>Continuá con tu acceso</h2>' +
          '<p data-template7-handoff-help></p><a data-template7-handoff-open>Continuar</a>' +
          '<button type="button" data-template7-handoff-copy>Copiar enlace</button>' +
          '<small>El enlace es temporal y de un solo uso. Abrilo una sola vez.</small></div>';
        document.body.appendChild(panel);
      }
      var help = panel.querySelector("[data-template7-handoff-help]");
      var open = panel.querySelector("[data-template7-handoff-open]");
      var copy = panel.querySelector("[data-template7-handoff-copy]");
      if (kind === "android") {
        help.textContent = "No se pudo abrir tu acceso en este navegador. Podés continuar en Chrome con la misma cuenta.";
        open.textContent = "Abrir en Chrome";
        open.href = template7HandoffIntent(url.href);
      } else {
        help.textContent = "No se pudo abrir tu acceso. Intentá abrir el enlace o copialo para continuar en otro navegador con la misma cuenta.";
        open.textContent = "Abrir enlace";
        open.href = url.href;
        open.target = "_blank";
        open.rel = "noopener noreferrer";
      }
      copy.onclick = function () {
        if (!navigator.clipboard || !navigator.clipboard.writeText) return;
        navigator.clipboard.writeText(url.href).then(function () {
          copy.textContent = "Enlace copiado";
        }).catch(function () { copy.textContent = "No se pudo copiar"; });
      };
      open.focus();
    }
  
      var fetchWithEntryRecovery = async function fetchWithEntryRecovery(url, init, onRetry) {
  const deadline = Date.now() + 45e3;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (init.signal?.aborted) throw init.signal.reason || new Error("entry_cancelled");
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error("entry_recovery_pending");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(42e3, remaining));
    const cancel = () => controller.abort(init.signal?.reason);
    init.signal?.addEventListener("abort", cancel, { once: true });
    if (init.signal?.aborted) cancel();
    const feedback = onRetry ? setTimeout(onRetry, Math.min(8e3, remaining)) : void 0;
    let response;
    let failure;
    let retryAfter = 0;
    try {
      response = await fetch(url, Object.assign({}, init, { signal: controller.signal }));
      if (!response.ok && ![408, 429, 500, 502, 503, 504].includes(response.status)) return response;
      const received = response;
      response = void 0;
      const text = await received.text();
      let body = null;
      try {
        body = JSON.parse(text);
      } catch (error) {
        if (received.ok) throw error;
      }
      response = new Response(text, { status: received.status, statusText: received.statusText, headers: received.headers });
      if (response.ok) return response;
      if (body && (body.retryable === false || ["integration_pending", "api2_not_configured", "landing_unavailable", "advisor_not_assigned"].includes(body.error))) return response;
      const header = response.headers.get("Retry-After");
      if (header) retryAfter = /^\d+$/.test(header) ? Number(header) * 1e3 : Math.max(0, Date.parse(header) - Date.now());
      if (retryAfter > 6e4) return response;
    } catch (error) {
      failure = error;
    } finally {
      clearTimeout(timer);
      if (feedback !== void 0) clearTimeout(feedback);
      init.signal?.removeEventListener("abort", cancel);
    }
    if (init.signal?.aborted) throw init.signal.reason || failure || new Error("entry_cancelled");
    if (attempt === 3) {
      if (response) return response;
      throw failure;
    }
    if (onRetry) onRetry();
    const delay = Math.max(Number.isFinite(retryAfter) ? retryAfter : 0, [500, 1500, 3500][attempt]);
    if (Date.now() + delay >= deadline) {
      if (response) return response;
      throw failure || new Error("entry_recovery_pending");
    }
    await new Promise((resolve, reject) => {
      const abort = () => {
        clearTimeout(pause);
        init.signal?.removeEventListener("abort", abort);
        reject(init.signal?.reason || new Error("entry_cancelled"));
      };
      const pause = setTimeout(() => {
        init.signal?.removeEventListener("abort", abort);
        resolve();
      }, delay);
      init.signal?.addEventListener("abort", abort, { once: true });
      if (init.signal?.aborted) abort();
    });
  }
  throw new Error("entry_recovery_exhausted");
};
      function setTemplate7Error(message) {
        var error = document.querySelector("[data-template7-error]");
        if (!error) return;
        error.textContent = message || "";
        error.hidden = !message;
      }

      function failTemplate7(button) {
        if (window.__entryFunnel) window.__entryFunnel.emit("entry_error", { error_code: "account_unavailable" });
        clickLocked = false;
        button.disabled = false;
        setButtonText(button, getRestButtonText(button));
        setTemplate7Error("Tu acceso sigue pendiente. Tocá el botón para continuar con el mismo intento.");
      }

      function startTemplate7Gateway(name, phone, promoCode, atrioData, tracking, params) {
        var advisorId = firstNonEmpty([atrioData && atrioData.atrioId, atrioData && atrioData.atrio_id]);
        var advisorSlug = firstNonEmpty([atrioData && atrioData.atrioSlug, atrioData && atrioData.atrio_slug]);
        var atrioClientId = firstNonEmpty([atrioData && atrioData.atrioClientId, atrioData && atrioData.atrio_client_id]);
        if (!advisorId || !advisorSlug || !atrioClientId) return Promise.reject(new Error("advisor unavailable"));
        return fetchWithEntryRecovery("/api/template7/prepare", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            landing_id: cfg.landingId,
            landing_slug: cfg.slug,
            entry_funnel: window.__entryFunnel ? window.__entryFunnel.context() : undefined,
            name: name,
            phone: phone || undefined,
            atrio_client_id: atrioClientId,
            advisor_id: advisorId,
            advisor_slug: advisorSlug,
            promo_code: promoCode,
            attribution: {
              utm_source: params.get("utm_source") || "",
              utm_medium: params.get("utm_medium") || "",
              landing: cfg.slug,
              landing_resolution: landingResolution || "",
              facebook: params.get("facebook") || "",
              portofolio: params.get("portofolio") || "",
              cp: params.get("cp") || "",
              campana: params.get("campana") || "",
              conjunto: params.get("conjunto") || "",
              anuncio: params.get("anuncio") || "",
              utm_campaign: params.get("utm_campaign") || "",
              utm_content: params.get("utm_content") || "",
              utm_term: params.get("utm_term") || "",
              target_provider: cfg.targetProvider,
              skin_code: cfg.targetProvider === "multi_skin" ? cfg.skinCode : "",
              fbp: tracking.fbp || "",
              fbc: tracking.fbc || ""
            }
          })
        }).then(function (response) {
          if (!response.ok) throw new Error("gateway unavailable");
          return response.json();
        }).then(function (data) {
          if (!data || typeof data.handoff_url !== "string" || !data.handoff_url) throw new Error("handoff unavailable");
          return data.handoff_url;
        });
      }

      function generatePromoCode(tag) {
        return String(tag || "LP") + "-" + Math.random().toString(16).slice(2, 14);
      }

      function buildMessage(promoCode) {
        var baseMessage = ("Hola! quiero mas informacion por favor! " + promoCode + "\nMi nombre es:").trim();
        var extraText = String(cfg.whatsappPrefillText || "").trim();
        return extraText ? baseMessage + "\n\n" + extraText : baseMessage;
      }

      function isAtrioDestination() {
        return cfg.template === 7;
      }

      function buildAtrioRedirectUrl(promoCode, atrioData) {
        try {
          var raw = firstNonEmpty([
            atrioData && atrioData.atrioRedirectUrl,
            atrioData && atrioData.atrio_redirect_url,
            cfg.atrioRedirectUrl
          ]);
          if (!raw) return "";
          var url = new URL(raw, window.location.href);
          if (url.protocol !== "http:" && url.protocol !== "https:") return "";
          url.searchParams.set("promo_code", promoCode);
          var atrioId = firstNonEmpty([
            atrioData && atrioData.atrioId,
            atrioData && atrioData.atrio_id,
            cfg.atrioId
          ]);
          if (atrioId) url.searchParams.set("atrio_id", atrioId);
          return url.toString();
        } catch (e) {
          return "";
        }
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

      function storageKey(key) {
        return String(cfg.storageNamespace || ("landing-builder:no-pixel:" + cfg.slug)) + ":" + key;
      }

      function getLocalStorageValue(key) {
        try { return window.localStorage.getItem(storageKey(key)) || ""; }
        catch (e) { return ""; }
      }

      function setLocalStorageValue(key, value) {
        try { if (value) window.localStorage.setItem(storageKey(key), value); }
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
        var fn = firstNonEmpty([getParam("fn"), getLocalStorageValue("fn"), meta.userFn || ""]);
        var ln = firstNonEmpty([getParam("ln"), getLocalStorageValue("ln"), meta.userLn || ""]);
        var ct = firstNonEmpty([getParam("ct"), getLocalStorageValue("ct")]);
        var st = firstNonEmpty([getParam("st"), getLocalStorageValue("st")]);
        var zip = firstNonEmpty([getParam("zip"), getLocalStorageValue("zip")]);
        var country = firstNonEmpty([getParam("country"), getLocalStorageValue("country")]);

        setLocalStorageValue("external_id", externalId);
        if (emailRaw) setLocalStorageValue("em", normalizeEmail(emailRaw));
        if (phoneRaw) setLocalStorageValue("ph", normalizePhone(phoneRaw, cfg.phoneCountryCode));
        if (fn) setLocalStorageValue("fn", fn);
        if (ln) setLocalStorageValue("ln", ln);
        if (ct) setLocalStorageValue("ct", ct);
        if (st) setLocalStorageValue("st", st);
        if (zip) setLocalStorageValue("zip", zip);
        if (country) setLocalStorageValue("country", country);

        return {
          emailRaw: emailRaw,
          phoneRaw: phoneRaw,
          ct: ct,
          st: st,
          zip: zip,
          country: country,
          email: emailRaw ? normalizeEmail(emailRaw) : "",
          ph: phoneRaw ? normalizePhone(phoneRaw, cfg.phoneCountryCode) : "",
          fn: fn,
          ln: ln,
          externalId: externalId
        };
      }

      function applyLeadCaptureToIdentity(identity, capture) {
        if (!capture || typeof capture !== "object") return identity;
        var fields = (cfg.leadCapture && cfg.leadCapture.fields) || {};
        var firstName = (cfg.template === 7 || fields.firstName) ? String(capture.firstName || "").trim() : "";
        var lastName = fields.lastName ? String(capture.lastName || "").trim() : "";
        var emailRaw = fields.email ? String(capture.email || "").trim() : "";
        var phoneRaw = (fields.phone || (cfg.template === 7 && cfg.template7Whatsapp))
          ? String(capture.phone || "").trim()
          : "";
        var normalizedPhone = phoneRaw
          ? (cfg.template === 7 ? normalizeArgentinaWhatsapp(phoneRaw) : normalizePhone(phoneRaw, cfg.phoneCountryCode))
          : "";

        return {
          emailRaw: emailRaw || identity.emailRaw,
          phoneRaw: normalizedPhone ? phoneRaw : identity.phoneRaw,
          ct: identity.ct,
          st: identity.st,
          zip: identity.zip,
          country: identity.country,
          email: emailRaw ? normalizeEmail(emailRaw) : identity.email,
          ph: normalizedPhone || identity.ph,
          fn: firstName || identity.fn,
          ln: lastName || identity.ln,
          externalId: identity.externalId
        };
      }

      function readInlineEmail() {
        if (!cfg.emailCapture || cfg.emailCapture.enabled !== true) return "";
        var input = document.querySelector("[data-inline-email-input]");
        if (!input) return "";
        var value = String(input.value || "").trim();
        var valid = value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
        var error = document.querySelector("[data-inline-email-error]");
        if (error) error.textContent = value && !valid
          ? "Email inválido. Podés seguir a WhatsApp." : "";
        return valid ? value.toLowerCase() : "";
      }

      function initInlineEmail() {
        var input = document.querySelector("[data-inline-email-input]");
        if (!input) return;
        input.addEventListener("input", function () {
          var error = document.querySelector("[data-inline-email-error]");
          if (error) error.textContent = "";
        });
        input.addEventListener("blur", readInlineEmail);
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
        var attribution = scopedFbc.collect();
        metaTracking = {
          fbp: fbp || "",
          fbc: attribution.fbc,
          landing_attribution: attribution.landing_attribution,
          clientIpAddress: metaTracking.clientIpAddress || "",
          clientIpIssuedAt: metaTracking.clientIpIssuedAt || null,
          clientIpProof: metaTracking.clientIpProof || ""
        };
        return metaTracking;
      }

      function safeEventSourceUrl() {
        try {
          return window.location.origin + window.location.pathname;
        } catch (e) {
          return "";
        }
      }

      function sanitizeSensitiveQueryParams() {
        try {
          var url = new URL(window.location.href);
          var sensitiveKeys = ["email", "em", "phone", "ph", "fn", "ln", "external_id", "eid", "ct", "st", "zip", "country"];
          var changed = false;
          sensitiveKeys.forEach(function (key) {
            if (url.searchParams.has(key)) {
              url.searchParams.delete(key);
              changed = true;
            }
          });
          if (changed) {
            window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
          }
        } catch (e) {}
      }

      function mergeMetaTracking(base, incoming) {
        var next = incoming && typeof incoming === "object" ? incoming : {};
        var attribution = scopedFbc.collect();
        return {
          fbp: String(next.fbp || base.fbp || ""),
          fbc: attribution.fbc,
          landing_attribution: attribution.landing_attribution,
          clientIpAddress: String(next.clientIpAddress || base.clientIpAddress || ""),
          clientIpIssuedAt: Number(next.clientIpIssuedAt || base.clientIpIssuedAt) || null,
          clientIpProof: String(next.clientIpProof || base.clientIpProof || "")
        };
      }

      function getOfficialMetaParamBuilder() {
        try {
          var sdk = window.clientParamBuilder;
          if (
            sdk &&
            typeof sdk.processAndCollectAllParams === "function" &&
            typeof sdk.getFbc === "function" &&
            typeof sdk.getFbp === "function"
          ) {
            return sdk;
          }
        } catch (e) {}
        return null;
      }

      function loadOfficialMetaParamBuilder() {
        var available = getOfficialMetaParamBuilder();
        if (available) return Promise.resolve(available);
        if (metaParamBuilderPromise) return metaParamBuilderPromise;

        var source = String(cfg.metaParamBuilderSrc || "").trim();
        if (!source) return Promise.resolve(null);

        metaParamBuilderPromise = new Promise(function (resolve) {
          var existing = document.querySelector("script[data-meta-param-builder='official']");
          var script = existing || document.createElement("script");
          var settled = false;

          function finish(value) {
            if (settled) return;
            settled = true;
            resolve(value || null);
          }

          script.addEventListener("load", function () {
            finish(getOfficialMetaParamBuilder());
          }, { once: true });
          script.addEventListener("error", function () {
            finish(null);
          }, { once: true });

          if (!existing) {
            script.src = source;
            script.async = true;
            script.setAttribute("data-meta-param-builder", "official");
            document.head.appendChild(script);
          }
        }).finally(function () {
          metaParamBuilderPromise = null;
        });

        return metaParamBuilderPromise;
      }

      function readOfficialMetaParam(sdk, methodName) {
        try {
          var method = sdk && sdk[methodName];
          return typeof method === "function" ? String(method.call(sdk) || "") : "";
        } catch (e) {
          return "";
        }
      }

      function collectOfficialMetaTracking() {
        var sdk = getOfficialMetaParamBuilder();
        if (!sdk) return Promise.resolve(null);

        var trustedIp =
          metaTracking.clientIpAddress && metaTracking.clientIpProof
            ? metaTracking.clientIpAddress
            : "";
        var processResult;

        try {
          processResult = trustedIp
            ? sdk.processAndCollectAllParams(window.location.href, function () {
                return Promise.resolve(trustedIp);
              })
            : sdk.processAndCollectAllParams(window.location.href);
        } catch (e) {
          return Promise.resolve(null);
        }

        return Promise.resolve(processResult)
          .then(function () {
            officialMetaTracking = {
              fbp: readOfficialMetaParam(sdk, "getFbp"),
              fbc: scopedFbc.collect().fbc,
              clientIpAddress: trustedIp,
              clientIpIssuedAt: trustedIp ? metaTracking.clientIpIssuedAt : null,
              clientIpProof: trustedIp ? metaTracking.clientIpProof : ""
            };
            metaTracking = mergeMetaTracking(metaTracking, officialMetaTracking);
            return officialMetaTracking;
          })
          .catch(function () {
            return null;
          });
      }

      function collectMetaClientIpProof() {
        var collectorUrl = String(cfg.metaIpCollectorUrl || "").trim();
        if (!collectorUrl) return Promise.resolve(null);
        if (metaTracking.clientIpAddress && metaTracking.clientIpProof) {
          return Promise.resolve(metaTracking);
        }
        if (metaIpCollectorPromise) return metaIpCollectorPromise;

        metaIpCollectorPromise = new Promise(function (resolve) {
          var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
          var timeoutId = window.setTimeout(function () {
            if (controller) controller.abort();
            resolve(null);
          }, 800);

          fetch(collectorUrl, {
            method: "GET",
            mode: "cors",
            credentials: "omit",
            cache: "no-store",
            signal: controller ? controller.signal : undefined
          })
            .then(function (response) {
              if (!response.ok) return null;
              return response.json();
            })
            .then(function (value) {
              if (!value || typeof value !== "object") return null;
              var ip = String(value.ip || "").trim().toLowerCase();
              var issuedAt = Number(value.issued_at);
              var proof = String(value.proof || "").trim();
              var nowSeconds = Math.floor(Date.now() / 1000);
              if (
                !ip ||
                !proof ||
                !Number.isInteger(issuedAt) ||
                issuedAt > nowSeconds + 30 ||
                nowSeconds - issuedAt > 600
              ) {
                return null;
              }
              metaTracking = mergeMetaTracking(metaTracking, {
                clientIpAddress: ip,
                clientIpIssuedAt: issuedAt,
                clientIpProof: proof
              });
              return metaTracking;
            })
            .then(resolve)
            .catch(function () { resolve(null); })
            .finally(function () {
              window.clearTimeout(timeoutId);
              metaIpCollectorPromise = null;
            });
        });

        return metaIpCollectorPromise;
      }

      function scheduleMetaClientIpCollection() {
        var run = function () { void collectMetaClientIpProof(); };
        if (typeof window.requestIdleCallback === "function") {
          window.requestIdleCallback(run, { timeout: 800 });
        } else {
          window.setTimeout(run, 0);
        }
      }

      function scheduleOfficialMetaParamBuilder() {
        var run = function () {
          void scopedFbc.collectNative(String(cfg.metaEbpCollectorSrc || ""));
          Promise.all([
            loadOfficialMetaParamBuilder(),
            collectMetaClientIpProof()
          ])
            .then(function (values) {
              if (!values[0]) return null;
              return collectOfficialMetaTracking();
            })
            .catch(function () {});
        };

        if (typeof window.requestIdleCallback === "function") {
          window.requestIdleCallback(run, { timeout: 1200 });
        } else {
          window.setTimeout(run, 0);
        }
      }

      window.__PUBLIC_META_COLLECT_PARAMS = function () {
        return officialMetaTracking;
      };

      function refreshMetaTracking(params, fallback) {
        var base = mergeMetaTracking(collectMetaTrackingParams(params), fallback || {});
        var collector = window.__PUBLIC_META_COLLECT_PARAMS;
        if (typeof collector !== "function") return Promise.resolve(base);
        return waitWithTimeout(Promise.resolve(collector()), 450)
          .then(function (value) {
            metaTracking = mergeMetaTracking(base, value || {});
            return metaTracking;
          })
          .catch(function () {
            metaTracking = base;
            return base;
          });
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
        if (isAtrioDestination()) return Promise.resolve(null);
        window.__PUBLIC_LANDING_PHONE_PROMISES = window.__PUBLIC_LANDING_PHONE_PROMISES || {};
        var existing = window.__PUBLIC_LANDING_PHONE_PROMISES[cfg.slug];
        if (existing) return existing;
        var baseUrl = cfg.supabaseUrl;
        var anonKey = cfg.supabaseAnonKey;
        if (!baseUrl || !anonKey) return Promise.resolve(null);
        var endpoint = baseUrl.replace(/\/+$/, "") + "/functions/v1/landing-phone?name=" + encodeURIComponent(cfg.slug);
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

      function ensureAtrioPromise() {
        if (!isAtrioDestination()) return Promise.resolve(null);
        window.__PUBLIC_LANDING_ATRIO_PROMISES = window.__PUBLIC_LANDING_ATRIO_PROMISES || {};
        var existing = window.__PUBLIC_LANDING_ATRIO_PROMISES[cfg.slug];
        if (existing) return existing;
        var baseUrl = cfg.supabaseUrl;
        var anonKey = cfg.supabaseAnonKey;
        if (!baseUrl || !anonKey) return Promise.resolve(null);
        var endpoint = baseUrl.replace(/\/+$/, "") + "/functions/v1/landing-atrio?name=" + encodeURIComponent(cfg.slug);
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
        window.__PUBLIC_LANDING_ATRIO_PROMISES[cfg.slug] = promise;
        return promise;
      }

      function clearPrewarmedAtrioPromise() {
        try {
          if (window.__PUBLIC_LANDING_ATRIO_PROMISES) {
            delete window.__PUBLIC_LANDING_ATRIO_PROMISES[cfg.slug];
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

      function sendJourneyStartBestEffort(body) {
        if (navigator && "sendBeacon" in navigator) {
          try {
            var blob = new Blob([body], { type: "application/json" });
            if (navigator.sendBeacon("/api/journey-start", blob)) return Promise.resolve(true);
          } catch (e) {}
        }
        return fetch("/api/journey-start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: body,
          keepalive: true
        }).then(function (response) {
          return !!(response && response.ok);
        }).catch(function () {
          return false;
        });
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

      function journeyStartDedupKey(slug, externalId) {
        return "journey_start_sent:" + slug + ":" + externalId;
      }

      function wasJourneyStartSent(slug, externalId) {
        if (!slug || !externalId) return false;
        try {
          var key = journeyStartDedupKey(slug, externalId);
          var raw = window.localStorage.getItem(key);
          if (!raw) return false;
          var sentAt = Number(raw);
          if (!isFinite(sentAt)) {
            window.localStorage.removeItem(key);
            return false;
          }
          var isFresh = Date.now() - sentAt < JOURNEY_START_DEDUP_TTL_MS;
          if (!isFresh) window.localStorage.removeItem(key);
          return isFresh;
        } catch (e) {
          return false;
        }
      }

      function markJourneyStartSent(slug, externalId) {
        if (!slug || !externalId) return;
        try {
          window.localStorage.setItem(journeyStartDedupKey(slug, externalId), String(Date.now()));
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

      function extractAssignedGerenciaSnapshot(phoneData) {
        if (!phoneData || typeof phoneData !== "object") return {};
        var gerencia = phoneData.gerencia && typeof phoneData.gerencia === "object"
          ? phoneData.gerencia
          : {};
        var internalId = gerencia.id != null ? Number(gerencia.id) : null;
        var externalId = firstNonEmpty([
          gerencia.externalId,
          gerencia.external_id,
          gerencia.gerencia_id,
          internalId
        ]);
        var name = firstNonEmpty([gerencia.name, gerencia.nombre]);
        var label = name && externalId ? name + " (ID " + externalId + ")" : (name || (externalId ? "Gerencia " + externalId : ""));
        return {
          assigned_gerencia_id: isFinite(internalId) && internalId > 0 ? internalId : undefined,
          assigned_gerencia_external_id: externalId || undefined,
          assigned_gerencia_name: name || undefined,
          assigned_gerencia_label: label || undefined
        };
      }

      function buildLandingJourneyStartPayload(params, identity, tracking, targetData) {
        var atrioMode = isAtrioDestination();
        var phoneData = atrioMode ? null : targetData;
        var assignedPhone = atrioMode ? "" : normalizePhone(
          (phoneData && phoneData.phone) || "",
          cfg.phoneCountryCode
        );
        var assignedGerenciaSnapshot = atrioMode ? {} : extractAssignedGerenciaSnapshot(phoneData);
        return {
          event_name: "LandingPageView",
          slug: cfg.slug,
          landing_id: cfg.landingId,
          landing_name: cfg.landingName,
          target_provider: cfg.template === 7 ? cfg.targetProvider : undefined,
          skin_code: cfg.template === 7 && cfg.targetProvider === "multi_skin" ? cfg.skinCode : undefined,
          workspace_currency: cfg.workspaceCurrency || undefined,
          external_id: identity.externalId,
          event_source_url: safeEventSourceUrl(),
          landing: cfg.slug,
              landing_resolution: landingResolution || "",
          facebook: params.get("facebook") || "",
          portofolio: params.get("portofolio") || "",
          cp: params.get("cp") || "",
          campana: params.get("campana") || "",
          conjunto: params.get("conjunto") || "",
          anuncio: params.get("anuncio") || "",
          utm_campaign: params.get("utm_campaign") || "",
          fbp: tracking.fbp,
          fbc: tracking.fbc,
          landing_attribution: tracking.landing_attribution,
          from_meta_ads: !!tracking.fbc,
          meta_pixel_id: String(cfg.pixelId || "").trim() || undefined,
          telefono_asignado: assignedPhone || undefined,
          assigned_gerencia_id: assignedGerenciaSnapshot.assigned_gerencia_id,
          assigned_gerencia_external_id: assignedGerenciaSnapshot.assigned_gerencia_external_id,
          assigned_gerencia_name: assignedGerenciaSnapshot.assigned_gerencia_name,
          assigned_gerencia_label: assignedGerenciaSnapshot.assigned_gerencia_label,
          device_type: deviceType(),
          client_ip_address: tracking.clientIpAddress || undefined,
          client_user_agent: navigator.userAgent || undefined
        };
      }

      function recordLandingJourneyStart() {
        if (journeyStartInFlight || !cfg.landingId) return;
        var params = queryParams();
        var identity = resolveIdentity(params);
        if (wasJourneyStartSent(cfg.slug, identity.externalId)) return;
        journeyStartInFlight = true;
        var tracking = collectMetaTrackingParams(params);
        var immediateBody = JSON.stringify(
          buildLandingJourneyStartPayload(params, identity, tracking, null)
        );
        sendJourneyStartBestEffort(immediateBody).then(function (sent) {
          if (sent) markJourneyStartSent(cfg.slug, identity.externalId);
          if (isAtrioDestination()) return sent;
          return ensurePhonePromise().then(function (phoneData) {
            if (!phoneData || !phoneData.phone) return sent;
            return sendJourneyStartBestEffort(JSON.stringify(
              buildLandingJourneyStartPayload(params, identity, tracking, phoneData)
            )).then(function (enrichedSent) {
              if (enrichedSent) markJourneyStartSent(cfg.slug, identity.externalId);
              return sent || enrichedSent;
            });
          });
        }).catch(function () {}).then(function () {
          journeyStartInFlight = false;
        });
      }

      function setButtonText(button, text) {
        var label = button.querySelector("[data-public-landing-cta-label]");
        if (label) label.textContent = text;
      }

      function getButtonLabel(button, attrName, fallback) {
        return button.getAttribute(attrName) || fallback;
      }

      function getRestButtonText(button) {
        return getButtonLabel(button, "data-public-landing-rest-label", cfg.ctaText);
      }

      function getLoadingButtonText(button) {
        return getButtonLabel(button, "data-public-landing-loading-label", "Abriendo...");
      }

      function getDisabledButtonText(button) {
        return getButtonLabel(button, "data-public-landing-disabled-label", "Sin numero disponible");
      }

      function setNoPhoneState(button) {
        button.disabled = true;
        setButtonText(button, getDisabledButtonText(button));
        if (noPhoneTimer) window.clearTimeout(noPhoneTimer);
        noPhoneTimer = window.setTimeout(function () {
          button.disabled = false;
          setButtonText(button, getRestButtonText(button));
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
            var notifyUrl = baseUrl.replace(/\/+$/, "") + "/functions/v1/phone-click";
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
                phone: phone,
                reservationId: (phoneData && phoneData.assignmentReservationId) || undefined
              }),
              keepalive: true
            }).catch(function () {});
          }
        } catch (e) {}
      }

      function notifyTemplate6CardClick(button) {
        try {
          if (cfg.template !== 6 || !cfg.landingId || !cfg.supabaseUrl || !cfg.supabaseAnonKey) return;
          var cardIndex = Number(button.getAttribute("data-template6-card-index"));
          if (!Number.isInteger(cardIndex) || cardIndex < 1 || cardIndex > 6) return;
          fetch(cfg.supabaseUrl.replace(/\/+$/, "") + "/functions/v1/landing-card-click", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: cfg.supabaseAnonKey,
              Authorization: "Bearer " + cfg.supabaseAnonKey
            },
            body: JSON.stringify({ landingId: cfg.landingId, cardIndex: cardIndex, eventId: safeUUID() }),
            keepalive: true
          }).catch(function () {});
        } catch (e) {}
      }

      function notifyAtrioClick(atrioData) {
        try {
          var baseUrl = cfg.supabaseUrl;
          var anonKey = cfg.supabaseAnonKey;
          var atrioClientId = firstNonEmpty([
            atrioData && atrioData.atrioClientId,
            atrioData && atrioData.atrio_client_id,
            cfg.atrioClientId
          ]);
          if (!baseUrl || !anonKey || !atrioClientId) return;
          var notifyUrl = baseUrl.replace(/\/+$/, "") + "/functions/v1/atrio-click";
          fetch(notifyUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: anonKey,
              Authorization: "Bearer " + anonKey
            },
            body: JSON.stringify({
              landingName: cfg.landingName || cfg.slug,
              atrioClientId: atrioClientId
            }),
            keepalive: true
          }).catch(function () {});
        } catch (e) {}
      }

      function firePixelContact(eventId) {
        try {
          if (!cfg.sendContactPixel || !window.fbq) return;
          window.fbq("track", "Contact", { source: "main_button" }, { eventID: eventId });
        } catch (e) {}
      }

      function createContactPrearm() {
        var params = queryParams();
        var promoCode = generatePromoCode(cfg.landingTag || "LP");
        var identity = resolveIdentity(params);
        var tracking = collectMetaTrackingParams(params);
        var testEventCode = params.get("test_event_code") || "";
        sanitizeSensitiveQueryParams();

        return {
          params: params,
          promoCode: promoCode,
          message: buildMessage(promoCode),
          eventId: safeUUID(),
          identity: identity,
          tracking: tracking,
          testEventCode: testEventCode,
          shouldSkipContact: testEventCode ? false : wasContactRecentlySent(cfg.slug, identity.externalId),
          createdAt: Date.now()
        };
      }

      function prearmContactContext() {
        try {
          prearmedContact = createContactPrearm();
        } catch (e) {
          prearmedContact = null;
        }
      }

      function consumeContactContext() {
        if (cfg.template === 7 && template7AttemptContext) return template7AttemptContext;
        var context = prearmedContact || createContactPrearm();
        prearmedContact = null;
        window.setTimeout(prearmContactContext, 0);
        if (cfg.template === 7) template7AttemptContext = context;
        return context;
      }

      function hasLeadCaptureFields() {
        var leadCapture = cfg.leadCapture || {};
        var fields = leadCapture.fields || {};
        return leadCapture.enabled === true &&
          (fields.firstName === true || fields.lastName === true || fields.phone === true || fields.email === true);
      }

      function shouldShowLeadCapture(button) {
        if (cfg.template === 7) return false;
        if (!hasLeadCaptureFields()) return false;
        return button.getAttribute("data-public-landing-auto-start") !== "true";
      }

      function closeLeadCaptureModal() {
        if (!leadCaptureModal) return;
        leadCaptureModal.hidden = true;
        document.body.classList.remove("public-lead-capture-open");
        pendingLeadCaptureButton = null;
      }

      function continueAfterLeadCapture(capture) {
        var button = pendingLeadCaptureButton;
        closeLeadCaptureModal();
        if (button) processCtaClick(button, capture || null);
      }

      function createLeadCaptureInput(name, label, type, autocomplete) {
        var wrapper = document.createElement("label");
        wrapper.className = "public-lead-capture__field";
        var input = document.createElement("input");
        input.type = type;
        input.name = name;
        input.autocomplete = autocomplete;
        input.setAttribute("aria-label", label);
        input.placeholder = label;
        input.className = "public-lead-capture__input";
        wrapper.appendChild(input);
        return wrapper;
      }

      function initLeadCaptureModal() {
        if (!hasLeadCaptureFields() || leadCaptureModal) return;
        var leadCapture = cfg.leadCapture || {};
        var fields = leadCapture.fields || {};
        var overlay = document.createElement("div");
        overlay.className = "public-lead-capture";
        overlay.hidden = true;
        overlay.setAttribute("role", "dialog");
        overlay.setAttribute("aria-modal", "true");
        overlay.setAttribute("aria-labelledby", "public-lead-capture-title");

        var card = document.createElement("form");
        card.className = "public-lead-capture__card";
        card.noValidate = true;

        var close = document.createElement("button");
        close.type = "button";
        close.className = "public-lead-capture__close";
        close.setAttribute("aria-label", "Omitir formulario e ir a WhatsApp");
        close.textContent = "×";

        var title = document.createElement("h2");
        title.id = "public-lead-capture-title";
        title.textContent = String(leadCapture.title || "Desbloqueá atención personalizada");

        var description = document.createElement("p");
        description.className = "public-lead-capture__description";
        description.textContent = String(leadCapture.description || "");

        var grid = document.createElement("div");
        grid.className = "public-lead-capture__grid";
        if (fields.firstName === true) grid.appendChild(createLeadCaptureInput("firstName", "Nombre", "text", "given-name"));
        if (fields.lastName === true) grid.appendChild(createLeadCaptureInput("lastName", "Apellido", "text", "family-name"));
        if (fields.phone === true) grid.appendChild(createLeadCaptureInput("phone", "Teléfono", "tel", "tel"));
        if (fields.email === true) grid.appendChild(createLeadCaptureInput("email", "Email", "email", "email"));

        var actions = document.createElement("div");
        actions.className = "public-lead-capture__actions";
        var skip = document.createElement("button");
        skip.type = "button";
        skip.className = "public-lead-capture__skip";
        skip.textContent = "OMITIR E IR A WHATSAPP";
        var submit = document.createElement("button");
        submit.type = "submit";
        submit.className = "public-lead-capture__submit";
        submit.textContent = "CONTINUAR A WHATSAPP →";
        actions.appendChild(skip);
        actions.appendChild(submit);

        card.appendChild(close);
        card.appendChild(title);
        if (description.textContent) card.appendChild(description);
        card.appendChild(grid);
        card.appendChild(actions);
        overlay.appendChild(card);
        document.body.appendChild(overlay);
        leadCaptureModal = overlay;

        function readCaptureValues() {
          var data = {};
          Array.prototype.slice.call(card.querySelectorAll("input[name]")).forEach(function (input) {
            data[input.name] = String(input.value || "").trim();
          });
          return data;
        }

        card.addEventListener("submit", function (event) {
          event.preventDefault();
          continueAfterLeadCapture(readCaptureValues());
        });
        skip.addEventListener("click", function () { continueAfterLeadCapture(null); });
        close.addEventListener("click", function () { continueAfterLeadCapture(null); });
        overlay.addEventListener("click", function (event) {
          if (event.target === overlay) continueAfterLeadCapture(null);
        });
        document.addEventListener("keydown", function (event) {
          if (!leadCaptureModal || leadCaptureModal.hidden) return;
          if (event.key === "Escape") continueAfterLeadCapture(null);
        });
      }

      function openLeadCaptureModal(button) {
        initLeadCaptureModal();
        if (!leadCaptureModal) {
          processCtaClick(button, null);
          return;
        }
        pendingLeadCaptureButton = button;
        var inlineEmail = readInlineEmail();
        var modalEmail = leadCaptureModal.querySelector('input[name="email"]');
        if (modalEmail && cfg.emailCapture && cfg.emailCapture.enabled === true) modalEmail.value = inlineEmail;
        leadCaptureModal.hidden = false;
        document.body.classList.add("public-lead-capture-open");
        window.setTimeout(function () {
          var first = leadCaptureModal.querySelector("input, button");
          if (first && typeof first.focus === "function") first.focus();
        }, 0);
      }

      function handleCtaClick(button) {
        if (clickLocked || button.disabled) return;
        if (cfg.template === 7) {
          var nameInput = document.querySelector("[data-template7-name]");
          var whatsappInput = document.querySelector("[data-template7-whatsapp]");
          var whatsappWarning = document.querySelector("[data-template7-phone-warning]");
          var firstName = nameInput ? String(nameInput.value || "").trim() : "";
          if (!firstName) {
            if (nameInput) nameInput.focus();
            button.disabled = true;
            return;
          }
          var rawWhatsapp = whatsappInput ? String(whatsappInput.value || "").trim() : "";
          var normalizedWhatsapp = rawWhatsapp ? normalizeArgentinaWhatsapp(rawWhatsapp) : "";
          if (whatsappWarning) {
            whatsappWarning.textContent = rawWhatsapp && !normalizedWhatsapp
              ? "No parece un WhatsApp argentino válido. Continuaremos sin guardarlo."
              : "";
            whatsappWarning.hidden = !whatsappWarning.textContent;
          }
          processCtaClick(button, { firstName: firstName, phone: normalizedWhatsapp });
          return;
        }
        if (shouldShowLeadCapture(button)) {
          openLeadCaptureModal(button);
          return;
        }
        processCtaClick(button, null);
      }

      function processCtaClick(button, leadCaptureValues) {
        if (clickLocked || button.disabled) return;
        if (cfg.template === 7 && !String(leadCaptureValues && leadCaptureValues.firstName || "").trim()) return;
        if (cfg.template === 7 && window.__entryFunnel) {
          if (!window.__T7_EARLY_CTA_RECORDED__) window.__entryFunnel.emit("cta_clicked");
          window.__T7_EARLY_CTA_RECORDED__ = false;
        }
        if (cfg.template === 7) setTemplate7Error("");
        clickLocked = true;
        button.disabled = true;
        setButtonText(button, getLoadingButtonText(button));
        notifyTemplate6CardClick(button);
        var tapStartedAt = Date.now();

        window.requestAnimationFrame(function () {
          var context = consumeContactContext();
          var params = context.params;
          var promoCode = context.promoCode;
          var message = context.message;
          var eventId = context.eventId;
          var inlineEmail = readInlineEmail();
          var safeCapture = leadCaptureValues;
          if (safeCapture && cfg.emailCapture && cfg.emailCapture.enabled === true) {
            var typedEmail = String(safeCapture.email || "").trim();
            safeCapture = Object.assign({}, safeCapture, {
              email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(typedEmail) ? typedEmail : ""
            });
          }
          var baseIdentity = inlineEmail
            ? Object.assign({}, context.identity, { emailRaw: inlineEmail, email: normalizeEmail(inlineEmail) })
            : context.identity;
          var identity = applyLeadCaptureToIdentity(baseIdentity, safeCapture);
          var captureFields = (cfg.leadCapture && cfg.leadCapture.fields) || {};
          var hasLeadCaptureForm = !!leadCaptureValues;
          var formFn = hasLeadCaptureForm && (cfg.template === 7 || captureFields.firstName)
            ? String(leadCaptureValues.firstName || "").trim()
            : "";
          var formLn = hasLeadCaptureForm && captureFields.lastName
            ? String(leadCaptureValues.lastName || "").trim()
            : "";
          var formEmail = hasLeadCaptureForm && captureFields.email
            ? normalizeEmail(safeCapture.email || "")
            : "";
          var formPhoneRaw = hasLeadCaptureForm && (captureFields.phone || (cfg.template === 7 && cfg.template7Whatsapp))
            ? String(leadCaptureValues.phone || "").trim()
            : "";
          var formPhone = formPhoneRaw
            ? (cfg.template === 7 ? normalizeArgentinaWhatsapp(formPhoneRaw) : normalizePhone(formPhoneRaw, cfg.phoneCountryCode))
            : "";
          var tracking = context.tracking;
          var testEventCode = context.testEventCode;
          var shouldSkipContact = context.shouldSkipContact || (cfg.template === 7 && template7ContactSent);

          Promise.all([
            refreshMetaTracking(params, tracking),
            isAtrioDestination()
              ? waitWithTimeout(ensureAtrioPromise(), 1500)
              : waitWithTimeout(ensurePhonePromise(), 1500)
          ])
            .then(function (resolved) {
              tracking = resolved[0];
              return resolved[1];
            })
            .then(function (targetData) {
              if (isAtrioDestination()) {
                if (targetData && (cfg.template === 7
                  ? firstNonEmpty([targetData.atrioClientId, targetData.atrio_client_id]) && firstNonEmpty([targetData.atrioId, targetData.atrio_id]) && firstNonEmpty([targetData.atrioSlug, targetData.atrio_slug])
                  : (targetData.atrioRedirectUrl || targetData.atrio_redirect_url))) return targetData;
                clearPrewarmedAtrioPromise();
                return waitWithTimeout(ensureAtrioPromise(), 2500);
              }
              if (targetData && targetData.phone) return targetData;
              clearPrewarmedPhonePromise();
              return waitWithTimeout(ensurePhonePromise(), 2500);
            })
            .then(function (targetData) {
              var atrioMode = isAtrioDestination();
              var gatewayMode = cfg.template === 7;
              var atrioData = atrioMode ? (targetData || {}) : null;
              var phoneData = atrioMode ? null : targetData;
              var phone = atrioMode ? "" : normalizePhone(
                (phoneData && phoneData.phone) || "",
                cfg.phoneCountryCode
              );
              var redirectUrl = gatewayMode ? "" : atrioMode
                ? buildAtrioRedirectUrl(promoCode, atrioData)
                : "https://wa.me/" + phone + "?text=" + encodeURIComponent(message);
              if (gatewayMode && (!firstNonEmpty([atrioData.atrioClientId, atrioData.atrio_client_id]) || !firstNonEmpty([atrioData.atrioId, atrioData.atrio_id]) || !firstNonEmpty([atrioData.atrioSlug, atrioData.atrio_slug]))) {
                if (window.__entryFunnel) window.__entryFunnel.emit("entry_error", { error_code: "destination_unavailable" });
                failTemplate7(button);
                return;
              }
              if (gatewayMode && window.__entryFunnel) window.__entryFunnel.emit("destination_ready");
              if ((!atrioMode && !phone) || (atrioMode && !gatewayMode && !redirectUrl)) {
                setNoPhoneState(button);
                return;
              }

              if (!shouldSkipContact) {
                firePixelContact(eventId);
              }

              if (!atrioMode) {
                notifyPhoneClick(phoneData, phone);
              } else {
                notifyAtrioClick(atrioData);
              }

              var assignedGerenciaSnapshot = atrioMode ? {} : extractAssignedGerenciaSnapshot(phoneData);
              var payload = {
                event_name: "Contact",
                target_provider: gatewayMode ? cfg.targetProvider : undefined,
                skin_code: gatewayMode && cfg.targetProvider === "multi_skin" ? cfg.skinCode : undefined,
                meta_pixel_id: String(cfg.pixelId || "").trim() || undefined,
                sendContactPixel: cfg.sendContactPixel,
                event_id: eventId,
                external_id: identity.externalId,
                event_source_url: safeEventSourceUrl(),
                email: identity.emailRaw,
                phone: identity.ph || identity.phoneRaw,
                phone_country_code: cfg.phoneCountryCode || undefined,
                currency: cfg.workspaceCurrency || undefined,
                workspace_currency: cfg.workspaceCurrency || undefined,
                lead_capture_form: hasLeadCaptureForm || undefined,
                form_fn: formFn || undefined,
                form_ln: formLn || undefined,
                form_email: formEmail || undefined,
                form_phone: formPhone || undefined,
                fn: identity.fn || undefined,
                ln: identity.ln || undefined,
                ct: identity.ct || undefined,
                st: identity.st || undefined,
                zip: identity.zip || undefined,
                country: identity.country || undefined,
                landing: cfg.slug,
              landing_resolution: landingResolution || "",
                facebook: params.get("facebook") || "",
                portofolio: params.get("portofolio") || "",
                cp: params.get("cp") || "",
                campana: params.get("campana") || "",
                conjunto: params.get("conjunto") || "",
                anuncio: params.get("anuncio") || "",
                utm_campaign: params.get("utm_campaign") || "",
                test_event_code: testEventCode || undefined,
                fbp: tracking.fbp,
                fbc: tracking.fbc,
                landing_attribution: tracking.landing_attribution,
                client_ip_address: tracking.clientIpAddress || undefined,
                client_ip_issued_at: tracking.clientIpIssuedAt || undefined,
                client_ip_proof: tracking.clientIpProof || undefined,
                client_user_agent: navigator.userAgent || undefined,
                telefono_asignado: atrioMode ? "" : phone,
                assigned_gerencia_id: assignedGerenciaSnapshot.assigned_gerencia_id,
                assigned_gerencia_external_id: assignedGerenciaSnapshot.assigned_gerencia_external_id,
                assigned_gerencia_name: assignedGerenciaSnapshot.assigned_gerencia_name,
                assigned_gerencia_label: assignedGerenciaSnapshot.assigned_gerencia_label,
                promo_code: promoCode,
                source: "main_button",
                source_platform: "landing",
                cta_destination: atrioMode ? "atrio" : "whatsapp",
                redirect_channel: gatewayMode
                  ? cfg.targetProvider === "multi_skin"
                    ? "multi_skin_gateway"
                    : cfg.targetProvider === "ases_del_norte"
                      ? "ases_del_norte_gateway"
                      : cfg.targetProvider === "ganamos_net"
                        ? "ganamos_net_gateway"
                      : "rey_de_ases_gateway"
                  : atrioMode ? "atrio" : "whatsapp",
                gateway_app_id: gatewayMode
                  ? cfg.targetProvider === "multi_skin"
                    ? "multi_skin_gateway"
                    : cfg.targetProvider === "ases_del_norte"
                      ? "ases_del_norte_gateway"
                      : cfg.targetProvider === "ganamos_net"
                        ? "ganamos_net_gateway"
                      : "reydeases_gateway"
                  : undefined,
                atrio_redirect_url: atrioMode ? firstNonEmpty([atrioData && atrioData.atrioRedirectUrl, atrioData && atrioData.atrio_redirect_url, cfg.atrioRedirectUrl]) : undefined,
                atrio_client_id: atrioMode ? firstNonEmpty([atrioData && atrioData.atrioClientId, atrioData && atrioData.atrio_client_id, cfg.atrioClientId]) : undefined,
                atrio_id: atrioMode ? firstNonEmpty([atrioData && atrioData.atrioId, atrioData && atrioData.atrio_id, cfg.atrioId]) : undefined,
                atrio_slug: atrioMode ? firstNonEmpty([atrioData && atrioData.atrioSlug, atrioData && atrioData.atrio_slug, cfg.atrioSlug]) : undefined,
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
              if (gatewayMode && !shouldSkipContact) template7ContactSent = true;

              if (gatewayMode) {
                startTemplate7Gateway(formFn, formPhone, promoCode, atrioData, tracking, params)
                  .then(function (handoffUrl) { navigateTemplate7Handoff(handoffUrl); })
                  .catch(function () { failTemplate7(button); });
              } else {
                window.setTimeout(function () {
                  window.location.assign(redirectUrl);
                }, 180);
              }
            })
            .catch(function () {
              if (cfg.template === 7) failTemplate7(button);
              else {
                clickLocked = false;
                button.disabled = false;
                setButtonText(button, getRestButtonText(button));
              }
            });
        });
      }

      function initCtas() {
        var ctas = Array.prototype.slice.call(document.querySelectorAll("[data-public-landing-cta]"));
        ctas.forEach(function (button) {
          button.addEventListener("click", function () { handleCtaClick(button); });
        });

        // Al volver de WhatsApp con la pagina restaurada desde bfcache, un CTA nuevo
        // necesita una asignacion nueva; la deduplicacion de Contact sigue en storage.
        window.addEventListener("pageshow", function (event) {
          if (!event.persisted || cfg.template !== 6) return;
          clickLocked = false;
          ctas.forEach(function (button) {
            button.disabled = false;
            setButtonText(button, getRestButtonText(button));
          });
          clearPrewarmedPhonePromise();
          if (!isAtrioDestination()) ensurePhonePromise();
          prearmContactContext();
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

      function initTemplate7Name() {
        if (cfg.template !== 7) return;
        var input = document.querySelector("[data-template7-name]");
        var whatsappInput = document.querySelector("[data-template7-whatsapp]");
        var whatsappWarning = document.querySelector("[data-template7-phone-warning]");
        var button = document.querySelector("[data-template7-form] [data-public-landing-cta]");
        var form = document.querySelector("[data-template7-form]");
        if (!input || !button || !form) return;
        function sync() {
          if (clickLocked) return;
          button.disabled = !String(input.value || "").trim();
        }
        input.addEventListener("input", sync);
        if (whatsappInput && whatsappWarning) {
          whatsappInput.addEventListener("input", function () {
            if (!String(whatsappInput.value || "").trim() || normalizeArgentinaWhatsapp(whatsappInput.value)) {
              whatsappWarning.textContent = "";
              whatsappWarning.hidden = true;
            }
          });
          whatsappInput.addEventListener("blur", function () {
            var raw = String(whatsappInput.value || "").trim();
            whatsappWarning.textContent = raw && !normalizeArgentinaWhatsapp(raw)
              ? "No parece un WhatsApp argentino válido. Continuaremos sin guardarlo."
              : "";
            whatsappWarning.hidden = !whatsappWarning.textContent;
          });
        }
        form.addEventListener("submit", function (event) {
          event.preventDefault();
          sync();
          if (!button.disabled) button.click();
          else input.focus();
        });
        window.addEventListener("pageshow", sync);
        sync();
      }

      function initPrivacyDialog() {
        var dialog = document.querySelector("[data-public-privacy-dialog]");
        var openButton = document.querySelector("[data-public-privacy-open]");
        if (!dialog || !openButton) return;

        function openDialog() {
          if (typeof dialog.showModal === "function") dialog.showModal();
          else dialog.setAttribute("open", "");
        }

        function closeDialog() {
          if (typeof dialog.close === "function") dialog.close();
          else dialog.removeAttribute("open");
        }

        openButton.addEventListener("click", openDialog);
        Array.prototype.slice.call(dialog.querySelectorAll("[data-public-privacy-close]")).forEach(function (button) {
          button.addEventListener("click", closeDialog);
        });
        dialog.addEventListener("click", function (event) {
          if (event.target === dialog) closeDialog();
        });
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
          var mobileSource = node.parentElement && node.parentElement.querySelector("[data-template7-mobile-background]");
          var variants = parseImages(node.getAttribute("data-template7-background-variants"));
          function showImage() {
            if (mobileSource) mobileSource.setAttribute("srcset", images[index]);
            if (variants[index]) {
              node.setAttribute("srcset", variants[index].srcSet || "");
              node.setAttribute("data-image-fallback", variants[index].original || "");
            }
            node.setAttribute("src", images[index]);
          }
          showImage();
          if (images.length <= 1) return;
          var everyMs = Math.max(1, Number(hours) || 24) * 60 * 60 * 1000;
          window.setInterval(function () {
            index = (index + 1) % images.length;
            showImage();
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

      function formatLiveTime(offsetMinutes) {
        var date = new Date(Date.now() + (offsetMinutes || 0) * 60 * 1000);
        var hours = String(date.getHours()).padStart(2, "0");
        var minutes = String(date.getMinutes()).padStart(2, "0");
        return hours + ":" + minutes;
      }

      function initTemplate4LiveDetails() {
        var count = document.querySelector("[data-template4-live-count]");
        if (count) {
          var current = Number(count.textContent) || 14;
          window.setInterval(function () {
            var delta = Math.random() > 0.5 ? 1 : -1;
            current = Math.max(9, Math.min(24, current + delta));
            count.textContent = String(current);
          }, 2600 + Math.floor(Math.random() * 1800));
        }

        var currentTime = document.querySelector("[data-template4-current-time]");
        if (currentTime) {
          currentTime.innerHTML = formatLiveTime(0) + "<br><i>24/7</i>";
        }
        Array.prototype.slice.call(document.querySelectorAll("[data-template4-message-time]")).forEach(function (node, index, nodes) {
          node.textContent = formatLiveTime(index - nodes.length + 1);
        });
      }

      function initTemplate5LiveDetails() {
        var currentTime = document.querySelector("[data-template5-current-time]");
        if (currentTime) currentTime.textContent = formatLiveTime(0);

        var viewerCount = document.querySelector("[data-template5-viewer-count]");
        if (viewerCount) {
          var current = Number(String(viewerCount.textContent || "").replace(/\D/g, "")) || 1278;
          window.setInterval(function () {
            var delta = Math.floor(Math.random() * 23) - 9;
            current = Math.max(1160, Math.min(1420, current + delta));
            viewerCount.textContent = current.toLocaleString("es-AR");
          }, 2200);
        }

        var createdCount = document.querySelector("[data-template5-created-count]");
        if (createdCount) {
          var created = Number(String(createdCount.textContent || "").replace(/\D/g, "")) || 1323;
          window.setInterval(function () {
            created += 1 + Math.floor(Math.random() * 3);
            createdCount.textContent = created.toLocaleString("es-AR");
          }, 4300);
        }

        var advisorCount = document.querySelector("[data-template5-advisor-count]");
        if (advisorCount) {
          window.setInterval(function () {
            advisorCount.textContent = String(2 + Math.floor(Math.random() * 9));
          }, 2700);
        }

        var feedRows = Array.prototype.slice.call(document.querySelectorAll("[data-template5-feed-row]"));
        var feedItems = [
          ["Camilo A.", "hace 5 s", "$ 1.150.000"],
          ["Sebastian G.", "hace 17 s", "$ 260.000"],
          ["Laura P.", "hace 29 s", "$ 780.000"],
          ["Mica R.", "hace 34 s", "$ 540.000"],
          ["Tomas D.", "hace 42 s", "$ 1.320.000"],
          ["Rocio M.", "hace 51 s", "$ 690.000"],
          ["Daniela T.", "hace 8 s", "$ 980.000"],
          ["Lucas F.", "hace 14 s", "$ 420.000"],
          ["Valen S.", "hace 23 s", "$ 1.760.000"],
          ["Nico P.", "hace 31 s", "$ 315.000"],
          ["Flor V.", "hace 38 s", "$ 890.000"],
          ["Agus M.", "hace 46 s", "$ 2.100.000"],
          ["Sofi L.", "hace 57 s", "$ 610.000"],
          ["Juan C.", "hace 12 s", "$ 1.480.000"],
          ["Pablo R.", "hace 19 s", "$ 730.000"],
          ["Lau G.", "hace 27 s", "$ 560.000"],
          ["Dario B.", "hace 36 s", "$ 1.250.000"],
          ["Cami N.", "hace 44 s", "$ 340.000"],
          ["Fede H.", "hace 52 s", "$ 1.690.000"],
          ["Maru D.", "hace 9 s", "$ 770.000"],
          ["Eze Q.", "hace 16 s", "$ 450.000"],
          ["Juli A.", "hace 24 s", "$ 1.030.000"],
          ["Bruno K.", "hace 33 s", "$ 640.000"],
          ["Meli F.", "hace 41 s", "$ 1.870.000"],
          ["Lean T.", "hace 49 s", "$ 520.000"],
          ["Ari B.", "hace 55 s", "$ 930.000"],
          ["Belen C.", "hace 11 s", "$ 1.410.000"],
          ["Rama J.", "hace 21 s", "$ 680.000"],
          ["Luli P.", "hace 30 s", "$ 2.350.000"],
          ["Gonza V.", "hace 39 s", "$ 810.000"]
        ];
        var feedIndex = feedRows.length;
        var visibleFeed = feedItems.slice(0, Math.max(feedRows.length, 1));

        function renderFeed() {
          feedRows.forEach(function (row, index) {
            var item = visibleFeed[index] || feedItems[index % feedItems.length];
            var name = row.querySelector("b");
            var time = row.querySelector("[data-template5-feed-time]");
            var amount = row.querySelector(":scope > strong") || row.lastElementChild;
            if (name) name.textContent = item[0];
            if (time) time.textContent = item[1];
            if (amount) amount.textContent = item[2];
            row.classList.remove("template5__feed-row--pulse");
            void row.offsetHeight;
            row.classList.add("template5__feed-row--pulse");
          });
        }

        if (feedRows.length) {
          window.setInterval(function () {
            visibleFeed.unshift(feedItems[feedIndex % feedItems.length]);
            visibleFeed = visibleFeed.slice(0, feedRows.length);
            feedIndex = (feedIndex + 1) % feedItems.length;
            renderFeed();
          }, 3600);
        }
      }

      function init() {
        if (cfg.template === 7 && window.__LB_IDENTITY_READY__) {
          window.__LB_IDENTITY_READY__.then(function () {
            recordLandingJourneyStart();
            prearmContactContext();
            window.setTimeout(prearmContactContext, 700);
          });
        } else {
          recordLandingJourneyStart();
          prearmContactContext();
          window.setTimeout(prearmContactContext, 700);
        }
        if (isAtrioDestination()) ensureAtrioPromise();
        else ensurePhonePromise();
        scheduleMetaClientIpCollection();
        scheduleOfficialMetaParamBuilder();
        initRotatingBackgrounds();
        initCtas();
        initTemplate7Name();
        initInlineEmail();
        initSocialProof();
        initTemplate4LiveDetails();
        initTemplate5LiveDetails();
        initPrivacyDialog();
      }

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
      } else {
        init();
      }
    })();
  