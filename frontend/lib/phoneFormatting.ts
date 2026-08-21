function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function formatSubscriber(subscriber: string): string {
  if (subscriber.length === 6) return `${subscriber.slice(0, 3)}-${subscriber.slice(3)}`;
  if (subscriber.length === 7) return `${subscriber.slice(0, 3)}-${subscriber.slice(3)}`;
  if (subscriber.length === 8) return `${subscriber.slice(0, 4)}-${subscriber.slice(4)}`;
  return subscriber;
}

function argentinaAreaLengths(local: string): number[] {
  return local.startsWith("11") ? [2, 3, 4] : [3, 4, 2];
}

function formatArgentinaWhatsAppPhone(digits: string): string | null {
  if (!digits.startsWith("54")) return null;

  let local = digits.startsWith("549") ? digits.slice(3) : digits.slice(2);
  if (local.startsWith("9")) local = local.slice(1);

  for (const areaLength of argentinaAreaLengths(local)) {
    if (local.slice(areaLength, areaLength + 2) !== "15") continue;

    const areaCode = local.slice(0, areaLength);
    const subscriber = local.slice(areaLength + 2);
    if (areaCode && subscriber.length >= 6 && subscriber.length <= 8) {
      return `+54 9 ${areaCode} ${formatSubscriber(subscriber)}`;
    }
  }

  for (const areaLength of argentinaAreaLengths(local)) {
    const areaCode = local.slice(0, areaLength);
    const subscriber = local.slice(areaLength);
    if (areaCode && subscriber.length >= 6 && subscriber.length <= 8) {
      return `+54 9 ${areaCode} ${formatSubscriber(subscriber)}`;
    }
  }

  return null;
}

export function formatWhatsAppDisplayPhone(value: string | null | undefined): string {
  const digits = onlyDigits(String(value ?? ""));
  if (!digits) return "";

  const argentinaPhone = formatArgentinaWhatsAppPhone(digits);
  if (argentinaPhone) return argentinaPhone;

  if (digits.startsWith("595") && digits.length >= 12) {
    const local = digits.slice(3);
    return `+595 ${local.slice(0, 3)} ${local.slice(3, 6)}-${local.slice(6, 9)}`;
  }

  return `+${digits}`;
}
