"""Kit de marca Landing Builder · isotipo Cohete. Uso: python3 build_lb.py <salida>"""
import json, math, os, subprocess, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

OUT = sys.argv[1] if len(sys.argv) > 1 else "dist"
WORD_FONT = "/usr/share/fonts/opentype/inter/InterDisplay-Bold.otf"
TAG_FONT = "/usr/share/fonts/opentype/inter/InterDisplay-Medium.otf"

def f(p): return f"{p[0]:.2f} {p[1]:.2f}"
def poly(pts): return "M" + "L".join(f(p) for p in pts) + "Z"
def rr(x, y, w, h, r):
    return (f"M{x+r:.2f} {y:.2f}H{x+w-r:.2f}A{r} {r} 0 0 1 {x+w:.2f} {y+r:.2f}V{y+h-r:.2f}"
            f"A{r} {r} 0 0 1 {x+w-r:.2f} {y+h:.2f}H{x+r:.2f}A{r} {r} 0 0 1 {x:.2f} {y+h-r:.2f}"
            f"V{y+r:.2f}A{r} {r} 0 0 1 {x+r:.2f} {y:.2f}Z")
def circ(cx, cy, r): return f"M{cx-r:.2f} {cy:.2f}a{r} {r} 0 1 0 {2*r} 0a{r} {r} 0 1 0 {-2*r} 0Z"

# ------------------------------------------------------------ cohete (grilla 64)
BODY = "M32 5C40.5 11 43 23 41.5 39H22.5C21 23 23.5 11 32 5Z"
FLAME = "M27 44Q32 61 37 44Z"
FIN_L = poly([(23, 28), (14, 41), (14, 45), (23, 40)])
FIN_R = poly([(41, 28), (50, 41), (50, 45), (41, 40)])
NOZZLE = rr(25.5, 38, 13, 5, 2)
WINDOW = circ(32, 22, 4.6)
POSE = "translate(32 32) scale(1.16) translate(-31 -32) rotate(40 32 32)"

def rocket(c, uid, tf=""):
    """c: body, fin, flame. La ventana siempre va calada (transparente)."""
    j = 'stroke-linejoin="round"'
    mask = (f'<defs><mask id="w{uid}" maskUnits="userSpaceOnUse" x="-8" y="-8" width="80" height="80">'
            f'<rect x="-8" y="-8" width="80" height="80" fill="#fff"/><path d="{WINDOW}" fill="#000"/></mask></defs>')
    g = (f'<path d="{FLAME}" fill="{c["flame"]}"/>'
         f'<path d="{FIN_L}" fill="{c["fin"]}" stroke="{c["fin"]}" stroke-width="1.5" {j}/>'
         f'<path d="{FIN_R}" fill="{c["fin"]}" stroke="{c["fin"]}" stroke-width="1.5" {j}/>'
         f'<path d="{NOZZLE}" fill="{c["fin"]}"/>'
         f'<path d="{BODY}" fill="{c["body"]}" mask="url(#w{uid})"/>')
    return mask + f'<g{tf}><g transform="{POSE}">{g}</g></g>'

# ------------------------------------------------------------ texto a trazos
class Face:
    def __init__(self, path):
        fnt = TTFont(path)
        self.gs, self.cmap = fnt.getGlyphSet(), fnt.getBestCmap()
        self.upm, self.cap, self.hmtx = fnt["head"].unitsPerEm, fnt["OS/2"].sCapHeight, fnt["hmtx"]
    def path(self, txt, size, x0, base, track=0.0):
        s, x, d = size / self.upm, x0, []
        for ch in txt:
            g = self.cmap[ord(ch)]
            pen = SVGPathPen(self.gs)
            self.gs[g].draw(TransformPen(pen, (s, 0, 0, -s, x, base)))
            d.append(pen.getCommands())
            x += self.hmtx[g][0] * s + track * size
        return " ".join(d), x - track * size
    def width(self, txt, size, track=0.0): return self.path(txt, size, 0, 0, track)[1]

WORD, TAG = Face(WORD_FONT), Face(TAG_FONT)
TRACK, CAP_H, GAP, MARK = -0.02, 15.5, 3, 64
SIZE = CAP_H * WORD.upm / WORD.cap
W_WORD = WORD.width("LandingBuilder", SIZE, TRACK)
H_W = MARK + GAP + W_WORD

def word(t1, t2, x, base):
    d1, xe = WORD.path("Landing", SIZE, x, base, TRACK)
    d2, _ = WORD.path("Builder", SIZE, xe + TRACK * SIZE, base, TRACK)
    return f'<path fill="{t1}" d="{d1}"/><path fill="{t2}" d="{d2}"/>'

def svg(w, h, body, title="Landing Builder"):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w:g}" height="{h:g}" viewBox="0 0 {w:g} {h:g}" '
            f'role="img" aria-label="{title}"><title>{title}</title>{body}</svg>\n')

def lock_h(c, t1, t2, uid):
    return svg(round(H_W, 2), MARK, rocket(c, uid) + word(t1, t2, MARK + GAP, 32 + CAP_H / 2 + 1))

V_GAP = 10
V_H = MARK + V_GAP + CAP_H + 4
V_W = max(W_WORD, MARK)
def lock_v(c, t1, t2, uid):
    mx = (V_W - MARK) / 2 + 1.65
    return svg(round(V_W, 2), round(V_H, 2),
               rocket(c, uid, f' transform="translate({mx:.2f} 0)"') + word(t1, t2, (V_W - W_WORD) / 2, MARK + V_GAP + CAP_H))

# ------------------------------------------------------------ colores
LIME, LIME_TEXT = "#8EE04E", "#8EE04E"
VARIANTS = {
    "dark":  ({"body": LIME, "fin": "#5FA833", "flame": "#D3F4B8"}, "#FFFFFF", LIME_TEXT),
    "light": ({"body": "#3E9A12", "fin": "#2A6A0A", "flame": "#8EE04E"}, "#0B1410", "#3E9A12"),
    "white": ({"body": "#FFFFFF", "fin": "#FFFFFF", "flame": "#FFFFFF"}, "#FFFFFF", "#FFFFFF"),
    "black": ({"body": "#0A0A0A", "fin": "#0A0A0A", "flame": "#0A0A0A"}, "#0A0A0A", "#0A0A0A"),
}
ICON_BG = LIME
ICON_FG = {"body": "#0B1410", "fin": "#2F5E17", "flame": "#0B1410"}
BG, SURFACE, MUTED = "#0A0F12", "#0E1418", "#A3ADA7"

def write(p, s):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, "w").write(s)
def png(src, dst, w, h=None):
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    subprocess.run(["rsvg-convert", "-w", str(round(w)), "-h", str(round(h or w)), "-o", dst, src], check=True)

def icon_svg(size=1024, rx_ratio=0.225, scale=0.66):
    s = size * scale / 64
    off = (size - 64 * s) / 2
    return svg(size, size, f'<rect width="{size}" height="{size}" rx="{size*rx_ratio:g}" fill="{ICON_BG}"/>'
               + rocket(ICON_FG, "i", f' transform="translate({off:.2f} {off:.2f}) scale({s:.4f})"'))

def favicon_svg():
    fg = {"body": "#0B1410", "fin": "#0B1410", "flame": "#0B1410"}
    return svg(64, 64, f'<rect width="64" height="64" rx="14" fill="{ICON_BG}"/>'
               + rocket(fg, "f", ' transform="translate(1 1) scale(0.97)"'))

def og():
    W, H = 1200, 630
    c, t1, t2 = VARIANTS["dark"]
    s = 4.0
    x, y = (W - H_W * s) / 2, (H - MARK * s) / 2 - 40
    tag = "Landings que convierten, listas para tus anuncios"
    ts = 28
    tp, _ = TAG.path(tag, ts, (W - TAG.width(tag, ts)) / 2, y + MARK * s + 82)
    body = (f'<rect width="{W}" height="{H}" fill="{BG}"/>'
            f'<rect x="40" y="40" width="{W-80}" height="{H-80}" rx="28" fill="{SURFACE}"/>'
            f'<g transform="translate({x:.2f} {y:.2f}) scale({s})">{rocket(c, "o")}{word(t1, t2, MARK + GAP, 32 + CAP_H / 2 + 1)}</g>'
            f'<path fill="{MUTED}" d="{tp}"/>')
    return svg(W, H, body)

def build():
    d = OUT
    for v, (c, t1, t2) in VARIANTS.items():
        write(f"{d}/logo/landingbuilder-logo-{v}.svg", lock_h(c, t1, t2, f"h{v}"))
        write(f"{d}/logo/landingbuilder-logo-vertical-{v}.svg", lock_v(c, t1, t2, f"v{v}"))
        write(f"{d}/logo/landingbuilder-isotipo-{v}.svg", svg(64, 64, rocket(c, f"m{v}")))
        png(f"{d}/logo/landingbuilder-logo-{v}.svg", f"{d}/logo/landingbuilder-logo-{v}.png", H_W * 8, MARK * 8)
        png(f"{d}/logo/landingbuilder-logo-vertical-{v}.svg", f"{d}/logo/landingbuilder-logo-vertical-{v}.png", V_W * 8, V_H * 8)
        png(f"{d}/logo/landingbuilder-isotipo-{v}.svg", f"{d}/logo/landingbuilder-isotipo-{v}.png", 512)
    write(f"{d}/app/app-icon.svg", icon_svg())
    write(f"{d}/app/app-icon-square.svg", icon_svg(rx_ratio=0))
    write(f"{d}/app/icon-maskable.svg", icon_svg(rx_ratio=0, scale=0.52))
    png(f"{d}/app/app-icon.svg", f"{d}/app/app-icon-1024.png", 1024)
    png(f"{d}/app/app-icon-square.svg", f"{d}/web/apple-touch-icon.png", 180)
    png(f"{d}/app/app-icon.svg", f"{d}/web/icon-192.png", 192)
    png(f"{d}/app/app-icon.svg", f"{d}/web/icon-512.png", 512)
    png(f"{d}/app/icon-maskable.svg", f"{d}/web/icon-maskable-512.png", 512)
    write(f"{d}/web/favicon.svg", favicon_svg())
    for s in (16, 32, 48):
        png(f"{d}/web/favicon.svg", f"{d}/web/favicon-{s}.png", s)
    subprocess.run(["convert", f"{d}/web/favicon-16.png", f"{d}/web/favicon-32.png",
                    f"{d}/web/favicon-48.png", f"{d}/web/favicon.ico"], check=True)
    write(f"{d}/social/og-image.svg", og())
    png(f"{d}/social/og-image.svg", f"{d}/social/og-image.png", 1200, 630)
    write(f"{d}/web/site.webmanifest", json.dumps({
        "name": "Landing Builder", "short_name": "LandingBuilder",
        "icons": [
            {"src": "/icon-192.png", "sizes": "192x192", "type": "image/png"},
            {"src": "/icon-512.png", "sizes": "512x512", "type": "image/png"},
            {"src": "/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}],
        "theme_color": BG, "background_color": BG, "display": "standalone"}, indent=2) + "\n")

if __name__ == "__main__":
    build()
    print("ok", round(H_W, 1))
