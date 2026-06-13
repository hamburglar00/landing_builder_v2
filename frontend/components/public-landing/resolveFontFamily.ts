export function resolveFontFamily(token: string | undefined): string | undefined {
  const value = (token || "system").toLowerCase();

  switch (value) {
    case "system":
      return undefined;
    case "roboto":
      return '"Roboto", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    case "poppins":
      return '"Poppins", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    case "montserrat":
      return '"Montserrat", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    case "bebas":
      return '"Bebas Neue", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    case "anton":
      return '"Anton", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    case "pp_mori":
      return '"PP Mori", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    case "alpha":
      return '"Alpha", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    default:
      return token;
  }
}
