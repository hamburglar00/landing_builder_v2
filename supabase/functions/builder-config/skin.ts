import { isMultiSkinCode, type MultiSkinCode } from "../_shared/multi-skin-catalog.ts";

/** Missing legacy skins mean Ganamos+; an explicit invalid skin must never choose another casino. */
export function publicSkinCode(raw: unknown, published?: unknown): MultiSkinCode {
  const value = raw === undefined ? published : raw;
  if (value === undefined) return "ganamos_plus";
  if (isMultiSkinCode(value)) return value;
  throw new Error("Invalid published Multi Skin code");
}
