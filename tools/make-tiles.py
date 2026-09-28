# Builds public/assets/zendikar-tiles.png: the AI Town gentle tileset with rows of
# our own pixel-art tiles appended below it, so gentle tile indices stay valid and custom
# tiles start at 1440 (45 tiles per row). Tiles are drawn procedurally here (no third-party
# art). tools/build-map.mjs refers to them by the CUSTOM index list printed at the end.
# Usage: python3 tools/make-tiles.py  (needs Pillow)
import math
import random
from pathlib import Path
from PIL import Image, ImageDraw

repo = Path(__file__).resolve().parent.parent
gentle = Image.open(repo / 'public/assets/gentle-obj.png').convert('RGBA')
T = 32
COLS = gentle.width // T  # 45

def rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,)

def shade(c, f):
    return tuple(max(0, min(255, int(v * f))) for v in c[:3]) + (c[3],)

def noise_tile(seed, base, dark, light, density=0.18):
    rnd = random.Random(seed)
    img = Image.new('RGBA', (T, T), base)
    px = img.load()
    for x in range(T):
        for y in range(T):
            r = rnd.random()
            if r < density / 2:
                px[x, y] = dark
            elif r < density:
                px[x, y] = light
    return img

def blob(draw, cx, cy, r, color):
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)

# --- Sky: pale blue air with small cloud puffs kept inside the tile so variants sit
# next to each other without seams ---
SKY = rgb('#9fd3f2'); SKY_D = rgb('#8cc6ea'); SKY_L = rgb('#b3def6')
CLOUD = rgb('#f4f8fb'); CLOUD_S = rgb('#d7e6f0')

def sky(seed, puffs):
    img = noise_tile(seed, SKY, SKY_D, SKY_L, 0.1)
    rnd = random.Random(seed * 7 + 1)
    d = ImageDraw.Draw(img)
    for _ in range(puffs):
        cx, cy = rnd.randint(9, 22), rnd.randint(9, 20)
        for dx, r in ((-4, 3), (0, 4), (4, 3)):
            blob(d, cx + dx, cy + 1, r, CLOUD_S)
        for dx, r in ((-4, 3), (0, 4), (4, 3)):
            blob(d, cx + dx, cy, r - 1, CLOUD)
    return img

def cloud_bank(seed):
    img = noise_tile(seed, CLOUD, rgb('#e6eff5'), rgb('#fbfdfe'), 0.2)
    d = ImageDraw.Draw(img)
    rnd = random.Random(seed)
    for _ in range(3):
        cx, cy, r = rnd.randint(8, 24), rnd.randint(8, 24), rnd.randint(3, 6)
        blob(d, cx, cy + 1, r, rgb('#e2ecf3'))
        blob(d, cx, cy, r - 1, CLOUD)
    return img

# --- Sky ruin ground: pale weathered flagstones with moss ---
STONE = rgb('#cfc6b0'); STONE_D = rgb('#a99f89'); STONE_L = rgb('#e3dcc8'); MOSS = rgb('#8fae6a')

def flagstones(seed, moss):
    img = noise_tile(seed, STONE, STONE_D, STONE_L, 0.14)
    d = ImageDraw.Draw(img)
    rnd = random.Random(seed)
    # Grout lines of a loose 2x2 slab pattern, offset per variant.
    off = rnd.randint(10, 22)
    d.line([(0, off), (T, off)], fill=STONE_D)
    d.line([(off // 2 + 4, 0), (off // 2 + 4, off)], fill=STONE_D)
    d.line([(off + 6, off), (off + 6, T)], fill=STONE_D)
    for _ in range(3):  # cracks
        x, y = rnd.randint(2, 29), rnd.randint(2, 29)
        for _ in range(5):
            nx, ny = x + rnd.randint(-2, 2), y + rnd.randint(0, 2)
            d.line([(x, y), (nx, ny)], fill=shade(STONE_D, 0.9))
            x, y = nx, ny
    px = img.load()
    for _ in range(moss):
        x, y = rnd.randrange(T), rnd.randrange(T)
        for dx in range(-1, 2):
            for dy in range(-1, 2):
                if 0 <= x + dx < T and 0 <= y + dy < T and rnd.random() < 0.7:
                    px[x + dx, y + dy] = shade(MOSS, 0.85 + rnd.random() * 0.3)
    return img

# --- Island rim: the ledge where the floating ground breaks off into sky ---
def rim(seed):
    img = sky(seed + 100, 1)
    d = ImageDraw.Draw(img)
    rnd = random.Random(seed)
    # Ledge top (stone) over a dark earth-and-root underside dropping into the air.
    d.rectangle([0, 0, T, 13], fill=STONE)
    for x in range(T):
        drop = 20 + int(4 * math.sin(x / 3 + seed)) + rnd.randint(-1, 1)
        d.line([(x, 13), (x, drop)], fill=rgb('#6d5b47'))
        d.point((x, drop), fill=rgb('#4e4034'))
        if rnd.random() < 0.12:
            d.line([(x, drop), (x, drop + rnd.randint(2, 5))], fill=rgb('#4e4034'))  # roots
    d.line([(0, 13), (T, 13)], fill=STONE_D)
    for x in range(T):
        if rnd.random() < 0.3:
            d.point((x, rnd.randint(1, 11)), fill=STONE_L)
    return img

# --- Obstacles (transparent background) ---
def pillar(seed):
    img = Image.new('RGBA', (T, T), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([7, 24, 25, 31], fill=(0, 0, 0, 70))  # shadow
    d.rectangle([10, 8, 21, 27], fill=STONE)
    d.rectangle([10, 8, 12, 27], fill=STONE_L)
    d.rectangle([19, 8, 21, 27], fill=STONE_D)
    d.polygon([(9, 8), (14, 3), (17, 6), (22, 2), (22, 8)], fill=STONE)  # broken top
    for y in (13, 19, 25):
        d.line([(10, y), (21, y)], fill=STONE_D)
    return img

HEDRON = rgb('#5b5f66'); HEDRON_L = rgb('#8a8f98'); RUNE = rgb('#9ff0ff')

def hedron(seed):
    # Zendikar's floating hedron: an elongated octahedral stone with glowing runes.
    img = Image.new('RGBA', (T, T), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([9, 27, 23, 31], fill=(0, 0, 0, 60))  # shadow far below: it floats
    top, mid_l, mid_r, bot = (16, 1), (7, 12), (25, 12), (16, 24)
    d.polygon([top, mid_l, (16, 14)], fill=HEDRON_L)
    d.polygon([top, mid_r, (16, 14)], fill=HEDRON)
    d.polygon([mid_l, bot, (16, 14)], fill=shade(HEDRON, 0.8))
    d.polygon([mid_r, bot, (16, 14)], fill=shade(HEDRON, 0.6))
    d.line([(16, 4), (16, 21)], fill=RUNE)
    d.line([(12, 11), (20, 11)], fill=RUNE)
    d.point([(14, 7), (18, 16), (13, 16)], fill=RUNE)
    return img

def rubble(seed):
    img = Image.new('RGBA', (T, T), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rnd = random.Random(seed)
    for _ in range(5):
        x, y, r = rnd.randint(8, 24), rnd.randint(12, 26), rnd.randint(3, 6)
        d.ellipse([x - r, y - r + 2, x + r, y + r + 2], fill=(0, 0, 0, 50))
        d.polygon([(x - r, y), (x - 1, y - r), (x + r, y - 1), (x + 1, y + r)], fill=STONE)
        d.line([(x - 1, y - r), (x + r, y - 1)], fill=STONE_L)
    return img

# --- Walkable decoration (transparent): drifting motes of light ---
def motes(seed):
    img = Image.new('RGBA', (T, T), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rnd = random.Random(seed)
    for _ in range(4):
        x, y = rnd.randint(3, 28), rnd.randint(3, 28)
        d.point((x, y), fill=(255, 255, 230, 255))
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            d.point((x + dx, y + dy), fill=(255, 250, 190, 140))
    return img

# Order defines indices: 1440 + position. Keep in sync with tools/build-map.mjs (CUSTOM).
TILES = [
    ('sky', sky(1, 0)), ('sky', sky(2, 1)), ('sky', sky(3, 0)),
    ('cloud', cloud_bank(4)), ('cloud', cloud_bank(5)),
    ('skyFloor', flagstones(6, 2)), ('skyFloor', flagstones(7, 5)), ('skyFloor', flagstones(8, 0)),
    ('skyRim', rim(9)), ('skyRim', rim(10)),
    ('pillar', pillar(11)), ('hedron', hedron(12)), ('rubble', rubble(13)),
    ('motes', motes(14)),
]

rows = math.ceil(len(TILES) / COLS)
sheet = Image.new('RGBA', (gentle.width, gentle.height + rows * T), (0, 0, 0, 0))
sheet.paste(gentle, (0, 0))
base = (gentle.height // T) * COLS
for i, (_, tile) in enumerate(TILES):
    sheet.paste(tile, ((i % COLS) * T, gentle.height + (i // COLS) * T))
out = repo / 'public/assets/zendikar-tiles.png'
sheet.save(out)

custom = {}
for i, (name, _) in enumerate(TILES):
    custom.setdefault(name, []).append(base + i)
print(f'{out.relative_to(repo)} {sheet.width}x{sheet.height}')
print('CUSTOM =', custom)
