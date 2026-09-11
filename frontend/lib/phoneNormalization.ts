export function normalizeInternationalPhone(
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
