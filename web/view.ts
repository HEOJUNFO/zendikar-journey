// What the viewer gets to see: everything for the observer (and on the world page, `all`),
// only what the character witnessed (and who stands next to them) in character mode.
import { formatClock } from '../sim/clock.ts';
import { player } from '../sim/state.ts';
import type { Actor, State } from '../sim/state.ts';
import { MAP_HEIGHT, MAP_WIDTH, TERRAINS } from '../sim/world.ts';
import { centroid, TILE, tilesOf } from '../sim/tiles.ts';
import type { EventDef, Region, World } from '../sim/world.ts';
import type { Color } from '../sim/mana.ts';

export function visibleActors(state: State, all = false): Actor[] {
  const alive = Object.values(state.actors).filter((a) => !a.dead || a.kind === 'player');
  const p = player(state);
  if (!p || all) return alive;
  return alive.filter((a) => a.id === p.id || (!p.travel && !a.travel && a.region === p.region));
}

export function visibleLog(state: State, all = false) {
  return all ? state.log : state.log.filter((e) => e.seen);
}

export function clock(state: State) {
  return formatClock(state.minutes);
}

// Lands are drawn in the color of their mana (MTG's five), not their terrain: white cream,
// blue, black, red, green, and grey for a land that gives none or only colorless. A land that
// gives one of two colors is drawn split between them. The sea keeps its own color.
export const MANA_COLORS: Record<Color | 'C', string> = {
  W: '#efe4c2',
  U: '#3f7fcf',
  B: '#2b2233',
  R: '#cc4f34',
  G: '#3f9447',
  C: '#9a958b',
};
export function landColors(r: Region): string[] {
  // A sea region is drawn as sea; a sea that is an area of a land (a bay: Sunder Bay) is a land
  // among its region's areas, colored by its mana like the rest.
  if (TERRAINS[r.terrain].sea && !r.parent) return [TERRAINS[r.terrain].color];
  if (r.noMana || !r.color) return [MANA_COLORS.C];
  return r.color.split('/').map((c) => MANA_COLORS[c as Color]);
}
// A CSS background for a small swatch of the land's colors.
export function landSwatch(r: Region) {
  const [a, b] = landColors(r);
  return b ? `linear-gradient(90deg, ${a} 50%, ${b} 50%)` : a;
}
// The left and right halves of a circle, for a two-color land.
export function halfCircle(x: number, y: number, r: number, side: 0 | 1) {
  return `M${x} ${y - r}A${r} ${r} 0 0 ${side} ${x} ${y + r}Z`;
}

// The map is drawn in tiles (sim/tiles.ts): each land's tiles filled in the colors of its mana,
// an area's inside its region's. A wandering place (Goma Fada) holds no tiles of the grid: it is
// drawn as a round mark where it walks.
export const PLAIN_NODE = 12;

// Every tile to draw: its land, and its square.
export function tileRects(world: World) {
  return world.regions
    .filter((r) => !r.wanders)
    .flatMap((r) => tilesOf(world, r.id).map((t) => ({ region: r, tile: t, x: t[0] * TILE, y: t[1] * TILE, size: TILE })));
}

// Where a land sits on the map: the middle of its own tiles (a wandering place: where it is).
export function nodeAt(world: World, r: Region) {
  if (r.wanders) return { x: r.x, y: r.y };
  return centroid(world, r.id) ?? { x: r.x, y: r.y };
}

// The tiles of a region with its areas.
function blobTiles(world: World, r: Region) {
  return [r, ...world.regions.filter((x) => x.parent === r.id)].flatMap((x) => tilesOf(world, x.id));
}

// The box around a region's tiles (its areas' too).
export function landBox(world: World, r: Region) {
  const ts = r.wanders ? [] : blobTiles(world, r);
  if (!ts.length) return { x0: r.x - PLAIN_NODE, y0: r.y - PLAIN_NODE, x1: r.x + PLAIN_NODE, y1: r.y + PLAIN_NODE };
  return {
    x0: Math.min(...ts.map((t) => t[0])) * TILE,
    y0: Math.min(...ts.map((t) => t[1])) * TILE,
    x1: (Math.max(...ts.map((t) => t[0])) + 1) * TILE,
    y1: (Math.max(...ts.map((t) => t[1])) + 1) * TILE,
  };
}

// How large a region is drawn (its tiles as a circle), for the shallow water under it.
export function containerRadius(world: World, r: Region) {
  return r.parent ? 0 : (r.radius ?? 0);
}

// A region's name: above its tiles, except for an island of a continent that lies below it,
// whose name goes under its own tiles (it would lie over the continent otherwise).
export function regionLabelAt(world: World, r: Region) {
  const b = landBox(world, r);
  const c = r.of ? world.regions.find((x) => x.id === r.of) : undefined;
  const below = !!c && r.y > c.y + TILE;
  return { x: (b.x0 + b.x1) / 2, y: below ? b.y1 + 6.5 : b.y0 - 2.5, anchor: 'middle', side: below ? 'below' : 'above' } as const;
}

// An area's name: in the middle of its tiles.
export function areaLabelAt(world: World, r: Region) {
  const n = nodeAt(world, r);
  return { x: n.x, y: n.y + 1.5, anchor: 'middle' } as const;
}

// Shallow water around a continent and the islands that belong to it (`map.of`), joining them
// so the islands read as the continent's: a wider circle under each, and a band to each island.
const SHELF = 10;
export function shelves(world: World) {
  return world.regions
    .filter((c) => world.regions.some((i) => i.of === c.id))
    .map((c) => {
      const islands = world.regions.filter((i) => i.of === c.id);
      return {
        id: c.id,
        circles: [c, ...islands].map((r) => ({ x: r.x, y: r.y, r: containerRadius(world, r) + SHELF })),
        bands: islands.map((i) => ({ x1: c.x, y1: c.y, x2: i.x, y2: i.y, width: 2 * (containerRadius(world, i) + SHELF) })),
      };
    });
}

// The part of the map a view shows, in map units.
export type MapBox = { x: number; y: number; w: number; h: number };

// Room for the names around the outermost lands (more on top, where the full-screen map's bar sits).
const FIT_PAD = { x: 24, top: 24, bottom: 20 };
const FIT_MIN_W = 384;

// The box that holds every land (with their names), widened to the map's shape so the map
// opens on the lands rather than on the empty sea around them.
export function fitView(world: World): MapBox {
  const tops = world.regions.filter((r) => !r.parent);
  if (!tops.length) return { x: 0, y: 0, w: MAP_WIDTH, h: MAP_HEIGHT };
  const boxes = tops.map((r) => landBox(world, r));
  const x0 = Math.min(...boxes.map((b) => b.x0)) - FIT_PAD.x;
  const x1 = Math.max(...boxes.map((b) => b.x1)) + FIT_PAD.x;
  const y0 = Math.min(...boxes.map((b) => b.y0)) - FIT_PAD.top;
  const y1 = Math.max(...boxes.map((b) => b.y1)) + FIT_PAD.bottom;
  const aspect = MAP_WIDTH / MAP_HEIGHT;
  const w = Math.min(MAP_WIDTH, Math.max(FIT_MIN_W, x1 - x0, (y1 - y0) * aspect));
  const h = w / aspect;
  const clamp = (v: number, size: number, max: number) => Math.min(Math.max(v, 0), Math.max(0, max - size));
  return { x: clamp((x0 + x1 - w) / 2, w, MAP_WIDTH), y: clamp((y0 + y1 - h) / 2, h, MAP_HEIGHT), w, h };
}

// Traps: events the land sets off by itself when someone comes (law-ruin-traps), unlike
// the events the morning LLM raises.
export function isTrap(ev: EventDef) {
  return ev.trigger !== 'gm';
}

export type TrapStatus = { kind: 'armed' } | { kind: 'omen'; at: number } | { kind: 'cooldown'; until: number };

// Whether a trap would answer now: waiting, about to go off (omened), or spent for a while.
export function trapStatus(state: State | null, ev: EventDef): TrapStatus {
  const t = state?.minutes ?? 0;
  const pending = state?.pending.find((p) => p.eventId === ev.id);
  if (pending) return { kind: 'omen', at: pending.at };
  const last = state?.events[ev.id]?.lastFired;
  if (last !== undefined && t - last < ev.cooldownHours * 60) return { kind: 'cooldown', until: last + ev.cooldownHours * 60 };
  return { kind: 'armed' };
}
