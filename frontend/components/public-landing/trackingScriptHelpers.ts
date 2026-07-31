const PHONE_NORMALIZER_BODY = String.raw`
  var digits = String(raw || "").replace(/\D+/g, "");
  var countryCallingCode = String(rawCountryCallingCode || "").replace(/\D+/g, "");
  if (!digits) return "";
  if (digits.indexOf("00") === 0) digits = digits.slice(2);
  if (countryCallingCode && digits.indexOf(countryCallingCode) === 0) return digits;

  var national = digits.replace(/^0+/, "");
  if (countryCallingCode === "54") {
    national = national.replace(/^15/, "");
    return national.length === 10 ? "54" + national : digits;
  }
  if (countryCallingCode === "595") {
    return national.length === 9 ? "595" + national : digits;
  }
  return digits;
`;

export function normalizeLandingPhone(
  raw: unknown,
  rawCountryCallingCode: unknown,
): string {
  let digits = String(raw || "").replace(/\D+/g, "");
  const countryCallingCode = String(rawCountryCallingCode || "").replace(/\D+/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (countryCallingCode && digits.startsWith(countryCallingCode)) return digits;

  let national = digits.replace(/^0+/, "");
  if (countryCallingCode === "54") {
    national = national.replace(/^15/, "");
    return national.length === 10 ? `54${national}` : digits;
  }
  if (countryCallingCode === "595") {
    return national.length === 9 ? `595${national}` : digits;
  }
  return digits;
}

export function buildPhoneNormalizerScript(functionName = "normalizePhone"): string {
  if (!/^[A-Za-z_$][\w$]*$/.test(functionName)) {
    throw new Error("Invalid phone normalizer function name");
  }
  return `function ${functionName}(raw, rawCountryCallingCode) {${PHONE_NORMALIZER_BODY}}`;
}
