/** Browser-only JSON transport. The deadline covers headers and body; cancellation
 * settles even when a fetch implementation ignores AbortSignal. No account writes. */
export function buildTemplate7BoundedRequestScript(): string {
  return `
    if (!window.__T7_FETCH_JSON__) window.__T7_FETCH_JSON__ = function(path, options, milliseconds) {
      var controller = typeof AbortController === 'function' ? new AbortController() : null;
      var timer, finished = false, rejectRequest;
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
          return response.json();
        }).then(function(data) {
          if (finished) return;
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
