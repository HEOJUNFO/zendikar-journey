// The static world the simulation runs on, built from world/entities (see world/README.md).
// Game data lives in each entity's frontmatter: `map` on locations, `sim` on characters and
// events. This module is pure so the web UI can share the types; sim/load.ts reads the files.
import { z } from 'zod';
import { layTiles } from './tiles.ts';
import type { Tile } from './tiles.ts';
import { TRAVEL_UNITS_PER_HOUR } from './rules.ts';
import { COLORS, parseManaCost } from './mana.ts';
import type { Color, Hybrid, Mana, ManaCost } from './mana.ts';
import { LIFE_KINDS, NEEDS } from './types.ts';
import type { Need } from './types.ts';

export const MAP_WIDTH = 2880;
export const MAP_HEIGHT = 2160;

// fly: can reach sky islands. aquatic: lives in the sea, and only there.
export const ABILITIES = ['fly', 'aquatic', 'lifelink', 'vigilance', 'haste', 'trample', 'defender', 'shroud', 'swampwalk', 'forestwalk', 'islandwalk', 'indestructible', 'intimidate', 'first_strike', 'double_strike', 'cant_block', 'bite', 'deathtouch', 'reach', 'unblockable', 'mountainwalk', 'nonbasic_landwalk', 'block_only_fliers'] as const;
export type Ability = (typeof ABILITIES)[number];
export const ABILITY_LABELS: Record<Ability, string> = { fly: '비행', aquatic: '물에 삶', lifelink: '생명연결', vigilance: '경계', haste: '속공', trample: '돌진', defender: '수비대', shroud: '방어막', swampwalk: '늪걷기', forestwalk: '숲걷기', islandwalk: '섬걷기', indestructible: '파괴불가', intimidate: '위협', first_strike: '선제공격', double_strike: '이중 타격', cant_block: '막지 못함', bite: '물어뜯기', deathtouch: '죽음의 손길', reach: '도달', unblockable: '막을 수 없음', mountainwalk: '산걷기', nonbasic_landwalk: '이름 있는 땅 걷기', block_only_fliers: '나는 이만 막음' };
// Creature types a card may name ("destroy target Angel"), and `artifact` for an artifact
// creature (마법물체 생물: it may block an intimidating one).
export const CREATURE_TYPES = ['angel', 'demon', 'artifact', 'elf', 'merfolk', 'kor', 'goblin'] as const;
export type CreatureType = (typeof CREATURE_TYPES)[number];
export const CREATURE_TYPE_LABELS: Record<CreatureType, string> = { angel: '천사', demon: '악마', artifact: '마법물체', elf: '엘프', merfolk: '인어', kor: '코르', goblin: '고블린' };

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
  'river',
  'tundra',
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
  river: { label: '강·폭포', color: '#4f8fb8', mana: 'U', type: 'island' },
  tundra: { label: '설원', color: '#dfe6ee', mana: 'W', type: 'plains' },
  deepsea: { label: '심해', color: '#1d3b66', mana: 'U', sea: true },
};

// --- frontmatter schemas ---------------------------------------------------------------

// Mana color of a land (C = colorless; [B, R] = one of the two, chosen when spent). Default:
// from the terrain.
const LandColor = z.union([z.enum([...COLORS, 'C']), z.tuple([z.enum(COLORS), z.enum(COLORS)])]).optional();

const CostSchema = z.string().refine((s) => parseManaCost(s) !== null, '마나 비용 형식: "{5}{B}{B}"');

// What a land does of its own (a location's `sim`): "enters tapped" (bonded with, it gives no
// mana that day) and what bonding with it brings ("When this land enters, you gain 1 life").
export const LandSimSchema = z.strictObject({
  // A named land card: no basic land type, whatever its terrain.
  nonbasic: z.boolean().default(false),
  // Its basic land type when its terrain gives another or none (e.g. the Silundi Sea: an island).
  land_type: z.enum(LAND_TYPES).optional(),
  // It gives no mana at all (e.g. a fetch land).
  no_mana: z.boolean().default(false),
  // Not a land at all, a place (e.g. Goma Fada, a walking city): no one bonds with it.
  not_land: z.boolean().default(false),
  // One land with another place (a sea and its coast or bay: the Silundi Sea and Coast, Sunder
  // Bay and its offing; user decision 2026-09-30): bonding here is bonding with that land, and
  // going between them is an hour. The map still draws them apart.
  one_land_with: z.string().optional(),
  // A place that moves (Goma Fada, "the city that walks"): `per_day` map units a day toward
  // the stop the LLM picks next among `stops` (sim/wander.ts). Its map point is where it starts.
  wanders: z
    .strictObject({
      per_day: z.number().positive(),
      stops: z.array(z.strictObject({ name: z.string().min(1), x: z.number(), y: z.number() })).min(2),
    })
    .optional(),
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
  // What bonding with it does: the bonder gains life, or someone standing there, whom the
  // bonder picks, loses life ("target player loses N life") or gains an ability for the day.
  on_bond: z
    .array(
      z.discriminatedUnion('type', [
        z.strictObject({ type: z.literal('gain_life'), amount: z.number().int().positive() }),
        z.strictObject({ type: z.literal('lose_life'), amount: z.number().int().positive() }),
        // "Target creature gains flying until end of turn": one there (them too), until 00:00.
        z.strictObject({ type: z.literal('grant'), ability: z.enum(ABILITIES) }),
        // "Target creature gets +2/+0 until end of turn": one there (them too), until 00:00.
        z.strictObject({ type: z.literal('pump'), pt: z.tuple([z.number().int(), z.number().int()]) }),
      ]),
    )
    .default([]),
  // "{U}, {T}: Put an eon counter on this land. Skip your next turn" and "{T}, Remove an eon
  // counter and return it to its owner's hand: Take an extra turn after this one" (Magosi):
  // whoever holds it may leave a day in it (losing their next day) and later take it back
  // (the bond ends, and the next day the world stands still for them alone). sim/eons.ts.
  eon: z.strictObject({ cost: CostSchema }).optional(),
  // "{T}: Put a +1/+1 counter on each green creature that entered this turn" (Oran-Rief):
  // whoever holds it may tap it to give every creature of that color that came into play
  // today a +1/+1 counter, whoever they serve.
  grow_entered: z.strictObject({ color: z.enum(COLORS) }).optional(),
  // "Whenever a Mountain enters under your control, if you control at least N other Mountains,
  // you may have this land deal D damage to any target" (Valakut): whoever holds it and bonds
  // with a mountain while holding N others may burn someone anywhere in this land's region.
  mountain_fire: z.strictObject({ others: z.number().int().min(0), damage: z.number().int().positive() }).optional(),
});
export type BondEffect = z.infer<typeof LandSimSchema>['on_bond'][number];

// What bonding with a land does, in a few words (for the region card and prompts).
export function bondEffectText(eff: BondEffect) {
  if (eff.type === 'gain_life') return `유대를 맺으면 생명 ${eff.amount}`;
  if (eff.type === 'lose_life') return `유대를 맺으면 곁의 하나(맺는 이가 고름)가 생명 ${eff.amount}을 잃음`;
  if (eff.type === 'pump') return `유대를 맺으면 곁의 하나(자신도, 맺는 이가 고름)가 자정까지 ${signed(eff.pt[0])}/${signed(eff.pt[1])}`;
  return `유대를 맺으면 곁의 하나(자신도, 맺는 이가 고름)가 자정까지 ${ABILITY_LABELS[eff.ability]}`;
}
function signed(n: number) {
  return n < 0 ? `${n}` : `+${n}`;
}

export const MapSchema = z.union([
  // A region: a node on the map.
  z.strictObject({
    x: z.number().min(0).max(MAP_WIDTH - 1),
    y: z.number().min(0).max(MAP_HEIGHT - 1),
    terrain: z.enum(TERRAIN_IDS),
    color: LandColor,
    // How large it is drawn: a continent (e.g. Ondu), or a small island off one (Agadeem).
    size: z.enum(['continent', 'island']).optional(),
    // The continent an island belongs to: drawn joined to it by shallow water.
    of: z.string().optional(),
    // How many tiles it holds, as large as the lore has it (sim/tiles.ts; at least 100 for a
    // continent, 10 for any other land). A sea holds the water around it instead.
    tiles: z.number().int().min(1).optional(),
  }),
  // An area inside a region: a land of its own at the region's place.
  z.strictObject({
    in: z.string(),
    terrain: z.enum(TERRAIN_IDS),
    color: LandColor,
    // Where it sits among its region's areas on the map, east (low) to west (high); default 0.
    order: z.number().optional(),
    // Where it lies inside its region, as the lore has it: [east(+)/west(-), south(+)/north(-)],
    // in parts of the region circle's radius (0,0 the middle; 1 on the rim: a coast or a bay,
    // half over the sea). Without it, areas sit in a row
    // across the lower part by `order`. It picks the tiles the area holds (sim/tiles.ts).
    pos: z.tuple([z.number().min(-1).max(1), z.number().min(-1).max(1)]).optional(),
    // How many tiles of its region it holds (sim/tiles.ts; default 1), as large as the lore has
    // it (user decision 2026-10-01).
    tiles: z.number().int().min(1).optional(),
  }),
]);

// Mana a character holds, from its card: { B: 7 } for {5}{B}{B}.
// A card's mana value in its colors; C: colorless (Stonework Puma {3}), no color of its own.
const ManaSchema = z.partialRecord(z.enum([...COLORS, 'C']), z.number().int().min(1));

// Power / toughness, as on the card. Combat damage piles up against toughness until the turn
// ends; reaching it is death.
const PtSchema = z.tuple([z.number().int().min(0), z.number().int().min(1)]);
const PtBonusSchema = z.tuple([z.number().int().min(0), z.number().int().min(0)]);
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
  // N damage to the target ("deals N damage to any target").
  z.strictObject({ type: z.literal('damage'), amount: z.number().int().positive() }),
  // The user gains N life ("and you gain N life").
  z.strictObject({ type: z.literal('gain_life'), amount: z.number().int().positive() }),
  // "Target opponent's life total becomes N".
  z.strictObject({ type: z.literal('set_life'), amount: z.number().int().min(1) }),
  // "You control target player during that player's next turn": the target's next day (00:00
  // to 00:00) is the user's: seized as their retainer for it (sim/retainers.ts).
  z.strictObject({ type: z.literal('possess_next_turn') }),
  // "Search your library for a card named X, put it onto the battlefield" (Nissa Revane +1): one
  // of that kind is born at the user's side, theirs (a token, with its creature `types`).
  z.strictObject({ type: z.literal('create_token'), creature: z.string(), pt: PtSchema, colors: z.array(z.enum(COLORS)), types: z.array(z.enum(CREATURE_TYPES)).default([]) }),
  // "You gain N life for each <type> you control" (Nissa Revane +1): their retainers of it.
  z.strictObject({ type: z.literal('gain_life_per'), kind: z.enum(CREATURE_TYPES), amount: z.number().int().positive() }),
  // "Search your library for any number of <type> creature cards, put them onto the
  // battlefield" (Nissa Revane −7): every living one of that type serving no one, anywhere,
  // comes to the user's side as theirs (user decision 2026-10-01).
  z.strictObject({ type: z.literal('call_kind'), kind: z.enum(CREATURE_TYPES) }),
  // "Put a blaze counter on target land without a blaze counter on it": the latest land the
  // target holds that isn't burning; it burns those bonded with it each 00:00 (sim/blaze.ts).
  z.strictObject({ type: z.literal('blaze_land') }),
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
  // The one living in the world, when a creature entity names its kind (e.g. 펠리다르 군주 of 펠리다르).
  name: z.string().min(1).optional(),
  pt: PtSchema,
  mana: ManaSchema.optional(),
  role: z.string().min(1),
  home: z.string(),
  // Where in their home they live, as the lore has it: [east(+)/west(-), south(+)/north(-)] in
  // parts of the land's radius, like an area's `map.pos` (sim/tiles.ts `placeTile`). Without
  // it, a tile of their home picked by their name.
  home_pos: z.tuple([z.number().min(-1).max(1), z.number().min(-1).max(1)]).optional(),
  persona: z.string().min(1),
  goal: z.string().min(1),
  abilities: z.array(z.enum(ABILITIES)).default([]),
  // Creature types from the card's type line that a card names ("destroy target Angel").
  types: z.array(z.enum(CREATURE_TYPES)).default([]),
  // "When this enters, destroy target <type>" (Halo Hunter: an Angel): each time they arrive
  // in a land (or are brought there), they may destroy one of that type there
  // (sim/abilities.ts `enterDestroy`, picked by the LLM after the hour).
  // Or `{ kicker }`: "Kicker …. When this enters, if it was kicked, destroy target creature"
  // (Heartstabber Mosquito): anyone there but a planeswalker, if they can pay it from their own
  // mana (paid as the blow falls).
  enter_destroy: z.union([z.enum(CREATURE_TYPES), z.strictObject({ kind: z.enum(CREATURE_TYPES).optional(), kicker: CostSchema.optional(), flying: z.boolean().default(false) })]).optional(),
  // "When this enters, each opponent loses life equal to the number of <kind>s you control. You
  // gain life equal to the life lost this way" (Malakir Bloodwitch: Vampires). Everyone else
  // standing there (not their side) loses it; their controller gains it (sim/abilities.ts).
  enter_drain: z.strictObject({ per: z.string() }).optional(),
  // "Kicker <cost>. When this enters, draw N cards. Then if it wasn't kicked, discard M cards"
  // (Sphinx of Lost Truths): on their first arrival of the day their controller learns N
  // secrets (sim/knowledge.ts); they pay the kicker from their own mana if they can, and if not
  // (or with no kicker) the controller lets go of M spells (sim/abilities.ts `enterDraw`).
  // "When this enters, you may search your library for a <type> card, put it onto the
  // battlefield tapped" (Kor Cartographer): their controller (master, or themselves) may bond,
  // from afar, with a land of that type they don't hold yet, as a fetch does; `tapped`: it
  // gives no mana that day (sim/abilities.ts `enterSearch`).
  // "Kicker …. When this enters, if it was kicked, destroy target noncreature permanent" (Mold
  // Shambler): on its first arrival of the day, paid from its own mana (sim/relics.ts).
  // `nonbasic`: only a land of a land card of its own (Goblin Ruinblaster: "destroy target nonbasic land").
  // `relics`: only an artifact or an enchantment, no land (Kor Sanctifiers).
  enter_shatter: z.strictObject({ kicker: CostSchema.optional(), nonbasic: z.boolean().optional(), relics: z.boolean().optional() }).optional(),
  // "When this enters, exile target <color> permanent" (Devout Lightcaster: black): sim/banish.ts.
  enter_exile: z.strictObject({ color: z.enum(COLORS) }).optional(),
  // "When this enters, tap target creature an opponent controls. It doesn't untap during its
  // controller's next untap step" (Kor Hookmaster): bound past the next 00:00 (sim/hook.ts).
  enter_tap: z.boolean().default(false),
  // "Kicker <cost>. When this enters, if it was kicked, it deals N damage to target creature"
  // (Torch Slinger): on its first arrival of the day, paid from its own mana; its controller picks
  // (sim/torch.ts).
  // "Kicker <cost>. If this was kicked, it enters with N +1/+1 counters" (Aether Figment): on its
  // first arrival of the day, if it can pay from its own mana, it pays and has +N/+N until midnight
  // (user decision 2026-10-01: no counters piling up day on day).
  // "Kicker <cost>. When this enters, if it was kicked, target player sacrifices a creature"
  // (Gatekeeper of Malakir): first arrival of the day, paid from its own mana (sim/toll.ts).
  // "When this enters, target creature can't block this turn" (Goblin Shortcutter): its controller
  // picks one on its tile, who can't block until midnight (sim/shortcut.ts).
  enter_no_block: z.boolean().default(false),
  // "Whenever this attacks, defending player reveals the top card of their library; a land, they
  // put it into their hand" (Goblin Guide): sim/scope.ts `guideOnAttack`.
  attack_gift: z.boolean().default(false),
  enter_sacrifice: z.strictObject({ kicker: CostSchema }).optional(),
  enter_pump: z.strictObject({ pt: z.tuple([z.number().int().min(0), z.number().int().min(0)]), kicker: CostSchema }).optional(),
  // "Kicker <cost>. When this enters, if it was kicked, creatures you control get +P/+T and gain
  // <abilities> until end of turn" (Goblin Bushwhacker): first arrival of the day, paid from its
  // own mana if it can; its controller and theirs on its tile (`enterRally`).
  enter_rally: z.strictObject({ pt: z.tuple([z.number().int().min(0), z.number().int().min(0)]), abilities: z.array(z.enum(ABILITIES)).default([]), kicker: CostSchema }).optional(),
  enter_damage: z.strictObject({ amount: z.number().int().positive(), kicker: CostSchema.optional() }).optional(),
  // "Kicker <cost>. When this enters, if it was kicked, target creature gains <ability> until end of
  // turn" (Kor Aeronaut): first arrival of the day, paid from its own mana; its controller picks
  // one on its tile, or no one (sim/aeronaut.ts).
  enter_grant: z.strictObject({ ability: z.enum(ABILITIES), kicker: CostSchema }).optional(),
  // "When this enters, you may attach target Equipment you control to target creature you control"
  // (Kor Outfitter): its controller, there with it, may put one of their equipment on themselves or
  // one who serves them there, for nothing (sim/outfitter.ts).
  enter_equip: z.boolean().default(false),
  // "When this enters, return a permanent you control to its owner's hand" (Kor Skyfisher): its
  // controller must return one of theirs, as Narrow Escape's pick (sim/escape.ts `enterReturn`).
  enter_return: z.boolean().default(false),
  // "Kicker <cost>. When this enters, if it was kicked, tap up to N target permanents" (Tempest
  // Owl): its controller pays and picks beings or held lands there (sim/owl.ts).
  enter_tap_many: z.strictObject({ count: z.number().int().positive(), kicker: CostSchema }).optional(),
  // "When this enters, reveal the top N cards of your library. Put all <type> cards revealed this way
  // into your hand" (Merfolk Wayfinder): lands in hand, to bond with from afar (sim/oracle.ts).
  enter_reveal: z.strictObject({ count: z.number().int().positive(), land_type: z.enum(LAND_TYPES) }).optional(),
  enter_search: z.strictObject({ types: z.array(z.enum(LAND_TYPES)).min(1), tapped: z.boolean().default(false) }).optional(),
  enter_draw: z.strictObject({ count: z.number().int().min(1), discard: z.number().int().min(1).optional(), kicker: CostSchema.optional() }).optional(),
  // "Protection from <color>" (Malakir Bloodwitch: white): nothing of that color damages them,
  // blocks them (strikes back, flies from them), or picks them (spells, abilities, lands).
  protection: z.array(z.enum(COLORS)).default([]),
  // Stats they live by (default: all). Without hunger they never eat; without coin work earns
  // nothing. Every living being tires (energy, user decision 2026-09-30); life is everyone's
  // regardless.
  needs: z
    .array(z.enum(NEEDS))
    .default([...NEEDS])
    .refine((n) => n.includes('energy'), { message: '모든 존재는 기력(energy)을 쓴다' }),
  // A beast: doesn't talk, hunts whoever stands with it when hungry, hunts a land out, and
  // holds only the hunting ground it last bonded with.
  beast: z.boolean().default(false),
  // Every beast may choose to follow one who wins its trust (user decision 2026-10-01: how hard,
  // and what it takes, is the LLM's to judge, as the beast): the player by talking to it, an NPC by
  // a "court" block (sim/retainers.ts).
  // "{T}: Prevent the next N damage that would be dealt to target player this turn" (Noble Vestige):
  // whoever controls it wards one on its tile until midnight (sim/tapper.ts).
  tap_shield: z.number().int().positive().optional(),
  // "<cost>, {T}: Target creature gains <ability> until end of turn" (Caller of Gales): a tap power
  // of whoever controls it, on one standing with it (sim/tapper.ts `gale`).
  tap_grant: z.strictObject({ ability: z.enum(ABILITIES), cost: CostSchema }).optional(),
  // "{T}: Target player draws a card, then discards a card" (Reckless Scholar): whoever controls
  // it has one on its tile come to know a secret, then let go of a spell (sim/tapper.ts).
  tap_loot: z.boolean().default(false),
  // "<cost>, {T}: Search your library for a basic land card, put it onto the battlefield tapped"
  // (Frontier Guide): whoever controls it pays and bonds from afar with a basic land (sim/tapper.ts).
  tap_search: z.strictObject({ cost: CostSchema, types: z.array(z.enum(LAND_TYPES)).min(1) }).optional(),
  // "Other <type> creatures you control get +P/+T for each Equipment attached to this" (Armament
  // Master: Kor, +2/+2): recounted every hour (sim/monument.ts `anthemHour`).
  equip_anthem: z.strictObject({ kind: z.enum(CREATURE_TYPES), pt: PtBonusSchema }).optional(),
  // "As long as this is equipped, it has <abilities>" (Kor Duelist: double strike): sim/monument.ts
  // `anthemHour`, recounted every hour.
  equipped_grant: z.array(z.enum(ABILITIES)).default([]),
  // "Whenever this creature deals damage to an opponent, sacrifice a land" (Ruinous Minotaur): each
  // exchange it deals someone damage in, whoever controls it gives up a land they hold (sim/harrow.ts).
  hit_sacrifice_land: z.boolean().default(false),
  // A beast that follows only one who controls a creature of this kind (a creature entity, e.g.
  // cre-vampire: Mindless Null follows a vampire's side) or that one character (Molten Ravager:
  // the Lullmage Mentor), user decision 2026-10-01: no one else may court or sway it.
  follows_only: z.string().optional(),
  // "This creature can't block unless you control a Vampire" (Mindless Null, a creature entity):
  // it stands against one who fell on its master first only while its master's creatures (the
  // master too) hold one.
  cant_block_unless: z.string().optional(),
  // "At the beginning of your upkeep, sacrifice this creature unless you return a land you
  // control to its owner's hand" (Living Tsunami): while it serves someone (sim/tide.ts).
  upkeep_return_land: z.boolean().default(false),
  // "You may play an additional land on each of your turns" (Oracle of Mul Daya): its controller
  // may bond with N more lands a day (sim/oracle.ts).
  extra_lands: z.number().int().min(1).optional(),
  // "Play with the top card of your library revealed; you may play lands from the top": a land
  // of the world revealed each 00:00 for its controller, to bond with from afar (sim/oracle.ts).
  reveal_top: z.boolean().default(false),
  // "{2}{U}: Tap target creature without flying" (Merfolk Seastalkers): in a fight, its
  // controller may pay to bind a foe there until midnight (`no_fly`: not one who flies,
  // sim/bind.ts).
  tap_foe: z.strictObject({ cost: CostSchema, no_fly: z.boolean().default(false) }).optional(),
  // "{T}: Put this creature and each creature it's blocking on top of their owners' libraries"
  // (Gomazoa): one who falls on it or its master is wrapped up and dragged with it to where it
  // lives (sim/engulf.ts).
  engulf: z.boolean().default(false),
  // "Whenever a spell or ability you control counters a spell, you may create a <token>" and "Tap
  // seven untapped Merfolk you control: Counter target spell" (Lullmage Mentor, sim/counter.ts).
  counter_tokens: z.strictObject({ creature: z.string(), pt: PtSchema, colors: z.array(z.enum(COLORS)) }).optional(),
  // "At the beginning of each opponent's upkeep, if that player has N or fewer cards in hand, this
  // deals D damage to that player" (Hellfire Mongrel): at 00:00, to each on its tile but its side
  // who holds that few spells (sim/scorch.ts).
  upkeep_burn: z.strictObject({ damage: z.number().int().positive(), max_hand: z.number().int().min(0) }).optional(),
  // "{T}: Add {G}{G}" (Greenweaver Druid): mana for whoever controls it, standing with them, each
  // day (sim/mana.ts `manaCapacity`).
  tap_mana: z.partialRecord(z.enum(COLORS), z.number().int().positive()).optional(),
  // "At the beginning of your upkeep, if you have N or more life, you win the game": its
  // controller (its master; a beast alone is no player) wins at 00:00 (sim/win.ts).
  wins_at_life: z.number().int().min(1).optional(),
  // "Whenever this attacks, you may pay {cost}. If you do, untap all attacking creatures and
  // there is an additional combat phase" (Hellkite Charger): when they strike and can pay, they
  // do, and they (and their retainers who struck with them) strike once more that hour.
  extra_combat: z.strictObject({ cost: CostSchema }).optional(),
  // "{B}: This creature gets +1/+1 until end of turn" (Crypt Ripper): before each hour it fights,
  // its controller pours in what they will, each `cost` +`pt` until midnight (sim/pump.ts).
  // +N/+0 too (Molten Ravager: {R}: +1/+0).
  pump: z.strictObject({ cost: CostSchema, pt: z.tuple([z.number().int().min(0), z.number().int().min(0)]) }).optional(),
  // "Gets +P/+T as long as an opponent has no cards in hand" (Guul Draz Specter): while a foe of
  // today standing with them holds no spell (user decision 2026-10-01).
  empty_hand_pump: z.tuple([z.number().int().min(0), z.number().int().min(0)]).optional(),
  // "Whenever this attacks, it gets +P/+T until end of turn for each <land type> you control"
  // (Timbermaw Larva: Forest): the first time each day it falls on someone in a fight, +P/+T
  // until midnight per land of that type its controller holds (user decision 2026-10-01).
  attack_pump: z.strictObject({ land: z.enum(LAND_TYPES), pt: PtSchema }).optional(),
  // "Whenever this deals combat damage to a player, that player discards a card": one it wounds
  // in a fight lets go of a spell, their pick (sim/discard.ts).
  discard_on_hit: z.boolean().default(false),
  // An Ally (card type; sim/allies.ts): of Zendikar's expedition parties.
  ally: z.boolean().default(false),
  // "Whenever this or another Ally enters under your control, …": when an Ally joins their
  // party. damage_allies: damage to one there equal to the party's Allies (Murasa Pyromancer).
  // lose_life_allies: one there loses life equal to the party's Allies (Hagra Diabolist).
  // damage_fliers: damage to one there who can fly (no planeswalker) equal to the party's Allies
  // (Tajuru Archer).
  // counters_allies: a +1/+1 counter on each Ally in the party, no one to pick (Kazuul Warlord).
  // counter_self: a +1/+1 counter on the one with the rally only (Tuktuk Grunts).
  // gain_life_allies: the party's master gains life equal to the party's Allies (Ondu Cleric).
  // token_counter: a <creature> token born at their side, the controller's retainer, and a
  // +1/+1 counter on the one with the rally (Turntimber Ranger: a 2/2 green Wolf).
  // grant_allies: each Ally in the party gains <ability> until the turn ends (Seascape Aerialist: flying).
  // ward_allies: their controller may name a color; each Ally in the party gains protection from it
  // until the turn ends (Kabira Evangel; sim/allies.ts `applyWard`).
  // reveal_discard: one there shows as many of their spells as the party's Allies;
  // the controller picks one they forget (Bala Ged Thief; sim/discard.ts `revealHand`).
  rally: z.array(z.discriminatedUnion('type', [z.strictObject({ type: z.literal('damage_allies') }), z.strictObject({ type: z.literal('damage_fliers') }), z.strictObject({ type: z.literal('lose_life_allies') }), z.strictObject({ type: z.literal('reveal_discard') }), z.strictObject({ type: z.literal('counters_allies') }), z.strictObject({ type: z.literal('counter_self') }), z.strictObject({ type: z.literal('gain_life_allies') }), z.strictObject({ type: z.literal('token_counter'), creature: z.string(), pt: PtSchema, colors: z.array(z.enum(COLORS)) }), z.strictObject({ type: z.literal('grant_allies'), ability: z.enum(ABILITIES) }), z.strictObject({ type: z.literal('ward_allies') })])).default([]),
  // "You may look at the top card of your library any time" (Sphinx of Jwar Isle): they see
  // what is coming. The rest of today's events and powers the morning LLM picked are in their
  // plan (made after it) and their talk (sim/foresight.ts).
  foresight: z.boolean().default(false),
  // A mercenary: anyone who pays (their card's mana value × 10 coin) hires them for good.
  hireable: z.boolean().default(false),
  // Landfall: when they bond with a land, they get +P/+T (and trample) until the turn ends.
  landfall: z.strictObject({ pt: z.tuple([z.number().int(), z.number().int()]), trample: z.boolean().default(false) }).optional(),
  // "Landfall — … create a P/T <color> <kind> creature token": born at their side, theirs
  // (their retainer), each time they bond with a land (Rampaging Baloths).
  landfall_token: z.strictObject({ creature: z.string(), pt: PtSchema, colors: z.array(z.enum(COLORS)), abilities: z.array(z.enum(ABILITIES)).optional() }).optional(),
  // "Landfall — you may gain control of target creature for as long as you control this" (Roil
  // Elemental): as they bond, they may seize one there (anyone, the player too) as their
  // retainer until they die (sim/retainers.ts `seize`).
  landfall_seize: z.boolean().default(false),
  // "Landfall — you may have target player lose N life. If you do, put M +1/+1 counters on this"
  // (Ob Nixilis, the Fallen): as they bond, one there (their pick after the hour, or none) loses
  // it and they grow for good.
  landfall_drain: z.strictObject({ life: z.number().int().positive(), counters: z.number().int().positive() }).optional(),
  // "Landfall — you may have target creature block this creature this turn if able" (Turntimber
  // Basilisk): its controller may pick one there, caught in its gaze: the two are foes today and
  // that one can't fly from it (user decision 2026-10-01).
  landfall_lure: z.boolean().default(false),
  // "Landfall — you may return this card from your graveyard to the battlefield" (Bloodghast):
  // dead in someone's graveyard, it rises at their side when they bond with a land (sim/bloodghast.ts).
  landfall_return: z.boolean().default(false),
  // "Whenever a creature an opponent controls enters, you may have that player lose N life" (Blood
  // Seeker): one on its tile not of its side gains a creature (sim/seeker.ts).
  drain_on_join: z.number().int().positive().optional(),
  // "This has haste as long as an opponent has N or less life" (Bloodghast): its foes of today.
  haste_low_life: z.number().int().positive().optional(),
  // "Landfall — target player mills N cards" (Hedron Crab): sim/mill.ts.
  landfall_mill: z.number().int().positive().optional(),
  // "As long as an opponent has N or less life, this gets +P/+T and has <abilities>" (Guul Draz
  // Vampire): the same scent, sim/bloodghast.ts.
  low_life_boost: z.strictObject({ at: z.number().int().positive(), pt: z.tuple([z.number().int().min(0), z.number().int().min(0)]), abilities: z.array(z.enum(ABILITIES)).default([]) }).optional(),
  // "Landfall — this loses <ability> until end of turn" (Shoal Serpent: defender).
  landfall_lose: z.array(z.enum(ABILITIES)).default([]),
  // "Landfall — this gains <ability> until end of turn" (Geyser Glider: flying).
  landfall_grant: z.array(z.enum(ABILITIES)).default([]),
  // "Landfall — you may gain N life" (Grazing Gladehart): its controller (master, or itself) gains
  // it (always: a boon).
  landfall_life: z.number().int().positive().optional(),
  // "Landfall — Whenever a land enters the battlefield under your control, you may add one mana of
  // any color" (Lotus Cobra): when whoever controls it (master, or itself) bonds with a land, it
  // standing with them, they have N more mana of any color until midnight (sim/mana.ts).
  landfall_mana: z.number().int().positive().optional(),
  // "If this would be put into a graveyard from the battlefield, put it on the bottom of its owner's
  // library instead" (Nissa's Chosen): it dies into no graveyard and wakes at home N days on
  // (sim/revive.ts).
  revives_after: z.number().int().positive().optional(),
  // "<cost>: Regenerate this creature" (River Boa): as an aura's regeneration, paid by itself
  // whenever it would die or fall (sim/combat.ts `regenerate`).
  regenerate: CostSchema.optional(),
  // "Sacrifice this creature: Remove all counters from target permanent" (Vampire Hexmage):
  // sim/hexmage.ts.
  sac_uncounter: z.boolean().default(false),
  // "Whenever this deals damage to an opponent, you may put a Goblin creature card from your hand
  // onto the battlefield" (Warren Instigator): its controller may call a goblin of the world who
  // serves no one to its side (sim/instigator.ts).
  instigate: z.boolean().default(false),
  // "Whenever an opponent shuffles their library, you may put a +1/+1 counter on this" (Cosi's
  // Trickster): another in its land seeking out a land from afar (sim/trickster.ts).
  shuffle_counter: z.boolean().default(false),
  // "{T}: Draw a card for each Ally you control" (Sea Gate Loremaster): a power of whoever
  // controls them (sim/loremaster.ts).
  tap_draw_allies: z.boolean().default(false),
  // The creature kind a character is (e.g. cre-vampire). A creature entity's sim is its own kind.
  creature: z.string().optional(),
  // A planeswalker's loyalty (law-planeswalkers): their momentum. Loyalty abilities raise
  // or spend it; damage wears it down; at 0 they leave this plane.
  loyalty: z.number().int().min(1).optional(),
  // "As this enters, choose a color. Your opponents can't cast spells of the chosen color"
  // (Iona): entering a fight, they name a color (sim/seal.ts).
  seal: z.boolean().default(false),
  // "At the beginning of your upkeep, you may choose a card type. If you do, each player
  // sacrifices a permanent of that type" (World Queller): sim/quell.ts.
  quell: z.boolean().default(false),
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
  // Damage to whoever set it off equal to the spells they hold (their hand: "damage equal to
  // the number of cards in that player's hand"). Not for morning (gm) events.
  z.strictObject({ type: z.literal('damage_hand') }),
  // Life loss for whoever set it off (sim/life.ts). Not damage, so nothing dodges it. Not for
  // morning (gm) events.
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
  // "Look at the top N cards of your library. You may put a creature card from among them onto
  // the battlefield" (Summoning Trap): N of the world's creature-card characters at random,
  // wherever they are; the LLM, as the trap, draws one there (or none) after the hour: that one
  // is moved to the trap's land, and turns on whoever set it off for the rest of the day.
  z.strictObject({ type: z.literal('summon'), look: z.number().int().positive() }),
  // "Target opponent mills N cards" (Archive Trap): whoever set it off loses N of their
  // memories, at random: what they think of those they know (sim/relations.ts). Not for
  // morning (gm) events.
  z.strictObject({ type: z.literal('forget'), count: z.number().int().positive() }),
  // "Exile all cards from target player's graveyard" (Ravenous Trap): whoever set it off loses
  // their graveyard for good: the spells they let go of (exiled: theirs never again, not even
  // learned anew, `Actor.exiled`) and the retainers who died serving them (none to raise, none
  // to count). Not for morning events.
  z.strictObject({ type: z.literal('exile_graveyard') }),
  // "N damage divided as you choose among any number of target attacking creatures" (Arrow
  // Volley Trap): N damage among those who set it off; the LLM, as the trap, divides it after
  // the hour. Not for morning (gm) events.
  z.strictObject({ type: z.literal('volley'), amount: z.number().int().positive() }),
  // "Attacking creatures get +P/+T until end of turn" (Lethargy Trap: -3/-0): each attacker who
  // set it off, until midnight. Only for `attacked` events.
  z.strictObject({ type: z.literal('pump_attackers'), pt: z.tuple([z.number().int(), z.number().int()]) }),
  // "Destroy target attacking creature without flying" (Pitfall Trap): each who struck as an
  // attacker and can't fly (with `exactly: 1`, the one) is destroyed.
  z.strictObject({ type: z.literal('destroy_attackers'), no_fly: z.boolean().default(false) }),
  // "N damage to target creature", a trap set off by one beset (Inferno Trap): N damage to one of
  // those who hurt them, still standing with them; the LLM, as the trap, picks after the hour.
  // `color`: the trap's (protection from it shields). Only for `hurt` events.
  // "Exile any number of target spells" (Mindbreak Trap): the spell that set it off has no
  // effect, and its caster forgets it (not to their graveyard; they may learn it again). Only
  // for `cast` events (sim/spells.ts `castSpell`).
  z.strictObject({ type: z.literal('counter_spell') }),
  z.strictObject({ type: z.literal('burn'), amount: z.number().int().positive(), color: z.enum(COLORS).optional() }),
  // "Return N target creatures to their owners' hands" (Whiplash Trap): the LLM, as the trap,
  // picks up to N creatures there after the hour; each is flung (sim/bounce.ts). Not for
  // morning (gm) events.
  z.strictObject({ type: z.literal('bounce'), count: z.number().int().positive() }),
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
  // A trap that springs underfoot: where in its land it lies, like `home_pos`.
  pos: z.tuple([z.number().min(-1).max(1), z.number().min(-1).max(1)]).optional(),
  // A trap's card cost: what setting a copy of it costs (Trapmaker's Snare, sim/snare.ts).
  card_cost: CostSchema.optional(),
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
  // "Cast this spell only if you control N or more <kind>" (Feast of Blood: two Vampires): the caster
  // and those who serve them hold that many of a creature kind (a creature entity, e.g. cre-vampire).
  requires: z.strictObject({ kind: z.string(), count: z.number().int().positive() }).optional(),
  // "Whenever an opponent gains life, you may pay <cost>. If you do, return this card from your
  // graveyard to your hand" (Punishing Fire): sim/punish.ts.
  return_on_life_gain: CostSchema.optional(),
  // Where it is learned, and how long that takes.
  learn_at: z.string(),
  learn_hours: z.number().int().min(1).default(4),
  // Who it can target: someone else standing in the same place, or anyone there (self too);
  // self: no target, it is the caster's own (e.g. "create tokens").
  target: z.enum(['other_here', 'any_here', 'self']).default('other_here'),
  // Kicker, for more effect: tap an untapped creature of this kind that the caster controls,
  // or pay this much more mana ("Kicker {6}").
  kicker: z.union([z.strictObject({ tap: z.string() }), z.strictObject({ mana: CostSchema })]).optional(),
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
        // base_pt: "enchanted creature has base power and toughness P/T" (Gigantiform), before
        // any other bonus; abilities: what it has while it wears it (trample).
        z.strictObject({
          type: z.literal('aura'),
          pt: z.tuple([z.number().int(), z.number().int()]).default([0, 0]),
          base_pt: z.tuple([z.number().int().min(0), z.number().int().min(1)]).optional(),
          abilities: z.array(z.enum(ABILITIES)).default([]),
          double_life_on_hit: z.boolean().default(false),
          // "Enchanted creature doesn't untap during its controller's untap step" (Paralyzing
          // Grasp): once bound (tapped), they stay bound at 00:00 while it is on them.
          no_untap: z.boolean().default(false),
          // "Enchanted creature has '<cost>: Regenerate this creature'" (Savage Silhouette): when it
          // would die or fall by damage or be destroyed, whoever controls it pays this if they can,
          // and instead it is healed, bound until midnight and out of today's fights (combat.ts).
          regenerate: CostSchema.optional(),
        }),
        // "If it was kicked, you may search your library for another <this> and put it onto the
        // battlefield": the caster may cast it once more, free, on someone else there (their pick
        // after the hour: the LLM, or the player's pick they owe).
        z.strictObject({ type: z.literal('copy_if_kicked') }),
        // "Destroy target land" (Desecrated Earth): the land the target most lately bonded with
        // (not already destroyed) is destroyed for everyone for a while (law-permanents).
        z.strictObject({ type: z.literal('destroy_land') }),
        // "Its controller discards a card": the target lets go of a spell they hold, their pick.
        z.strictObject({ type: z.literal('discard') }),
        // "Target player discards a card for each <land type> you control" (Mind Sludge: Swamp):
        // as many as the caster holds of that type, not destroyed.
        z.strictObject({ type: z.literal('discard_per_land'), land: z.enum(LAND_TYPES) }),
        // "Deals damage to any target equal to the number of <land type>s you control" (Spire
        // Barrage: Mountains): as many as the caster holds of that type, not destroyed.
        z.strictObject({ type: z.literal('damage_per_land'), land: z.enum(LAND_TYPES) }),
        // "Destroy target artifact or enchantment and up to one other target artifact or
        // enchantment" (Relic Crush): items standing where the caster is, auras on those there.
        // The caster picks after casting, the first surely, the rest if they will (sim/relics.ts).
        z.strictObject({ type: z.literal('destroy_relics'), count: z.number().int().positive() }),
        // "Destroy target artifact or land" (Demolish): after casting, the caster picks an artifact
        // on their tile, the land they stand in, or a land someone there holds (sim/relics.ts).
        z.strictObject({ type: z.literal('demolish') }),
        // "Return target permanent you control to its owner's hand" (Narrow Escape): after casting,
        // the caster picks a being of theirs on their tile (themselves too), a land they hold, an
        // item of theirs or an aura they cast there; one must be picked (sim/escape.ts).
        z.strictObject({ type: z.literal('return_own') }),
        // "Return target nonland permanent to its owner's hand" (Into the Roil): after casting, the
        // caster picks anyone's on their tile, no land: a being (one not theirs is flung, as
        // Whiplash Trap flings), an item someone owns, an aura (sim/escape.ts `any`).
        z.strictObject({ type: z.literal('return_nonland') }),
        // "When this enters, exile target creature. When it leaves, return the exiled card"
        // (Journey to Nowhere): the target (no planeswalker) is taken nowhere until the caster's
        // enchantment is gone (sim/nowhere.ts).
        z.strictObject({ type: z.literal('exile_until') }),
        // "Draw N cards" (if kicked, with if_kicked): the caster comes to know N secrets
        // (sim/knowledge.ts).
        z.strictObject({ type: z.literal('draw'), count: z.number().int().positive(), if_kicked: z.boolean().default(false) }),
        // "Choose one or both — return target creature card / land card from your graveyard to your
        // hand" (Grim Discovery): after casting, the caster may pick of each (sim/discovery.ts).
        z.strictObject({ type: z.literal('grim_discovery') }),
        // "Target creature gets +P/+T and gains <abilities> until end of turn" (Slaughter Cry): the
        // target (no planeswalker), until midnight.
        z.strictObject({ type: z.literal('pump_target'), pt: PtBonusSchema, abilities: z.array(z.enum(ABILITIES)).default([]) }),
        // "Search target player's library for up to N cards, exile them" (Sadistic Sacrament;
        // kicked: `kicked_count`): the spells the target could still learn; the caster picks
        // (sim/sacrament.ts).
        z.strictObject({ type: z.literal('exile_library'), count: z.number().int().positive(), kicked_count: z.number().int().positive().optional() }),
        // "You gain N life": the caster.
        z.strictObject({ type: z.literal('gain_life'), amount: z.number().int().positive() }),
        // "Destroy target non<color> creature. Its controller loses N life" (Hideous End): one on
        // the caster's tile not of that color (a card's; one with none, their lands'), no
        // planeswalker; whoever controls them (their master, or they themselves) loses the life
        // whether or not they fall.
        z.strictObject({ type: z.literal('destroy_target'), not_color: z.enum(COLORS).optional(), lose_life: z.number().int().positive().optional() }),
        // "As an additional cost, sacrifice a land. Search your library for up to N basic land
        // cards, put them onto the battlefield" (Harrow): the caster gives up a land they hold,
        // then bonds from afar with up to N basic lands of the world (sim/harrow.ts).
        z.strictObject({ type: z.literal('harrow'), count: z.number().int().positive() }),
        // "As an additional cost to cast this spell, sacrifice a land" (Magma Rift): cast, the caster
        // gives up a land they hold, one must (as Harrow's first step, sim/harrow.ts).
        z.strictObject({ type: z.literal('sacrifice_land') }),
        // "Gain control of target creature until end of turn. Put N +1/+1 counters on it and untap
        // it. It gains <abilities> until end of turn" (Mark of Mutiny): held as the caster's
        // retainer until midnight, then back to whom it served (sim/retainers.ts `seize`).
        z.strictObject({ type: z.literal('threaten'), counters: z.number().int().min(0).default(0), abilities: z.array(z.enum(ABILITIES)).default([]) }),
        // "Deals N damage to target creature" (Magma Rift): no planeswalker; `any`: "to target
        // creature or player" (Punishing Fire): anyone, a planeswalker's loyalty too.
        // `kicked_amount`: the damage if kicked (Burst Lightning).
        z.strictObject({ type: z.literal('damage'), amount: z.number().int().positive(), any: z.boolean().default(false), kicked_amount: z.number().int().positive().optional() }),
        // "Destroy all creatures" (Day of Judgment): every being on the caster's tile, the caster
        // too (user decision 2026-10-01), not planeswalkers; the indestructible stand.
        z.strictObject({ type: z.literal('destroy_all') }),
        // "Deals N damage to each creature without flying" (Seismic Shudder): every being on the
        // caster's tile (the caster too) that can't fly now, no planeswalker.
        // "Enchant land. When this enters, draw a card. Enchanted land is an Island" (Spreading
        // Seas): after casting, a land someone on the tile holds becomes an Island (sim/flood.ts).
        z.strictObject({ type: z.literal('flood_land') }),
        // "Prevent all combat damage that would be dealt this turn by creatures without trample"
        // (Tanglesap): on the caster's tile, until midnight (sim/combat.ts `fogged`).
        z.strictObject({ type: z.literal('fog') }),
        // "Choose a color. White creatures you control gain protection from it until end of turn"
        // (Brave the Elements): the caster picks after the hour; their white ones on their tile
        // (sim/allies.ts `applyBrave`).
        z.strictObject({ type: z.literal('brave') }),
        // "Target player reveals their hand and discards all Trap cards" (Trapfinder's Trick): in
        // this world, the caster finds every trap hidden in the land they stand in and its areas
        // (sim/knowledge.ts `findTraps`).
        z.strictObject({ type: z.literal('find_traps') }),
        // "Search your library for a Trap card, put it into your hand" (Trapmaker's Snare): the
        // caster comes by one of the world's traps at random, to set where they stand later
        // (sim/snare.ts).
        z.strictObject({ type: z.literal('snare_trap') }),
        z.strictObject({ type: z.literal('damage_grounded'), amount: z.number().int().positive() }),
        // "Reveal the top N cards of your library. Put all creature cards revealed this way into
        // your hand and the rest into your graveyard" (Beast Hunt): N unknown secrets turn up; the
        // caster keeps creatures' whereabouts (sim/knowledge.ts `huntKnowledge`).
        z.strictObject({ type: z.literal('hunt_creatures'), count: z.number().int().positive() }),
        // "You gain N life for each <land type> you control" (Landbind Ritual: Plains): per land
        // of that type the target has bonded with, not destroyed.
        z.strictObject({ type: z.literal('gain_life_per_land'), land: z.enum(LAND_TYPES), amount: z.number().int().positive() }),
        // "Create N P/T <color> <kind> creature tokens" (kicked: `kicked_count` instead): born
        // at the caster's side, their retainers (Conqueror's Pledge).
        z.strictObject({
          type: z.literal('create_retainers'),
          creature: z.string(),
          count: z.number().int().positive(),
          kicked_count: z.number().int().positive().optional(),
          pt: z.tuple([z.number().int().min(0), z.number().int().min(1)]),
          colors: z.array(z.enum(COLORS)),
          // Keywords the tokens have (Elemental Appeal: trample, haste).
          abilities: z.array(z.enum(ABILITIES)).optional(),
          // Creature types the tokens have (Conqueror's Pledge: Kor Soldiers).
          types: z.array(z.enum(CREATURE_TYPES)).optional(),
          // "Exile it at the beginning of the next end step": gone at midnight.
          until_midnight: z.boolean().optional(),
          // "If kicked, that creature gets +P/+T until end of turn".
          kicked_pump: PtBonusSchema.optional(),
        }),
        // "Create a token that's a copy of target creature" (kicked: `kicked_count` instead,
        // Rite of Replication): copies of the target, born the caster's retainers; planeswalkers
        // can't be copied (sim/replicate.ts).
        // "N target creatures you control each get +P/+T and gain <abilities> until end of turn"
        // (Windborne Charge): the caster's own on their tile (themselves and their retainers,
        // user decision 2026-10-01), until midnight; it needs N of them. The caster picks the
        // first as they cast, the rest after (a pick they owe, sim/spells.ts).
        // "Creatures you control get +P/+T until end of turn; if kicked, instead +P'/+T' and
        // <abilities>" (Bold Defense): the caster and their retainers on their tile (user decision
        // 2026-10-01), until midnight.
        z.strictObject({
          type: z.literal('pump_controlled'),
          pt: PtBonusSchema,
          abilities: z.array(z.enum(ABILITIES)).default([]),
          kicked: z.strictObject({ pt: PtBonusSchema, abilities: z.array(z.enum(ABILITIES)).default([]) }).optional(),
        }),
        // "Creatures target player controls get -P/-T until end of turn; if kicked, -P'/-T'"
        // (Marsh Casualties): the target and their retainers on the caster's tile (no
        // planeswalker), until midnight; one whose toughness falls to 0 or below their wounds dies.
        // "Target creature gets -P/-T until end of turn": the one, alone (Disfigure).
        z.strictObject({ type: z.literal('weaken_target'), pt: z.tuple([z.number().int().max(0), z.number().int().max(0)]) }),
        z.strictObject({ type: z.literal('weaken_controlled'), pt: z.tuple([z.number().int().max(0), z.number().int().max(0)]), kicked_pt: z.tuple([z.number().int().max(0), z.number().int().max(0)]).optional() }),
        z.strictObject({ type: z.literal('pump_own'), count: z.number().int().positive(), pt: PtBonusSchema, abilities: z.array(z.enum(ABILITIES)).default([]) }),
        // "Counter target creature spell" (Summoner's Bane): cast only in answer to someone
        // joining another on the caster's tile; the joining comes to nothing (sim/counter.ts).
        z.strictObject({ type: z.literal('counter_creature') }),
        // "Counter target spell" (Cancel): the same, for any spell cast on the caster's tile, and
        // any joining (a creature spell is a spell) (sim/counter.ts).
        z.strictObject({ type: z.literal('counter_spell') }),
        z.strictObject({ type: z.literal('copy_target'), count: z.number().int().positive(), kicked_count: z.number().int().positive().optional() }),
      ]),
    )
    .min(1),
});
export type SpellEffect = z.infer<typeof SpellSimSchema>['effects'][number];

// An item (an MTG artifact, world/entities/items): it stands in one place and becomes the
// possession of whoever pays its cost there (tames it). An enchantment that is no aura (one
// that isn't on someone) stands in a place the same way, as `card_type: enchantment` (user
// decision 2026-09-30): what destroys artifacts or enchantments reaches both (sim/relics.ts).
export const ItemSimSchema = z.strictObject({
  card_type: z.enum(['artifact', 'enchantment']).default('artifact'),
  cost: CostSchema,
  at: z.string(),
  // Where in its land it stands, like `home_pos`.
  pos: z.tuple([z.number().min(-1).max(1), z.number().min(-1).max(1)]).optional(),
  // Equipment (Grappling Hook): tamed, it is carried by its owner (not standing); "Equip <cost>":
  // its owner pays to put it on themselves or a retainer standing with them, who then has
  // `abilities`; `lure`: "whenever equipped creature attacks, you may have target creature
  // block it": the one it falls on can't fly from it (sim/equipment.ts).
  // `unblockable_by`: "equipped creature can't be blocked by Vampires" (creature kinds, Blazing
  // Torch, sim/combat.ts); `sac_damage`: "equipped creature has '{T}, Sacrifice this: it deals N
  // damage to any target'" (sim/fling.ts).
  // `death_counters`: "Whenever a creature dies, put a +1/+1 counter on equipped creature (two on a
  // Vampire)" (Blade of the Bloodchief): a death on its bearer's tile (sim/bloodchief.ts).
  // `attack_reveal`: "Whenever equipped creature attacks, look at the top card of your library;
  // a land, you may put it onto the battlefield tapped" (Explorer's Scope, sim/scope.ts).
  // `landfall_pump`: "Landfall — equipped creature gets +P/+T until end of turn" (Adventuring
  // Gear): when its owner bonds with a land, its bearer, until midnight (sim/items.ts).
  equip: z.strictObject({ cost: CostSchema, abilities: z.array(z.enum(ABILITIES)).default([]), lure: z.boolean().default(false), death_counters: z.boolean().default(false), unblockable_by: z.array(z.string()).default([]), sac_damage: z.number().int().positive().optional(), landfall_pump: z.tuple([z.number().int().min(0), z.number().int().min(0)]).optional(), attack_reveal: z.boolean().default(false) }).optional(),
  effects: z
    .array(
      z.discriminatedUnion('type', [
        // "Enters with X charge counters, where X is your life total": when tamed.
        z.strictObject({ type: z.literal('charge_life') }),
        // "Landfall — you may have your life total become the number of charge counters": when
        // its owner bonds with a land, if that raises their life.
        z.strictObject({ type: z.literal('landfall_set_life') }),
        // "Creatures you control get +P/+T and have <abilities>" (sim/monument.ts).
        // `counters`: only while it has that many quest counters (Beastmaster Ascension: seven).
        z.strictObject({ type: z.literal('anthem'), pt: z.tuple([z.number().int(), z.number().int()]), abilities: z.array(z.enum(ABILITIES)).default([]), counters: z.number().int().positive().optional() }),
        // "At the beginning of your upkeep, sacrifice a creature. If you can't, sacrifice this."
        z.strictObject({ type: z.literal('upkeep_sacrifice') }),
        // "{T}: Add N mana of any one color": its owner draws on N more of any color each turn
        // (sim/mana.ts `manaCapacity`).
        z.strictObject({ type: z.literal('mana'), amount: z.number().int().positive() }),
        // "<cost>, Sacrifice a creature: Draw N cards" (Carnage Altar): its owner, before it, offers
        // one who serves them (sim/altar.ts).
        // "{2}, {T}, Sacrifice this: Search your library for a land card, put it into your hand"
        // (Expedition Map): sim/chart.ts.
        z.strictObject({ type: z.literal('search_hand'), cost: CostSchema }),
        z.strictObject({ type: z.literal('sacrifice_draw'), cost: CostSchema, draws: z.number().int().positive().default(1) }),
        // "When this enters, return N lands you control to their owner's hand": when tamed, the
        // tamer's bonds with N lands break (they may bond with them again).
        z.strictObject({ type: z.literal('return_lands'), count: z.number().int().positive() }),
        // "At the beginning of each end step, if you drew N or more cards this turn, you may put
        // a quest counter on this. As long as it has M or more, if you would draw a card, you may
        // instead search your library for a card and put it into your hand" (Archmage
        // Ascension): a counter at midnight for an owner who came to know N secrets that day;
        // with M, what they would come to know they have for real instead (sim/ascension.ts).
        z.strictObject({ type: z.literal('quest'), draws: z.number().int().positive(), counters: z.number().int().positive() }),
        // "Whenever a creature you control attacks, you may put a quest counter on this"
        // (Beastmaster Ascension): each creature its owner controls, the first time a day it
        // falls on someone, puts one on it (sim/ascension.ts `attackQuest`).
        z.strictObject({ type: z.literal('attack_quest') }),
        // "Landfall — you may put a quest counter on this" (Ior Ruin Expedition): each land its
        // owner bonds with puts one on it (sim/items.ts `itemsOnLandfall`).
        z.strictObject({ type: z.literal('landfall_quest') }),
        // "At the beginning of each opponent's end step, if you didn't lose life this turn, you may
        // put a quest counter on this" (Luminarch Ascension): at midnight, for an owner who neither
        // lost life nor took damage that day (sim/luminarch.ts).
        z.strictObject({ type: z.literal('quest_unhurt') }),
        // "Whenever you cast an instant or sorcery spell that has the same name as a card in your
        // graveyard, you may put a quest counter on this. Whenever you cast an instant or sorcery
        // while this has N or more, you may copy that spell" (Pyromancer Ascension):
        // sim/pyromancer.ts.
        z.strictObject({ type: z.literal('spell_quest'), counters: z.number().int().positive() }),
        // "At each end step, if an opponent lost 2 or more life this turn, a quest counter; with N or
        // more, whenever a card goes into an opponent's graveyard, they lose `drain` life and you
        // gain as much" (Bloodchief Ascension): sim/bloodascension.ts.
        z.strictObject({ type: z.literal('bloodchief'), counters: z.number().int().positive(), drain: z.number().int().positive() }),
        // "<cost>: Create a P/T <creature> token with <abilities>. Activate only if this has N or
        // more quest counters" (Luminarch Ascension): its owner pays, whenever they will, and it
        // serves them (sim/luminarch.ts).
        z.strictObject({ type: z.literal('quest_token'), counters: z.number().int().positive(), cost: CostSchema, creature: z.string(), pt: z.tuple([z.number().int().positive(), z.number().int().positive()]), colors: z.array(z.enum(COLORS)).default([]), abilities: z.array(z.enum(ABILITIES)).default([]), types: z.array(z.enum(CREATURE_TYPES)).default([]) }),
        // "Remove N quest counters from this and sacrifice it: Draw M cards" (Ior Ruin
        // Expedition: `draws`) / "search for up to M basic land cards, put them onto the
        // battlefield tapped" (Khalni Heart Expedition: `lands`): its owner, whenever they will,
        // ends it and comes to know M secrets, or bonds from afar with up to M basic lands,
        // tapped (sim/expedition.ts).
        // `plus_counters`: "put four +1/+1 counters on target creature" (Quest for the Gemblades).
        // `token`: "create a 7/1 red Elemental with trample and haste. Exile it at the next end step"
        // (Zektar Shrine Expedition): it serves the owner, gone at midnight.
        z.strictObject({ type: z.literal('expedition'), counters: z.number().int().positive(), draws: z.number().int().positive().optional(), lands: z.number().int().positive().optional(), plus_counters: z.number().int().positive().optional(), token: z.strictObject({ creature: z.string(), pt: z.tuple([z.number().int().positive(), z.number().int().positive()]), colors: z.array(z.enum(COLORS)).default([]), abilities: z.array(z.enum(ABILITIES)).default([]), until_midnight: z.boolean().default(false) }).optional() }).refine((e) => !!e.draws || !!e.lands || !!e.plus_counters || !!e.token, '보상(draws, lands, plus_counters, token)이 있어야 한다'),
        // "Whenever a creature you control deals combat damage to a creature, you may put a quest
        // counter on this" (Quest for the Gemblades): sim/expedition.ts `gembladesHit`.
        z.strictObject({ type: z.literal('quest_combat') }),
        // "Whenever a creature enters the battlefield under your control, you may pay <cost>. If
        // you do, that creature deals damage equal to its power to any target" (Electropotence):
        // sim/electro.ts.
        z.strictObject({ type: z.literal('enter_strike'), cost: CostSchema }),
      ]),
    )
    .default([]),
}).refine((x) => x.effects.length > 0 || !!x.equip, '효과(effects)나 장착(equip)이 있어야 한다');
export type ItemEffect = z.infer<typeof ItemSimSchema>['effects'][number];

export const EventSimSchema = z.discriminatedUnion('trigger', [
  // The morning LLM decides whether it happens today. `chance` is the share of days it
  // usually happens on, a guide for the LLM.
  z.strictObject({ ...EventBase, ...EventCost, trigger: z.literal('gm'), chance: z.number().min(0).max(1) }),
  // Goes off when someone makes landfall on `region` (arrives there) and it is at least their
  // `landfalls`-th landfall this turn (game day).
  z.strictObject({ ...EventBase, ...EventCost, trigger: z.literal('landfall'), landfalls: z.number().int().min(1).default(1) }),
  // Goes off when someone arrives in `region` (exactly there: an area is entered on its own).
  // With gained_life, only for those who gained life this turn (game day); with refused, only
  // for those turned down this turn as they sought to make someone follow them (Summoning Trap:
  // "if a creature spell you cast this turn was countered by an opponent"); with searched, only
  // for those who sought out a land with a fetch land this turn (Archive Trap: "if an opponent
  // searched their library this turn").
  z.strictObject({
    ...EventBase,
    ...EventCost,
    trigger: z.literal('enter'),
    gained_life: z.boolean().default(false),
    refused: z.boolean().default(false),
    searched: z.boolean().default(false),
    // Only for those who tamed an item this turn (Baloth Cage Trap: "if an opponent had an
    // artifact enter the battlefield under their control this turn").
    claimed: z.boolean().default(false),
    // Only for those who had this many creatures or more come under their control this turn
    // (Whiplash Trap: "if an opponent had two or more creatures enter the battlefield under
    // their control this turn"): retainers who joined, were born or were raised theirs today.
    joined: z.number().int().min(1).optional(),
    // Only for those who had this many or more go into their graveyard this turn (Ravenous Trap:
    // "if an opponent had three or more cards put into their graveyard from anywhere this turn"):
    // spells let go of, retainers who died serving them (`Actor.buried`).
    buried: z.number().int().min(1).optional(),
  }),
  // Goes off when a noncreature permanent in `region` is destroyed by someone else's doing (a
  // spell, an ability or another event): for now the land itself (law-permanents).
  z.strictObject({ ...EventBase, ...EventCost, trigger: z.literal('destroyed') }),
  // Goes off for anyone in `region` (or its areas) who has drawn `cards` or more spells this
  // turn ("if an opponent drew three or more cards this turn"): once a day for each.
  z.strictObject({ ...EventBase, ...EventCost, trigger: z.literal('drew'), cards: z.number().int().min(1) }),
  // Goes off when `attackers` or more strike as attackers in `region` in the same hour ("if four
  // or more creatures are attacking", Arrow Volley Trap): those attackers set it off. `exactly`:
  // that many and no more ("if exactly one creature is attacking", Pitfall Trap); `on_tile`: only
  // on the one tile it lies hidden in (`pos`), as a trap underfoot.
  z.strictObject({ ...EventBase, ...EventCost, trigger: z.literal('attacked'), attackers: z.number().int().min(1), exactly: z.boolean().default(false), on_tile: z.boolean().default(false) }),
  // Goes off for anyone in `region` (or its areas) dealt combat damage by `creatures` or more
  // this turn ("if you've been dealt damage by two or more creatures this turn", Inferno Trap):
  // in the hour it happens, once a day for each.
  z.strictObject({ ...EventBase, ...EventCost, trigger: z.literal('hurt'), creatures: z.number().int().min(1) }),
  // Goes off as anyone in `region` (or its areas) casts their `spells`-th spell this turn ("if
  // an opponent cast three or more spells this turn", Mindbreak Trap), before it resolves:
  // once a day for each.
  z.strictObject({ ...EventBase, ...EventCost, trigger: z.literal('cast'), spells: z.number().int().min(1) }),
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
  // The basic land type it has whatever its terrain (`sim.land_type`).
  landType?: LandType;
  noMana: boolean;
  notLand?: boolean;
  // The land this place is one with (`sim.one_land_with`): bonds go to that one.
  oneLandWith?: string;
  wanders?: { perDay: number; stops: { name: string; x: number; y: number }[] };
  fetch?: { types: LandType[]; life: number };
  fallenMana?: { color: Color; cost: number };
  climbHours?: number;
  upkeepRevive?: { plains: number };
  // Keeps days (sim/eons.ts): what leaving one costs, besides tapping the land.
  eon?: { cost: ManaCost; costText: string };
  // Tapped, gives a +1/+1 counter to each creature of this color that came into play today.
  growEntered?: { color: Color };
  // Burns someone in its region when its holder bonds with a mountain and holds N others.
  mountainFire?: { others: number; damage: number };
  // An area inside this region (its x, y are the region's). Areas are lands of their own:
  // people meet, bond, and get hit by events there, but an event on the region reaches them.
  parent?: string;
  // The land at the top an area lies in (its region's, for an area in an area).
  top?: string;
  // How large a region is drawn (web/view.ts).
  size?: 'continent' | 'island';
  // The continent this island belongs to (`map.of`), for the map only.
  of?: string;
  // An area's place among its region's areas on the map (`map.order`), east to west.
  order?: number;
  // Where it lies inside its region on the map (`map.pos`), in parts of its radius.
  pos?: [number, number];
  // Tiles it holds of its region (an area, `map.tiles`), and how large it is drawn (sim/tiles.ts).
  tileCount?: number;
  radius?: number;
};

export type NpcDef = {
  // A token gone at this time (Elemental Appeal's elemental: midnight).
  vanishAt?: number;
  // A token copy of someone (Rite of Replication, sim/replicate.ts): whom it was made from.
  copyOf?: string;
  id: string;
  name: string;
  summary: string;
  role: string;
  home: string;
  homePos?: [number, number];
  persona: string;
  goal: string;
  pt: Pt;
  mana?: Mana;
  abilities: Ability[];
  needs: Need[];
  beast?: boolean;
  followsOnly?: string;
  tapShield?: number;
  tapGrant?: { ability: Ability; cost: ManaCost; costText: string };
  tapLoot?: boolean;
  tapSearch?: { cost: ManaCost; costText: string; types: LandType[] };
  equipAnthem?: { kind: CreatureType; pt: [number, number] };
  equippedGrant?: Ability[];
  hitSacrificeLand?: boolean;
  cantBlockUnless?: string;
  upkeepReturnLand?: boolean;
  extraLands?: number;
  revealTop?: boolean;
  tapFoe?: { cost: ManaCost; costText: string; noFly: boolean };
  engulf?: boolean;
  counterTokens?: { creature: string; pt: Pt; colors: Color[] };
  upkeepBurn?: { damage: number; maxHand: number };
  tapMana?: Partial<Record<Color, number>>;
  winsAtLife?: number;
  extraCombat?: { cost: ManaCost; costText: string };
  pump?: { cost: ManaCost; costText: string; pt: [number, number] };
  emptyHandPump?: [number, number];
  attackPump?: { land: LandType; pt: [number, number] };
  discardOnHit?: boolean;
  ally?: boolean;
  rally?: ({ type: 'damage_allies' | 'damage_fliers' | 'lose_life_allies' | 'reveal_discard' | 'counters_allies' | 'counter_self' | 'gain_life_allies' | 'ward_allies' } | { type: 'grant_allies'; ability: Ability } | { type: 'token_counter'; creature: string; pt: [number, number]; colors: Color[] })[];
  hireable?: boolean;
  foresight?: boolean;
  landfall?: { pt: [number, number]; trample: boolean };
  landfallToken?: { creature: string; pt: Pt; colors: Color[]; abilities?: Ability[] };
  landfallSeize?: boolean;
  landfallLose?: Ability[];
  landfallGrant?: Ability[];
  landfallLife?: number;
  landfallMana?: number;
  revivesAfter?: number;
  regenerate?: string;
  sacUncounter?: boolean;
  instigate?: boolean;
  shuffleCounter?: boolean;
  attackGift?: boolean;
  landfallDrain?: { life: number; counters: number };
  landfallLure?: boolean;
  landfallReturn?: boolean;
  drainOnJoin?: number;
  hasteLowLife?: number;
  landfallMill?: number;
  lowLifeBoost?: { at: number; pt: [number, number]; abilities: Ability[] };
  tapDrawAllies?: boolean;
  types?: CreatureType[];
  enterDestroy?: { kind?: CreatureType; kicker?: ManaCost; kickerText?: string; flying?: boolean };
  enterDrain?: { per: string };
  enterSearch?: { types: LandType[]; tapped: boolean };
  enterShatter?: { kicker?: ManaCost; kickerText?: string; nonbasic?: boolean; relics?: boolean };
  enterExile?: { color: Color };
  enterTap?: boolean;
  enterNoBlock?: boolean;
  enterSacrifice?: { kicker: ManaCost; kickerText: string };
  enterPump?: { pt: [number, number]; kicker: ManaCost; kickerText: string };
  enterRally?: { pt: [number, number]; abilities: Ability[]; kicker: ManaCost; kickerText: string };
  enterDamage?: { amount: number; kicker?: ManaCost; kickerText?: string };
  enterGrant?: { ability: Ability; kicker: ManaCost; kickerText: string };
  enterEquip?: boolean;
  enterReturn?: boolean;
  enterTapMany?: { count: number; kicker: ManaCost; kickerText: string };
  enterReveal?: { count: number; type: LandType };
  enterDraw?: { count: number; discard?: number; kicker?: ManaCost; kickerText?: string };
  protection?: Color[];
  // The creature kind they are (e.g. cre-vampire), for "a Vampire you control".
  creature?: string;
  // Their colors when their mana doesn't say (e.g. a black Vampire risen in play).
  colors?: Color[];
  // Planeswalkers' loyalty, the colors of spells they hold, and powers the morning LLM may
  // use for them. Characters born in play (state.tokens) have none.
  loyalty?: number;
  knowsColors?: Color[];
  activated?: ActivatedAbility[];
  // Names a color entering a fight; their opponents can't cast spells of it (sim/seal.ts).
  seal?: boolean;
  quell?: boolean;
};

export type SpellDef = {
  id: string;
  name: string;
  summary: string;
  cost: ManaCost;
  costText: string;
  speed: 'sorcery' | 'instant';
  requires?: { kind: string; count: number };
  returnOnLifeGain?: { cost: ManaCost; text: string };
  target: 'other_here' | 'any_here' | 'self';
  learnAt: string;
  learnHours: number;
  kicker?: { tap: string; mana?: undefined; manaText?: undefined } | { tap?: undefined; mana: ManaCost; manaText: string };
  effects: SpellEffect[];
};

export type ItemDef = {
  id: string;
  name: string;
  summary: string;
  // A card type: artifact (most), or an enchantment that is no aura.
  cardType: 'artifact' | 'enchantment';
  cost: ManaCost;
  costText: string;
  at: string;
  effects: ItemEffect[];
  pos?: [number, number];
  equip?: { cost: ManaCost; costText: string; abilities: Ability[]; lure: boolean; deathCounters?: boolean; landfallPump?: [number, number]; attackReveal?: boolean; unblockableBy?: string[]; sacDamage?: number };
};

// Who answers when spoken to.
export type Speaker = Pick<NpcDef, 'id' | 'name' | 'persona' | 'goal' | 'role'>;

export type EventDef = {
  id: string;
  name: string;
  summary: string;
  region: string;
  range: number;
  trigger: 'gm' | 'landfall' | 'enter' | 'destroyed' | 'drew' | 'attacked' | 'hurt' | 'cast';
  chance?: number; // gm
  landfalls?: number; // landfall
  gained_life?: boolean; // enter
  refused?: boolean; // enter
  searched?: boolean; // enter
  claimed?: boolean; // enter
  joined?: number; // enter
  buried?: number; // enter
  cards?: number; // drew
  attackers?: number; // attacked
  exactly?: boolean; // attacked
  on_tile?: boolean; // attacked
  creatures?: number; // hurt
  spells?: number; // cast
  cooldownHours: number;
  scope: 'region' | 'world';
  omen?: string;
  text: string;
  effects: Effect[];
  cost?: { by: string; mana: ManaCost; text: string };
  pos?: [number, number];
  cardCost?: { mana: ManaCost; text: string };
  // A copy someone set (Trapmaker's Snare): the tile it lies on, and who set it.
  tile?: [number, number];
  setBy?: string;
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
  // The grid (sim/tiles.ts): each land's tiles, and which land each tile ("c,r") is.
  tiles?: Record<string, Tile[]>;
  tileOwner?: Record<string, string>;
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
          ...('in' in map.data ? { x: 0, y: 0, parent: map.data.in, order: map.data.order, ...(map.data.pos ? { pos: map.data.pos } : {}), ...(map.data.tiles ? { tileCount: map.data.tiles } : {}) } : { x: map.data.x, y: map.data.y, size: map.data.size, of: map.data.of, ...(map.data.tiles ? { tileCount: map.data.tiles } : {}) }),
          terrain: map.data.terrain,
          color: c === 'C' ? null : Array.isArray(c) ? (`${c[0]}/${c[1]}` as Hybrid) : (c ?? TERRAINS[map.data.terrain].mana),
          entersTapped: land.data?.enters_tapped ?? false,
          onBond: land.data?.on_bond ?? [],
          nonbasic: land.data?.nonbasic ?? false,
          ...(land.data?.land_type ? { landType: land.data.land_type } : {}),
          noMana: land.data?.no_mana ?? false,
          ...(land.data?.not_land ? { notLand: true, noMana: true } : {}),
          ...(land.data?.one_land_with ? { oneLandWith: land.data.one_land_with } : {}),
          ...(land.data?.wanders ? { wanders: { perDay: land.data.wanders.per_day, stops: land.data.wanders.stops } } : {}),
          fetch: land.data?.fetch,
          fallenMana: land.data?.fallen_mana,
          climbHours: land.data?.climb_hours,
          upkeepRevive: land.data?.upkeep_revive,
          eon: land.data?.eon && { cost: parseManaCost(land.data.eon.cost)!, costText: land.data.eon.cost },
          growEntered: land.data?.grow_entered,
          mountainFire: land.data?.mountain_fire,
        });
      }
    }
  }
  // An island belongs to a region, not to an area or itself.
  for (const r of world.regions) {
    if (!r.of) continue;
    const c = world.regions.find((x) => x.id === r.of);
    if (!c) err(r.id, `map.of ${r.of} 가 맵에 없음`);
    else if (c.parent || c.id === r.id) err(r.id, `map.of ${r.of} 는 다른 지역이어야 함 (구역이나 자기 자신은 안 됨)`);
  }
  // A place one land with another: that one must be a land of its own, not one with a third.
  for (const r of world.regions) {
    if (!r.oneLandWith) continue;
    const o = world.regions.find((x) => x.id === r.oneLandWith);
    if (!o) err(r.id, `sim.one_land_with ${r.oneLandWith} 가 맵에 없음`);
    else if (o.oneLandWith || o.notLand) err(r.id, `sim.one_land_with ${r.oneLandWith} 는 그 자체로 땅이어야 함`);
  }
  // Areas sit where their region is. An area may hold areas of its own (user decision
  // 2026-10-01), never in a sea region (a sea may be an area of a land region, as a bay: Thunder
  // Bay in Murasa, user decision 2026-09-30).
  for (const r of world.regions) {
    if (!r.parent) continue;
    const p = world.regions.find((x) => x.id === r.parent);
    if (!p) err(r.id, `map.in ${r.parent} 가 맵에 없음`);
    else if (TERRAINS[topOf(world, p).terrain].sea) err(r.id, `map.in ${r.parent} 은 바다 안이라 구역을 둘 수 없음`);
    else if (within(world, p.id, r.id)) err(r.id, `map.in ${r.parent} 가 돌고 돎 (구역이 제 안에 들어감)`);
    else if (TERRAINS[p.terrain].sea) err(r.id, '바다 지역 안에는 구역을 둘 수 없음 (바다 구역은 뭍 지역 안에 둔다)');
    else {
      const top = topOf(world, p);
      Object.assign(r, { x: top.x, y: top.y, top: top.id });
    }
  }
  layTiles(world);

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
      const { knows_colors, activated, wins_at_life, extra_combat, pump, empty_hand_pump, attack_pump, discard_on_hit, landfall_token, landfall_seize, landfall_lose, landfall_grant, landfall_life, landfall_mana, revives_after, regenerate, sac_uncounter, instigate, shuffle_counter, attack_gift, landfall_drain, landfall_lure, landfall_return, drain_on_join, haste_low_life, low_life_boost, landfall_mill, enter_destroy, enter_drain, enter_draw, enter_search, enter_shatter, enter_exile, enter_tap, enter_damage, enter_grant, enter_equip, enter_return, enter_tap_many, enter_pump, enter_rally, enter_sacrifice, enter_no_block, enter_reveal, upkeep_return_land, extra_lands, reveal_top, tap_foe, tap_draw_allies, engulf, tap_mana, upkeep_burn, counter_tokens, follows_only, cant_block_unless, tap_shield, tap_grant, tap_loot, tap_search, equip_anthem, equipped_grant, hit_sacrifice_land, name, home_pos, ...rest } = sim.data;

      world.npcs.push({
        id: e.id,
        name: name ?? e.name,
        summary: e.summary ?? '',
        ...rest,
        creature: e.kind === 'creature' ? e.id : rest.creature,
        knowsColors: knows_colors,
        ...(wins_at_life !== undefined ? { winsAtLife: wins_at_life } : {}),
        ...(landfall_token ? { landfallToken: landfall_token } : {}),
        ...(landfall_seize ? { landfallSeize: true } : {}),
        ...(landfall_lose.length ? { landfallLose: landfall_lose } : {}),
        ...(landfall_grant.length ? { landfallGrant: landfall_grant } : {}),
        ...(landfall_life ? { landfallLife: landfall_life } : {}),
        ...(landfall_mana ? { landfallMana: landfall_mana } : {}),
        ...(revives_after ? { revivesAfter: revives_after } : {}),
        ...(regenerate ? { regenerate } : {}),
        ...(sac_uncounter ? { sacUncounter: true } : {}),
        ...(instigate ? { instigate: true } : {}),
        ...(shuffle_counter ? { shuffleCounter: true } : {}),
        ...(attack_gift ? { attackGift: true } : {}),
        ...(enter_destroy
          ? { enterDestroy: typeof enter_destroy === 'string' ? { kind: enter_destroy } : { kind: enter_destroy.kind, ...(enter_destroy.kicker ? { kicker: parseManaCost(enter_destroy.kicker)!, kickerText: enter_destroy.kicker } : {}), ...(enter_destroy.flying ? { flying: true } : {}) } }
          : {}),
        ...(enter_drain ? { enterDrain: enter_drain } : {}),
        ...(enter_search ? { enterSearch: enter_search } : {}),
        ...(enter_exile ? { enterExile: { color: enter_exile.color } } : {}),
        ...(enter_tap ? { enterTap: true } : {}),
        ...(enter_no_block ? { enterNoBlock: true } : {}),
        ...(enter_sacrifice ? { enterSacrifice: { kicker: parseManaCost(enter_sacrifice.kicker)!, kickerText: enter_sacrifice.kicker } } : {}),
        ...(enter_pump ? { enterPump: { pt: enter_pump.pt, kicker: parseManaCost(enter_pump.kicker)!, kickerText: enter_pump.kicker } } : {}),
        ...(enter_rally ? { enterRally: { pt: enter_rally.pt, abilities: enter_rally.abilities, kicker: parseManaCost(enter_rally.kicker)!, kickerText: enter_rally.kicker } } : {}),
        ...(enter_equip ? { enterEquip: true } : {}),
        ...(enter_return ? { enterReturn: true } : {}),
        ...(enter_tap_many ? { enterTapMany: { count: enter_tap_many.count, kicker: parseManaCost(enter_tap_many.kicker)!, kickerText: enter_tap_many.kicker } } : {}),
        ...(enter_grant ? { enterGrant: { ability: enter_grant.ability, kicker: parseManaCost(enter_grant.kicker)!, kickerText: enter_grant.kicker } } : {}),
        ...(enter_damage ? { enterDamage: { amount: enter_damage.amount, ...(enter_damage.kicker ? { kicker: parseManaCost(enter_damage.kicker)!, kickerText: enter_damage.kicker } : {}) } } : {}),
        ...(enter_reveal ? { enterReveal: { count: enter_reveal.count, type: enter_reveal.land_type } } : {}),
        ...(enter_shatter ? { enterShatter: { ...(enter_shatter.kicker ? { kicker: parseManaCost(enter_shatter.kicker)!, kickerText: enter_shatter.kicker } : {}), ...(enter_shatter.nonbasic ? { nonbasic: true } : {}), ...(enter_shatter.relics ? { relics: true } : {}) } } : {}),
        ...(upkeep_return_land ? { upkeepReturnLand: true } : {}),
        ...(extra_lands ? { extraLands: extra_lands } : {}),
        ...(reveal_top ? { revealTop: true } : {}),
        ...(engulf ? { engulf: true } : {}),
        ...(follows_only ? { followsOnly: follows_only } : {}),
        ...(tap_shield ? { tapShield: tap_shield } : {}),
        ...(tap_grant ? { tapGrant: { ability: tap_grant.ability, cost: parseManaCost(tap_grant.cost)!, costText: tap_grant.cost } } : {}),
        ...(tap_loot ? { tapLoot: true } : {}),
        ...(tap_search ? { tapSearch: { cost: parseManaCost(tap_search.cost)!, costText: tap_search.cost, types: tap_search.types } } : {}),
        ...(equip_anthem ? { equipAnthem: equip_anthem } : {}),
        ...(equipped_grant.length ? { equippedGrant: equipped_grant } : {}),
        ...(hit_sacrifice_land ? { hitSacrificeLand: true } : {}),
        ...(cant_block_unless ? { cantBlockUnless: cant_block_unless } : {}),
        ...(counter_tokens ? { counterTokens: { creature: counter_tokens.creature, pt: [...counter_tokens.pt], colors: [...counter_tokens.colors] } } : {}),
        ...(upkeep_burn ? { upkeepBurn: { damage: upkeep_burn.damage, maxHand: upkeep_burn.max_hand } } : {}),
        ...(tap_mana ? { tapMana: tap_mana } : {}),
        ...(tap_foe ? { tapFoe: { cost: parseManaCost(tap_foe.cost)!, costText: tap_foe.cost, noFly: tap_foe.no_fly } } : {}),
        ...(home_pos ? { homePos: home_pos } : {}),
        ...(enter_draw ? { enterDraw: { count: enter_draw.count, discard: enter_draw.discard, ...(enter_draw.kicker ? { kicker: parseManaCost(enter_draw.kicker)!, kickerText: enter_draw.kicker } : {}) } } : {}),
        ...(landfall_drain ? { landfallDrain: landfall_drain } : {}),
        ...(landfall_lure ? { landfallLure: true } : {}),
        ...(landfall_return ? { landfallReturn: true } : {}),
        ...(drain_on_join ? { drainOnJoin: drain_on_join } : {}),
        ...(haste_low_life ? { hasteLowLife: haste_low_life } : {}),
        ...(landfall_mill ? { landfallMill: landfall_mill } : {}),
        ...(low_life_boost ? { lowLifeBoost: low_life_boost } : {}),
        ...(tap_draw_allies ? { tapDrawAllies: true } : {}),
        ...(extra_combat ? { extraCombat: { cost: parseManaCost(extra_combat.cost)!, costText: extra_combat.cost } } : {}),
        ...(pump ? { pump: { cost: parseManaCost(pump.cost)!, costText: pump.cost, pt: pump.pt } } : {}),
        ...(empty_hand_pump ? { emptyHandPump: empty_hand_pump } : {}),
        ...(attack_pump ? { attackPump: attack_pump } : {}),
        ...(discard_on_hit ? { discardOnHit: true } : {}),
        activated: activated.map((x) => ({ ...x, cost: parseManaCost(x.cost)!, costText: x.cost })),
      });
    } else if (e.kind === 'event') {
      const sim = EventSimSchema.safeParse(e.sim);
      if (!sim.success) {
        err(e.id, `sim 오류: ${issues(sim.error)}`);
        continue;
      }
      const { cooldown_hours, effects, cost, card_cost, ...rest } = sim.data;
      if (rest.trigger !== 'attacked' && effects.some((x) => x.type === 'pump_attackers' || x.type === 'destroy_attackers')) err(e.id, 'pump_attackers, destroy_attackers 는 trigger: attacked 사건에만 쓸 수 있음 (덤빈 이들에게)');
      if (rest.trigger !== 'cast' && effects.some((x) => x.type === 'counter_spell')) err(e.id, 'counter_spell 은 trigger: cast 사건에만 쓸 수 있음 (막을 주문이 있어야 함)');
      if (rest.trigger !== 'hurt' && effects.some((x) => x.type === 'burn')) err(e.id, 'burn 은 trigger: hurt 사건에만 쓸 수 있음 (누가 누구에게 다쳤는지 알아야 함)');
      if (rest.trigger !== 'landfall' && effects.some((x) => x.type === 'destroy_lands'))
        err(e.id, 'destroy_lands 는 trigger: landfall 사건에만 쓸 수 있음 (누가 상륙한 땅인지 알아야 함)');
      if (rest.trigger === 'gm' && effects.some((x) => x.type === 'lose_life' || x.type === 'damage_hand' || x.type === 'forget' || x.type === 'exile_graveyard' || x.type === 'summon' || x.type === 'volley' || x.type === 'bounce'))
        err(e.id, 'lose_life, damage_hand, forget, exile_graveyard, summon, volley, bounce 는 trigger: gm 사건에 쓸 수 없음 (누가 일으켰는지 알아야 함)');
      world.events.push({
        id: e.id,
        name: e.name,
        summary: e.summary ?? '',
        ...rest,
        cooldownHours: cooldown_hours,
        effects,
        ...(cost ? { cost: { by: cost.by, mana: parseManaCost(cost.mana)!, text: cost.mana } } : {}),
        ...(card_cost ? { cardCost: { mana: parseManaCost(card_cost)!, text: card_cost } } : {}),
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
        ...(d.requires ? { requires: d.requires } : {}),
        ...(d.return_on_life_gain ? { returnOnLifeGain: { cost: parseManaCost(d.return_on_life_gain)!, text: d.return_on_life_gain } } : {}),
        target: d.target,
        learnAt: d.learn_at,
        learnHours: d.learn_hours,
        ...(d.kicker ? { kicker: 'tap' in d.kicker ? { tap: d.kicker.tap } : { mana: parseManaCost(d.kicker.mana)!, manaText: d.kicker.mana } } : {}),
        effects: d.effects,
      });
    } else if (e.kind === 'item') {
      const sim = ItemSimSchema.safeParse(e.sim);
      if (!sim.success) {
        err(e.id, `sim 오류: ${issues(sim.error)}`);
        continue;
      }
      const d = sim.data;
      world.items.push({ id: e.id, name: e.name, summary: e.summary ?? '', cardType: d.card_type, cost: parseManaCost(d.cost)!, costText: d.cost, at: d.at, ...(d.pos ? { pos: d.pos } : {}), effects: d.effects, ...(d.equip ? { equip: { cost: parseManaCost(d.equip.cost)!, costText: d.equip.cost, abilities: d.equip.abilities, lure: d.equip.lure, ...(d.equip.death_counters ? { deathCounters: true } : {}), ...(d.equip.unblockable_by.length ? { unblockableBy: d.equip.unblockable_by } : {}), ...(d.equip.sac_damage ? { sacDamage: d.equip.sac_damage } : {}), ...(d.equip.landfall_pump ? { landfallPump: d.equip.landfall_pump } : {}), ...(d.equip.attack_reveal ? { attackReveal: true } : {}) } } : {}) });
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
    if (s.kicker?.tap && !ids.has(s.kicker.tap)) err(s.id, `sim.kicker.tap ${s.kicker.tap} 가 없음`);
    for (const e of s.effects) if (e.type === 'create_retainers' && !ids.has(e.creature)) err(s.id, `create_retainers.creature ${e.creature} 가 없음`);
  }
  for (const x of world.items) {
    const r = regionOk(x.id, x.at, 'sim.at');
    if (r && TERRAINS[r.terrain].sea) err(x.id, `sim.at ${x.at} 은 바다라 아무도 머물 수 없음`);
  }
  for (const b of world.npcs) {
    for (const x of b.activated ?? []) for (const eff of x.effects) if (eff.type === 'create_token' && !ids.has(eff.creature)) err(b.id, `activated ${x.id}: creature ${eff.creature} 가 없음`);
    for (const x of b.activated ?? [])
      for (const eff of x.effects)
        if (eff.type === 'raise') {
          if (!ids.has(eff.creature)) err(b.id, `activated ${x.id}: creature ${eff.creature} 가 없음`);
          if (eff.faction && !ids.has(eff.faction)) err(b.id, `activated ${x.id}: faction ${eff.faction} 가 없음`);
        }
    for (const eff of b.rally ?? []) if (eff.type === 'token_counter' && !ids.has(eff.creature)) err(b.id, `rally: creature ${eff.creature} 가 없음`);
    if (b.followsOnly && !ids.has(b.followsOnly)) err(b.id, `follows_only ${b.followsOnly} 가 없음`);
    if (b.cantBlockUnless && !ids.has(b.cantBlockUnless)) err(b.id, `cant_block_unless ${b.cantBlockUnless} 가 없음`);
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
// Haste halves the way ([결정] 2026-09-30, ZEN-131), never under an hour.
export function travelHours(a: Region, b: Region, abilities: readonly Ability[] = []) {
  const hours = baseTravelHours(a, b, abilities);
  return abilities.includes('haste') ? Math.max(1, Math.ceil(hours / 2)) : hours;
}

function baseTravelHours(a: Region, b: Region, abilities: readonly Ability[]) {
  const climb = (r: Region) => {
    const need = TERRAINS[r.terrain].requires;
    return need && !abilities.includes(need) ? (r.climbHours ?? 0) : 0;
  };
  const home = (r: Region) => r.top ?? r.parent ?? r.id;
  if (home(a) === home(b)) return 1 + climb(a) + climb(b);
  // One land in two places (a sea and its coast): an hour between them.
  if (a.oneLandWith === b.id || b.oneLandWith === a.id) return 1 + climb(a) + climb(b);
  const road = Math.max(1, Math.ceil(distance(a, b) / TRAVEL_UNITS_PER_HOUR));
  return road + (a.parent ? 1 : 0) + (b.parent ? 1 : 0) + climb(a) + climb(b);
}

// The land a place is: itself, or the one it is one land with (`sim.one_land_with`).
export function landIdOf(world: World, id: string) {
  return world.regions.find((r) => r.id === id)?.oneLandWith ?? id;
}

// A land's basic land types (none for a named land card, or a sea), unless it says its own.
// With `state`: a land the sea has spread over (Spreading Seas, sim/flood.ts) is an Island.
export function landTypes(r: Region, state?: { regions: Record<string, { flooded?: unknown }> }): LandType[] {
  if (state?.regions[r.oneLandWith ?? r.id]?.flooded) return ['island'];
  if (r.landType) return r.notLand ? [] : [r.landType];
  const type = TERRAINS[r.terrain].type;
  return r.nonbasic || r.notLand || !type ? [] : [type];
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
  if (origin.parent && ev.range === 0) return [origin, ...descendantsOf(world, origin.id)];
  return world.regions.filter((r) => !TERRAINS[r.terrain].sea && distance(origin, r) <= ev.range);
}

// The land at the top of a place: itself, or the continent, island or sea its areas (and their
// areas) lie in. An area may hold areas of its own (Riverroot in the Guum Wilds of Bala Ged,
// user decision 2026-10-01).
export function topOf(world: World, r: Region): Region {
  let x = r;
  for (let i = 0; x.parent && i < 8; i++) x = world.regions.find((y) => y.id === x.parent) ?? x;
  return x;
}

// A region's areas, theirs, and so on down.
export function descendantsOf(world: World, id: string): Region[] {
  return world.regions.filter((r) => r.parent === id).flatMap((r) => [r, ...descendantsOf(world, r.id)]);
}

// Whether `id` is `ancestor` or lies in it (at any depth).
export function within(world: World, id: string, ancestor: string) {
  for (let x = world.regions.find((r) => r.id === id), i = 0; x && i < 8; x = x.parent ? world.regions.find((r) => r.id === x!.parent) : undefined, i++) if (x.id === ancestor) return true;
  return false;
}

// Areas inside a region.
// A region's areas, in their map order (east to west).
export function areasOf(world: World, id: string) {
  return world.regions.filter((r) => r.parent === id).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

// A land's realm: its continent (the region it lies in, or the continent that island belongs
// to), the continent's areas, its islands (`map.of`) and their areas.
export function realmOf(world: World, id: string) {
  const r = world.regions.find((x) => x.id === id);
  if (!r) return [];
  const home = topOf(world, r);
  const top = home.of ?? home.id;
  const regions = [top, ...world.regions.filter((x) => x.of === top).map((x) => x.id)];
  return [...regions, ...regions.flatMap((id) => descendantsOf(world, id).map((x) => x.id))];
}

// "굴 드라즈 › 게트 혈족의 영지" for an area ("발라 게드 › 굼 밀림 › 리버루트" for one in an area),
// the name for a region.
export function placeName(world: World, r: Region): string {
  const p = r.parent && world.regions.find((x) => x.id === r.parent);
  return p ? `${placeName(world, p)} › ${r.name}` : r.name;
}
