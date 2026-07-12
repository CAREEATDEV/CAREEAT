"""Generate placeholder icon (1024x1024) and splash (1284x2778) for HYDRA.

Deliberately minimal: black background, segmented drop-ish glyph, brand
green. Meant to unblock the first `expo run:ios` — replace with the real
1024 icon (goutte segmentee) when it's ready.
"""

from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
FONTS = ASSETS / "fonts"

BG = (0, 0, 0)
GREEN = (62, 224, 122)
GREEN_DEEP = (46, 204, 106)
DIM = (28, 32, 38)
TEXT = (237, 239, 242)


def rounded_rect(draw, xy, radius, fill):
    x0, y0, x1, y1 = xy
    draw.rounded_rectangle(xy, radius=radius, fill=fill)


def draw_drop(img, size, cx, cy, fill=GREEN):
    """A stylised droplet: triangle tip + circle base."""
    draw = ImageDraw.Draw(img)
    r = size // 2
    # base circle
    draw.ellipse((cx - r, cy - r + size // 6, cx + r, cy + r + size // 6), fill=fill)
    # tip triangle
    tip = [
        (cx, cy - r - size // 4),
        (cx - int(r * 0.9), cy + size // 8),
        (cx + int(r * 0.9), cy + size // 8),
    ]
    draw.polygon(tip, fill=fill)


def segmented_bar(img, xy, segments, filled, color=GREEN, empty=DIM, gap=6, radius=6):
    x0, y0, x1, y1 = xy
    total = x1 - x0
    seg_w = (total - gap * (segments - 1)) / segments
    for i in range(segments):
        sx = x0 + i * (seg_w + gap)
        rect = (sx, y0, sx + seg_w, y1)
        rounded_rect(ImageDraw.Draw(img), rect, radius=radius,
                     fill=color if i < filled else empty)


def make_icon(path: Path):
    S = 1024
    img = Image.new("RGB", (S, S), BG)
    # segmented droplet: draw a droplet then carve horizontal gaps to make it segmented
    layer = Image.new("RGB", (S, S), BG)
    draw_drop(layer, size=520, cx=S // 2, cy=S // 2 - 40, fill=GREEN)
    # apply horizontal segmentation by pasting black stripes over the droplet
    d = ImageDraw.Draw(layer)
    stripes = 7
    band_h = 24
    top = S // 2 - 340
    step = 90
    for i in range(stripes):
        y = top + i * step
        d.rectangle((0, y, S, y + band_h), fill=BG)
    img.paste(layer, (0, 0))
    img.save(path, "PNG")


def make_splash(path: Path):
    W, H = 1284, 2778
    img = Image.new("RGB", (W, H), BG)
    # bar mid-page
    bar_w = int(W * 0.7)
    bar_h = 44
    bx0 = (W - bar_w) // 2
    by0 = H // 2 + 60
    segmented_bar(img, (bx0, by0, bx0 + bar_w, by0 + bar_h),
                  segments=20, filled=14, gap=8, radius=6)
    # wordmark
    try:
        font = ImageFont.truetype(str(FONTS / "ChakraPetch-Bold.ttf"), 140)
    except Exception:
        font = ImageFont.load_default()
    text = "HYDRA"
    d = ImageDraw.Draw(img)
    bbox = d.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    d.text(((W - tw) // 2 - bbox[0], H // 2 - 240 - bbox[1]), text,
           fill=TEXT, font=font)
    img.save(path, "PNG")


if __name__ == "__main__":
    make_icon(ASSETS / "icon.png")
    make_splash(ASSETS / "splash.png")
    print(f"wrote {ASSETS/'icon.png'} and {ASSETS/'splash.png'}")
