// Map v2 (world-v2/, user decision 2026-10-03): the lands are painted on the grid instead of
// laid out around a point (sim/tiles.ts `layTiles`). A grid file holds one character per tile;
// its legend says whose tile each character is. Layers are painted in order: the first covers
// the whole map ('.' = the open sea, no one's), each later one paints a land's areas over its
// tiles ('.' = left as it is). The world is then built as v1 builds it, with the painted tiles
// in place of the laid-out ones. Pure: the files are read by sim/load-v2.ts.
//
// Positions in messages: a grid file's line and character (1-based, as an editor counts), and
// a tile as 칸 column,row (0-based, as the map counts: the character's place in world.txt).
import { buildWorld, MAP_HEIGHT, MAP_WIDTH } from './world.ts';
import type { RawEntity, World } from './world.ts';
import { CONTINENT_MIN, LAND_MIN, radiusOf, TILE, tileAt, tileCenter, tileKey } from './tiles.ts';
import type { Tile } from './tiles.ts';

export const GRID_COLS = MAP_WIDTH / TILE;
export const GRID_ROWS = MAP_HEIGHT / TILE;
// Not painted: the open sea on the first layer, left as it is on a later one.
export const BLANK = '.';

export type GridLayer = {
  // The file it came from, for messages.
  name: string;
  text: string;
  // Where the layer's first character lies on the map: [column, row] (a later layer may cover
  // a part of it).
  origin?: Tile;
  legend: Record<string, string>;
};

// One character painted: whose the tile became, and whose it was just before.
export type Paint = { id: string; tile: Tile; prev: string | null; layer: string };

export type Footprint = {
  tiles: Record<string, Tile[]>;
  owner: Record<string, string>;
  // Every paint in order (to check an area lies on its land, even where a later paint covers it).
  paints: Paint[];
  errors: string[];
};

const tileText = (t: Tile) => `칸 ${t[0]},${t[1]}`;

export function paintLayers(layers: GridLayer[], cols = GRID_COLS, rows = GRID_ROWS): Footprint {
  const owner: Record<string, string> = {};
  const paints: Paint[] = [];
  const errors: string[] = [];
  layers.forEach((layer, i) => {
    const lines = layer.text.replace(/\n+$/, '').split('\n');
    const [c0, r0] = layer.origin ?? [0, 0];
    if (i === 0 && (c0 || r0)) errors.push(`${layer.name}: 첫 겹은 지도 전체여야 함 (origin 없이)`);
    if (i === 0 && lines.length !== rows) errors.push(`${layer.name}: ${lines.length}줄 (지도는 ${rows}줄)`);
    lines.forEach((line, r) => {
      if (i === 0 && line.length !== cols) errors.push(`${layer.name} ${r + 1}줄: ${line.length}글자 (지도는 ${cols}칸)`);
      [...line].forEach((ch, c) => {
        if (ch === BLANK || ch === ' ') return;
        const id = layer.legend[ch];
        const t: Tile = [c0 + c, r0 + r];
        const at = `${layer.name} ${r + 1}줄 ${c + 1}째 글자`;
        if (!id) return void errors.push(`${at}: 범례에 없는 글자 '${ch}'`);
        if (t[0] < 0 || t[1] < 0 || t[0] >= cols || t[1] >= rows) return void errors.push(`${at}: 지도 밖 (${tileText(t)})`);
        const k = tileKey(t);
        paints.push({ id, tile: t, prev: owner[k] ?? null, layer: layer.name });
        owner[k] = id;
      });
    });
  });
  return { tiles: tilesByOwner(owner, cols, rows), owner, paints, errors };
}

function tilesByOwner(owner: Record<string, string>, cols = GRID_COLS, rows = GRID_ROWS) {
  const tiles: Record<string, Tile[]> = {};
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const id = owner[tileKey([c, r])];
      if (id) (tiles[id] ??= []).push([c, r]);
    }
  }
  return tiles;
}

function middle(ts: Tile[]) {
  const ps = ts.map(tileCenter);
  return { x: ps.reduce((s, p) => s + p.x, 0) / ps.length, y: ps.reduce((s, p) => s + p.y, 0) / ps.length };
}

// A land's areas, theirs, and so on down; safe on a `map.in` loop (buildWorld reports it).
function subtree(world: World, id: string, seen = new Set<string>([id])): string[] {
  return world.regions
    .filter((r) => r.parent === id && !seen.has(r.id))
    .flatMap((r) => {
      seen.add(r.id);
      return [r.id, ...subtree(world, r.id, seen)];
    });
}

// The world from v2's entities and painted tiles. A land at the top takes its place (`map.x/y`,
// which v2 files leave out) from the middle of its tiles and its areas'. A wandering place
// (`sim.wanders`, Goma Fada) is not painted: it keeps the place its file gives and one tile of its
// own there, as in v1. `drafts`: ids of v2 places not yet canon, for a clearer message when one is
// painted.
export function buildWorldV2(entities: RawEntity[], fp: Footprint, drafts: Set<string> = new Set()): { world: World; errors: string[] } {
  const errors = [...fp.errors];
  const parentOf = new Map<string, string>();
  const wanderers = new Set<string>();
  for (const e of entities) {
    const m = e.map as { in?: unknown } | undefined;
    if (m && typeof m.in === 'string') parentOf.set(e.id, m.in);
    if ((e.sim as { wanders?: unknown } | undefined)?.wanders) wanderers.add(e.id);
  }
  const topOf = (id: string) => {
    let x = id;
    for (let i = 0; parentOf.has(x) && i < 8; i++) x = parentOf.get(x)!;
    return x;
  };
  const placed = entities.map((e) => {
    const m = e.map as Record<string, unknown> | undefined;
    if (!m || typeof m !== 'object' || 'in' in m || wanderers.has(e.id)) return e;
    const ts = Object.entries(fp.tiles).filter(([id]) => topOf(id) === e.id).flatMap(([, t]) => t);
    const at = ts.length ? middle(ts) : { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 };
    return { ...e, map: { ...m, x: at.x, y: at.y } };
  });
  const built = buildWorld(placed);
  const world = built.world;
  errors.push(...built.errors);

  // Only lands of this world own tiles: a paint of anything else is reported and leaves the tile
  // to whoever held it before.
  const lands = new Set(world.regions.filter((r) => !r.wanders).map((r) => r.id));
  const bad = new Set(fp.paints.map((p) => p.id).filter((id) => !lands.has(id)));
  for (const id of bad) {
    if (wanderers.has(id)) errors.push(`${id}: 걸어 다니는 곳은 칠하지 않는다 (자리는 map.x, map.y)`);
    else if (drafts.has(id)) errors.push(`${id}: 칠해져 있지만 status 가 draft 라 지도에 없음 (canon 이어야 함)`);
    else errors.push(`${id}: 범례에 있지만 지역이 아님 (canon 이고 map 이 있는 location 이어야 함)`);
  }
  const owner: Record<string, string> = {};
  for (const p of fp.paints) if (lands.has(p.id)) owner[tileKey(p.tile)] = p.id;
  const tiles = tilesByOwner(owner);
  world.tiles = Object.fromEntries(world.regions.map((r) => [r.id, r.wanders ? [tileAt(r.x, r.y)] : (tiles[r.id] ?? [])]));
  world.tileOwner = owner;

  // An area is painted over its own land's tiles, on a layer after that land's: every paint of it
  // (even one a later paint covered), not counting it painted again over itself.
  const strays = new Map<string, Paint[]>();
  for (const p of fp.paints) {
    const parent = lands.has(p.id) ? parentOf.get(p.id) : undefined;
    if (parent && p.prev !== p.id && p.prev !== parent) strays.set(p.id, [...(strays.get(p.id) ?? []), p]);
  }
  for (const [id, ps] of strays) {
    errors.push(`${id}: ${ps.length}번을 바깥 땅(${parentOf.get(id)}) 위가 아닌 곳에 칠함 (예: ${tileText(ps[0].tile)}, ${ps[0].layer}). 구역은 바깥 땅을 칠한 겹보다 뒤 겹에, 바깥 땅의 칸 위에 칠한다`);
  }
  for (const r of world.regions) {
    if (r.wanders) continue;
    const below = subtree(world, r.id);
    const n = world.tiles[r.id].length + (r.parent ? 0 : below.reduce((m, d) => m + world.tiles![d].length, 0));
    if (!world.tiles[r.id].length && !below.some((d) => world.tiles![d].length)) errors.push(`${r.id}: 지도에 칸이 없음`);
    r.radius = radiusOf(Math.max(1, n));
  }
  return { world, errors };
}

// A place (장소, `place: true`, user decision 2026-10-03): a town, temple, ruin or landmark inside
// a region, not a land, 1 to this many tiles. A region (지역) is a land of 10 tiles or more.
export const PLACE_MAX = 4;

// Lands of the wrong size for their kind (user decisions 2026-10-01, 2026-10-03): a continent 100
// tiles with its areas, any other land 10, a place 1 to PLACE_MAX. A sea holds water and a
// wandering place one tile of its own, whatever their size.
export function sizeProblems(world: World, places: Set<string>): string[] {
  const out: string[] = [];
  for (const r of world.regions) {
    if (r.wanders || (r.terrain === 'deepsea' && !r.parent)) continue;
    const n = [r.id, ...subtree(world, r.id)].reduce((m, id) => m + (world.tiles?.[id]?.length ?? 0), 0);
    if (places.has(r.id)) {
      if (n < 1 || n > PLACE_MAX) out.push(`${r.id}: 장소인데 칸 ${n}개 (1~${PLACE_MAX})`);
    } else {
      const least = r.size === 'continent' ? CONTINENT_MIN : LAND_MIN;
      if (n < least) out.push(`${r.id}: 칸 ${n}개 (최소 ${least})`);
    }
  }
  return out;
}

// What the v2 page shows besides the world: each place's level design and lore notes, and the
// fan map pieces laid over it for comparison (world-v2/map/reference.yaml).
export type Design = { role?: string; danger?: number; note?: string };
export type V2Note = { design?: Design; tags: string[]; body: string; place?: boolean };
// A piece of the reference image: the outline of it to show (image px) and where it lies on the
// map (an SVG matrix from image px to map units).
export type ReferencePiece = { clip: [number, number][]; matrix: [number, number, number, number, number, number] };
export type Reference = { image: string; size: [number, number]; pieces: Record<string, ReferencePiece> };
export type WorldV2View = { world: World; errors: string[]; notes: Record<string, V2Note>; reference: (Reference & { available: boolean }) | null };

// Where a painted land's name goes: the tile deepest inside it and its areas (farthest from any
// tile that isn't theirs), the one nearest its middle among the deepest. A concave land (a
// crescent around a bay) keeps its name on its own ground.
export function labelTile(world: World, id: string): Tile | undefined {
  return labelSpot(world, id)?.tile;
}

// Where a land's name goes: on the row where the land runs longest (weighted towards its inside,
// so a thin ring or a river gorge writes its name where it runs longest), centred on that run.
// `tile` is the chosen tile, `run` how many of the land's tiles run across that row through it,
// `x` the middle of the run (in tiles, the name's centre).
export function labelSpot(world: World, id: string): { tile: Tile; run: number; x: number } | undefined {
  const mine = new Set([id, ...subtree(world, id)]);
  const ts = [...mine].flatMap((x) => world.tiles?.[x] ?? []);
  if (!ts.length) return undefined;
  const own = new Set(ts.map(tileKey));
  const depth = new Map<string, number>();
  let edge = ts.filter((t) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) => !own.has(tileKey([t[0] + dc, t[1] + dr]))));
  for (const t of edge) depth.set(tileKey(t), 1);
  for (let d = 2; edge.length; d++) {
    const next: Tile[] = [];
    for (const t of edge) {
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n: Tile = [t[0] + dc, t[1] + dr];
        const k = tileKey(n);
        if (own.has(k) && !depth.has(k)) {
          depth.set(k, d);
          next.push(n);
        }
      }
    }
    edge = next;
  }
  const mid = middle(ts);
  const runOf = (t: Tile) => {
    let n = 1;
    for (let c = t[0] - 1; own.has(tileKey([c, t[1]])); c--) n++;
    for (let c = t[0] + 1; own.has(tileKey([c, t[1]])); c++) n++;
    return n;
  };
  // A run counts from its middle: a name sits centred on its tile.
  const room = (t: Tile) => {
    let l = 0, r = 0;
    while (own.has(tileKey([t[0] - l - 1, t[1]]))) l++;
    while (own.has(tileKey([t[0] + r + 1, t[1]]))) r++;
    return 1 + 2 * Math.min(l, r);
  };
  const score = (t: Tile) => room(t) * (1 + 0.15 * (depth.get(tileKey(t)) ?? 1));
  const away = (t: Tile) => Math.hypot(tileCenter(t).x - mid.x, tileCenter(t).y - mid.y);
  const tile = [...ts].sort((a, b) => score(b) - score(a) || away(a) - away(b) || a[1] - b[1] || a[0] - b[0])[0];
  let c0 = tile[0];
  let c1 = tile[0];
  while (own.has(tileKey([c0 - 1, tile[1]]))) c0--;
  while (own.has(tileKey([c1 + 1, tile[1]]))) c1++;
  return { tile, run: runOf(tile), x: (c0 + c1 + 1) / 2 };
}
