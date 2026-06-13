import Script from "next/script";

type Props = {
  pixelId: string;
};

declare global {
  interface Window {
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

export default function PixelInit({ pixelId }: Props) {
  const normalizedPixelId = String(pixelId || "").trim().replace(/\D+/g, "");
  if (!normalizedPixelId) return null;

  return (
    <Script id={`meta-pixel-${normalizedPixelId}`} strategy="afterInteractive">
      {`
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

            function readMeta(key){
              try {
                return window.__META && window.__META[key] ? window.__META[key] : '';
              } catch (e) {
                return '';
              }
            }

            function readLocalStorage(key){
              try {
                return localStorage.getItem(key) || '';
              } catch (e) {
                return '';
              }
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

            function normPhone(v){
              var d = String(v || '').replace(/\\D+/g, '');
              if (!d) return undefined;
              if (d.indexOf('54') === 0) return d;
              d = d.replace(/^0+/, '').replace(/^15/, '');
              if (d.length === 10) return '54' + d;
              return d || undefined;
            }

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
                var existing = localStorage.getItem('external_id');
                if (existing) return existing;
                var created = safeUUID();
                localStorage.setItem('external_id', created);
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
            ]));

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

            try {
              localStorage.setItem('external_id', externalId);
            } catch (e) {}

            try {
              if (userEmail) localStorage.setItem('em', userEmail);
              if (userPhone) localStorage.setItem('ph', userPhone);
            } catch (e) {}

            fbq('init', '${normalizedPixelId}', {
              em: userEmail,
              ph: userPhone,
              fn: userFn,
              ln: userLn,
              external_id: externalId
            });

            fbq('track', 'PageView');

            window.__META = {
              PIXEL_ID: '${normalizedPixelId}',
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
      `}
    </Script>
  );
}
