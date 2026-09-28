# Renders data/zendikar.js to world/map.png with place names, for reviewing
# the plane as regions are added. Usage: npm run world:map (needs Python + Pillow).
import json, re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

repo = Path(__file__).resolve().parent.parent
data = (repo / 'data/zendikar.js').read_text()
places_src = (repo / 'data/places.ts').read_text()
grab = lambda name, src: json.loads(re.search(rf'export const {name}[^=]*= (.*?);?\n', src, re.S).group(1))
layers = grab('bgtiles', data) + grab('objmap', data)
places = json.loads(re.search(r'export const PLACES: Place\[\] = (.*?);\n', places_src, re.S).group(1))

tileset_url = re.search(r'export const tilesetpath = "([^"]+)"', data).group(1)
tileset = Image.open(repo / 'public/assets' / Path(tileset_url).name).convert('RGBA')
cols = tileset.width // 32
tiles = {}
def tile(i):
    if i not in tiles:
        tiles[i] = tileset.crop(((i % cols) * 32, (i // cols) * 32, (i % cols) * 32 + 32, (i // cols) * 32 + 32))
    return tiles[i]

W, H = len(layers[0]), len(layers[0][0])
img = Image.new('RGBA', (W * 32, H * 32), (0, 0, 0, 255))
for layer in layers:
    for x in range(W):
        for y in range(H):
            if layer[x][y] != -1:
                img.alpha_composite(tile(layer[x][y]), (x * 32, y * 32))
img = img.resize((W * 12, H * 12), Image.LANCZOS)

try:
    font = ImageFont.truetype('/System/Library/Fonts/AppleSDGothicNeo.ttc', 22)
except OSError:
    font = ImageFont.load_default()
draw = ImageDraw.Draw(img)
for p in places:
    if not p['spots']:
        continue
    x, y = p['spots'][0]['x'] * 12, p['spots'][0]['y'] * 12
    draw.text((x, y), p['name'], font=font, fill='white', stroke_width=3, stroke_fill='black', anchor='mm')
img.convert('RGB').save(repo / 'world/map.png')
print(f'world/map.png ({W}x{H} tiles, {len(places)} places)')
