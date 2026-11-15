"""Génère des visuels de démonstration (silhouettes de voitures) pour le seed."""
from PIL import Image, ImageDraw, ImageFilter
import os, sys

OUT = os.path.join(os.path.dirname(__file__), 'seed-assets')
W, H = 1200, 800
COLORS = {
    'white': (240, 240, 244), 'black': (35, 35, 42), 'silver': (178, 182, 190), 'red': (196, 32, 44),
    'blue': (30, 78, 170), 'grey': (96, 100, 110), 'beige': (214, 196, 160), 'green': (40, 110, 80),
    'purple': (110, 30, 200), 'orange': (230, 120, 30),
}
BGS = [((247, 242, 253), (225, 205, 250)), ((240, 244, 250), (205, 215, 235)), ((250, 244, 236), (232, 214, 190))]
SHAPES = ['sedan', 'suv', 'hatch']

def grad(bg):
    im = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(im)
    for y in range(H):
        t = y / H
        d.line([(0, y), (W, y)], fill=tuple(int(bg[0][i] * (1 - t) + bg[1][i] * t) for i in range(3)))
    return im

def shade(c, f):
    return tuple(max(0, min(255, int(v * f))) for v in c)

def car(im, color, shape):
    d = ImageDraw.Draw(im, 'RGBA')
    # ombre au sol
    sh = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse([170, 600, 1030, 680], fill=(40, 20, 70, 110))
    im.paste(Image.alpha_composite(im.convert('RGBA'), sh.filter(ImageFilter.GaussianBlur(18))).convert('RGB'))
    d = ImageDraw.Draw(im, 'RGBA')
    top = {'sedan': 330, 'suv': 270, 'hatch': 300}[shape]
    body_top = {'sedan': 440, 'suv': 410, 'hatch': 430}[shape]
    # caisse
    d.rounded_rectangle([170, body_top, 1030, 600], radius=60, fill=color)
    # pavillon
    if shape == 'sedan':
        roof = [(330, body_top + 5), (450, top), (760, top), (900, body_top + 5)]
    elif shape == 'suv':
        roof = [(300, body_top + 5), (390, top), (880, top), (950, body_top + 5)]
    else:
        roof = [(300, body_top + 5), (420, top), (820, top), (900, body_top + 5)]
    d.polygon(roof, fill=color)
    # vitres
    gl = (60, 40, 90, 200)
    mx = (roof[1][0] + roof[2][0]) // 2
    d.polygon([(roof[0][0] + 40, body_top), (roof[1][0] + 15, top + 22), (mx - 8, top + 22), (mx - 8, body_top)], fill=gl)
    d.polygon([(mx + 8, body_top), (mx + 8, top + 22), (roof[2][0] - 10, top + 22), (roof[3][0] - 50, body_top)], fill=gl)
    # reflets & lignes
    d.rounded_rectangle([200, body_top + 40, 1000, body_top + 52], radius=6, fill=shade(color, 1.15) + (255,))
    d.line([(mx, body_top), (mx, 590)], fill=shade(color, 0.75) + (255,), width=4)
    d.rounded_rectangle([985, body_top + 30, 1030, body_top + 70], radius=12, fill=(255, 220, 120, 255))
    d.rounded_rectangle([170, body_top + 30, 205, body_top + 70], radius=12, fill=(200, 30, 40, 255))
    # roues
    for cx in (330, 870):
        d.ellipse([cx - 95, 505, cx + 95, 695], fill=(28, 28, 32))
        d.ellipse([cx - 55, 545, cx + 55, 655], fill=(170, 172, 180))
        d.ellipse([cx - 18, 582, cx + 18, 618], fill=(90, 90, 98))
    return im

os.makedirs(OUT, exist_ok=True)
for ci, (name, c) in enumerate(COLORS.items()):
    for si, shape in enumerate(SHAPES):
        for bi, bg in enumerate(BGS):
            im = car(grad(bg), c, shape)
            im.save(os.path.join(OUT, f'{shape}-{name}-{bi}.jpg'), quality=82)
print('ok', len(os.listdir(OUT)))
