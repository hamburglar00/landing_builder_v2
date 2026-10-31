// Lexical window used only by this bundle's official Meta EBP collector.
// The main Meta SDK and the browser's globals are never replaced.
const browser = globalThis.window;
const cleanups = new Set();
let onFailure = () => {};

export function setBridgeFailureHandler(handler) {
  onFailure = handler;
}

export function disposeBridge() {
  onFailure = () => {};
  for (const cleanup of cleanups) cleanup();
  cleanups.clear();
}

function iosMessage(path) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      cleanups.delete(cancel);
      resolve(typeof value === "string" ? value : null);
    };
    const cancel = () => finish(null);
    cleanups.add(cancel);
    try {
      Promise.resolve(browser.webkit.messageHandlers.browserProperties.postMessage(path))
        .then(finish, cancel);
    } catch {
      cancel();
    }
  });
}

class EbpRequest {
  DONE = 4;
  readyState = 0;
  status = 0;
  responseText = "";
  closed = false;
  onload = null;
  onerror = null;

  constructor() {
    try { this.request = new browser.XMLHttpRequest(); } catch { this.closed = true; onFailure(); return; }
    this.cancel = () => {
      this.closed = true;
      this.request.onload = this.request.onerror = this.request.ontimeout = null;
      try { this.request.abort(); } catch { /* Already complete. */ }
    };
    cleanups.add(this.cancel);
  }

  open(method, url) {
    // Keep this adapter limited to the official EBP property, never HTTP.
    if (!this.request || this.closed) return;
    if (method !== "GET" || url !== "properties://browser/clickID") { onFailure(); return; }
    try { this.request.open(method, url); } catch { onFailure(); }
  }

  send() {
    if (!this.request || this.closed) return;
    const fail = () => {
      // SDK 1.3.1 has a detached .then() on rejected bridge promises.
      // Finish our collector instead of invoking that SDK rejection path.
      onFailure();
    };
    this.request.onload = () => {
      if (this.request.readyState !== 4 || this.request.status < 200 || this.request.status >= 300 || typeof this.request.responseText !== "string" || !this.request.responseText) {
        fail();
        return;
      }
      this.readyState = 4;
      this.status = this.request.status;
      this.responseText = this.request.responseText;
      this.onload?.();
    };
    this.request.onerror = fail;
    this.request.ontimeout = fail;
    try { this.request.send(); } catch { fail(); }
  }
}

const handler = browser.webkit?.messageHandlers?.browserProperties;
export const window = {
  navigator: browser.navigator,
  ...(handler ? { webkit: { messageHandlers: { browserProperties: { postMessage: iosMessage } } } } : {}),
  ...(typeof browser.XMLHttpRequest !== "undefined" ? { XMLHttpRequest: EbpRequest } : {}),
};
