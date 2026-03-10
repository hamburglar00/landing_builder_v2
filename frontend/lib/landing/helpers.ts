import type { ColorOption, FontFamilyOption, Landing } from "./types";
import { COLOR_MAP } from "./constants";

/**
 * Devuelve el valor hex de un color de la lista cerrada.
 */
export function getColorHex(color: ColorOption): string {
  return COLOR_MAP[color] ?? "#000000";
}

/**
 * Mapea el token de familia tipográfica a una font-family CSS.
 * La landing pública puede reutilizar este contrato o definir el suyo propio.
 */
export function getFontFamilyCss(font: FontFamilyOption): string {
  switch (font) {
    case "pp_mori":
      return '"PP Mori", system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Roboto", sans-serif';
    case "roboto":
      return '"Roboto", system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
    case "poppins":
      return '"Poppins", system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
    case "montserrat":
      return '"Montserrat", system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
    case "bebas":
      return '"Bebas Neue", system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
    case "alpha":
      return '"Alpha", system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
    case "anton":
      return '"Anton", system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
    case "system":
    default:
      return 'system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Roboto", sans-serif';
  }
}

const STORAGE_KEY_PREFIX = "landing-config";
const LANDINGS_LIST_KEY_PREFIX = "landings-list";

/**
 * Clave de localStorage para la config del usuario logueado (admin, una sola).
 */
export function getStorageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}-${userId}`;
}

/**
 * Clave de localStorage para la lista de landings de un cliente.
 */
export function getLandingsStorageKey(userId: string): string {
  return `${LANDINGS_LIST_KEY_PREFIX}-${userId}`;
}

/**
 * Carga la config guardada desde localStorage.
 * Devuelve null si no hay nada guardado o si el JSON es inválido.
 */
export function loadConfigFromStorage<T>(userId: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(getStorageKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Guarda la config en localStorage para el usuario logueado.
 */
export function saveConfigToStorage<T>(userId: string, config: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      getStorageKey(userId),
      JSON.stringify(config, null, 2),
    );
  } catch {
    // ignore quota or parse errors
  }
}

/**
 * Carga la lista de landings del cliente desde localStorage.
 */
export function loadLandingsFromStorage(userId: string): Landing[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(getLandingsStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Landing[]) : [];
  } catch {
    return [];
  }
}

/**
 * Guarda la lista de landings del cliente en localStorage.
 */
export function saveLandingsToStorage(userId: string, landings: Landing[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      getLandingsStorageKey(userId),
      JSON.stringify(landings, null, 2),
    );
  } catch {
    // ignore
  }
}
