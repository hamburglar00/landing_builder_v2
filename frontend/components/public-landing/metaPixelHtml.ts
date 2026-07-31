import { buildPhoneNormalizerScript } from "./trackingScriptHelpers";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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

export function buildPixelInitScript(
  pixelId: string,
  slug: string,
  phoneCountryCode = "54",
) {
  const safePixelId = pixelId.replace(/\D+/g, "");
  if (!safePixelId) return "";
  const storageNamespace = `landing-builder:${safePixelId}:${slug}`;

  return `<script>
    (function () {
      !function(f,b,e,v,n,t,s){
        if(f.fbq) return;
        n=f.fbq=function(){
          n.callMethod
            ? n.callMethod.apply(n, arguments)
            : n.queue.push(arguments);
        };
        if(!f._fbq) f._fbq=n;
        n.push=n;
        n.loaded=!0;
        n.version='2.0';
        n.queue=[];
        t=b.createElement(e);
        t.async=!0;
        t.src=v;
        s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s);
      }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

      try {
        var params = new URLSearchParams(window.location.search);
        var storageNamespace = ${escapeScriptJson(storageNamespace)};

        function storageKey(key){
          return storageNamespace + ':' + key;
        }

        function readMeta(key){
          try {
            return window.__META && window.__META[key] ? window.__META[key] : '';
          } catch (e) {
            return '';
          }
        }

        function readLocalStorage(key){
          try {
            return localStorage.getItem(storageKey(key)) || '';
          } catch (e) {
            return '';
          }
        }

        function writeLocalStorage(key, value){
          try {
            if (value) localStorage.setItem(storageKey(key), value);
          } catch (e) {}
        }

        function sanitizeAddressBar(){
          try {
            var url = new URL(window.location.href);
            var sensitiveKeys = ['email', 'em', 'phone', 'ph', 'fn', 'ln', 'external_id', 'eid', 'ct', 'st', 'zip', 'country'];
            var changed = false;
            sensitiveKeys.forEach(function(key){
              if (url.searchParams.has(key)) {
                url.searchParams.delete(key);
                changed = true;
              }
            });
            if (changed) {
              window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
            }
          } catch (e) {}
        }

        function firstNonEmpty(values){
          for (var i = 0; i < values.length; i += 1) {
            var value = values[i];
            if (value != null) {
              var text = String(value).trim();
              if (text) return text;
            }
          }
          return '';
        }

        function normEmail(v){
          v = (v || '').trim().toLowerCase();
          return v || undefined;
        }

        ${buildPhoneNormalizerScript("normPhone")}

        function safeUUID(){
          if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            return window.crypto.randomUUID();
          }
          return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c){
            var r = Math.random() * 16 | 0;
            var v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });
        }

        function getOrCreateExternalId(){
          try {
            var existing = readLocalStorage('external_id');
            if (existing) return existing;
            var created = safeUUID();
            localStorage.setItem(storageKey('external_id'), created);
            return created;
          } catch (e) {
            return safeUUID();
          }
        }

        var userEmail = normEmail(firstNonEmpty([
          params.get('email'),
          params.get('em'),
          readLocalStorage('em'),
          readMeta('userEmail')
        ]));

        var userPhone = normPhone(firstNonEmpty([
          params.get('phone'),
          params.get('ph'),
          readLocalStorage('ph'),
          readMeta('userPhone')
        ]), ${escapeScriptJson(phoneCountryCode)}) || undefined;

        var userFn = firstNonEmpty([
          params.get('fn'),
          readMeta('userFn')
        ]) || undefined;

        var userLn = firstNonEmpty([
          params.get('ln'),
          readMeta('userLn')
        ]) || undefined;

        var externalId =
          firstNonEmpty([readMeta('externalId'), readLocalStorage('external_id')]) ||
          getOrCreateExternalId();

        writeLocalStorage('external_id', externalId);
        writeLocalStorage('em', userEmail);
        writeLocalStorage('ph', userPhone);
        writeLocalStorage('ct', params.get('ct') || '');
        writeLocalStorage('st', params.get('st') || '');
        writeLocalStorage('zip', params.get('zip') || '');
        writeLocalStorage('country', params.get('country') || '');
        sanitizeAddressBar();

        fbq('init', ${escapeScriptJson(safePixelId)}, {
          em: userEmail,
          ph: userPhone,
          fn: userFn,
          ln: userLn,
          external_id: externalId
        });

        fbq('track', 'PageView');

        window.__META = {
          PIXEL_ID: ${escapeScriptJson(safePixelId)},
          userEmail: userEmail,
          userPhone: userPhone,
          userFn: userFn,
          userLn: userLn,
          externalId: externalId,
          safeUUID: safeUUID
        };
      } catch (e) {
        console.error('Meta Pixel init error', e);
      }
    })();
  </script>`;
}

export function buildPixelNoscript(pixelId: string) {
  const safePixelId = pixelId.replace(/\D+/g, "");
  if (!safePixelId) return "";

  return `<noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${escapeHtml(
    safePixelId,
  )}&amp;ev=PageView&amp;noscript=1" alt=""></noscript>`;
}
