// The static world the simulation runs on, built from world/entities (see world/README.md).
// Game data lives in each entity's frontmatter: `map` on locations, `sim` on characters and
// events. This module is pure so the web UI can share the types; sim/load.ts reads the files.
import { z } from 'zod';
import { parseTimeOfDay } from './clock.ts';
import { TRAVEL_UNITS_PER_HOUR } from './rules.ts';
import { LIFE_KINDS } from './types.ts';
import type { ScheduleBlock } from './types.ts';

export const MAP_WIDTH = 96;
export const MAP_HEIGHT = 72;

export const ABILITIES = ['fly'] as const;
export type Ability = (typeof ABILITIES)[number];
export const ABILITY_LABELS: Record<Ability, string> = { fly: '비행' };

export const TERRAIN_IDS = [
  'grassland',
  'forest',
  'rocky',
  'beach',
  'settlement',
  'sky',
  'volcanic',
  'deepsea',
] as const;
export type Terrain = (typeof TERRAIN_IDS)[number];
type TerrainInfo = {
  label: string;
  color: string;
  // Sea regions are drawn on the map but nobody stays in them.
  sea?: boolean;
  // Needed to get in or out (no ships, bridges or lifts yet).
  requires?: Ability;
};
export const TERRAINS: Record<Terrain, TerrainInfo> = {
  grassland: { label: '초원', color: '#8fb35a' },
  forest: { label: '숲', color: '#3f7a3a' },
  rocky: { label: '바위 지대', color: '#8a8173' },
  beach: { label: '해변', color: '#d9c38a' },
  settlement: { label: '정착지', color: '#b08850' },
  sky: { label: '공중섬', color: '#b9c8ea', requires: 'fly' },
  volcanic: { label: '화산 지대', color: '#b5462c' },
  deepsea: { label: '심해', color: '#1d3b66', sea: true },
};

// --- frontmatter schemas ---------------------------------------------------------------

export const MapSchema = z.strictObject({
  x: z.number().min(0).max(MAP_WIDTH - 1),
  y: z.number().min(0).max(MAP_HEIGHT - 1),
  terrain: z.enum(TERRAIN_IDS),
});

const Hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$|^24:00$/, 'HH:MM');
// [start, end, region, kind, activity, emoji]
const RoutineRow = z.tuple([
  Hhmm,
  Hhmm,
  z.string(),
  z.enum(LIFE_KINDS),
  z.string().min(1),
  z.string().min(1),
]);

export const CharacterSimSchema = z.strictObject({
  role: z.string().min(1),
  home: z.string(),
  persona: z.string().min(1),
  goal: z.string().min(1),
  abilities: z.array(z.enum(ABILITIES)).default([]),
  routine: z.array(RoutineRow).min(1),
});

const EffectSchema = z.discriminatedUnion('type', [
  // Stat change for everyone present in the affected regions.
  z.strictObject({
    type: z.literal('stat'),
    energy: z.number().optional(),
    hunger: z.number().optional(),
    coin: z.number().optional(),
  }),
  // Up to `max` of those present can't move or act until 06:00 the next day.
  z.strictObject({
    type: z.literal('bind'),
    max: z.number().int().positive(),
    until: z.literal('next-morning'),
  }),
  // A lasting state on the affected regions.
  z.strictObject({
    type: z.literal('condition'),
    label: z.string().min(1),
    hours: z.number().positive(),
    blocks_travel: z.boolean().default(false),
  }),
]);
export type Effect = z.infer<typeof EffectSchema>;

export const EventSimSchema = z.strictObject({
  // Where it starts. Affects land regions within `range` map units of it (0 = only there).
  region: z.string(),
  range: z.number().min(0).default(0),
  // gm: the GM may raise it once a day (`chance` per day without the LLM).
  // enter: may go off each hour someone is in `region` (`chance` per hour, scaled by pace).
  trigger: z.enum(['gm', 'enter']),
  chance: z.number().min(0).max(1),
  cooldown_hours: z.number().min(0).default(0),
  // Who hears of it: those in the affected regions, or the whole world.
  scope: z.enum(['region', 'world']).default('region'),
  // Warning an hour before it fires. The careful dodge its stat effects.
  omen: z.string().optional(),
  text: z.string().min(1),
  effects: z.array(EffectSchema).min(1),
});

// --- built world -----------------------------------------------------------------------

export type Region = {
  id: string;
  name: string;
  nameEn: string;
  summary: string;
  x: number;
  y: number;
  terrain: Terrain;
};

export type NpcDef = {
  id: string;
  name: string;
  summary: string;
  role: string;
  home: string;
  persona: string;
  goal: string;
  abilities: Ability[];
  routine: ScheduleBlock[];
};

export type EventDef = {
  id: string;
  name: string;
  summary: string;
  region: string;
  range: number;
  trigger: 'gm' | 'enter';
  chance: number;
  cooldownHours: number;
  scope: 'region' | 'world';
  omen?: string;
  text: string;
  effects: Effect[];
};

// Every entity in brief, for prompts (laws, creatures, factions...).
export type Lore = { id: string; kind: string; name: string; summary: string };

export type World = {
  regions: Region[];
  npcs: NpcDef[];
  events: EventDef[];
  lore: Lore[];
};

export type RawEntity = {
  id: string;
  kind: string;
  name: string;
  name_en?: string;
  summary?: string;
  status?: string;
  map?: unknown;
  sim?: unknown;
  [key: string]: unknown;
};

function issues(error: z.ZodError) {
  return error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
}

// Builds the world from entity frontmatter. Returns every problem found instead of
// throwing so world-check can list them all.
export function buildWorld(entities: RawEntity[]): { world: World; errors: string[] } {
  const errors: string[] = [];
  const world: World = { regions: [], npcs: [], events: [], lore: [] };
  const err = (id: string, msg: string) => errors.push(`${id}: ${msg}`);

  for (const e of entities) {
    world.lore.push({ id: e.id, kind: e.kind, name: e.name, summary: e.summary ?? '' });
    if (e.map !== undefined) {
      if (e.kind !== 'location') err(e.id, 'map 은 location 에만 쓸 수 있음');
      const map = MapSchema.safeParse(e.map);
      if (!map.success) err(e.id, `map 오류: ${issues(map.error)}`);
      else
        world.regions.push({
          id: e.id,
          name: e.name,
          nameEn: e.name_en ?? '',
          summary: e.summary ?? '',
          ...map.data,
        });
    }
  }

  for (const e of entities) {
    if (e.sim === undefined) continue;
    if (e.kind === 'character') {
      const sim = CharacterSimSchema.safeParse(e.sim);
      if (!sim.success) {
        err(e.id, `sim 오류: ${issues(sim.error)}`);
        continue;
      }
      const { routine, ...rest } = sim.data;
      world.npcs.push({
        id: e.id,
        name: e.name,
        summary: e.summary ?? '',
        ...rest,
        routine: routine.map(([start, end, regionId, kind, activity, emoji]) => ({
          start: parseTimeOfDay(start),
          end: parseTimeOfDay(end),
          regionId,
          kind,
          activity,
          emoji,
        })),
      });
    } else if (e.kind === 'event') {
      const sim = EventSimSchema.safeParse(e.sim);
      if (!sim.success) {
        err(e.id, `sim 오류: ${issues(sim.error)}`);
        continue;
      }
      const { cooldown_hours, effects, ...rest } = sim.data;
      world.events.push({
        id: e.id,
        name: e.name,
        summary: e.summary ?? '',
        ...rest,
        cooldownHours: cooldown_hours,
        effects,
      });
    } else {
      err(e.id, `sim 은 character, event 에만 쓸 수 있음 (${e.kind})`);
    }
  }

  // References into the map.
  const regionOk = (owner: string, id: string, what: string) => {
    const r = world.regions.find((x) => x.id === id);
    if (!r) err(owner, `${what} ${id} 가 맵에 없음 (location 에 map 필요)`);
    return r;
  };
  for (const npc of world.npcs) {
    for (const id of new Set([npc.home, ...npc.routine.map((b) => b.regionId)])) {
      const r = regionOk(npc.id, id, 'sim 의 지역');
      if (r && !canStay(r, npc.abilities)) err(npc.id, `${id} 에 머물 수 없음 (${TERRAINS[r.terrain].label})`);
    }
    const blocks = [...npc.routine].sort((a, b) => a.start - b.start);
    if (blocks[0].start !== 0 || blocks.at(-1)!.end !== 1440 || blocks.some((b, i) => b.start >= b.end || (i > 0 && blocks[i - 1].end !== b.start)))
      err(npc.id, 'sim.routine 은 00:00 부터 24:00 까지 빈틈 없이 이어져야 함');
  }
  for (const ev of world.events) regionOk(ev.id, ev.region, 'sim.region');

  return { world, errors };
}

// --- geometry and access -----------------------------------------------------------------

export function region(world: World, id: string) {
  const r = world.regions.find((x) => x.id === id);
  if (!r) throw new Error(`Unknown region ${id}`);
  return r;
}

export function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function travelHours(a: Region, b: Region) {
  return Math.max(1, Math.ceil(distance(a, b) / TRAVEL_UNITS_PER_HOUR));
}

// Whether someone with these abilities can be in a region at all.
export function canStay(r: Region, abilities: readonly Ability[]) {
  const t = TERRAINS[r.terrain];
  return !t.sea && (!t.requires || abilities.includes(t.requires));
}

// Land regions an event reaches.
export function affectedRegions(world: World, ev: EventDef) {
  const origin = region(world, ev.region);
  return world.regions.filter((r) => !TERRAINS[r.terrain].sea && distance(origin, r) <= ev.range);
}
