import { collectParams } from "meta-capi-param-builder-clientjs/shared/ext/ebpExtension.js";
import { disposeBridge, setBridgeFailureHandler } from "./ebpWindow.mjs";

let collected;
globalThis.window.__ATRIO_META_COLLECT_CLICK_ID__ = function collectCurrentClickId() {
  if (collected) return collected;
  collected = new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      disposeBridge();
      resolve(typeof value === "string" && /^[A-Za-z0-9_-]{1,500}$/.test(value) ? value : null);
    };
    const timer = setTimeout(() => finish(null), 800);
    setBridgeFailureHandler(() => finish(null));
    Promise.resolve().then(() => collectParams()).then(finish, () => finish(null));
  });
  return collected;
};
