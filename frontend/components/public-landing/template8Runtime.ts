/** Selection adapter around the shared Template 7 runtime, identity and tracking. */
export function adaptTemplate8Runtime(source: string, classic: boolean): string {
  source = source.replaceAll("[cfg.slug]", "[template8DestinationKey()]");
  source = source.replace("function template7DestinationKey() { return cfg.slug; }", "function template7DestinationKey() { return template8DestinationKey(); }");
  source = source.replace('template7RequestDestination({ landing_id:', 'template7RequestDestination({ commit: true, landing_id:');
  source = source.replace("      function ensureAtrioPromise() {", "      function ensureAtrioPromise() {\n        if (!cfg.cardIndex) return Promise.resolve(null);");
  source = source.replace("      function warmTemplate7Entry() {", "      function warmTemplate7Entry() {\n        if (!cfg.cardIndex) return;");
  source = source.replace("if (cfg.template !== 6 ||", "if ((cfg.template !== 6 && !cfg.template8) ||");
  source = source.replace("          notifyTemplate6CardClick(button);", "          if (!cfg.template8) notifyTemplate6CardClick(button);");
  source = source.replace("target_provider: cfg.targetProvider,", "card_index: String(cfg.cardIndex), target_provider: cfg.targetProvider,");
  source = source.replace("target_provider: gatewayMode ? cfg.targetProvider : undefined,", "card_index: cfg.cardIndex, target_provider: gatewayMode ? cfg.targetProvider : undefined,");
  source = source.replace("      function init() {", `
      var template8SelectionVersion = 0;
      function template8DestinationKey() { return cfg.slug + ':' + (cfg.cardIndex || 'unselected'); }
      function template8Destination(card, commit) {
        return template7RequestDestination({landing_id:cfg.landingId, landing_slug:cfg.slug, card_index:card.index, commit:commit${classic ? ", device_id:getOrCreateDeviceId()" : ""}}, true);
      }
      function initTemplate8Selection() {
        var grid = document.querySelector('[data-template8-grid]');
        var entry = document.querySelector('[data-template8-entry]');
        var status = document.querySelector('[data-template8-status]');
        window.addEventListener('click', function(event) {
          var back = event.target && event.target.closest && event.target.closest('[data-template8-back]');
          if (back && !clickLocked && !window.__T7_ENTRY_STARTED__) { template8SelectionVersion++; template7EntryGeneration++; cancelTemplate7Destination(); entry.hidden = true; grid.hidden = false; cfg.cardIndex = null; return; }
          var button = event.target && event.target.closest && event.target.closest('[data-template8-card-index]');
          if (!button || button.disabled || clickLocked || window.__T7_ENTRY_STARTED__) return;
          var index = Number(button.getAttribute('data-template8-card-index'));
          var card = cfg.template8Cards[index - 1];
          if (!card) return;
          var selectionVersion = ++template8SelectionVersion;
          template7EntryGeneration++;
          cancelTemplate7Destination();
          setTemplate7Error(''); if(status)status.textContent='';
          notifyTemplate6CardClick(button);
          cfg.cardIndex = index; cfg.targetProvider = card.targetProvider; cfg.skinCode = card.multiSkinCode || '';
          if(window.__entryFunnel)window.__entryFunnel.emit('skin_selected',{provider:cfg.targetProvider,skin:cfg.skinCode});
          window.__T7_SELECTED_GATEWAY__=card.gatewayOrigin;
          if(window.__T7_WARM_RESOURCES__)window.__T7_WARM_RESOURCES__(card.gatewayOrigin);
          try { var selectedUrl = new URL(window.location.href); selectedUrl.searchParams.set('card_index',String(index)); selectedUrl.searchParams.set('target_provider',card.targetProvider); window.history.replaceState(window.history.state,'',selectedUrl.href); } catch(e) {}
          var login = document.querySelector('[data-template8-login]');
          if (login && card.gatewayOrigin) login.href = card.gatewayOrigin;
          var logo = document.querySelector('[data-entry-logo]');
          if (logo && card.transitionLogo) { logo.removeAttribute('src'); logo.setAttribute('data-src',card.transitionLogo); logo.alt = card.text; }
          var transitionRoot = document.getElementById('gateway-entry-transition');
          if (transitionRoot && card.transitionBrand) {
            var brand = card.transitionBrand;
            transitionRoot.dataset.palette = brand.background;
            transitionRoot.style.setProperty('--entry-background',brand.background);
            transitionRoot.style.setProperty('--entry-accent',brand.accent || '#f6c84b');
            transitionRoot.style.setProperty('--entry-track',(brand.accent || '#f6c84b') + '33');
            transitionRoot.style.setProperty('--entry-accent-text',brand.accentText || '#171105');
            transitionRoot.style.setProperty('--entry-glow',brand.glow);
            transitionRoot.querySelectorAll('[data-entry-source]').forEach(function(source) {
              source.removeAttribute('srcset'); source.dataset.srcset = card.transitionLogoAvif || '';
            });
          }
          grid.hidden = true; entry.hidden = false;
          var title = document.querySelector('[data-template8-selected-page]');
          if (title) title.textContent = card.text;
          var pageLogo = document.querySelector('.template7__logo');
          if (!pageLogo && title && card.imageUrl) { pageLogo=document.createElement('img'); pageLogo.className='template7__logo'; title.parentNode.insertBefore(pageLogo,title); }
          if (pageLogo) { pageLogo.hidden=!card.imageUrl; if(card.imageUrl){pageLogo.src=card.imageUrl;pageLogo.alt=card.text;} }
          var input = document.querySelector('[data-template7-name]');
          window.__T7_PROGRAMMATIC_FOCUS__=true;
          if (input) input.focus();
          window.__T7_PROGRAMMATIC_FOCUS__=false;
          var key = template8DestinationKey();
          window.__PUBLIC_LANDING_ATRIO_PROMISES=window.__PUBLIC_LANDING_ATRIO_PROMISES||{};
          // Selection owns its own request. Never wait for another card's warmup.
          var selected = template8Destination(card, true);
          window.__PUBLIC_LANDING_ATRIO_PROMISES[key] = selected;
          observeTemplate7Destination(selected);
          selected.then(function(advisor) {
            if (selectionVersion !== template8SelectionVersion) return;
            if(!advisor && !window.__T7_ENTRY_STARTED__)setTemplate7Error('No pudimos preparar el acceso. Tocá Crear usuario para volver a intentar.');
            if (advisor && advisor.preparationReady) warmTemplate7Entry();
          });
        }, true);
      }
      function init() {
        initTemplate8Selection();`);
  // Recovery must carry the same saved card and original attribution as a new entry.
  source = source.replace(/(landing_slug:\s*cfg\.slug)(?=\s*[,}])(?!\s*,\s*card_index\s*:)/g, "$1, card_index: cfg.cardIndex");
  return source;
}
