/** Browser-only JSON transport. The deadline covers headers and body; cancellation
 * settles even when a fetch implementation ignores AbortSignal. No account writes. */
export function buildTemplate7BoundedRequestScript(trackIdentity = false): string {
  return `
    if (!window.__T7_FETCH_JSON__) window.__T7_FETCH_JSON__ = function(path, options, milliseconds) {
      var controller = typeof AbortController === 'function' ? new AbortController() : null;
      var timer, finished = false, rejectRequest, startedAt = Date.now();
      function observeTiming(header) {
        try {
          if (!header || header.length > 2048) return;
          if(window.__entryFunnel) window.__entryFunnel.timings(header);
          else { var early=window.__ENTRY_FUNNEL_EARLY__;if(early){early.timings=early.timings||[];if(early.timings.length<8)early.timings.push(header);} }
        } catch (_) {}
      }
      var request = new Promise(function(resolve, reject) {
        rejectRequest = reject;
        timer = window.setTimeout(function() { cancel('request_timeout'); }, milliseconds);
        var init = Object.assign({}, options, controller ? {signal:controller.signal} : {});
        Promise.resolve().then(function() { return fetch(path, init); }).then(function(response) {
          if (finished) return;
          if (!response || !response.ok) {
            var error = new Error('entry_request_failed');
            error.code = response && response.status === 429 ? 'rate_limited' : 'network_error';
            error.status = response && response.status;
            throw error;
          }
          try { if (path === '/api/template7/destination') observeTiming(response.headers.get('server-timing')); } catch (_) {}
          return response.json();
        }).then(function(data) {
          if (finished) return;
          ${trackIdentity ? "if(path === '/api/client-identity/bootstrap') observeTiming('t7-identity-bootstrap;dur='+Math.max(0,Date.now()-startedAt));" : ""}
          finished = true; window.clearTimeout(timer); resolve(data);
        }, function(error) {
          if (finished) return;
          finished = true; window.clearTimeout(timer); reject(error);
        });
      });
      function cancel(code) {
        if (finished) return;
        finished = true; window.clearTimeout(timer);
        if (controller) controller.abort();
        var error = new Error('entry_request_cancelled'); error.code = code || 'request_cancelled'; rejectRequest(error);
      }
      request.cancel = cancel;
      return request;
    };
  `;
}
