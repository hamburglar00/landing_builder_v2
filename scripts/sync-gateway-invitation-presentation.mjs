import { readFile, writeFile } from "node:fs/promises";
const read = async path => (await readFile(path,"utf8")).replaceAll("\r\n","\n");
const base = new URL("../../landing-autologuin/public/",import.meta.url);
const canonical = await read(new URL("gateway-client.css",base));
const notice = /^\.gateway-app-notice-backdrop \{[\s\S]*?(?=@media \(max-width: 640px\))/m;
const extra = /\/\* BEGIN shared app invitation presentation \*\/[\s\S]*?\/\* END shared app invitation presentation \*\//;
const check = process.argv.includes("--check");
for (const repo of ["landing-autologuin","ases-gateway","ganamos-gateway","multi-skin-gateway"]) {
  const path = new URL(`../../${repo}/public/gateway-client.css`,import.meta.url);
  const before = await read(path);
  let after = before.replace(notice,()=>canonical.match(notice)[0]);
  after = extra.test(after) ? after.replace(extra,()=>canonical.match(extra)[0]) : after.trimEnd()+"\n\n"+canonical.match(extra)[0]+"\n";
  after = after.replace("min(740px, calc(100dvh", "min(851px, calc(100dvh").replace("min(74dvh, 720px,", "min(85.1dvh, 828px,");
  if(check) { if(after!==before) throw Error(`Invitation presentation differs: ${repo}`); }
  else await writeFile(path,after);
}
console.log("Page palettes, margins and chat dimensions synchronized across four gateways.");
