// Builds the Zendikar plane map from world/entities/locations.
// Everything starts as open sea; each location with a `map:` block raises land there.
// Writes data/zendikar.js (AI Town map module) and data/places.ts (NPC places).
// Usage: npm run world:map
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const repo = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const locationsDir = join(repo, 'world', 'entities', 'locations');

export const MAP_WIDTH = 96;
export const MAP_HEIGHT = 72;
const SPOTS_PER_PLACE = 8;
// Sea within this many tiles of a sky island turns into open sky and clouds.
const SKY_HALO = 5;

// public/assets/zendikar-tiles.png: gentle-obj.png plus our tiles appended below
// (tools/make-tiles.py). The frontend slices it by these dimensions.
const TILESET_URL = '/ai-town/assets/zendikar-tiles.png';
const TILESET_FILE = join(repo, 'public', 'assets', 'zendikar-tiles.png');

// Tile indices in zendikar-tiles.png (45 tiles per row, 32px). 0..1439 are gentle-obj.png;
// 1440+ are ours, as printed by tools/make-tiles.py.
const CUSTOM = {
  sky: [1440, 1441, 1442],
  cloud: [1443, 1444],
  skyFloor: [1445, 1446, 1447],
  skyRim: [1448, 1449],
  pillar: [1450],
  hedron: [1451],
  rubble: [1452],
  motes: [1453],
  basalt: [1454, 1455, 1456],
  ash: [1457, 1458],
  blackSand: [1459, 1460],
  lavaCrack: [1461],
  lavaPool: [1462, 1463],
  spire: [1464],
  boulder: [1465],
  embers: [1466],
  deepWater: [1467, 1468],
  whirlpool: [1469],
  tentacle: [1470],
};
const T = {
  water: [451, 452],
  sand: [1061, 1063, 1106],
  grass: [271, 271, 271, 0],
  dirt: [46, 46, 1],
  // Invisible tile that blocks movement (the default AI Town map uses it the same way).
  blocker: 367,
  trees: [939, 940, 894, 895],
  bushes: [891, 892],
  rocks: [896, 941],
  flowers: [936, 937],
};

// Per terrain: ground tiles, and chances per tile of a blocking obstacle or a walkable decoration.
export const TERRAINS = {
  grassland: { ground: T.grass, obstacles: T.trees, obstacleChance: 0.04, decor: [...T.flowers, ...T.bushes], decorChance: 0.06 },
  forest: { ground: T.grass, obstacles: T.trees, obstacleChance: 0.3, decor: T.bushes, decorChance: 0.1 },
  rocky: { ground: T.dirt, obstacles: T.rocks, obstacleChance: 0.15, decor: [], decorChance: 0 },
  beach: { ground: T.sand, obstacles: T.rocks, obstacleChance: 0.02, decor: [], decorChance: 0 },
  settlement: { ground: T.dirt, obstacles: [], obstacleChance: 0, decor: T.flowers, decorChance: 0.03 },
  // Floating island (Emeria): ruin flagstones, no beach; surrounded by sky instead of sea.
  sky: {
    ground: CUSTOM.skyFloor,
    obstacles: [...CUSTOM.pillar, ...CUSTOM.hedron, ...CUSTOM.rubble],
    obstacleChance: 0.08,
    decor: CUSTOM.motes,
    decorChance: 0.05,
    floating: true,
  },
  // Volcanic chasm (Lavaball Trap): basalt and ash with glowing cracks, lava pools and
  // spires to walk around, black sand where it meets the sea.
  // Sea feature (Lorthos's deepwater realm): darker water painted over open sea. Raises no
  // land and makes no place; a whirlpool marks the centre and tentacles break the surface.
  deepsea: {
    sea: true,
    ground: CUSTOM.deepWater,
    obstacles: [],
    obstacleChance: 0,
    decor: CUSTOM.tentacle,
    decorChance: 0.02,
    centre: CUSTOM.whirlpool,
  },
  volcanic: {
    ground: [...CUSTOM.basalt, ...CUSTOM.basalt, ...CUSTOM.ash, ...CUSTOM.lavaCrack],
    coast: CUSTOM.blackSand,
    // A lava river meanders along the chasm; it breaks wherever it would cut the area in two.
    river: CUSTOM.lavaPool,
    obstacles: [...CUSTOM.spire, ...CUSTOM.boulder, ...CUSTOM.spire],
    obstacleChance: 0.08,
    decor: CUSTOM.embers,
    decorChance: 0.06,
  },
};

function hashString(s) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rand, list) => list[Math.floor(rand() * list.length)];

// Smooth value noise in [-1, 1] so coastlines look natural rather than elliptical.
function valueNoise(seed, cell = 5) {
  const lattice = (i, j) => rng(hashString(`${seed}:${i}:${j}`))() * 2 - 1;
  const smooth = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const i = Math.floor(x / cell), j = Math.floor(y / cell);
    const fx = smooth(x / cell - i), fy = smooth(y / cell - j);
    const a = lattice(i, j), b = lattice(i + 1, j), c = lattice(i, j + 1), d = lattice(i + 1, j + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
}

export function readLocations() {
  if (!existsSync(locationsDir)) return [];
  return readdirSync(locationsDir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const text = readFileSync(join(locationsDir, f), 'utf8');
      const m = text.match(/^---\n([\s\S]*?)\n---/);
      return m ? parse(m[1]) : null;
    })
    .filter((fm) => fm?.map);
}

export function buildMap(locations) {
  const W = MAP_WIDTH, H = MAP_HEIGHT;
  const grid = (v) => Array.from({ length: W }, () => Array(H).fill(v));
  const seaRand = rng(hashString('sea'));
  const bg = grid(-1), deco = grid(-1), obj = grid(-1);
  const owner = grid(null); // location id per land tile
  for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) {
    bg[x][y] = pick(seaRand, T.water);
    obj[x][y] = T.blocker;
  }

  // Larger areas first so smaller sites (towns inside a region) paint over them.
  const seaFeatures = locations.filter((l) => TERRAINS[l.map.terrain].sea);
  const ordered = locations
    .filter((l) => !TERRAINS[l.map.terrain].sea)
    .sort((a, b) => b.map.w * b.map.h - a.map.w * a.map.h);
  for (const loc of ordered) {
    const { x: cx, y: cy, w, h } = loc.map;
    const noise = valueNoise(loc.id);
    for (let x = Math.max(0, Math.floor(cx - w)); x < Math.min(W, Math.ceil(cx + w)); x++) {
      for (let y = Math.max(0, Math.floor(cy - h)); y < Math.min(H, Math.ceil(cy + h)); y++) {
        const d = ((x - cx) / (w / 2)) ** 2 + ((y - cy) / (h / 2)) ** 2;
        if (d < 1 + 0.35 * noise(x, y)) owner[x][y] = loc.id;
      }
    }
  }

  const byId = new Map(locations.map((l) => [l.id, l]));
  const isLand = (x, y) => x >= 0 && y >= 0 && x < W && y < H && owner[x][y] !== null;
  const nearSea = (x, y) => {
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (!isLand(x + dx, y + dy)) return true;
    return false;
  };
  const walkable = (x, y) => isLand(x, y) && obj[x][y] === -1;

  // Ground, beaches, then decorations and obstacles that keep each area connected.
  for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) {
    const id = owner[x][y];
    if (!id) continue;
    const rand = rng(hashString(`${id}:${x}:${y}`));
    const terrain = TERRAINS[byId.get(id).map.terrain];
    const coast = nearSea(x, y);
    bg[x][y] = pick(rand, coast && !terrain.floating ? (terrain.coast ?? T.sand) : terrain.ground);
    obj[x][y] = -1;
    if (!coast && terrain.decor.length && rand() < terrain.decorChance) deco[x][y] = pick(rand, terrain.decor);
  }
  for (const loc of ordered) {
    const terrain = TERRAINS[loc.map.terrain];
    if (terrain.river) paintRiver(loc, terrain.river, owner, obj, nearSea, W, H, walkable);
    if (!terrain.obstacles.length) continue;
    for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) {
      if (owner[x][y] !== loc.id || nearSea(x, y) || deco[x][y] !== -1) continue;
      const rand = rng(hashString(`${loc.id}:obstacle:${x}:${y}`));
      if (rand() >= terrain.obstacleChance) continue;
      obj[x][y] = pick(rand, terrain.obstacles);
      if (!connected(W, H, walkable, x, y)) obj[x][y] = -1;
    }
  }

  for (const loc of seaFeatures) paintSeaFeature(loc, W, H, bg, deco, owner);
  paintSky(W, H, bg, owner, byId);

  const places = ordered.map((loc) => ({
    id: loc.id,
    name: loc.name,
    description: loc.summary ?? '',
    entityId: loc.id,
    spots: pickSpots(loc, owner, walkable),
  }));
  return { bg, deco, obj, places };
}

// Repaints open sea inside the location's noisy ellipse; land and its coast are left alone.
function paintSeaFeature(loc, W, H, bg, deco, owner) {
  const { x: cx, y: cy, w, h } = loc.map;
  const terrain = TERRAINS[loc.map.terrain];
  const noise = valueNoise(loc.id);
  for (let x = Math.max(0, Math.floor(cx - w)); x < Math.min(W, Math.ceil(cx + w)); x++) {
    for (let y = Math.max(0, Math.floor(cy - h)); y < Math.min(H, Math.ceil(cy + h)); y++) {
      const d = ((x - cx) / (w / 2)) ** 2 + ((y - cy) / (h / 2)) ** 2;
      if (owner[x][y] !== null || d >= 1 + 0.35 * noise(x, y)) continue;
      const rand = rng(hashString(`${loc.id}:${x}:${y}`));
      bg[x][y] = pick(rand, terrain.ground);
      if (d > 0.05 && rand() < terrain.decorChance) deco[x][y] = pick(rand, terrain.decor);
    }
  }
  const [x, y] = [Math.round(cx), Math.round(cy)];
  if (terrain.centre && owner[x][y] === null) bg[x][y] = pick(rng(hashString(loc.id)), terrain.centre);
}

// A meandering channel (1-2 tiles wide) along the location's long axis.
function paintRiver(loc, tiles, owner, obj, nearSea, W, H, walkable) {
  const { x: cx, y: cy, w, h } = loc.map;
  const horizontal = w >= h;
  const noise = valueNoise(`${loc.id}:river`, 6);
  const span = horizontal ? w : h;
  for (let t = -span; t <= span; t++) {
    const along = Math.round((horizontal ? cx : cy) + t);
    const across = (horizontal ? cy : cx) + noise(t, 0) * (horizontal ? h : w) * 0.2;
    for (const off of [0, noise(t, 7) > 0 ? 1 : -1]) {
      const [x, y] = horizontal ? [along, Math.round(across) + off] : [Math.round(across) + off, along];
      if (x < 0 || y < 0 || x >= W || y >= H || owner[x][y] !== loc.id || nearSea(x, y) || obj[x][y] !== -1) continue;
      obj[x][y] = pick(rng(hashString(`${loc.id}:river:${x}:${y}`)), tiles);
      if (!connected(W, H, walkable, x, y)) obj[x][y] = -1;
    }
  }
}

// Around floating islands the sea becomes sky: open air near the island, a ring of
// cloud where it meets the sea, and the island's underside showing below its south edge.
function paintSky(W, H, bg, owner, byId) {
  const skyLand = [];
  for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) {
    const id = owner[x][y];
    if (id && TERRAINS[byId.get(id).map.terrain].floating) skyLand.push([x, y]);
  }
  if (!skyLand.length) return;
  for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) {
    if (owner[x][y] !== null) continue;
    let d = Infinity;
    for (const [a, b] of skyLand) d = Math.min(d, Math.hypot(a - x, b - y));
    if (d > SKY_HALO) continue;
    const rand = rng(hashString(`sky:${x}:${y}`));
    const northId = y > 0 ? owner[x][y - 1] : null;
    if (northId && TERRAINS[byId.get(northId).map.terrain].floating) bg[x][y] = pick(rand, CUSTOM.skyRim);
    else if (d > SKY_HALO - 1.5) bg[x][y] = pick(rand, CUSTOM.cloud);
    else bg[x][y] = pick(rand, CUSTOM.sky);
  }
}

// PNG width and height from the IHDR chunk.
function pngSize(file) {
  const b = readFileSync(file);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

// Would the walkable neighbours of (x, y) still reach each other with (x, y) blocked?
function connected(W, H, walkable, x, y) {
  const around = [[1, 0], [-1, 0], [0, 1], [0, -1]]
    .map(([dx, dy]) => [x + dx, y + dy])
    .filter(([a, b]) => walkable(a, b));
  if (around.length <= 1) return true;
  const seen = new Set([around[0].join()]);
  const queue = [around[0]];
  while (queue.length) {
    const [a, b] = queue.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = [a + dx, b + dy];
      if (!seen.has(n.join()) && walkable(...n)) {
        seen.add(n.join());
        queue.push(n);
      }
    }
  }
  return around.every((p) => seen.has(p.join()));
}

// Walkable tiles of this location closest to its centre, at least 2 tiles apart.
function pickSpots(loc, owner, walkable) {
  const { x: cx, y: cy } = loc.map;
  const tiles = [];
  owner.forEach((col, x) => col.forEach((id, y) => {
    if (id === loc.id && walkable(x, y)) tiles.push({ x, y, d: (x - cx) ** 2 + (y - cy) ** 2 });
  }));
  tiles.sort((a, b) => a.d - b.d);
  const spots = [];
  for (const t of tiles) {
    if (spots.every((s) => Math.abs(s.x - t.x) + Math.abs(s.y - t.y) >= 2)) spots.push({ x: t.x, y: t.y });
    if (spots.length === SPOTS_PER_PLACE) break;
  }
  return spots;
}

function writeOutputs({ bg, deco, obj, places }) {
  const gameData = join(repo, 'data');
  const header = '// Generated by tools/build-map.mjs from world/entities/locations. Do not edit.\n';
  const tileset = pngSize(TILESET_FILE);
  writeFileSync(
    join(gameData, 'zendikar.js'),
    header +
      `export const tilesetpath = "${TILESET_URL}"
export const tiledim = 32
export const screenxtiles = 45
export const screenytiles = 32
export const tilesetpxw = ${tileset.width}
export const tilesetpxh = ${tileset.height}
export const bgtiles = ${JSON.stringify([bg, deco])}
export const objmap = ${JSON.stringify([obj])}
export const animatedsprites = []
export const mapwidth = bgtiles[0].length;
export const mapheight = bgtiles[0][0].length;
`,
  );
  writeFileSync(
    join(gameData, 'places.ts'),
    header +
      `// Named places NPC schedules refer to by id: one per location with a map block.

export type Place = {
  id: string;
  name: string;
  description: string;
  entityId?: string;
  spots: { x: number; y: number }[];
};

export const PLACES: Place[] = ${JSON.stringify(places, null, 2)};

export const PLACES_BY_ID = new Map(PLACES.map((p) => [p.id, p]));
`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const locations = readLocations();
  const result = buildMap(locations);
  writeOutputs(result);
  const land = result.obj.flat().filter((t) => t !== 367).length;
  console.log(
    `맵 ${MAP_WIDTH}x${MAP_HEIGHT}: 지역 ${locations.length}곳, 육지 ${land}칸` +
      (locations.length ? '' : ' (아직 망망대해)'),
  );
  for (const p of result.places) console.log(`  ${p.id} ${p.name}: 설 자리 ${p.spots.length}곳`);
}
