// The map in tiles (user decision 2026-10-01): the world is a grid of TILE × TILE squares, an
// hour's walk each. Every land holds tiles of its own: a continent or an island around its
// place, an area (`map.in`) a few of its region's tiles where the lore puts it (`map.pos`,
// `map.tiles`), a plain land or a sea around its place. Beings stand on a tile (`Actor.tile`);
// only those on the same tile of the same land meet, fight, or fall under what picks "those
// there" (sim/state.ts `present`). A wandering place (Goma Fada) holds no tiles of the grid:
// it is one tile of its own, wherever it walks.
import { TRAVEL_UNITS_PER_HOUR } from './rules.ts';
import type { Region, World } from './world.ts';

export const TILE = TRAVEL_UNITS_PER_HOUR;
export type Tile = [number, number];

// The least a land holds (user decision 2026-10-01: at least; how large beyond that is the
// lore's, `map.tiles`): a continent, with its areas; an area; an island or another land.
// A continent keeps open ground of its own besides its areas, an island or a land with areas
// some too.
export const CONTINENT_MIN = 100;
export const LAND_MIN = 10;
export const CONTINENT_GROUND = 40;
export const ISLAND_GROUND = 5;
// A named sea's waters, in tiles, unless the lore says (`map.tiles`), and how far out they may
// be sought.
export const SEA_TILES = 40;
const SEA_REACH = 12;

export function tileKey(t: Tile) {
  return `${t[0]},${t[1]}`;
}
export function sameTile(a: Tile | undefined, b: Tile | undefined) {
  return !!a && !!b && a[0] === b[0] && a[1] === b[1];
}
export function tileAt(x: number, y: number): Tile {
  return [Math.floor(x / TILE), Math.floor(y / TILE)];
}
export function tileCenter(t: Tile) {
  return { x: (t[0] + 0.5) * TILE, y: (t[1] + 0.5) * TILE };
}
// Hours on foot from one tile to another: a step to any of the eight around is an hour.
export function tileSteps(a: Tile, b: Tile) {
  return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
}

function areaTiles(r: Region) {
  return r.tileCount ?? LAND_MIN;
}

// How many tiles a land holds: as many as the lore gives it (`map.tiles`; the least for its kind
// when it doesn't say), with room for its areas and some open ground of its own. The least is
// the world's rule, checked by `world:check` (`tooSmall`), not forced here.
function tilesWanted(world: World, r: Region) {
  const areas = world.regions.filter((x) => x.parent === r.id).reduce((n, x) => n + areaTiles(x), 0);
  if (r.size === 'continent') return Math.max(r.tileCount ?? CONTINENT_MIN, areas ? CONTINENT_GROUND + areas : 0);
  return Math.max(r.tileCount ?? LAND_MIN, areas ? ISLAND_GROUND + areas : 0);
}

// Lands smaller than the least for their kind (a continent with its areas, any other land; a
// sea holds water, not land).
export function tooSmall(world: World) {
  return world.regions
    .filter((r) => !r.wanders && !isSea(r))
    .map((r) => {
      const n = tilesOf(world, r.id).length + (r.parent ? 0 : world.regions.filter((x) => x.parent === r.id).reduce((m, x) => m + tilesOf(world, x.id).length, 0));
      const least = r.size === 'continent' ? CONTINENT_MIN : LAND_MIN;
      return n < least ? `${r.id}: 칸 ${n}개 (최소 ${least})` : null;
    })
    .filter((x): x is string => !!x);
}

function isSea(r: Region) {
  return r.terrain === 'deepsea' && !r.parent;
}

// The radius of a circle as large as `n` tiles: how large a land is drawn, and how far out its
// areas' `pos` reaches.
export function radiusOf(n: number) {
  return Math.sqrt((n * TILE * TILE) / Math.PI);
}

// Lays the lands out on the grid: each top land takes the free tiles nearest its place (the
// smallest first, so an island or a sea between continents keeps its spot), then each area the
// free tiles of its region nearest where the lore puts it (the largest first). What is left of
// a region is its open ground. Sets `tiles` and `radius` on each land, and the owner of each
// tile.
export function layTiles(world: World) {
  const owner: Record<string, string> = {};
  const tops = world.regions.filter((r) => !r.parent && !r.wanders && !isSea(r));
  const wanted = new Map(tops.map((r) => [r.id, tilesWanted(world, r)]));
  const order = [...tops].sort((a, b) => wanted.get(a.id)! - wanted.get(b.id)! || a.id.localeCompare(b.id));
  // `n` tiles for `id` nearest `from`, of those in `pool` it may take.
  const claim = (id: string, from: { x: number; y: number }, n: number, pool: Tile[], mayTake: (t: Tile) => boolean) => {
    const got = pool
      .filter(mayTake)
      .sort((a, b) => dist(tileCenter(a), from) - dist(tileCenter(b), from) || a[1] - b[1] || a[0] - b[0])
      .slice(0, n);
    for (const t of got) owner[tileKey(t)] = id;
    return got;
  };
  const tiles: Record<string, Tile[]> = {};
  for (const r of order) {
    tiles[r.id] = claim(r.id, r, wanted.get(r.id)!, nearTiles(r, wanted.get(r.id)!), (t) => !owner[tileKey(t)]);
    r.radius = radiusOf(tiles[r.id].length);
  }
  for (const top of tops) {
    const R = top.radius!;
    const areas = world.regions.filter((x) => x.parent === top.id).sort((a, b) => areaTiles(b) - areaTiles(a) || a.id.localeCompare(b.id));
    for (const a of areas) {
      const at = a.pos ? { x: top.x + a.pos[0] * R * 0.8, y: top.y + a.pos[1] * R * 0.8 } : { x: top.x, y: top.y };
      tiles[a.id] = claim(a.id, at, areaTiles(a), tiles[top.id], (t) => owner[tileKey(t)] === top.id);
      a.radius = radiusOf(tiles[a.id].length);
    }
    tiles[top.id] = tiles[top.id].filter((t) => owner[tileKey(t)] === top.id);
  }
  // The seas: the water no land holds, as much as the lore gives each (`map.tiles`), the water
  // nearest each; the rest is the open sea, no one's.
  const seas = world.regions.filter(isSea);
  const pairs = seas
    .flatMap((r) => nearTiles(r, (2 * SEA_REACH) ** 2).filter((t) => !owner[tileKey(t)]).map((t) => ({ r, t, d: dist(tileCenter(t), r) })))
    .sort((a, b) => a.d - b.d || a.r.id.localeCompare(b.r.id));
  for (const r of seas) tiles[r.id] = [];
  for (const { r, t } of pairs) {
    if (owner[tileKey(t)] || tiles[r.id].length >= (r.tileCount ?? SEA_TILES)) continue;
    owner[tileKey(t)] = r.id;
    tiles[r.id].push(t);
  }
  for (const r of seas) r.radius = radiusOf(Math.max(1, tiles[r.id].length));
  // A wandering place: one tile of its own, where it starts.
  for (const r of world.regions.filter((x) => x.wanders)) {
    tiles[r.id] = [tileAt(r.x, r.y)];
    r.radius = radiusOf(1);
  }
  world.tiles = tiles;
  world.tileOwner = owner;
}

// Tiles around a point, enough to hold `n` and then some.
function nearTiles(p: { x: number; y: number }, n: number): Tile[] {
  const span = Math.ceil(Math.sqrt(n)) + 3;
  const [c0, r0] = tileAt(p.x, p.y);
  const out: Tile[] = [];
  for (let c = c0 - span; c <= c0 + span; c++) for (let r = r0 - span; r <= r0 + span; r++) if (c >= 0 && r >= 0) out.push([c, r]);
  return out;
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function tilesOf(world: World, regionId: string): Tile[] {
  return world.tiles?.[regionId] ?? [];
}

// The middle of a land's tiles (where its name goes, and where one lands when nothing says).
export function centroid(world: World, regionId: string) {
  const ts = tilesOf(world, regionId);
  if (!ts.length) return undefined;
  return { x: ts.reduce((s, t) => s + tileCenter(t).x, 0) / ts.length, y: ts.reduce((s, t) => s + tileCenter(t).y, 0) / ts.length };
}

// The tile of `regionId` nearest a point (its middle one, with no point).
export function nearestTile(world: World, regionId: string, p?: { x: number; y: number }): Tile | undefined {
  const ts = tilesOf(world, regionId);
  const at = p ?? centroid(world, regionId);
  if (!ts.length || !at) return undefined;
  return [...ts].sort((a, b) => dist(tileCenter(a), at) - dist(tileCenter(b), at) || a[1] - b[1] || a[0] - b[0])[0];
}

export function ownsTile(world: World, regionId: string, t: Tile | undefined) {
  return !!t && tilesOf(world, regionId).some((x) => sameTile(x, t));
}

// A tile picked for something that stays put in a land (a trap, a relic), from its id: always
// the same one.
export function fixedTile(world: World, regionId: string, id: string): Tile | undefined {
  const ts = tilesOf(world, regionId);
  if (!ts.length) return undefined;
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return ts[h % ts.length];
}

// "온두 북동쪽 (41,36)": the land, the way from its middle, and the tile.
const WAYS = ['동', '남동', '남', '남서', '서', '북서', '북', '북동'];
export function tileLabel(world: World, regionId: string, t: Tile) {
  const r = world.regions.find((x) => x.id === regionId);
  const mid = centroid(world, regionId);
  const name = r?.name ?? regionId;
  if (!mid || tilesOf(world, regionId).length === 1) return name;
  const c = tileCenter(t);
  const [dx, dy] = [c.x - mid.x, c.y - mid.y];
  const way = Math.hypot(dx, dy) < TILE * 0.75 ? '한가운데' : `${WAYS[Math.round((Math.atan2(dy, dx) / (Math.PI / 4) + 8)) % 8]}쪽`;
  return `${name} ${way} (${t[0]},${t[1]})`;
}
