export function normalizeArgentinaWhatsapp(rawValue: unknown): string {
  let digits = String(rawValue ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) digits = digits.slice(2);
  digits = digits.replace(/^0+/, "");

  let national = digits;
  if (digits.startsWith("54")) national = digits.slice(2);
  else if (digits.startsWith("9") && digits.length === 11) national = digits.slice(1);

  national = national.replace(/^0+/, "");
  if (national.startsWith("9") && national.length === 11) national = national.slice(1);

  if (national.length === 12) {
    for (const areaLength of [2, 3, 4]) {
      if (national.slice(areaLength, areaLength + 2) !== "15") continue;
      const withoutMobilePrefix = `${national.slice(0, areaLength)}${national.slice(areaLength + 2)}`;
      if (withoutMobilePrefix.length === 10) {
        national = withoutMobilePrefix;
        break;
      }
    }
  }

  return /^[1-9]\d{9}$/.test(national) ? `549${national}` : "";
}

export function buildArgentinaWhatsappNormalizerScript(
  functionName = "normalizeArgentinaWhatsapp",
): string {
  if (!/^[A-Za-z_$][\w$]*$/.test(functionName)) {
    throw new Error("Invalid phone normalizer function name");
  }

  return `function ${functionName}(rawValue){var digits=String(rawValue==null?"":rawValue).replace(/\\D/g,"");if(!digits)return"";if(digits.indexOf("00")===0)digits=digits.slice(2);digits=digits.replace(/^0+/,"");var national=digits;if(digits.indexOf("54")===0)national=digits.slice(2);else if(digits.indexOf("9")===0&&digits.length===11)national=digits.slice(1);national=national.replace(/^0+/,"");if(national.indexOf("9")===0&&national.length===11)national=national.slice(1);if(national.length===12){var lengths=[2,3,4];for(var i=0;i<lengths.length;i++){var areaLength=lengths[i];if(national.slice(areaLength,areaLength+2)!=="15")continue;var candidate=national.slice(0,areaLength)+national.slice(areaLength+2);if(candidate.length===10){national=candidate;break}}}return/^[1-9]\\d{9}$/.test(national)?"549"+national:""}`;
}
