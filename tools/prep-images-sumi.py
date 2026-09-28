# SUMI: turns the generated PNGs in assets/sumi/ into the webp files the page uses, then deletes the PNGs.
# Paper white is pushed to exactly #FFFFFF, masks get real alpha. Run: python tools/prep-images-sumi.py
import os
import sys
from PIL import Image, ImageOps

sys.stdout.reconfigure(encoding='utf-8')
DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'sumi')
P = lambda n: os.path.join(DIR, n)

# Luminance at or above this becomes pure white (paper), everything darker is stretched below it.
WHITE_POINT = {'paper': 246, 'mountains': 244, 'plum': 244}
# Seal crop box on the 1254px source (x0, y0, x1, y1) with a small margin around the stamp.
SEAL_BOX = (500, 470, 752, 712)
SEAL_RGB = (178, 34, 30)


def whiten(img, white):
    """Levels: map [0, white] to [0, 255] so the paper reads as #FFFFFF."""
    lut = [min(255, round(v * 255 / white)) for v in range(256)]
    return img.point(lut * (len(img.getbands())))


def save(img, name, **kw):
    img.save(P(name), 'WEBP', method=6, **kw)
    print(name, img.size, os.path.getsize(P(name)) // 1024, 'KB')


def main():
    paper = whiten(ImageOps.grayscale(Image.open(P('paper.png'))), WHITE_POINT['paper'])
    save(paper.resize((1024, 683), Image.LANCZOS), 'paper.webp', quality=70)

    mountains = whiten(ImageOps.grayscale(Image.open(P('mountains.png'))), WHITE_POINT['mountains'])
    save(mountains, 'mountains.webp', quality=78)

    plum = whiten(Image.open(P('plum.png')).convert('RGB'), WHITE_POINT['plum'])
    save(plum, 'plum.webp', quality=78)

    # Brush: alpha = ink darkness, colour pure black. Used as a CSS mask and a stroke overlay.
    brush = ImageOps.grayscale(Image.open(P('brush.png')))
    alpha = ImageOps.invert(whiten(brush, 240)).point(lambda v: min(255, round(v * 1.15)))
    out = Image.new('RGBA', brush.size, (0, 0, 0, 0))
    out.putalpha(alpha)
    save(out.resize((1200, 600), Image.LANCZOS), 'brush-mask.webp', quality=80)

    # Seal: alpha from how far a pixel is from white in the green channel, colour flattened to cinnabar.
    seal = Image.open(P('seal.png')).convert('RGB').crop(SEAL_BOX)
    g = seal.split()[1]
    salpha = g.point(lambda v: max(0, min(255, round((250 - v) * 1.35))))
    stamp = Image.new('RGBA', seal.size, SEAL_RGB + (0,))
    stamp.putalpha(salpha)
    save(stamp.resize((480, 461), Image.LANCZOS), 'seal.webp', quality=88)

    for n in ['paper', 'brush', 'seal', 'mountains', 'plum']:
        os.remove(P(n + '.png'))


main()
