// The static world the simulation runs on, built from world/entities (see world/README.md).
// Game data lives in each entity's frontmatter: `map` on locations, `sim` on characters and
// events. This module is pure so the web UI can share the types; sim/load.ts reads the files.
import { z } from 'zod';
import { TRAVEL_UNITS_PER_HOUR } from './rules.ts';
import { COLORS, parseManaCost } from './mana.ts';
import type { Color, Hybrid, Mana, ManaCost } from './mana.ts';
import { LIFE_KINDS, NEEDS } from './types.ts';
import type { Need } from './types.ts';

export const MAP_WIDTH = 96;
export const MAP_HEIGHT = 72;

// fly: can reach sky islands. aquatic: lives in the sea, and only there.
export const ABILITIES = ['fly', 'aquatic'] as const;
export type Ability = (typeof ABILITIES)[number];
export const ABILITY_LABELS: Record<Ability, string> = { fly: '비행', aquatic: '물에 삶' };

export const TERRAIN_IDS = [
  'grassland',
  'forest',
  'rocky',
  'beach',
  'settlement',
  'sky',
  'volcanic',
  'swamp',
  'ruins',
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
  // The basic land type a land of this terrain has (MTG's Plains, Mountain...), unless it is a
  // named land card of its own (`sim.nonbasic`).
  type?: LandType;
};
export const LAND_TYPES = ['plains', 'island', 'swamp', 'mountain', 'forest'] as const;
export type LandType = (typeof LAND_TYPES)[number];
export const LAND_TYPE_LABELS: Record<LandType, string> = { plains: '평원', island: '섬', swamp: '늪', mountain: '산', forest: '숲' };
export const TERRAINS: Record<Terrain, TerrainInfo> = {
  grassland: { label: '초원', color: '#8fb35a', mana: 'W', type: 'plains' },
  forest: { label: '숲', color: '#3f7a3a', mana: 'G', type: 'forest' },
  rocky: { label: '바위 지대', color: '#8a8173', mana: 'R', type: 'mountain' },
  beach: { label: '해변', color: '#d9c38a', mana: 'U', type: 'island' },
  settlement: { label: '정착지', color: '#b08850', mana: null },
  sky: { label: '공중섬', color: '#b9c8ea', mana: 'W', requires: 'fly' },
  volcanic: { label: '화산 지대', color: '#b5462c', mana: 'R', type: 'mountain' },
  swamp: { label: '늪', color: '#4f4a5e', mana: 'B', type: 'swamp' },
  ruins: { label: '폐허', color: '#6a5a82', mana: null },
  deepsea: { label: '심해', color: '#1d3b66', mana: 'U', sea: true },
};

// --- frontmatter schemas ---------------------------------------------------------------

// Mana color of a land (C = colorless; [B, R] = one of the two, chosen when spent). Default:
// from the terrain.
const LandColor = z.union([z.enum([...COLORS, 'C']), z.tuple([z.enum(COLORS), z.enum(COLORS)])]).optional();

// What a land does of its own (a location's `sim`): "enters tapped" (bonded with, it gives no
// mana that day) and what bonding with it brings ("When this land enters, you gain 1 life").
export const LandSimSchema = z.strictObject({
  // A named land card: no basic land type, whatever its terrain.
  nonbasic: z.boolean().default(false),
  // It gives no mana at all (e.g. a fetch land).
  no_mana: z.boolean().default(false),
  enters_tapped: z.boolean().default(false),
  // "{T}, Pay N life, Sacrifice this land: Search your library for a <type> or <type> card, put
  // it onto the battlefield": whoever holds it gives it up and N life, and bonds with a land of
  // one of these types they don't hold yet, from wherever they are.
  fetch: z.strictObject({ types: z.array(z.enum(LAND_TYPES)).min(1), life: z.number().int().min(0).default(0) }).optional(),
  // "{2}, {T}: Add {B} for each black creature card in your graveyard": for each creature of
  // that color who died serving whoever holds the land (their fallen retainers), one mana of
  // it, less the cost; never less than the land's one mana.
  fallen_mana: z.strictObject({ color: z.enum(COLORS), cost: z.number().int().min(0) }).optional(),
  // Those without the ability its terrain asks for (flying, for a sky island) can still climb
  // up or down, taking this many hours more each way.
  climb_hours: z.number().int().positive().optional(),
  // "At the beginning of your upkeep, if you control N or more Plains, you may return target
  // creature card from your graveyard to the battlefield": at 00:00, whoever holds it with N
  // plains or more gets back the last retainer who died serving them.
  upkeep_revive: z.strictObject({ plains: z.number().int().positive() }).optional(),
  on_bond: z.array(z.discriminatedUnion('type', [z.strictObject({ type: z.literal('gain_life'), amount: z.number().int().positive() })])).default([]),
});
export type BondEffect = z.infer<typeof LandSimSchema>['on_bond'][number];

export const MapSchema = z.union([
  // A region: a node on the map.
  z.strictObject({
    x: z.number().min(0).max(MAP_WIDTH - 1),
    y: z.number().min(0).max(MAP_HEIGHT - 1),
    terrain: z.enum(TERRAIN_IDS),
    color: LandColor,
    // How large it is drawn: a continent (e.g. Ondu), or a small island off one (Agadeem).
    size: z.enum(['continent', 'island']).optional(),
  }),
  // An area inside a region: a land of its own at the region's place.
  z.strictObject({
    in: z.string(),
    terrain: z.enum(TERRAIN_IDS),
    color: LandColor,
  }),
]);

// Mana a character holds, from its card: { B: 7 } for {5}{B}{B}.
const ManaSchema = z.partialRecord(z.enum(COLORS), z.number().int().min(1));
const CostSchema = z.string().refine((s) => parseManaCost(s) !== null, '마나 비용 형식: "{5}{B}{B}"');

// Power / toughness, as on the card. Combat damage piles up against toughness until the turn
// ends; reaching it is death.
const PtSchema = z.tuple([z.number().int().min(0), z.number().int().min(1)]);
export type Pt = z.infer<typeof PtSchema>;

// What an activated ability does (world/entities/characters sim.activated).
const AbilityEffectSchema = z.discriminatedUnion('type', [
  // The target dies, whatever its toughness.
  z.strictObject({ type: z.literal('destroy') }),
  // If the target died this way, it rises as a new character of this creature kind,
  // with its power/toughness, in this faction, as the user's retainer.
  // Its colors come from the card ("a black Vampire token"): [] for a colorless one.
  z.strictObject({ type: z.literal('raise'), creature: z.string(), faction: z.string().optional(), colors: z.array(z.enum(COLORS)) }),
  // "Discard a card. If a <color> card is discarded this way, deal N damage to any target":
  // they let go of a spell they hold (their hand); if it was of that color, N damage.
  z.strictObject({ type: z.literal('discard_spell'), if_color: z.enum(COLORS), damage: z.number().int().positive() }),
  // "Each player discards their hand, then draws N": everyone where they are lets go of the
  // spells they hold and comes to hold N spells of the world, at random.
  z.strictObject({ type: z.literal('wheel'), draw: z.number().int().positive() }),
  // "Cast any number of <color> spells from your graveyard free": every spell of that color
  // they let go of, cast on the target without paying.
  z.strictObject({ type: z.literal('flashback'), color: z.enum(COLORS) }),
]);
export type AbilityEffect = z.infer<typeof AbilityEffectSchema>;

const ActivatedSchema = z
  .array(
    z.strictObject({
      id: z.string().min(1),
      name: z.string().min(1),
      cost: CostSchema.default('{0}'),
      tap: z.boolean().default(false),
      // A loyalty ability: +N / -N loyalty, one a turn (game day).
      loyalty: z.number().int().optional(),
      // Whether it has a target (a living character).
      target: z.boolean().default(true),
      effects: z.array(AbilityEffectSchema).min(1),
    }),
  )
  .default([]);

export const CharacterSimSchema = z.strictObject({
  pt: PtSchema,
  mana: ManaSchema.optional(),
  role: z.string().min(1),
  home: z.string(),
  persona: z.string().min(1),
  goal: z.string().min(1),
  abilities: z.array(z.enum(ABILITIES)).default([]),
  // Stats they live by (default: all). Without hunger they never eat; without coin work earns
  // nothing; with none (e.g. Kalitas) they neither tire nor gain or lose life.
  needs: z.array(z.enum(NEEDS)).default([...NEEDS]),
  // A beast: doesn't talk, hunts whoever stands with it when hungry, hunts a land out, and
  // holds only the hunting ground it last bonded with.
  beast: z.boolean().default(false),
  // Landfall: when they bond with a land, they get +P/+T (and trample) until the turn ends.
  landfall: z.strictObject({ pt: z.tuple([z.number().int(), z.number().int()]), trample: z.boolean().default(false) }).optional(),
  // The creature kind a character is (e.g. cre-vampire). A creature entity's sim is its own kind.
  creature: z.string().optional(),
  // A planeswalker's loyalty (law-planeswalkers): their momentum. Loyalty abilities raise
  // or spend it; damage wears it down; at 0 they leave this plane.
  loyalty: z.number().int().min(1).optional(),
  // They hold (know) every spell of these colors in the world: their hand.
  knows_colors: z.array(z.enum(COLORS)).default([]),
  // Powers the morning LLM may use for them ("{cost}, {T}: effect" or "+1: effect").
  activated: ActivatedSchema,
});

export type ActivatedAbility = {
  id: string;
  name: string;
  cost: ManaCost;
  costText: string;
  tap: boolean;
  loyalty?: number;
  target: boolean;
  effects: AbilityEffect[];
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
  // New characters of this creature kind (MTG tokens) come into being where it happens, with
  // no master, and turn on whoever set it off for the rest of the day.
  z.strictObject({
    type: z.literal('create'),
    creature: z.string(),
    count: z.number().int().positive(),
    pt: z.tuple([z.number().int().min(0), z.number().int().min(1)]),
    // Their colors, from the card ("1/1 green Snake tokens"): [] for colorless ones.
    colors: z.array(z.enum(COLORS)),
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

// An item (an MTG artifact, world/entities/items): it stands in one place and becomes the
// possession of whoever pays its cost there (tames it).
export const ItemSimSchema = z.strictObject({
  cost: CostSchema,
  at: z.string(),
  effects: z
    .array(
      z.discriminatedUnion('type', [
        // "Enters with X charge counters, where X is your life total": when tamed.
        z.strictObject({ type: z.literal('charge_life') }),
        // "Landfall — you may have your life total become the number of charge counters": when
        // its owner bonds with a land, if that raises their life.
        z.strictObject({ type: z.literal('landfall_set_life') }),
      ]),
    )
    .min(1),
});
export type ItemEffect = z.infer<typeof ItemSimSchema>['effects'][number];

export const EventSimSchema = z.discriminatedUnion('trigger', [
  // The morning LLM decides whether it happens today. `chance` is the share of days it
  // usually happens on, a guide for the LLM.
  z.strictObject({ ...EventBase, ...EventCost, trigger: z.literal('gm'), chance: z.number().min(0).max(1) }),
  // Goes off when someone makes landfall on `region` (arrives there) and it is at least their
  // `landfalls`-th landfall this turn (game day).
  z.strictObject({ ...EventBase, ...EventCost, trigger: z.literal('landfall'), landfalls: z.number().int().min(1).default(1) }),
  // Goes off when someone arrives in `region` (exactly there: an area is entered on its own).
  // With gained_life, only for those who gained life this turn (game day).
  z.strictObject({ ...EventBase, ...EventCost, trigger: z.literal('enter'), gained_life: z.boolean().default(false) }),
  // Goes off when a noncreature permanent in `region` is destroyed by someone else's doing (a
  // spell, an ability or another event): for now the land itself (law-permanents).
  z.strictObject({ ...EventBase, ...EventCost, trigger: z.literal('destroyed') }),
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
  // Mana color of the land (null = colorless, 'B/R' = one of the two).
  color: Color | Hybrid | null;
  // Bonded with, it gives no mana that day.
  entersTapped: boolean;
  // What bonding with it brings.
  onBond: BondEffect[];
  nonbasic: boolean;
  noMana: boolean;
  fetch?: { types: LandType[]; life: number };
  fallenMana?: { color: Color; cost: number };
  climbHours?: number;
  upkeepRevive?: { plains: number };
  // An area inside this region (its x, y are the region's). Areas are lands of their own:
  // people meet, bond, and get hit by events there, but an event on the region reaches them.
  parent?: string;
  // How large a region is drawn (web/view.ts).
  size?: 'continent' | 'island';
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
  // The creature kind they are (e.g. cre-vampire), for "a Vampire you control".
  creature?: string;
  // Their colors when their mana doesn't say (e.g. a black Vampire risen in play).
  colors?: Color[];
  // Planeswalkers' loyalty, the colors of spells they hold, and powers the morning LLM may
  // use for them. Characters born in play (state.tokens) have none.
  loyalty?: number;
  knowsColors?: Color[];
  activated?: ActivatedAbility[];
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

export type ItemDef = {
  id: string;
  name: string;
  summary: string;
  cost: ManaCost;
  costText: string;
  at: string;
  effects: ItemEffect[];
};

// Who answers when spoken to.
export type Speaker = Pick<NpcDef, 'id' | 'name' | 'persona' | 'goal' | 'role'>;

export type EventDef = {
  id: string;
  name: string;
  summary: string;
  region: string;
  range: number;
  trigger: 'gm' | 'landfall' | 'enter' | 'destroyed';
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
  events: EventDef[];
  spells: SpellDef[];
  items: ItemDef[];
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
  const world: World = { regions: [], npcs: [], events: [], spells: [], items: [], lore: [] };
  const err = (id: string, msg: string) => errors.push(`${id}: ${msg}`);

  for (const e of entities) {
    world.lore.push({ id: e.id, kind: e.kind, name: e.name, summary: e.summary ?? '' });
    if (e.map !== undefined) {
      if (e.kind !== 'location') err(e.id, 'map 은 location 에만 쓸 수 있음');
      const map = MapSchema.safeParse(e.map);
      const land = LandSimSchema.safeParse(e.sim ?? {});
      if (!land.success) err(e.id, `sim 오류: ${issues(land.error)}`);
      if (!map.success) err(e.id, `map 오류: ${issues(map.error)}`);
      else {
        const c = map.data.color;
        world.regions.push({
          id: e.id,
          name: e.name,
          nameEn: e.name_en ?? '',
          summary: e.summary ?? '',
          ...('in' in map.data ? { x: 0, y: 0, parent: map.data.in } : { x: map.data.x, y: map.data.y, size: map.data.size }),
          terrain: map.data.terrain,
          color: c === 'C' ? null : Array.isArray(c) ? (`${c[0]}/${c[1]}` as Hybrid) : (c ?? TERRAINS[map.data.terrain].mana),
          entersTapped: land.data?.enters_tapped ?? false,
          onBond: land.data?.on_bond ?? [],
          nonbasic: land.data?.nonbasic ?? false,
          noMana: land.data?.no_mana ?? false,
          fetch: land.data?.fetch,
          fallenMana: land.data?.fallen_mana,
          climbHours: land.data?.climb_hours,
          upkeepRevive: land.data?.upkeep_revive,
        });
      }
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
    if (e.kind === 'location') {
      // A land's own sim: read with its map above.
      if (e.map === undefined) err(e.id, 'location 의 sim 은 map 이 있을 때만 쓸 수 있음');
    } else if (e.kind === 'character' || e.kind === 'creature') {
      // A creature's sim is one of its kind, living in the world (e.g. a roaming baloth).
      const sim = CharacterSimSchema.safeParse(e.sim);
      if (!sim.success) {
        err(e.id, `sim 오류: ${issues(sim.error)}`);
        continue;
      }
      const { knows_colors, activated, ...rest } = sim.data;
      world.npcs.push({
        id: e.id,
        name: e.name,
        summary: e.summary ?? '',
        ...rest,
        creature: e.kind === 'creature' ? e.id : rest.creature,
        knowsColors: knows_colors,
        activated: activated.map((x) => ({ ...x, cost: parseManaCost(x.cost)!, costText: x.cost })),
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
    } else if (e.kind === 'item') {
      const sim = ItemSimSchema.safeParse(e.sim);
      if (!sim.success) {
        err(e.id, `sim 오류: ${issues(sim.error)}`);
        continue;
      }
      const d = sim.data;
      world.items.push({ id: e.id, name: e.name, summary: e.summary ?? '', cost: parseManaCost(d.cost)!, costText: d.cost, at: d.at, effects: d.effects });
    } else {
      err(e.id, `sim 은 location, character, creature, event, spell, item 에만 쓸 수 있음 (${e.kind})`);
    }
  }

  // References into the map.
  const regionOk = (owner: string, id: string, what: string) => {
    const r = world.regions.find((x) => x.id === id);
    if (!r) err(owner, `${what} ${id} 가 맵에 없음 (location 에 map 필요)`);
    return r;
  };
  for (const npc of world.npcs) {
    const r = regionOk(npc.id, npc.home, 'sim.home');
    if (r && !canStay(r, npc.abilities)) err(npc.id, `${npc.home} 에 머물 수 없음 (${TERRAINS[r.terrain].label})`);
  }
  const known = new Set(entities.map((e) => e.id));
  for (const ev of world.events) {
    regionOk(ev.id, ev.region, 'sim.region');
    for (const x of ev.effects) if (x.type === 'create' && !known.has(x.creature)) err(ev.id, `create 의 creature ${x.creature} 가 없음`);
    if (ev.cost && !world.npcs.some((n) => n.id === ev.cost!.by))
      err(ev.id, `sim.cost.by ${ev.cost.by} 가 sim 을 가진 인물이 아님`);
  }
  const ids = new Set(entities.map((e) => e.id));
  for (const s of world.spells) {
    const r = regionOk(s.id, s.learnAt, 'sim.learn_at');
    if (r && TERRAINS[r.terrain].sea) err(s.id, `sim.learn_at ${s.learnAt} 은 바다라 아무도 머물 수 없음`);
    if (s.kicker && !ids.has(s.kicker.tap)) err(s.id, `sim.kicker.tap ${s.kicker.tap} 가 없음`);
  }
  for (const x of world.items) {
    const r = regionOk(x.id, x.at, 'sim.at');
    if (r && TERRAINS[r.terrain].sea) err(x.id, `sim.at ${x.at} 은 바다라 아무도 머물 수 없음`);
  }
  for (const b of world.npcs) {
    for (const x of b.activated ?? [])
      for (const eff of x.effects)
        if (eff.type === 'raise') {
          if (!ids.has(eff.creature)) err(b.id, `activated ${x.id}: creature ${eff.creature} 가 없음`);
          if (eff.faction && !ids.has(eff.faction)) err(b.id, `activated ${x.id}: faction ${eff.faction} 가 없음`);
        }
  }

  return { world, errors };
}

// A character of legend: one with powers of their own (activated abilities or loyalty).
export function hasPowers(def: NpcDef | undefined) {
  return !!(def?.activated?.length || def?.loyalty !== undefined);
}

// A spell's colors: those in its cost.
export function spellColors(s: SpellDef): Color[] {
  return Object.keys(s.cost.colored) as Color[];
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
// the distance, plus an hour to get out of or into an area through its region. One without the
// ability a land asks for (e.g. flying to a sky ruin) climbs instead, if it can be climbed.
export function travelHours(a: Region, b: Region, abilities: readonly Ability[] = []) {
  const climb = (r: Region) => {
    const need = TERRAINS[r.terrain].requires;
    return need && !abilities.includes(need) ? (r.climbHours ?? 0) : 0;
  };
  const home = (r: Region) => r.parent ?? r.id;
  if (home(a) === home(b)) return 1 + climb(a) + climb(b);
  const road = Math.max(1, Math.ceil(distance(a, b) / TRAVEL_UNITS_PER_HOUR));
  return road + (a.parent ? 1 : 0) + (b.parent ? 1 : 0) + climb(a) + climb(b);
}

// A land's basic land types (none for a named land card, or a sea).
export function landTypes(r: Region): LandType[] {
  const type = TERRAINS[r.terrain].type;
  return r.nonbasic || !type ? [] : [type];
}

// Whether someone with these abilities can be in a region at all. The sea is for those who
// live in it, and they never leave it.
export function canStay(r: Region, abilities: readonly Ability[]) {
  const t = TERRAINS[r.terrain];
  if (abilities.includes('aquatic')) return !!t.sea;
  return !t.sea && (!t.requires || abilities.includes(t.requires) || !!r.climbHours);
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
