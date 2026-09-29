// The static world the simulation runs on, built from world/entities (see world/README.md).
// Game data lives in each entity's frontmatter: `map` on locations, `sim` on characters and
// events. This module is pure so the web UI can share the types; sim/load.ts reads the files.
import { z } from 'zod';
import { parseTimeOfDay } from './clock.ts';
import { TRAVEL_UNITS_PER_HOUR } from './rules.ts';
import { COLORS, parseManaCost } from './mana.ts';
import type { Color, Mana, ManaCost } from './mana.ts';
import { LIFE_KINDS, NEEDS } from './types.ts';
import type { Need, ScheduleBlock } from './types.ts';

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
  'swamp',
  'deepsea',
] as const;
export type Terrain = (typeof TERRAIN_IDS)[number];
type TerrainInfo = {
  label: string;
  color: string;
  // The land's mana color when its location doesn't say (null = colorless).
  mana: Color | null;
  // Sea regions are drawn on the map but nobody stays in them.
  sea?: boolean;
  // Needed to get in or out (no ships, bridges or lifts yet).
  requires?: Ability;
};
export const TERRAINS: Record<Terrain, TerrainInfo> = {
  grassland: { label: '초원', color: '#8fb35a', mana: 'W' },
  forest: { label: '숲', color: '#3f7a3a', mana: 'G' },
  rocky: { label: '바위 지대', color: '#8a8173', mana: 'R' },
  beach: { label: '해변', color: '#d9c38a', mana: 'U' },
  settlement: { label: '정착지', color: '#b08850', mana: null },
  sky: { label: '공중섬', color: '#b9c8ea', mana: 'W', requires: 'fly' },
  volcanic: { label: '화산 지대', color: '#b5462c', mana: 'R' },
  swamp: { label: '늪', color: '#4f4a5e', mana: 'B' },
  deepsea: { label: '심해', color: '#1d3b66', mana: 'U', sea: true },
};

// --- frontmatter schemas ---------------------------------------------------------------

// Mana color of a land (C = colorless). Default: from the terrain.
const LandColor = z.enum([...COLORS, 'C']).optional();

export const MapSchema = z.union([
  // A region: a node on the map.
  z.strictObject({
    x: z.number().min(0).max(MAP_WIDTH - 1),
    y: z.number().min(0).max(MAP_HEIGHT - 1),
    terrain: z.enum(TERRAIN_IDS),
    color: LandColor,
  }),
  // An area inside a region: a land of its own at the region's place.
  z.strictObject({
    in: z.string(),
    terrain: z.enum(TERRAIN_IDS),
    color: LandColor,
  }),
]);

// Mana a being holds, from its card: { B: 7 } for {5}{B}{B}.
const ManaSchema = z.partialRecord(z.enum(COLORS), z.number().int().min(1));
const CostSchema = z.string().refine((s) => parseManaCost(s) !== null, '마나 비용 형식: "{5}{B}{B}"');

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

// Power / toughness, as on the card. Combat damage piles up against toughness until the turn
// ends; reaching it is death.
const PtSchema = z.tuple([z.number().int().min(0), z.number().int().min(1)]);
export type Pt = z.infer<typeof PtSchema>;

export const CharacterSimSchema = z.strictObject({
  pt: PtSchema,
  mana: ManaSchema.optional(),
  role: z.string().min(1),
  home: z.string(),
  persona: z.string().min(1),
  goal: z.string().min(1),
  abilities: z.array(z.enum(ABILITIES)).default([]),
  // Stats this being lives by (default: all). Without hunger they never eat; without coin
  // work earns nothing.
  needs: z.array(z.enum(NEEDS)).min(1).default([...NEEDS]),
  // A beast: doesn't talk, hunts whoever stands with it when hungry, hunts a land out, and
  // holds only the hunting ground it last bonded with.
  beast: z.boolean().default(false),
  // Landfall: when they bond with a land, they get +P/+T (and trample) until the turn ends.
  landfall: z.strictObject({ pt: z.tuple([z.number().int(), z.number().int()]), trample: z.boolean().default(false) }).optional(),
  // The creature kind a character is (e.g. cre-vampire). A creature entity's sim is its own kind.
  creature: z.string().optional(),
  routine: z.array(RoutineRow).min(1),
});

// A character who doesn't live a routine but acts through GM events and abilities (e.g.
// Lorthos). They stay at home, where others can meet them.
export const GmBeingSimSchema = z.strictObject({
  gm: z.literal(true),
  home: z.string(),
  pt: PtSchema,
  mana: ManaSchema.optional(),
  abilities: z.array(z.enum(ABILITIES)).default([]),
  // Abilities the GM may use for them ("{cost}, {T}: effect"), on any living character.
  activated: z
    .array(
      z.strictObject({
        id: z.string().min(1),
        name: z.string().min(1),
        cost: CostSchema,
        tap: z.boolean().default(false),
        effects: z
          .array(
            z.discriminatedUnion('type', [
              // The target dies, whatever its toughness.
              z.strictObject({ type: z.literal('destroy') }),
              // If the target died this way, it rises as a new character of this creature kind,
              // with its power/toughness, in this faction, as the being's retainer.
              z.strictObject({ type: z.literal('raise'), creature: z.string(), faction: z.string().optional() }),
            ]),
          )
          .min(1),
      }),
    )
    .default([]),
});
export type ActivatedAbility = {
  id: string;
  name: string;
  cost: ManaCost;
  costText: string;
  tap: boolean;
  effects: ({ type: 'destroy' } | { type: 'raise'; creature: string; faction?: string })[];
};

const EffectSchema = z.discriminatedUnion('type', [
  // Damage to every creature present in the affected regions (piles up against toughness).
  z.strictObject({
    type: z.literal('damage'),
    amount: z.number().int().positive(),
  }),
  // Stat change for everyone present in the affected regions.
  z.strictObject({
    type: z.literal('stat'),
    energy: z.number().optional(),
    hunger: z.number().optional(),
    coin: z.number().optional(),
  }),
  // Tap up to `max` permanents in the affected regions: characters first (they can't move or
  // act), then the lands themselves (nothing can be explored or worked there). They untap when
  // a turn (game day) starts; with skip_untap they miss the next untap and wait for the one after.
  z.strictObject({
    type: z.literal('tap'),
    max: z.number().int().positive(),
    skip_untap: z.boolean().default(false),
    // How a tapped land shows (e.g. "조수에 잠긴 해안").
    land_label: z.string().min(1).default('묶인 땅'),
  }),
  // A lasting state on the affected regions.
  z.strictObject({
    type: z.literal('condition'),
    label: z.string().min(1),
    hours: z.number().positive(),
    blocks_travel: z.boolean().default(false),
  }),
  // Land destruction (a land is a region): the lands whoever set it off made landfall on this
  // turn, latest first, are destroyed for good — nothing can be explored or worked there until
  // some card brings them back. Landfall events only.
  z.strictObject({
    type: z.literal('destroy_lands'),
    count: z.number().int().positive(),
  }),
  // Life loss for whoever set it off (life rides on energy: sim/life.ts). Not damage, so
  // nothing dodges it. Landfall and enter events only.
  z.strictObject({
    type: z.literal('lose_life'),
    amount: z.number().int().positive(),
  }),
]);
export type Effect = z.infer<typeof EffectSchema>;

const EventBase = {
  // Where it happens. Affects land regions within `range` map units of it (0 = only there).
  region: z.string(),
  range: z.number().min(0).default(0),
  cooldown_hours: z.number().min(0).default(0),
  // Who hears of it: those in the affected regions, or the whole world.
  scope: z.enum(['region', 'world']).default('region'),
  // Warning an hour before it fires. The careful dodge its stat effects.
  omen: z.string().optional(),
  text: z.string().min(1),
  effects: z.array(EffectSchema).min(1),
};

const EventCost = {
  // Someone must pay this for the effects to happen (e.g. Lorthos pays {8} when he attacks).
  cost: z.strictObject({ by: z.string(), mana: CostSchema }).optional(),
};

// A spell someone can learn and cast (world/entities/spells).
export const SpellSimSchema = z.strictObject({
  cost: CostSchema,
  // sorcery: only when the caster is free to act; instant: any time (no difference yet).
  speed: z.enum(['sorcery', 'instant']).default('sorcery'),
  // Where it is learned, and how long that takes.
  learn_at: z.string(),
  learn_hours: z.number().int().min(1).default(4),
  // Who it can target: someone else standing in the same place, or anyone there (self too).
  target: z.enum(['other_here', 'any_here']).default('other_here'),
  // Kicker: tap an untapped creature of this kind that the caster controls, for more effect.
  kicker: z.strictObject({ tap: z.string() }).optional(),
  effects: z
    .array(
      z.discriminatedUnion('type', [
        // The target loses half their life, rounded up.
        z.strictObject({ type: z.literal('lose_half_life') }),
        // The caster gains the life lost this way (only if kicked, with if_kicked).
        z.strictObject({ type: z.literal('gain_life_lost'), if_kicked: z.boolean().default(false) }),
        // An aura: stays on the target until they die. +P/+T; with double_life_on_hit, whenever
        // they deal combat damage to someone, whoever controls them (their master, or they
        // themselves) doubles their life.
        z.strictObject({
          type: z.literal('aura'),
          pt: z.tuple([z.number().int(), z.number().int()]).default([0, 0]),
          double_life_on_hit: z.boolean().default(false),
        }),
      ]),
    )
    .min(1),
});
export type SpellEffect = z.infer<typeof SpellSimSchema>['effects'][number];

export const EventSimSchema = z.discriminatedUnion('trigger', [
  // The GM decides each morning whether it happens today. `chance` is the share of days it
  // usually happens on, a guide for the GM.
  z.strictObject({ ...EventBase, ...EventCost, trigger: z.literal('gm'), chance: z.number().min(0).max(1) }),
  // Goes off when someone makes landfall on `region` (arrives there) and it is at least their
  // `landfalls`-th landfall this turn (game day).
  z.strictObject({ ...EventBase, ...EventCost, trigger: z.literal('landfall'), landfalls: z.number().int().min(1).default(1) }),
  // Goes off when someone arrives in `region` (exactly there: an area is entered on its own).
  // With gained_life, only for those who gained life this turn (game day).
  z.strictObject({ ...EventBase, ...EventCost, trigger: z.literal('enter'), gained_life: z.boolean().default(false) }),
]);

// --- built world -----------------------------------------------------------------------

export type Region = {
  id: string;
  name: string;
  nameEn: string;
  summary: string;
  x: number;
  y: number;
  terrain: Terrain;
  // Mana color of the land (null = colorless).
  color: Color | null;
  // An area inside this region (its x, y are the region's). Areas are lands of their own:
  // people meet, bond, and get hit by events there, but an event on the region reaches them.
  parent?: string;
};

export type NpcDef = {
  id: string;
  name: string;
  summary: string;
  role: string;
  home: string;
  persona: string;
  goal: string;
  pt: Pt;
  mana?: Mana;
  abilities: Ability[];
  needs: Need[];
  beast?: boolean;
  landfall?: { pt: [number, number]; trample: boolean };
  routine: ScheduleBlock[];
  // The creature kind they are (e.g. cre-vampire), for "a Vampire you control".
  creature?: string;
};

export type SpellDef = {
  id: string;
  name: string;
  summary: string;
  cost: ManaCost;
  costText: string;
  speed: 'sorcery' | 'instant';
  target: 'other_here' | 'any_here';
  learnAt: string;
  learnHours: number;
  kicker?: { tap: string };
  effects: SpellEffect[];
};

// Who answers when spoken to.
export type Speaker = Pick<NpcDef, 'id' | 'name' | 'persona' | 'goal' | 'role'>;

export type BeingDef = {
  id: string;
  name: string;
  summary: string;
  // Where they stay (may be a sea: they belong there).
  home: string;
  pt: Pt;
  mana?: Mana;
  abilities: Ability[];
  activated: ActivatedAbility[];
};

export type EventDef = {
  id: string;
  name: string;
  summary: string;
  region: string;
  range: number;
  trigger: 'gm' | 'landfall' | 'enter';
  chance?: number; // gm
  landfalls?: number; // landfall
  gained_life?: boolean; // enter
  cooldownHours: number;
  scope: 'region' | 'world';
  omen?: string;
  text: string;
  effects: Effect[];
  cost?: { by: string; mana: ManaCost; text: string };
};

// Every entity in brief, for prompts (laws, creatures, factions...).
export type Lore = { id: string; kind: string; name: string; summary: string };

export type World = {
  regions: Region[];
  npcs: NpcDef[];
  // GM-driven characters: no routine; they stay at home on the map.
  beings: BeingDef[];
  events: EventDef[];
  spells: SpellDef[];
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
  const world: World = { regions: [], npcs: [], beings: [], events: [], spells: [], lore: [] };
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
          ...('in' in map.data ? { x: 0, y: 0, parent: map.data.in } : { x: map.data.x, y: map.data.y }),
          terrain: map.data.terrain,
          color: map.data.color === 'C' ? null : (map.data.color ?? TERRAINS[map.data.terrain].mana),
        });
    }
  }
  // Areas sit where their region is. One level only, and never at sea.
  for (const r of world.regions) {
    if (!r.parent) continue;
    const p = world.regions.find((x) => x.id === r.parent);
    if (!p) err(r.id, `map.in ${r.parent} 가 맵에 없음`);
    else if (p.parent) err(r.id, `map.in ${r.parent} 도 구역임 (구역 안에 구역은 둘 수 없음)`);
    else if (TERRAINS[p.terrain].sea || TERRAINS[r.terrain].sea) err(r.id, '바다에는 구역을 둘 수 없음');
    else Object.assign(r, { x: p.x, y: p.y });
  }

  for (const e of entities) {
    if (e.sim === undefined) continue;
    if (e.kind === 'character' && (e.sim as { gm?: unknown }).gm === true) {
      const sim = GmBeingSimSchema.safeParse(e.sim);
      if (!sim.success) err(e.id, `sim 오류: ${issues(sim.error)}`);
      else
        world.beings.push({
          id: e.id,
          name: e.name,
          summary: e.summary ?? '',
          home: sim.data.home,
          pt: sim.data.pt,
          mana: sim.data.mana,
          abilities: sim.data.abilities,
          activated: sim.data.activated.map((x) => ({ ...x, cost: parseManaCost(x.cost)!, costText: x.cost })),
        });
    } else if (e.kind === 'character' || e.kind === 'creature') {
      // A creature's sim is one of its kind, living in the world (e.g. a roaming baloth).
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
        creature: e.kind === 'creature' ? e.id : rest.creature,
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
      const { cooldown_hours, effects, cost, ...rest } = sim.data;
      if (rest.trigger !== 'landfall' && effects.some((x) => x.type === 'destroy_lands'))
        err(e.id, 'destroy_lands 는 trigger: landfall 사건에만 쓸 수 있음 (누가 상륙한 땅인지 알아야 함)');
      if (rest.trigger === 'gm' && effects.some((x) => x.type === 'lose_life'))
        err(e.id, 'lose_life 는 trigger: landfall, enter 사건에만 쓸 수 있음 (누가 일으켰는지 알아야 함)');
      world.events.push({
        id: e.id,
        name: e.name,
        summary: e.summary ?? '',
        ...rest,
        cooldownHours: cooldown_hours,
        effects,
        ...(cost ? { cost: { by: cost.by, mana: parseManaCost(cost.mana)!, text: cost.mana } } : {}),
      });
    } else if (e.kind === 'spell') {
      const sim = SpellSimSchema.safeParse(e.sim);
      if (!sim.success) {
        err(e.id, `sim 오류: ${issues(sim.error)}`);
        continue;
      }
      const d = sim.data;
      world.spells.push({
        id: e.id,
        name: e.name,
        summary: e.summary ?? '',
        cost: parseManaCost(d.cost)!,
        costText: d.cost,
        speed: d.speed,
        target: d.target,
        learnAt: d.learn_at,
        learnHours: d.learn_hours,
        kicker: d.kicker,
        effects: d.effects,
      });
    } else {
      err(e.id, `sim 은 character, creature, event, spell 에만 쓸 수 있음 (${e.kind})`);
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
    if (!npc.needs.includes('hunger') && npc.routine.some((b) => b.kind === 'eat'))
      err(npc.id, 'needs 에 hunger 가 없으면 sim.routine 에 eat 을 쓸 수 없음');
    if (npc.routine.some((b) => b.start % 60 || b.end % 60)) err(npc.id, 'sim.routine 은 정시 단위로 나눠야 함 (세계는 1시간 단위로 돈다)');
    const blocks = [...npc.routine].sort((a, b) => a.start - b.start);
    if (blocks[0].start !== 0 || blocks.at(-1)!.end !== 1440 || blocks.some((b, i) => b.start >= b.end || (i > 0 && blocks[i - 1].end !== b.start)))
      err(npc.id, 'sim.routine 은 00:00 부터 24:00 까지 빈틈 없이 이어져야 함');
  }
  for (const ev of world.events) {
    regionOk(ev.id, ev.region, 'sim.region');
    if (ev.cost && !world.beings.some((b) => b.id === ev.cost!.by) && !world.npcs.some((n) => n.id === ev.cost!.by))
      err(ev.id, `sim.cost.by ${ev.cost.by} 가 sim 을 가진 인물이 아님`);
  }
  const ids = new Set(entities.map((e) => e.id));
  for (const s of world.spells) {
    const r = regionOk(s.id, s.learnAt, 'sim.learn_at');
    if (r && TERRAINS[r.terrain].sea) err(s.id, `sim.learn_at ${s.learnAt} 은 바다라 아무도 머물 수 없음`);
    if (s.kicker && !ids.has(s.kicker.tap)) err(s.id, `sim.kicker.tap ${s.kicker.tap} 가 없음`);
  }
  for (const b of world.beings) {
    regionOk(b.id, b.home, 'sim.home');
    for (const x of b.activated)
      for (const eff of x.effects)
        if (eff.type === 'raise') {
          if (!ids.has(eff.creature)) err(b.id, `activated ${x.id}: creature ${eff.creature} 가 없음`);
          if (eff.faction && !ids.has(eff.faction)) err(b.id, `activated ${x.id}: faction ${eff.faction} 가 없음`);
        }
  }

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

// Within a region (its open ground and its areas) any move is an hour. Between regions it is
// the distance, plus an hour to get out of or into an area through its region.
export function travelHours(a: Region, b: Region) {
  const home = (r: Region) => r.parent ?? r.id;
  if (home(a) === home(b)) return 1;
  const road = Math.max(1, Math.ceil(distance(a, b) / TRAVEL_UNITS_PER_HOUR));
  return road + (a.parent ? 1 : 0) + (b.parent ? 1 : 0);
}

// Whether someone with these abilities can be in a region at all.
export function canStay(r: Region, abilities: readonly Ability[]) {
  const t = TERRAINS[r.terrain];
  return !t.sea && (!t.requires || abilities.includes(t.requires));
}

// Land regions an event reaches: those within range, with their areas. An event in an area
// with range 0 stays in that area.
export function affectedRegions(world: World, ev: EventDef) {
  const origin = region(world, ev.region);
  if (origin.parent && ev.range === 0) return [origin];
  return world.regions.filter((r) => !TERRAINS[r.terrain].sea && distance(origin, r) <= ev.range);
}

// Areas inside a region.
export function areasOf(world: World, id: string) {
  return world.regions.filter((r) => r.parent === id);
}

// "굴 드라즈 › 게트 혈족의 영지" for an area, the name for a region.
export function placeName(world: World, r: Region) {
  const p = r.parent && world.regions.find((x) => x.id === r.parent);
  return p ? `${p.name} › ${r.name}` : r.name;
}
