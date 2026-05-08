"""
Generates icon16.png, icon48.png, icon128.png for the Pictify Chrome extension.
Run once: python3 create-icons.py
"""
from PIL import Image, ImageDraw
import os

os.makedirs('icons', exist_ok=True)

PURPLE = (134, 59, 255, 255)
WHITE  = (255, 255, 255, 255)

def draw_printer(draw, size):
    """Draw a minimal printer icon centred in the canvas."""
    m  = size * 0.18   # margin
    w  = size - 2 * m  # usable width

    # Paper tray (bottom sheet coming out)
    tray_h = w * 0.22
    tray_y = size * 0.62
    draw.rounded_rectangle(
        [m + w * 0.12, tray_y, m + w * 0.88, tray_y + tray_h],
        radius=max(1, int(size * 0.04)),
        fill=WHITE,
    )

    # Printer body (main block)
    body_h = w * 0.32
    body_y = size * 0.32
    draw.rounded_rectangle(
        [m, body_y, m + w, body_y + body_h],
        radius=max(1, int(size * 0.07)),
        fill=WHITE,
    )

    # Paper slot cut-out in printer body (purple, same colour as background)
    slot_h = body_h * 0.38
    slot_y = body_y + (body_h - slot_h) / 2
    draw.rectangle(
        [m + w * 0.22, slot_y, m + w * 0.78, slot_y + slot_h],
        fill=PURPLE,
    )

    # Ink dot (status light)
    dot_r = max(1, int(size * 0.042))
    dot_cx = int(m + w * 0.78)
    dot_cy = int(body_y + body_h * 0.3)
    draw.ellipse(
        [dot_cx - dot_r, dot_cy - dot_r, dot_cx + dot_r, dot_cy + dot_r],
        fill=(100, 220, 120, 255),
    )

    # Paper above printer (input)
    top_h = w * 0.18
    top_y = body_y - top_h + size * 0.01
    draw.rounded_rectangle(
        [m + w * 0.24, top_y, m + w * 0.76, body_y + size * 0.01],
        radius=max(1, int(size * 0.04)),
        fill=WHITE,
    )


def make_icon(size):
    img  = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Purple rounded-square background
    radius = int(size * 0.22)
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=PURPLE)

    if size >= 32:
        draw_printer(draw, size)
    else:
        # 16 px: just a bold white "P"
        # Draw a tiny simplified printer using rectangles
        s = size
        draw.rectangle([s//4, s//4, s*3//4, s*5//8], fill=WHITE)
        draw.rectangle([s//3, s//2, s*2//3, s*3//4], fill=WHITE)
        draw.rectangle([s*3//8, s//3, s*5//8, s//2], fill=PURPLE)

    return img


for size in [16, 48, 128]:
    icon = make_icon(size)
    path = f'icons/icon{size}.png'
    icon.save(path)
    print(f'Created {path}')

print('Done.')
