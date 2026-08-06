"""
Ticket 17 — measure the browse row's backdrop as a GROUND for text, in whichever
theme the screenshot was taken in.

Method: for each sampled text line, walk x across the text column. At each x take
a vertical window covering the glyph band and separate ground from ink by
percentile: in light theme the ground is the LIGHT end, in dark theme the DARK
end. Then compute the WCAG contrast ratio of the theme's textMuted against that
local ground.

This is deliberately a measurement of the GROUND, not of the rendered glyphs —
antialiased glyph pixels would drag any naive average toward the middle.
"""

import sys
from PIL import Image

# tokens.ts
LIGHT_TEXT_MUTED = (0x6B, 0x72, 0x80)
DARK_TEXT_MUTED = (0xD8, 0xDE, 0xE9)
LIGHT_BG = (0xEC, 0xEF, 0xF4)
DARK_BG = (0x1C, 0x1C, 0x1C)


def srgb_lin(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4


def luminance(rgb):
    r, g, b = (srgb_lin(v) for v in rgb[:3])
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a, b):
    la, lb = luminance(a), luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def ground_profile(img, y_center, x0, x1, band=14, light=True, step=8):
    """Local ground colour across a text line."""
    px = img.load()
    out = []
    for x in range(x0, x1, step):
        col = [px[x, y][:3] for y in range(y_center - band, y_center + band)]
        col.sort(key=luminance)
        # ground = the extreme AWAY from the ink. Glyph strokes are thick enough
        # that anything short of the true extreme still lands on ink.
        pick = col[-1] if light else col[0]
        out.append((x, pick))
    return out


def ink_extent(img, y_center, x0, x1, ink, band=14, tol=42):
    """Where the glyphs actually are, so we never measure empty row."""
    px = img.load()
    hits = []
    for x in range(x0, x1):
        for y in range(y_center - band, y_center + band):
            p = px[x, y][:3]
            if sum(abs(a - b) for a, b in zip(p, ink)) < tol:
                hits.append(x)
                break
    if not hits:
        return None
    return min(hits), max(hits)


def report(path, rows, light, x0, x1):
    img = Image.open(path).convert("RGB")
    ink = LIGHT_TEXT_MUTED if light else DARK_TEXT_MUTED
    bg = LIGHT_BG if light else DARK_BG
    print(f"\n=== {path}  ({'LIGHT' if light else 'DARK'}) ===")
    print(f"ink {ink}  flat-bg contrast would be {contrast(ink, bg):.2f}:1")
    print(f"{'series':<14} {'ink x-range':>13} {'min CR':>7} {'at x':>6} {'worst ground':>18}")
    for name, y in rows:
        ext = ink_extent(img, y, x0, x1, ink)
        if ext is None:
            print(f"{name:<14} {'(no ink found)':>13}")
            continue
        a, b = ext
        prof = ground_profile(img, y, a, b, light=light)
        crs = [(contrast(ink, g), x, g) for x, g in prof]
        worst = min(crs)
        flag = "  <-- FAIL (<4.5)" if worst[0] < 4.5 else ""
        print(
            f"{name:<14} {f'{a}-{b}':>13} {worst[0]:>7.2f} {worst[1]:>6} "
            f"{str(worst[2]):>18}{flag}"
        )


if __name__ == "__main__":
    path = sys.argv[1]
    light = sys.argv[2] == "light"
    # y centres of the "Next/Continue •" line, original 1440x3120 pixels
    rows = [
        ("Bobiverse", 1000),
        ("City Watch", 1491),
        ("Death", 1983),
        ("Discworld", 2474),
    ]
    report(path, rows, light, x0=445, x1=1400)
