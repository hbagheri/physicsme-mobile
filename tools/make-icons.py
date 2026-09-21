#!/usr/bin/env python3
"""Draw the PWA icon set with Pillow.

No ImageMagick / rsvg / inkscape on this machine, so the atom is drawn from
primitives rather than rasterised from SVG. Everything is computed from the
canvas size, so adding a size is one line at the bottom.

The palette is lifted from tokens.css by hand — if the board colour changes
there, change BOARD/GLOW here too. Icons are not CSS and cannot read tokens.
"""

import math
import os
from PIL import Image, ImageDraw

BOARD = (11, 16, 38)        # --color-surface-board  #0B1026
TOP = (24, 32, 82)          # --color-board-top      #182052
GLOW = (139, 132, 255)      # --color-primary-glow   #8B84FF
LIGHT = (154, 147, 255)     # --color-primary-light  #9A93FF
NUCLEUS = (232, 236, 247)   # --color-text-on-board  #E8ECF7

SS = 4                      # supersample factor — Pillow has no antialiasing
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'icons')
RES = os.path.join(HERE, '..', 'android', 'app', 'src', 'main', 'res')


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def draw_atom(size, inset, background=True):
    """Atom on a vertical board gradient. `inset` is the fraction of the
    canvas kept clear on every side — 0 for a normal icon, 0.2 for maskable,
    where Android may crop to a circle inscribed in the middle 80%.

    `background=False` returns the mark alone on transparency, which is what
    an Android adaptive foreground has to be: the system paints the colour
    from values/ic_launcher_background.xml underneath it."""
    s = size * SS
    img = Image.new('RGBA', (s, s), BOARD + (255,) if background else (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # background: a soft top-lit gradient, same read as the board surface
    if background:
        for y in range(s):
            d.line([(0, y), (s, y)], fill=lerp(TOP, BOARD, (y / s) ** 0.75) + (255,))

    c = s / 2
    r = (s / 2) * (1 - 2 * inset) * 0.92      # orbit semi-major axis
    ry = r * 0.42                              # semi-minor
    w = max(2, int(s * 0.026))

    # three ellipses at 0 / 60 / -60 degrees, drawn on their own rotated
    # layers because Pillow cannot rotate an ellipse in place
    for angle in (0, 60, -60):
        layer = Image.new('RGBA', (s, s), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        ld.ellipse([c - r, c - ry, c + r, c + ry], outline=GLOW + (255,), width=w)
        if angle:
            layer = layer.rotate(angle, resample=Image.BICUBIC, center=(c, c))
        img.paste(layer, (0, 0), layer)

    # one electron per orbit, parked where the curve reads clearly
    er = max(3, int(s * 0.036))
    for angle, t in ((0, 165), (60, 40), (-60, 300)):
        a = math.radians(t)
        x, y = r * math.cos(a), ry * math.sin(a)
        ra = math.radians(-angle)
        ex = c + x * math.cos(ra) - y * math.sin(ra)
        ey = c + x * math.sin(ra) + y * math.cos(ra)
        d.ellipse([ex - er, ey - er, ex + er, ey + er], fill=LIGHT)

    nr = s * 0.085
    d.ellipse([c - nr, c - nr, c + nr, c + nr], fill=NUCLEUS)

    return img.resize((size, size), Image.LANCZOS)


def web_icons():
    os.makedirs(OUT, exist_ok=True)
    for name, size, inset in [
        ('icon-180.png', 180, 0.06),
        ('icon-192.png', 192, 0.06),
        ('icon-512.png', 512, 0.06),
        # 20% safe margin: Android crops maskable icons to an arbitrary shape
        ('icon-maskable-512.png', 512, 0.20),
    ]:
        p = os.path.join(OUT, name)
        draw_atom(size, inset).convert('RGB').save(p, 'PNG', optimize=True)
        print(name, os.path.getsize(p), 'bytes')


def android_icons():
    """Overwrite Capacitor's stock launcher icons. Skipped silently when the
    android platform has not been added."""
    if not os.path.isdir(RES):
        print('android/ not present — skipping launcher icons')
        return

    legacy = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
    # Adaptive foregrounds are 108dp with only the middle 72dp guaranteed
    # visible, so the mark is drawn at a third of the canvas inset.
    fore = {'mdpi': 108, 'hdpi': 162, 'xhdpi': 216, 'xxhdpi': 324, 'xxxhdpi': 432}

    for density, size in legacy.items():
        d = os.path.join(RES, 'mipmap-' + density)
        os.makedirs(d, exist_ok=True)
        square = draw_atom(size, 0.06).convert('RGB')
        square.save(os.path.join(d, 'ic_launcher.png'), 'PNG', optimize=True)

        # round: the same art clipped to a circle
        r = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        mask = Image.new('L', (size * SS, size * SS), 0)
        ImageDraw.Draw(mask).ellipse([0, 0, size * SS - 1, size * SS - 1], fill=255)
        r.paste(square, (0, 0), mask.resize((size, size), Image.LANCZOS))
        r.save(os.path.join(d, 'ic_launcher_round.png'), 'PNG', optimize=True)

        draw_atom(fore[density], 0.20, background=False).save(
            os.path.join(d, 'ic_launcher_foreground.png'), 'PNG', optimize=True)

    bg = os.path.join(RES, 'values', 'ic_launcher_background.xml')
    with open(bg, 'w', encoding='utf-8') as f:
        f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
                '    <color name="ic_launcher_background">#0B1026</color>\n</resources>\n')
    print('android launcher icons written to', os.path.relpath(RES))


if __name__ == '__main__':
    web_icons()
    android_icons()
