# derive the token colours from CIE LCH (D65) -> sRGB hex. Dev scaffolding; its output is pasted into tokens.css comments.
import math


def lch_to_hex(L, C, H):
    a, b = C * math.cos(math.radians(H)), C * math.sin(math.radians(H))
    fy = (L + 16) / 116
    fx, fz = fy + a / 500, fy - b / 200
    e, k = 216 / 24389, 24389 / 27

    def finv(t):
        return t ** 3 if t ** 3 > e else (116 * t - 16) / k
    X, Y, Z = 0.95047 * finv(fx), (L / k if L <= k * e else fy ** 3), 1.08883 * finv(fz)
    r = 3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z
    g = -0.9692660 * X + 1.8760108 * Y + 0.0415560 * Z
    bb = 0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z

    def gam(c):
        c = max(0.0, min(1.0, c))
        return 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055
    return "#" + "".join(f"{round(gam(c) * 255):02x}" for c in (r, g, bb))


NEUTRAL_H, NEUTRAL_C = 75, 3.0   # warm stone grey
steps = [(0, 99), (50, 97), (100, 94), (150, 90.5), (200, 86), (300, 76), (400, 64), (500, 52), (600, 42), (700, 33), (800, 24), (850, 18), (900, 13), (950, 8)]
print("neutral (LCH, h=%d c=%.1f):" % (NEUTRAL_H, NEUTRAL_C))
for n, L in steps:
    c = NEUTRAL_C if L < 97 else NEUTRAL_C * 0.6
    print(f"  --n-{n}: {lch_to_hex(L, c, NEUTRAL_H)};  /* lch({L}% {c:.1f} {NEUTRAL_H}) */")
named = {
    "brand-primary (deep sea blue)": (36, 32, 245),
    "brand-primary-ink-dark (light tint for dark theme text)": (74, 26, 245),
    "accent (ochre)": (74, 72, 78),
    "accent-ink (text on light)": (44, 48, 68),
    "available": (46, 36, 150), "available-ink-dark": (78, 34, 150), "available-bg": (95, 8, 150), "available-bg-dark": (22, 14, 150),
    "reserved": (62, 58, 72), "reserved-ink": (42, 40, 68), "reserved-ink-dark": (80, 50, 78), "reserved-bg": (95, 10, 80), "reserved-bg-dark": (22, 14, 70),
    "sold": (44, 46, 30), "sold-ink-dark": (74, 34, 30), "sold-bg": (95, 6, 30), "sold-bg-dark": (22, 14, 30),
    "danger": (44, 58, 32), "danger-ink-dark": (74, 38, 32),
    "whatsapp": (42, 38, 152),
}
for k, (L, C, H) in named.items():
    print(f"  {k}: {lch_to_hex(L, C, H)}  /* lch({L}% {C} {H}) */")
