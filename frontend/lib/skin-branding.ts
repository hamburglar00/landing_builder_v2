// Verified official assets/palettes, captured from public skins on 2026-10-30.
// Local assets only at runtime; source evidence is in docs/validation.
import { MULTI_SKIN_CATALOG, type MultiSkinCode } from './multi-skin-catalog';
export type MultiSkinBrand = { logo:string; icon:string; background:string; primary:string; secondary:string; accent:string; accentText:string; surface:string; text:string; muted:string; glow:string };
const brands: Record<MultiSkinCode, MultiSkinBrand> = {
  "ganamos_plus": {
    "logo": "/ganamos-plus-logo-transparent.optimized.avif",
    "icon": "/ganamos-plus-app-192.png",
    "background": "#121212",
    "primary": "#8b00ff",
    "secondary": "#a855f7",
    "accent": "#f5c518",
    "accentText": "#171105",
    "surface": "#191a1e",
    "text": "#ffffff",
    "muted": "#98a7b5",
    "glow": "#9d20d966"
  },
  "jugamos": {
    "logo": "/skins/jugamos/logo.avif",
    "icon": "/skins/jugamos/icon-192.png",
    "background": "#101010",
    "primary": "#885fff",
    "secondary": "#f5c518",
    "accent": "#885fff",
    "accentText": "#101010",
    "surface": "#16161a",
    "text": "#ffffff",
    "muted": "#98a7b5",
    "glow": "#885fff55"
  },
  "casino_zeus": {
    "logo": "/skins/casino_zeus/logo.avif",
    "icon": "/skins/casino_zeus/icon-192.png",
    "background": "#101010",
    "primary": "#da4167",
    "secondary": "#e26c89",
    "accent": "#da4167",
    "accentText": "#101010",
    "surface": "#16161a",
    "text": "#ffffff",
    "muted": "#98a7b5",
    "glow": "#da416755"
  },
  "bet30": {
    "logo": "/skins/bet30/logo.avif",
    "icon": "/skins/bet30/icon-192.png",
    "background": "#101010",
    "primary": "#da4167",
    "secondary": "#e26c89",
    "accent": "#da4167",
    "accentText": "#101010",
    "surface": "#16161a",
    "text": "#ffffff",
    "muted": "#98a7b5",
    "glow": "#da416755"
  },
  "gana_en_casa": {
    "logo": "/skins/gana_en_casa/logo.avif",
    "icon": "/skins/gana_en_casa/icon-192.png",
    "background": "#101010",
    "primary": "#f2ce00",
    "secondary": "#bf8200",
    "accent": "#f2ce00",
    "accentText": "#101010",
    "surface": "#16161a",
    "text": "#ffffff",
    "muted": "#98a7b5",
    "glow": "#f2ce0055"
  },
  "celu_apuestas": {
    "logo": "/skins/celu_apuestas/logo.avif",
    "icon": "/skins/celu_apuestas/icon-192.png",
    "background": "#101010",
    "primary": "#da4167",
    "secondary": "#e26c89",
    "accent": "#da4167",
    "accentText": "#101010",
    "surface": "#16161a",
    "text": "#ffffff",
    "muted": "#98a7b5",
    "glow": "#da416755"
  },
  "casino_zeta": {
    "logo": "/skins/casino_zeta/logo.avif",
    "icon": "/skins/casino_zeta/icon-192.png",
    "background": "#101010",
    "primary": "#da4167",
    "secondary": "#e26c89",
    "accent": "#da4167",
    "accentText": "#101010",
    "surface": "#16161a",
    "text": "#ffffff",
    "muted": "#98a7b5",
    "glow": "#da416755"
  },
  "oro_puro": {
    "logo": "/skins/oro_puro/logo.avif",
    "icon": "/skins/oro_puro/icon-192.png",
    "background": "#0a0d11",
    "primary": "#ffd459",
    "secondary": "#fbba72",
    "accent": "#ffd459",
    "accentText": "#101010",
    "surface": "#191a1e",
    "text": "#ffffff",
    "muted": "#98a7b5",
    "glow": "#ffd45955"
  },
  "fortu_bet": {
    "logo": "/skins/fortu_bet/logo.avif",
    "icon": "/skins/fortu_bet/icon-192.png",
    "background": "#101010",
    "primary": "#673eb7",
    "secondary": "#13a0ff",
    "accent": "#13a0ff",
    "accentText": "#101010",
    "surface": "#16161a",
    "text": "#ffffff",
    "muted": "#98a7b5",
    "glow": "#673eb755"
  },
  "gran_poseidon": {
    "logo": "/skins/gran_poseidon/logo.avif",
    "icon": "/skins/gran_poseidon/icon-192.png",
    "background": "#000032",
    "primary": "#00aef6",
    "secondary": "#006fce",
    "accent": "#00aef6",
    "accentText": "#101010",
    "surface": "#16161a",
    "text": "#ffffff",
    "muted": "#98a7b5",
    "glow": "#00aef655"
  },
  "kona_bet": {
    "logo": "/skins/kona_bet/logo.avif",
    "icon": "/skins/kona_bet/icon-192.png",
    "background": "#101010",
    "primary": "#da4167",
    "secondary": "#e26c89",
    "accent": "#da4167",
    "accentText": "#101010",
    "surface": "#16161a",
    "text": "#ffffff",
    "muted": "#98a7b5",
    "glow": "#da416755"
  },
  "mega_faraon": {
    "logo": "/skins/mega_faraon/logo.avif",
    "icon": "/skins/mega_faraon/icon-192.png",
    "background": "#101010",
    "primary": "#f2ce00",
    "secondary": "#ff8a00",
    "accent": "#f2ce00",
    "accentText": "#101010",
    "surface": "#16161a",
    "text": "#ffffff",
    "muted": "#98a7b5",
    "glow": "#f2ce0055"
  },
  "camel_bet": {
    "logo": "/skins/camel_bet/logo.avif",
    "icon": "/skins/camel_bet/icon-192.png",
    "background": "#101010",
    "primary": "#ffb000",
    "secondary": "#ff9f00",
    "accent": "#ffb000",
    "accentText": "#101010",
    "surface": "#16161a",
    "text": "#ffffff",
    "muted": "#98a7b5",
    "glow": "#ffb00055"
  },
  "rhino_play": {
    "logo": "/skins/rhino_play/logo.avif",
    "icon": "/skins/rhino_play/icon-192.png",
    "background": "#101010",
    "primary": "#e17e01",
    "secondary": "#b53313",
    "accent": "#e17e01",
    "accentText": "#101010",
    "surface": "#16161a",
    "text": "#ffffff",
    "muted": "#98a7b5",
    "glow": "#e17e0155"
  }
};
export function getMultiSkinBrand(code: MultiSkinCode): MultiSkinBrand & { name:string } {
  return { name:MULTI_SKIN_CATALOG[code].name, ...brands[code] };
}
