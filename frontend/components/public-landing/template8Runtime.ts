/** Selection adapter around the shared Template 7 runtime, identity and tracking. */
export function adaptTemplate8Runtime(source: string, classic: boolean): string {
  source = source.replaceAll("[cfg.slug]", "[template8DestinationKey()]");
  source = source.replace("      function ensureAtrioPromise() {", "      function ensureAtrioPromise() {\n        if (!cfg.cardIndex) return Promise.resolve(null);");
  source = source.replace("      function warmTemplate7Entry() {", "      function warmTemplate7Entry() {\n        if (!cfg.cardIndex) { prewarmTemplate8Pages(); return; }");
  source = source.replace("landing_slug: cfg.slug,\n            name:", "landing_slug: cfg.slug,\n            card_index: cfg.cardIndex,\n            name:");
  source = source.replace("if (cfg.template !== 6 ||", "if ((cfg.template !== 6 && !cfg.template8) ||");
  source = source.replace("          notifyTemplate6CardClick(button);", "          if (!cfg.template8) notifyTemplate6CardClick(button);");
  source = source.replace("target_provider: cfg.targetProvider,", "card_index: String(cfg.cardIndex), target_provider: cfg.targetProvider,");
  source = source.replace("target_provider: gatewayMode ? cfg.targetProvider : undefined,", "card_index: cfg.cardIndex, target_provider: gatewayMode ? cfg.targetProvider : undefined,");
  source = source.replace("attribution: { target_provider: cfg.targetProvider }", "attribution: template8RecoveryAttribution()");
  source = source.replace("      function init() {", `
      var template8SelectionVersion = 0;
      function template8RecoveryAttribution() {
        var params = new URLSearchParams(window.location.search);
        var result = { landing:cfg.slug, landing_resolution:landingResolution || '', target_provider:cfg.targetProvider, card_index:String(cfg.cardIndex) };
        ['facebook','portofolio','cp','campana','conjunto','anuncio','utm_source','utm_medium','utm_campaign','utm_content','utm_term'].forEach(function(key){var value=params.get(key);if(value)result[key]=value;});
        return result;
      }
      function template8DestinationKey() { return cfg.slug + ':' + (cfg.targetProvider || 'unselected'); }
      function template8Destination(card, commit) {
        return Promise.resolve(window.__LB_IDENTITY_READY__ || true).then(function(ready) {
          if (ready !== true) throw new Error('identity_pending');
          return fetch('/api/template7/destination', {
            method:'POST', credentials:'same-origin', cache:'no-store', headers:{'Content-Type':'application/json'},
            body:JSON.stringify({landing_id:cfg.landingId, landing_slug:cfg.slug, card_index:card.index, commit:commit${classic ? ", device_id:getOrCreateDeviceId()" : ""}})
          }).then(function(response) { if (!response.ok) throw new Error('page_unavailable'); return response.json(); });
        });
      }
      function prewarmTemplate8Pages() {
        window.__PUBLIC_LANDING_ATRIO_PROMISES = window.__PUBLIC_LANDING_ATRIO_PROMISES || {};
        var promises = window.__PUBLIC_LANDING_ATRIO_PROMISES;
        cfg.template8Cards.forEach(function(card) {
          if (card.targetProvider === 'multi_skin') return;
          var key = cfg.slug + ':' + card.targetProvider;
          if (!promises[key]) promises[key] = template8Destination(card, false).catch(function() { return null; });
        });
      }
      function initTemplate8Selection() {
        var grid = document.querySelector('[data-template8-grid]');
        var entry = document.querySelector('[data-template8-entry]');
        var status = document.querySelector('[data-template8-status]');
        window.addEventListener('click', function(event) {
          var back = event.target && event.target.closest && event.target.closest('[data-template8-back]');
          if (back && !clickLocked && !window.__T7_ENTRY_STARTED__) { template8SelectionVersion++; entry.hidden = true; grid.hidden = false; cfg.cardIndex = null; return; }
          var button = event.target && event.target.closest && event.target.closest('[data-template8-card-index]');
          if (!button || button.disabled || clickLocked || window.__T7_ENTRY_STARTED__) return;
          var index = Number(button.getAttribute('data-template8-card-index'));
          var card = cfg.template8Cards[index - 1];
          if (!card || card.targetProvider === 'multi_skin') return;
          var selectionVersion = ++template8SelectionVersion;
          notifyTemplate6CardClick(button);
          cfg.cardIndex = index; cfg.targetProvider = card.targetProvider; cfg.skinCode = '';
          try { var selectedUrl = new URL(window.location.href); selectedUrl.searchParams.set('card_index',String(index)); selectedUrl.searchParams.set('target_provider',card.targetProvider); window.history.replaceState(window.history.state,'',selectedUrl.href); } catch(e) {}
          var login = document.querySelector('[data-template8-login]');
          if (login && card.gatewayOrigin) login.href = card.gatewayOrigin;
          var logo = document.querySelector('[data-entry-logo]');
          if (logo && card.transitionLogo) { logo.removeAttribute('src'); logo.setAttribute('data-src',card.transitionLogo); logo.alt = card.text; }
          grid.hidden = true; entry.hidden = false;
          var title = document.querySelector('[data-template8-selected-page]');
          if (title) title.textContent = card.text;
          var pageLogo = document.querySelector('.template7__logo');
          if (!pageLogo && title && card.imageUrl) { pageLogo=document.createElement('img'); pageLogo.className='template7__logo'; title.parentNode.insertBefore(pageLogo,title); }
          if (pageLogo) { pageLogo.hidden=!card.imageUrl; if(card.imageUrl){pageLogo.src=card.imageUrl;pageLogo.alt=card.text;} }
          var input = document.querySelector('[data-template7-name]'); if (input) input.focus();
          var key = template8DestinationKey();
          var previous = window.__PUBLIC_LANDING_ATRIO_PROMISES[key];
          var selected = Promise.resolve(previous).then(function() { return template8Destination(card, true); });
          window.__PUBLIC_LANDING_ATRIO_PROMISES[key] = selected.catch(function() { return null; });
          selected.then(function(advisor) {
            if (selectionVersion !== template8SelectionVersion) return;
            if (advisor && advisor.preparationReady) warmTemplate7Entry();
          }).catch(function() {
            if (selectionVersion !== template8SelectionVersion) return;
            entry.hidden = true; grid.hidden = false; cfg.cardIndex = null;
            status.textContent = 'Esta página no está disponible ahora. Elegí otra o volvé a intentar.';
          });
        }, true);
      }
      function init() {
        initTemplate8Selection();`);
  // Recovery must carry the same saved card and original attribution as a new entry.
  source = source.replaceAll("landing_id: cfg.landingId, landing_slug: cfg.slug", "landing_id: cfg.landingId, landing_slug: cfg.slug, card_index: cfg.cardIndex");
  return source;
}
