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

# --- Volcanic chasm (Lavaball Trap): basalt, ash, black sand, lava ---
BASALT = rgb('#3b3538'); BASALT_D = rgb('#29242a'); BASALT_L = rgb('#4f4649')
ASH = rgb('#443d3f'); ASH_D = rgb('#383234'); ASH_L = rgb('#514a4b')
LAVA = rgb('#ff7a1a'); LAVA_HOT = rgb('#ffc94a'); CRUST = rgb('#7a2a10')

def cracks(img, seed, color, n=3, glow=None):
    d = ImageDraw.Draw(img)
    rnd = random.Random(seed)
    for _ in range(n):
        x, y = rnd.randint(3, 28), rnd.randint(3, 28)
        for _ in range(6):
            nx = min(31, max(0, x + rnd.randint(-3, 3)))
            ny = min(31, max(0, y + rnd.randint(-3, 3)))
            if glow:
                d.line([(x, y + 1), (nx, ny + 1)], fill=glow)
            d.line([(x, y), (nx, ny)], fill=color)
            x, y = nx, ny
    return img

def basalt(seed):
    return cracks(noise_tile(seed, BASALT, BASALT_D, BASALT_L, 0.2), seed, BASALT_D)

def ash(seed):
    return noise_tile(seed, ASH, ASH_D, ASH_L, 0.3)

def black_sand(seed):
    return noise_tile(seed, rgb('#2f2b2d'), rgb('#1f1c1e'), rgb('#48413f'), 0.35)

def lava_crack(seed):
    return cracks(noise_tile(seed, BASALT, BASALT_D, BASALT_L, 0.2), seed, LAVA, 1, glow=CRUST)

def lava_pool(seed):
    img = noise_tile(seed, LAVA, CRUST, LAVA_HOT, 0.25)
    d = ImageDraw.Draw(img)
    rnd = random.Random(seed)
    for _ in range(4):  # cooling crust plates
        x, y, r = rnd.randint(4, 27), rnd.randint(4, 27), rnd.randint(2, 4)
        d.ellipse([x - r, y - r, x + r, y + r], fill=CRUST)
        d.ellipse([x - r + 1, y - r + 1, x + r - 2, y + r - 2], fill=rgb('#5a2010'))
    for _ in range(3):  # bubbles
        x, y = rnd.randint(4, 27), rnd.randint(4, 27)
        d.ellipse([x - 1, y - 1, x + 1, y + 1], fill=LAVA_HOT)
    return img

def spire(seed):
    img = Image.new('RGBA', (T, T), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([6, 25, 26, 31], fill=(0, 0, 0, 80))
    d.polygon([(9, 29), (13, 6), (16, 1), (19, 7), (23, 29)], fill=BASALT)
    d.polygon([(9, 29), (13, 6), (16, 1), (15, 29)], fill=BASALT_L)
    d.line([(17, 10), (19, 22)], fill=BASALT_D)
    d.line([(12, 18), (14, 24)], fill=LAVA)  # a glowing seam
    return img

def boulder(seed):
    img = Image.new('RGBA', (T, T), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([5, 22, 27, 31], fill=(0, 0, 0, 80))
    d.polygon([(5, 25), (8, 13), (16, 8), (25, 12), (27, 24), (18, 29)], fill=BASALT)
    d.polygon([(8, 13), (16, 8), (19, 14), (11, 18)], fill=BASALT_L)
    d.line([(18, 29), (22, 18)], fill=BASALT_D)
    return img

def embers(seed):
    img = Image.new('RGBA', (T, T), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rnd = random.Random(seed)
    for _ in range(5):
        x, y = rnd.randint(3, 28), rnd.randint(3, 28)
        d.point((x, y), fill=LAVA_HOT)
        d.point((x + 1, y), fill=(255, 122, 26, 160))
    return img

# --- Deep sea (Lorthos, the Tidemaker): dark water, whirlpool, a tentacle breaking the surface ---
DEEP = rgb('#0f2a3d'); DEEP_D = rgb('#0a1f2e'); DEEP_L = rgb('#1a3b52'); FOAM = rgb('#9cc7d9')

def deep_water(seed):
    img = noise_tile(seed, DEEP, DEEP_D, DEEP_L, 0.25)
    d = ImageDraw.Draw(img)
    rnd = random.Random(seed)
    for _ in range(3):  # slow swell lines
        x, y = rnd.randint(2, 20), rnd.randint(4, 28)
        d.line([(x, y), (x + rnd.randint(5, 9), y)], fill=DEEP_L)
    return img

def whirlpool(seed):
    img = deep_water(seed)
    d = ImageDraw.Draw(img)
    for r, color in ((13, DEEP_L), (10, rgb('#2a5670')), (7, DEEP_L), (4, rgb('#061521'))):
        d.arc([16 - r, 16 - r, 16 + r, 16 + r], start=(r * 40) % 360, end=(r * 40 + 250) % 360, fill=color, width=2)
    d.arc([3, 3, 29, 29], start=200, end=320, fill=FOAM, width=1)
    return img

def tentacle(seed):
    img = Image.new('RGBA', (T, T), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([6, 24, 26, 31], outline=FOAM, width=1)  # ripple where it breaks the surface
    pts = [(14, 28), (12, 22), (13, 16), (17, 11), (21, 8), (22, 5), (20, 3)]
    for i in range(len(pts) - 1):
        w = max(1, 5 - i)
        d.line([pts[i], pts[i + 1]], fill=rgb('#3e5f4f'), width=w)
    for x, y in pts[1:5]:  # suckers
        d.point((x + 2, y), fill=rgb('#b7c9a8'))
    return img

# Order defines indices: 1440 + position. Keep in sync with tools/build-map.mjs (CUSTOM).
TILES = [
    ('sky', sky(1, 0)), ('sky', sky(2, 1)), ('sky', sky(3, 0)),
    ('cloud', cloud_bank(4)), ('cloud', cloud_bank(5)),
    ('skyFloor', flagstones(6, 2)), ('skyFloor', flagstones(7, 5)), ('skyFloor', flagstones(8, 0)),
    ('skyRim', rim(9)), ('skyRim', rim(10)),
    ('pillar', pillar(11)), ('hedron', hedron(12)), ('rubble', rubble(13)),
    ('motes', motes(14)),
    # Appended for ZEN-135 (volcanic). Only ever append, so existing indices stay valid.
    ('basalt', basalt(15)), ('basalt', basalt(16)), ('basalt', basalt(17)),
    ('ash', ash(18)), ('ash', ash(19)),
    ('blackSand', black_sand(20)), ('blackSand', black_sand(21)),
    ('lavaCrack', lava_crack(22)),
    ('lavaPool', lava_pool(23)), ('lavaPool', lava_pool(24)),
    ('spire', spire(25)), ('boulder', boulder(26)),
    ('embers', embers(27)),
    # Appended for ZEN-53 (deep sea).
    ('deepWater', deep_water(28)), ('deepWater', deep_water(29)),
    ('whirlpool', whirlpool(30)), ('tentacle', tentacle(31)),
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
