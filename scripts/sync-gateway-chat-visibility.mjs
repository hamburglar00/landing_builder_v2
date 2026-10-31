import { readFile, writeFile } from "node:fs/promises";

const read = async url => (await readFile(url, "utf8")).replaceAll("\r\n", "\n");
const canonical = await read(new URL("../../landing-autologuin/public/gateway-client.js", import.meta.url));
const pattern = /    \/\/ BEGIN shared chat visibility\n[\s\S]*?    \/\/ END shared chat visibility/;
const shared = canonical.match(pattern)?.[0];
if (!shared) throw new Error("Missing canonical chat visibility bridge");
const check = process.argv.includes("--check");
for (const repo of ["landing-autologuin", "ases-gateway", "ganamos-gateway", "multi-skin-gateway"]) {
  const target = new URL(`../../${repo}/public/gateway-client.js`, import.meta.url);
  const source = await read(target);
  const block = repo === "landing-autologuin" ? shared : shared.replaceAll('source: "reydeases-gateway"', "source: config.messageSource");
  const previous = source.includes("// BEGIN shared chat visibility") ? pattern
    : /    let frameLoaded = false;[\s\S]*?(?=\n\n    \/\/ BEGIN shared chat motion)/;
  if (!previous.test(source)) throw new Error(`Missing chat visibility bridge: ${repo}`);
  let expected = source.replace(previous, () => block);
  const ready = '      if (event.data.type === "atrio.widget.ready") {';
  if (!expected.includes(ready + "\n        widgetReady = true;")) {
    if (!expected.includes(ready)) throw new Error(`Missing widget ready handler: ${repo}`);
    expected = expected.replace(ready, ready + "\n        widgetReady = true;");
  }
  const prepared = ready + "\n        widgetReady = true;";
  if (!expected.includes(prepared + "\n        if (event.data.visibleEntry === true) pendingAction = null;")) {
    expected = expected.replace(prepared, prepared + "\n        if (event.data.visibleEntry === true) pendingAction = null;");
  }
  if (check) {
    if (source !== expected) throw new Error(`Chat visibility differs: ${repo}`);
  } else await writeFile(target, expected);
}
console.log("Chat visibility synchronized across all four gateways.");
