import { readFile, writeFile } from "node:fs/promises";

const read = async url => (await readFile(url, "utf8")).replaceAll("\r\n", "\n");
const source = await read(new URL("../../landing-autologuin/public/gateway-client.js", import.meta.url));
const block = /  \/\/ BEGIN shared contextual install offer\n[\s\S]*?  \/\/ END shared contextual install offer/;
const canonical = source.match(block)?.[0];
if (!canonical) throw Error("Missing contextual install offer");
const check = process.argv.includes("--check");
for (const repo of ["landing-autologuin", "ases-gateway", "ganamos-gateway", "multi-skin-gateway"]) {
  const target = new URL(`../../${repo}/public/gateway-client.js`, import.meta.url);
  const before = await read(target);
  const pattern = block.test(before) ? block : /  function initializeInstallAndPush\(\) \{[\s\S]*?\n  \}/;
  if (!pattern.test(before)) throw Error(`Missing installation initialization: ${repo}`);
  let after = before.replace(pattern, () => canonical);
  // Presentation/bridge changes have one source too; provider login code stays local.
  for (const section of [
    /  function closeNotice\(\) \{[\s\S]*?(?=  function registerServiceWorker)/,
    /  function subscribeToPush\(\) \{[\s\S]*?(?=  function parseWidgetPresentation)/,
  ]) {
    const shared = source.match(section)?.[0];
    if (!shared || !section.test(after)) throw Error(`Missing reminder section: ${repo}`);
    after = after.replace(section, () => shared);
  }
  after = after.replace(/    function showProfileNotice\(invitation\) \{[\s\S]*?(?=    function showPromotionNotice)/, section => {
    if (!section.includes("reminderInvitation:")) section = section.replace("title: invitation.title,", "title: invitation.title,\n        reminderInvitation: invitation.reminderKey ? invitation : null,");
    return section.replace('if (storageGet(localStorage, dismissKey)', 'if (dismissKey && storageGet(localStorage, dismissKey)')
      .replace(/^          storageSet\(localStorage, dismissKey, "1"\);/m, '          if (dismissKey) storageSet(localStorage, dismissKey, "1");');
  });
  after = after.replace(/      if \(event.data.type === "atrio.widget.request-install"\) \{[\s\S]*?\n      \}/,
    '      if (event.data.type === "atrio.widget.request-install") {\n        requestInstallOffer(event.data);\n      }');
  const cancel = source.match(/      if \(event.data.type === "atrio.widget.cancel-reminder"[\s\S]*?\n      \}/)?.[0];
  if (!after.includes('event.data.type === "atrio.widget.cancel-reminder"')) {
    if (!cancel) throw Error("Missing reminder cancellation");
    after = after.replace('      if (event.data.type === "atrio.widget.invitation") {', cancel + '\n      if (event.data.type === "atrio.widget.invitation") {');
  }
  const additions = [
    ['      if (event.data.type === "atrio.widget.request-install") {', '      if (event.data.type === "atrio.widget.reminders-ready" || event.data.type === "atrio.widget.reminder-ack") handleReminderReceipt(event.data);', true],
    ['      if (event.data.type === "atrio.widget.request-install") {', '      if (event.data.type === "atrio.widget.refresh-app-state") void refreshReminderState(event.data.requestId);', true],
    ['      if (event.data.type === "atrio.widget.ready") {', '        publishInstallOfferState();'],
    ['      if (event.data.type === "atrio.widget.invitation") {', '      if (event.data.type === "atrio.widget.dismiss-install-offer") dismissInstallOffer();', true],
    ['    storageSet(localStorage, "gateway:installed", "1");', '    publishInstallOfferState();'],
  ];
  for (const [anchor, addition, prepend] of additions) {
    if (prepend) {
      let found = false;
      after = after.split("\n").filter(line => {
        if (line !== addition) return true;
        if (found) return false;
        found = true;
        return true;
      }).join("\n");
    }
    const expected = prepend ? addition + "\n" + anchor : anchor + "\n" + addition;
    if (!(prepend ? after.includes(addition) : after.includes(expected))) {
      if (!after.includes(anchor)) throw Error(`Missing install offer anchor: ${repo}`);
      after = after.replace(anchor, expected);
    }
  }
  if (check) { if (after !== before) throw Error(`Install offer differs: ${repo}`); }
  else await writeFile(target, after);
}
console.log("Contextual installation synchronized across all four gateways.");
