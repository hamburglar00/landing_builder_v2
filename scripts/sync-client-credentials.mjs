import { readFile, writeFile } from "node:fs/promises";
const source = new URL("../../landing-autologuin/", import.meta.url);
const read = async url => (await readFile(url, "utf8")).replaceAll("\r\n", "\n");
const contract = await read(new URL("../../internal-chat/src/lib/gateway-credentials-contract.ts", import.meta.url));
const handler = await read(new URL("src/lib/client-credentials.ts", source));
const js = await read(new URL("public/gateway-client.js", source));
const bridge = js.match(/    \/\/ BEGIN shared client credentials bridge\n[\s\S]*?    \/\/ END shared client credentials bridge/)?.[0];
if (!bridge) throw Error("Missing credentials bridge");
const check = process.argv.includes("--check");
for (const repo of ["landing-autologuin", "ases-gateway", "ganamos-gateway", "multi-skin-gateway"]) {
  const root = new URL(`../../${repo}/`, import.meta.url);
  let client = await read(new URL("public/gateway-client.js", root));
  const pattern = /    \/\/ BEGIN shared client credentials bridge\n[\s\S]*?    \/\/ END shared client credentials bridge/;
  client = pattern.test(client) ? client.replace(pattern, () => bridge) : client.replace("    function showProfileNotice(invitation) {", bridge + "\n\n    function showProfileNotice(invitation) {");
  const hook = '      if (event.data.type === "atrio.widget.credentials") void replyWithClientCredentials(event.data);';
  if (!client.includes(hook)) client = client.replace('      if (event.data.type === "atrio.widget.close") setOpen(false);', '      if (event.data.type === "atrio.widget.close") setOpen(false);\n' + hook);
  for (const [name, expected] of [["public/gateway-client.js", client], ["src/lib/client-credentials.ts", handler], ["src/lib/gateway-credentials-contract.ts", contract], ["src/lib/client-credentials.test.ts", await read(new URL("src/lib/client-credentials.test.ts", source))]]) {
    const url = new URL(name, root);
    if (check) { if (await read(url) !== expected) throw Error(`Credentials differ: ${repo}/${name}`); }
    else await writeFile(url, expected);
  }
}
console.log("Client credentials synchronized across all four gateways.");
