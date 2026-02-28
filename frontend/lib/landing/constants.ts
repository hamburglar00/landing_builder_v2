import type { ColorOption } from "./types";

/**
 * Mapa de nombre de color → valor hex para aplicar en estilos.
 * Lista cerrada; no se usa color picker libre.
 */
export const COLOR_MAP: Record<ColorOption, string> = {
  white: "#FFFFFF",
  black: "#000000",
  gold: "#FFD700",
  yellow: "#FFF000",
  red: "#FF3B30",
  green: "#1FAF38",
  whatsapp_green: "#25D366",
  blue: "#007BFF",
  cyan: "#00D8FF",
  orange: "#FF8C00",
  pink: "#FF4FC3",
  purple: "#9B59B6",
  gray_light: "#D9D9D9",
  gray_dark: "#4A4A4A",
};

/**
 * Lista ordenada de colores para mostrar en selectores.
 */
export const COLOR_OPTIONS: ColorOption[] = [
  "white",
  "black",
  "gold",
  "yellow",
  "red",
  "green",
  "whatsapp_green",
  "blue",
  "cyan",
  "orange",
  "pink",
  "purple",
  "gray_light",
  "gray_dark",
];

/** Formato de imagen obligatorio para subidas (preview local; sin storage real aún). */
export const ACCEPTED_IMAGE_FORMAT = ".avif";
