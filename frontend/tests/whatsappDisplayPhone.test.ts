import assert from "node:assert/strict";
import test from "node:test";

import { formatWhatsAppDisplayPhone } from "../lib/phoneFormatting";

test("formatea telefonos argentinos de WhatsApp con 9 internacional", () => {
  assert.equal(formatWhatsAppDisplayPhone("54351158571452"), "+54 9 351 857-1452");
  assert.equal(formatWhatsAppDisplayPhone("5493518571452"), "+54 9 351 857-1452");
  assert.equal(formatWhatsAppDisplayPhone("+54 9 351 857-1452"), "+54 9 351 857-1452");
});

test("mantiene fallback internacional cuando no reconoce el formato", () => {
  assert.equal(formatWhatsAppDisplayPhone("12345"), "+12345");
  assert.equal(formatWhatsAppDisplayPhone(""), "");
});
