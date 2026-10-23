import { readFile, writeFile } from "node:fs/promises";

// Synchronize only the common motion: provider identities and support adapters stay local.
const canonical = new URL("../../landing-autologuin/public/", import.meta.url);
const read = async url => (await readFile(url, "utf8")).replaceAll("\r\n", "\n");
const js = await read(new URL("gateway-client.js", canonical));
const css = await read(new URL("gateway-client.css", canonical));
const runtime = js.match(/    \/\/ BEGIN shared chat motion\n[\s\S]*?    \/\/ END shared chat motion/)?.[0];
const styles = css.match(/\/\* BEGIN shared chat motion \*\/[\s\S]*?\/\* END shared chat motion \*\//)?.[0];
if (!runtime || !styles) throw Error("Missing canonical chat motion");
const check = process.argv.includes("--check");
for (const repo of ["landing-autologuin", "ases-gateway", "ganamos-gateway", "multi-skin-gateway"]) {
  const root = new URL(`../../${repo}/public/`, import.meta.url);
  let client = await read(new URL("gateway-client.js", root));
  const runtimePattern = client.includes("// BEGIN shared chat motion")
    ? /    \/\/ BEGIN shared chat motion\n[\s\S]*?    \/\/ END shared chat motion/
    : /    function setOpen\(open\) \{[\s\S]*?\n    \}(?=\n\n    function showProfileNotice)/;
  if (!runtimePattern.test(client)) throw Error(`Missing widget state function: ${repo}`);
  client = client.replace(runtimePattern, () => runtime)
    .replace(/^    backdrop\.hidden = true;\n/m, "");
  if (!client.includes('shell.dataset.motion = "closed"')) client = client.replace('shell.dataset.open = "false";', 'shell.dataset.open = "false";\n    shell.dataset.motion = "closed";');
  if (!client.includes('button.setAttribute("aria-expanded", "false")')) client = client.replace('button.setAttribute("aria-label", "Abrir chat de Atrio");', 'button.setAttribute("aria-label", "Abrir chat de Atrio");\n    button.setAttribute("aria-expanded", "false");');
  let sheet = await read(new URL("gateway-client.css", root));
  sheet = sheet.replace(/#gateway-chat-shell:not\(\[data-open="true"\]\) \{\n  width: 0 !important;[\s\S]*?\n\}\n/, "");
  const stylePattern = /\/\* BEGIN shared chat motion \*\/[\s\S]*?\/\* END shared chat motion \*\//;
  sheet = stylePattern.test(sheet) ? sheet.replace(stylePattern, () => styles) : sheet.trimEnd() + "\n\n" + styles + "\n";
  for (const [name, expected] of [["gateway-client.js", client], ["gateway-client.css", sheet]]) {
    const target = new URL(name, root);
    if (check) { if (await read(target) !== expected) throw Error(`Chat motion differs: ${repo}/${name}`); }
    else await writeFile(target, expected);
  }
}
console.log("Chat motion synchronized across all four gateways.");
