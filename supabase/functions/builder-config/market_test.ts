import {
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import { phoneCountryCodeForCurrency } from "./market.ts";

Deno.test("usa Paraguay para PYG", () => {
  assertEquals(phoneCountryCodeForCurrency("PYG"), "595");
  assertEquals(phoneCountryCodeForCurrency("pyg"), "595");
});

Deno.test("conserva Argentina para configuraciones históricas o ambiguas", () => {
  assertEquals(phoneCountryCodeForCurrency("ARS"), "54");
  assertEquals(phoneCountryCodeForCurrency("USD"), "54");
  assertEquals(phoneCountryCodeForCurrency(""), "54");
});
