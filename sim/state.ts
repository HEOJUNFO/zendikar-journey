// Everything that changes while the world runs. Plain JSON so it saves as-is.
import { gameDay, START_MINUTES } from './clock.ts';
import { INITIAL_STATS } from './rules.ts';
import { NEEDS } from './types.ts';
import type { LifeKind, Need, Pace, Schedule, Stats } from './types.ts';
import { homeTile, nearestTile, ownsTile, sameTile, tileCenter, tileLabel } from './tiles.ts';
import type { Tile } from './tiles.ts';
import type { QuellKind } from './quell.ts';
import { josa, shortName } from './text.ts';
import { canStay, spellColors } from './world.ts';
import type { Ability, BondEffect, CreatureType, NpcDef, Pt, Speaker, World } from './world.ts';
import type { Color, Mana } from './mana.ts';

export type TaskKind = LifeKind | 'explore' | 'travel' | 'fight' | 'bond' | 'learn' | 'cast' | 'fetch';

export type Task = {
  kind: TaskKind;
  activity: string;
  emoji: string;
  // Player tasks and forced tasks end here; NPC tasks follow the schedule.
  until?: number;
  // learn: the spell being learned.
  spell?: string;
  // claim: the item being tamed.
  item?: string;
  // fetch: the land given up, and the land sought. store_day / spend_day: the land that
  // keeps days (sim/eons.ts).
  from?: string;
  land?: string;
  // court: the beast whose trust they seek; hire: the mercenary.
  who?: string;
  // bond: whom the land's targeted effect ("target player loses N life") falls on (the player's pick).
  target?: string;
};

export type Actor = {
  id: string;
  name: string;
  kind: 'npc' | 'player';
  // Where they are, or where they set out from while travelling.
  region: string;
  // The tile of it they stand on (sim/tiles.ts): only those on the same tile meet.
  tile?: Tile;
  // `tile`: the tile they are bound for.
  travel?: { to: string; arrive: number; tile?: Tile };
  // When they last stepped onto a tile (a trap hidden there may answer it at that hour).
  steppedAt?: number;
  // Lands (regions) they have bonded with: each gives a mana of its color every turn.
  bonds?: string[];
  // Lands they bonded with this turn = game day, in order: their landfalls.
  landfalls?: { day: number; regions: string[] };
  // When their latest landfall happened (a landfall event may answer it at that hour).
  landfallAt?: number;
  manaSpent?: { day: number; spent: Mana };
  // Mana of any color they have until midnight, beyond their own (Lotus Cobra's landfall).
  bonusMana?: { day: number; any: number };
  // The last game day they lost life or took damage (Luminarch Ascension).
  hurtDay?: number;
  // When they last arrived somewhere (an enter event may answer it at that hour).
  arrivedAt?: number;
  // Spells they drew (came to hold at random) this turn, and the events that already answered
  // it ("if an opponent drew three or more cards this turn").
  drawn?: { day: number; count: number; sprung?: string[] };
  // Spells they cast this turn (not those cast for free), and the events that already answered
  // it ("if an opponent cast three or more spells this turn", Mindbreak Trap).
  cast?: { day: number; count: number; sprung?: string[] };
  // Spells used, held still but not to be cast again until then (by spell; user decision
  // 2026-10-01: as many hours as its mana value, from when its mana was paid). sim/spells.ts.
  used?: Record<string, number>;
  // Secrets of the world they came to know by drawing (sim/knowledge.ts); `day`: true only then.
  knowledge?: { id: string; text: string; day?: number }[];
  // Life total (sim/life.ts), apart from energy; START_LIFE until something changes it.
  life?: number;
  // A being of the sea on land (sim/stranded.ts): since when, and the toughness it has lost
  // drying out (until it is back in the water at 00:00).
  strandedSince?: number;
  dried?: number;
  // The hour they last struck as the attacker (sim/combat.ts `clash`): "attacking creatures"
  // (Arrow Volley Trap).
  attackedAt?: number;
  // The day they last attacked for the first time ("whenever this attacks" goes off once a day:
  // Timbermaw Larva, Beastmaster Ascension; sim/combat.ts `onAttack`).
  attackDay?: number;
  // Lands exiled from them (Devout Lightcaster): their bond broken for good, never to be made again.
  exiledLands?: string[];
  // Game day they last tamed an item: "an artifact entered under their control" (Baloth Cage Trap).
  claimed?: number;
  // Game day they last sought out a land with a fetch land: "searched their library" (Archive Trap).
  searched?: number;
  // The land on top of their library today (Oracle of Mul Daya, sim/oracle.ts).
  topLand?: { day: number; land: string };
  // Lands in their hand (Merfolk Wayfinder): revealed to them, to bond with from afar as their land
  // for a day, whenever they will (sim/oracle.ts `bondFromHand`).
  handLands?: string[];
  // What an item's blessing gives them now (sim/monument.ts): +P/+T, and the abilities it added.
  anthem?: { pt: [number, number]; added: Ability[] };
  // Game day they last gained life (sim/life.ts).
  lifeGained?: number;
  // Game day they were last turned down seeking to make someone follow them (a beast they
  // courted, one they asked to serve them): Summoning Trap's "creature spell countered".
  refused?: number;
  stats: Stats;
  // Power / toughness (the player starts at 1/1; missing in old saves = 1/1).
  pt?: Pt;
  // "+N/+N and trample until end of turn": gone at `until` (00:00).
  boost?: { until: number; pt: Pt; trample: boolean };
  // Auras on them (spells that stay until they die).
  // `base`: base power/toughness it sets (Gigantiform): the latest such aura wins.
  // `added`: the abilities it gave that they didn't have (they go with it).
  // Taken nowhere by `by`'s enchantment `spell` (Journey to Nowhere, sim/nowhere.ts): out of
  // the world until it is gone.
  nowhere?: { by: string; spell: string };
  auras?: { spell: string; name: string; by: string; pt: Pt; base?: Pt; doubleLifeOnHit: boolean; added?: Ability[]; noUntap?: boolean; regen?: string; nowhere?: string }[];
  // Combat damage taken this turn; it wears off when the turn ends (00:00).
  wounds?: { day: number; amount: number };
  // Damage prevented for them today, still to come (Noble Vestige's ward, sim/tapper.ts).
  shield?: { day: number; amount: number };
  // Every land they have bonded with: those they hold no longer are their land graveyard
  // (Grim Discovery, sim/discovery.ts).
  everBonded?: string[];
  // Haste given by the scent of blood this hour (Bloodghast, sim/bloodghast.ts).
  bloodHaste?: boolean;
  // Those who dealt them combat damage this turn (Inferno Trap: "dealt damage by two or more
  // creatures this turn"). `sprung`: the `hurt` events they set off today.
  hurtBy?: { day: number; ids: string[]; sprung?: string[] };
  // Who they'll attack on sight this turn (they were attacked, or turned hostile).
  // `struck`: those of them who fell on them first (not yet foes when the blow fell): a fight they
  // defend, not one they started (one who can't block won't join their master's, Hagra Crocodile).
  foes?: { day: number; ids: string[]; struck?: string[] };
  // The color they sealed today (Iona, sim/seal.ts): their opponents can't cast spells of it.
  seal?: { day: number; color: Color };
  // The day a color of theirs is sealed against them (sim/seal.ts): none of their powers then.
  sealedOut?: number;
  // Protection from these colors (a card's, e.g. Malakir Bloodwitch: white).
  protection?: Color[];
  // Protection from a color until a time (Kabira Evangel's rally: until midnight).
  warded?: { color: Color; until: number }[];
  // The home the world gave them when last seen (sim/state.ts `syncWorld`): if the world moves
  // it, they go there.
  home?: string;
  // The day their "when this enters" last answered: once a day, on the first arrival (user
  // decision 2026-09-30).
  enteredDay?: number;
  // Whom they serve: they are that one's retainer (sim/retainers.ts).
  master?: string;
  // Abilities they have lost for a while ("loses defender until end of turn").
  lost?: { ability: Ability; until: number }[];
  // Seized (Roil Elemental, Sorin): held by their master's power, not their will. They can't
  // turn on their master; only the master's end (or `seizedUntil`) frees them. The player
  // seized can only wait.
  seized?: boolean;
  seizedUntil?: number;
  // Whom they served before a hold with an end (`seizedUntil`): they go back to them after.
  seizedFrom?: string;
  // A flyer's answer, for the day, to one who can't fly attacking them (sim/combat.ts): out
  // of their reach until `until` (evade), or standing to fight.
  evasions?: { from: string; evade: boolean; until: number }[];
  // Lands they sought out with a fetch land: gone from their "library". Kept for when
  // exploring can turn things up (fewer empty searches, as MTG's deck thinning).
  fetched?: string[];
  // Their retainers who died serving them: their "graveyard" of creatures.
  fallen?: string[];
  // Lands they tapped for an ability today: they give no mana until 00:00.
  landsTapped?: { day: number; ids: string[] };
  // Days left in a land that keeps them (Magosi's eon counters), by land (sim/eons.ts).
  eons?: Record<string, number>;
  // The game day they skip ("skip your next turn"): out of time all that day.
  skipDay?: number;
  // When they came into play (born, raised or brought back), for "entered this turn".
  enteredAt?: number;
  // When they last came to serve their master (hired, won over, pledged): sim/bounce.ts.
  joinedAt?: number;
  // +1/+1 counters on them: for good, until they die.
  plusCounters?: number;
  // Abilities they have only for a while ("gains flying until end of turn"), in `abilities`
  // until `until`.
  granted?: { ability: Ability; until: number }[];
  // "+N/+N until end of turn" from lands and the like, on top of `boost` (landfall's), until `until`.
  pumps?: { pt: Pt; until: number }[];
  // Guul Draz Specter's +P/+T while a foe beside them holds no spell (sim/combat.ts `refreshEmptyHand`).
  emptyHand?: Pt;
  // Spells they know (world/entities/spells): their hand.
  spells?: string[];
  // Spells they let go of (discarded): their graveyard.
  graveyard?: string[];
  // Spells exiled from their graveyard (Ravenous Trap): theirs to use never again, not even by
  // learning them anew (user decision 2026-10-01). The graveyard is had-it-and-may-again.
  exiled?: string[];
  // How many went into their graveyard today (spells let go of, retainers who died serving them):
  // Ravenous Trap's "three or more cards put into their graveyard this turn".
  buried?: { day: number; count: number };
  // A planeswalker's loyalty now, and the game day they last used a loyalty ability.
  loyalty?: number;
  loyaltyDay?: number;
  // A planeswalker who left this plane (with `dead` set, so the world lets them go).
  left?: boolean;
  // What they think of others, latest impression each (sim/relations.ts).
  relations?: Record<string, { name: string; text: string; t: number }>;
  dead?: { at: number; cause: string };
  // Nissa's Chosen (sim/revive.ts): dying, they go to no graveyard and wake at home after `revives`
  // days (at `reviveAt`).
  revives?: number;
  reviveAt?: number;
  // Hour of their last combat exchange (one per hour).
  lastClash?: number;
  pace: Pace;
  abilities: Ability[];
  // Stats they live by; missing in saves from before needs existed (= all).
  needs?: Need[];
  task?: Task;
  // Overrides the schedule or the player's task (e.g. collapsed from exhaustion).
  forced?: Task;
  // Tapped: can't move or act until then (an untap).
  boundUntil?: number;
  schedule?: Schedule; // npc
  background?: string; // player
};

// What falls on the one picked: a land's bonding effect, a burst of damage (Valakut), or a
// spell an NPC casts (sim/spells.ts).
export type Choice = { by: string; land: string; effect: ChoiceEffect; candidates: string[]; optional?: boolean; t: number };
export type ChoiceEffect = BondEffect | { type: 'damage'; amount: number } | { type: 'cast'; spell: string; free?: boolean; second?: boolean } | { type: 'follow' } | { type: 'rally'; source: string } | { type: 'seize' } | { type: 'pledge'; from: string } | { type: 'evade'; from: string } | { type: 'discard'; cause: string; count?: number } | { type: 'pilfer'; source: string; target: string } | { type: 'pour'; source: string } | { type: 'demolish'; spell: string } | { type: 'escape'; spell: string; any?: boolean } | { type: 'torch'; source: string } | { type: 'lift'; source: string } | { type: 'outfit'; source: string } | { type: 'gem'; item: string; amount: number } | { type: 'flood'; spell: string } | { type: 'lure'; source: string } | { type: 'toll'; source: string } | { type: 'shortcut'; source: string } | { type: 'discovery'; spell: string; kind: 'creature' | 'land' } | { type: 'sacrament'; spell: string; target: string; left: number } | { type: 'sacrifice'; item: string } | { type: 'destroy'; kind?: CreatureType; kicker?: string; flying?: boolean } | { type: 'drain_grow'; life: number; counters: number } | { type: 'crush'; spell: string; left: number; first: boolean } | { type: 'quell'; source: string } | { type: 'quelled'; kind: QuellKind; source: string } | { type: 'return_lands'; item: string; left: number } | { type: 'search'; source: string } | { type: 'tide'; source: string } | { type: 'bind'; source: string } | { type: 'engulf'; source: string } | { type: 'harrow'; spell: string; left: number; given: boolean; tapped?: boolean } | { type: 'ward'; source: string } | { type: 'hook'; source: string } | { type: 'shatter' } | { type: 'counter'; spell: string; joiner: string; master: string; how: string } | { type: 'counter_cast'; spell: string; caster: string; cast: string; target: string; kicked: boolean } | { type: 'exile'; source: string } | { type: 'strike'; item: string; creature: string };

export type Condition = {
  label: string;
  until: number;
  blocksTravel: boolean;
  // A tapped land: nothing can be explored or worked there until it untaps (`until`).
  tapped?: boolean;
  source: string;
};

export type RegionState = {
  conditions: Condition[];
  // Destroyed land: in ruins for everyone until `until` (a midnight, DESTROYED_DAYS on).
  // Saves from before it came back have no `until` (sim/step.ts `ruinsUntil`).
  destroyed?: { at: number; source: string; until?: number };
  // A blaze counter (Obsidian Fireheart): it burns those bonded with it each 00:00, until the
  // land is destroyed (sim/blaze.ts).
  blaze?: { by: string; at: number };
  // Spreading Seas on it: an Island until the aura or the land is destroyed (sim/flood.ts).
  flooded?: { by: string; spell: string };
};

export type LogKind =
  | 'omen'
  | 'event'
  | 'effect'
  | 'condition'
  | 'move'
  | 'arrive'
  | 'activity'
  | 'meet'
  | 'status'
  | 'combat'
  | 'death'
  | 'player'
  | 'speech'
  | 'narration'
  | 'system';

export type LogEntry = {
  id: number;
  t: number;
  kind: LogKind;
  text: string;
  regions: string[];
  scope: 'region' | 'world';
  actors: string[];
  // Whether the player character witnessed it (always true in observer mode).
  seen: boolean;
};

export type GmPlan = {
  day: number;
  source: 'none' | 'llm';
  fires: { eventId: string; hour: number }[];
  // Activated abilities characters use today (chosen by the morning LLM).
  uses?: { being: string; ability: string; target: string; hour: number }[];
  note?: string;
};

export type Mode = 'observer' | 'character';

export type State = {
  version: 1;
  seed: number;
  rng: number;
  minutes: number;
  mode: Mode;
  playerId?: string;
  // The player character died: their life is over.
  over?: { at: number; cause: string };
  // Those who won the game ("you win the game", sim/win.ts): the world's winners. The game
  // goes on; each is named once. `by`: what won it for them (e.g. the Felidar Sovereign).
  winners?: { id: string; name: string; at: number; by: string }[];
  actors: Record<string, Actor>;
  // Characters born in play (MTG tokens, e.g. Kalitas's risen vampires), who have no entity
  // file: what they live by.
  tokens?: Record<string, NpcDef>;
  // Saves from before every character was an actor: their mana and tap, moved onto the
  // actor by syncWorld.
  beings?: Record<string, { id: string; manaSpent?: { day: number; spent: Mana }; boundUntil?: number }>;
  regions: Record<string, RegionState>;
  events: Record<string, { lastFired?: number }>;
  // Omened events that go off at `at`, with who set them off.
  pending: { eventId: string; at: number; by: string[] }[];
  gm: GmPlan;
  // Last day the morning LLM planned the day's events and powers.
  preparedDay: number;
  met: { day: number; pairs: string[] };
  // NPC conversations held today (the LLM writes them; capped per day).
  talks?: { day: number; count: number };
  // Items (sim/items.ts): who holds each, and the charge counters on it.
  // `gone`: sacrificed (Eldrazi Monument), no longer in the world.
  // An item's state: its owner; carried (equipment, with its owner wherever they go), where it
  // lies dropped (its owner died); on whom it is equipped and what that gave them.
  items?: Record<string, { name: string; owner?: string; counters: number; gone?: boolean; carried?: boolean; lies?: { region: string; tile?: Tile }; bearer?: string; added?: Ability[]; since?: number; struck?: string[] }>;
  // Extra turns (sim/eons.ts): on that game day only `actor` moves; everyone else is out of time.
  extraDays?: { actor: string; day: number }[];
  // Picks an NPC owes (a land's targeted effect as they bonded with it): the LLM makes them
  // after the hour (sim/run.ts), from these candidates.
  // `optional`: they may pick no one ("you may").
  choices?: Choice[];
  // Until when Blood Seeker has counted creatures coming under someone's control (sim/seeker.ts).
  seekScan?: number;
  // Where each wandering place (sim/wander.ts) is now, the stop it is heading for (or the one
  // it last reached, waiting for the LLM to pick the next).
  wanderers?: Record<string, { x: number; y: number; to?: string; at?: string }>;
  // Arrow volleys loosed (sim/step.ts): how the damage falls among the attackers is the LLM's
  // division, as the trap, after the hour (sim/run.ts `volleys`).
  volleys?: { event: string; amount: number; by: string[]; region: string; t: number }[];
  // Fires loosed (Inferno Trap, sim/step.ts): which of those who hurt `by` it falls on is the
  // LLM's pick, as the trap, after the hour (sim/run.ts `burns`).
  burns?: { event: string; amount: number; color?: Color; by: string[]; region: string; t: number }[];
  // Summoning traps sprung (sim/step.ts): which of the creatures looked at is drawn there is
  // the LLM's pick, as the trap, after the hour (sim/run.ts `summons`).
  summons?: { event: string; creatures: string[]; by: string[]; region: string; t: number }[];
  // Whiplash traps sprung this hour: whom (up to `count`, of those there) the LLM, as the trap, flings.
  bounces?: { event: string; count: number; by: string[]; region: string; tile?: Tile; t: number }[];
  // A flyer NPC attacked by one who can't fly: whether they take to the air is asked of the LLM
  // after the hour (sim/run.ts); the blow waits until then.
  evades?: { by: string; from: string; t: number }[];
  // "You control target player during that player's next turn" (Sorin): the target is seized by
  // `by` from `from` until `until` (their next day), at the upkeep (sim/retainers.ts).
  possessions?: { target: string; by: string; from: number; until: number }[];
  // The dead exiled from a graveyard: erased from the world for good (sim/erase.ts), never made
  // anew from their card.
  // Life gained since the hour began: who and where (sim/punish.ts).
  lifeGains?: { id: string; region: string }[];
  erased?: string[];
  // Picks the player owes (an Ally's rally in their party): they answer with a "choose" action
  // before anything else (sim/run.ts).
  asks?: Choice[];
  nextLogId: number;
  log: LogEntry[];
  // Everyone stands on their own tile of their home (saves from before stood on its middle).
  spread?: number;
};

export const PLAYER_ID = 'player';
// An ordinary person. Grows with training, gear and magic (when cards bring them).
export const PLAYER_PT: Pt = [1, 1];
const LOG_LIMIT = 3000;

export type NewGame = {
  seed?: number;
  mode: Mode;
  player?: { name: string; background: string; region: string };
};

export function newState(world: World, opts: NewGame): State {
  const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
  const state: State = {
    version: 1,
    seed,
    rng: seed,
    minutes: START_MINUTES,
    mode: opts.mode,
    actors: {},
    regions: Object.fromEntries(world.regions.map((r) => [r.id, { conditions: [] }])),
    events: Object.fromEntries(world.events.map((e) => [e.id, {}])),
    pending: [],
    gm: { day: -1, source: 'none', fires: [] },
    preparedDay: -1,
    met: { day: -1, pairs: [] },
    nextLogId: 0,
    log: [],
  };
  for (const npc of world.npcs) {
    state.actors[npc.id] = { ...npcActor(npc), tile: homeTile(world, npc) };
    refreshHand(state, world, npc);
  }
  state.spread = SPREAD;
  if (opts.mode === 'character') {
    if (!opts.player) throw new Error('character mode needs a player');
    state.playerId = PLAYER_ID;
    state.actors[PLAYER_ID] = {
      id: PLAYER_ID,
      name: opts.player.name,
      kind: 'player',
      region: opts.player.region,
      stats: { ...INITIAL_STATS },
      pt: [...PLAYER_PT],
      pace: 'normal',
      abilities: [],
      needs: [...NEEDS],
      background: opts.player.background,
    };
  }
  for (const a of Object.values(state.actors)) settleTile(world, a);
  return state;
}

// A save made before new cards came in: add the new characters, regions and events.
// Characters whose home is gone are left where they are.
export function syncWorld(state: State, world: World) {
  for (const r of world.regions) state.regions[r.id] ??= { conditions: [] };
  for (const e of world.events) state.events[e.id] ??= {};
  for (const npc of world.npcs) {
    if (state.erased?.includes(npc.id)) continue;
    const old = state.beings?.[npc.id];
    const a = (state.actors[npc.id] ??= { ...npcActor(npc), tile: homeTile(world, npc), manaSpent: old?.manaSpent, boundUntil: old?.boundUntil });
    // Saves from when some characters stayed at home without a day of their own.
    if ((a.kind as string) === 'being') a.kind = 'npc';
    // Their own, and any they have for a while (sim/abilities.ts grantAbility).
    a.abilities = [...new Set([...npc.abilities, ...(a.granted ?? []).map((g) => g.ability)])];
    a.needs = [...npc.needs];
    a.pt = [...npc.pt];
    refreshHand(state, world, npc);
  }
  delete state.beings;
  // Saves from when a risen one's master was kept on its definition.
  for (const [id, def] of Object.entries(state.tokens ?? {})) {
    const old = (def as { master?: string }).master;
    if (old && state.actors[id] && !state.actors[id].master) state.actors[id].master = old;
  }
  // The map changed under the save (a region gone, a character back to draft): characters no
  // longer in the world leave the save; those standing where nothing is any more go home, or
  // to the first land they can stay on.
  const exists = (id: string) => world.regions.some((r) => r.id === id);
  // A wandering place kept where the map no longer has its roads (the map redrawn): back to its start.
  for (const [id, w] of Object.entries(state.wanderers ?? {})) {
    const r = world.regions.find((x) => x.id === id);
    if (!r?.wanders) {
      delete state.wanderers![id];
      continue;
    }
    const points = [r, ...r.wanders.stops];
    const span = Math.max(...points.flatMap((p) => points.map((q) => Math.hypot(p.x - q.x, p.y - q.y))));
    if (Math.hypot(w.x - r.x, w.y - r.y) > span * 1.5 + 1 || (w.to && !r.wanders.stops.some((x) => x.name === w.to))) state.wanderers![id] = { x: r.x, y: r.y };
  }
  // Regions and events gone from the world leave no state behind.
  for (const id of Object.keys(state.regions)) if (!exists(id)) delete state.regions[id];
  for (const id of Object.keys(state.events)) if (!world.events.some((e) => e.id === id)) delete state.events[id];
  for (const a of Object.values(state.actors)) {
    const def = world.npcs.find((n) => n.id === a.id) ?? state.tokens?.[a.id];
    if (a.kind === 'npc' && !def) {
      delete state.actors[a.id];
      continue;
    }
    // The world moved their home (a user decision): they go there, unless they serve someone
    // (they stay at their master's side). A save from before this was kept counts as moved when
    // they stand elsewhere.
    if (a.kind === 'npc' && def && !a.dead && world.npcs.includes(def as NpcDef) && a.home !== def.home) {
      if (!a.master && a.region !== def.home && exists(def.home)) {
        a.region = def.home;
        a.tile = homeTile(world, def as NpcDef);
        a.travel = undefined;
        a.task = undefined;
        a.schedule = undefined;
      }
      a.home = def.home;
    }
    if (exists(a.region) && (!a.travel || exists(a.travel.to))) continue;
    const home = def && exists(def.home) ? def.home : world.regions.find((r) => canStay(r, a.abilities))?.id;
    if (!home) {
      if (a.kind === 'npc') delete state.actors[a.id];
      continue;
    }
    a.region = home;
    a.travel = undefined;
    a.schedule = undefined;
  }
  // Saves from when everyone in a land stood on its middle tile, or before their own tiles last
  // moved (the lore's places): those at home, on their own.
  if (state.spread !== SPREAD) {
    for (const a of Object.values(state.actors)) {
      const def = world.npcs.find((n) => n.id === a.id);
      if (def && !a.dead && !a.master && !a.travel && a.region === def.home) a.tile = homeTile(world, def);
    }
    state.spread = SPREAD;
  }
  // Saves from before tiles, and tiles the map took away: the nearest tile of their land.
  for (const a of Object.values(state.actors)) {
    settleTile(world, a);
    if (a.travel?.tile && !ownsTile(world, a.travel.to, a.travel.tile)) delete a.travel.tile;
  }
}

// `a` on a tile of their land: the one they are on, or the nearest to it.
export function settleTile(world: World, a: Actor) {
  if (ownsTile(world, a.region, a.tile)) return;
  a.tile = nearestTile(world, a.region, a.tile && tileCenter(a.tile));
}

// A planeswalker's loyalty (first time) and their hand: every spell of their colors they
// haven't held yet (new spell cards join it).
function refreshHand(state: State, world: World, npc: NpcDef) {
  const a = state.actors[npc.id];
  if (npc.loyalty !== undefined && a.loyalty === undefined) a.loyalty = npc.loyalty;
  const held = new Set([...(a.spells ?? []), ...(a.graveyard ?? []), ...(a.exiled ?? [])]);
  for (const s of world.spells)
    if (!held.has(s.id) && spellColors(s).some((c) => npc.knowsColors?.includes(c))) a.spells = [...(a.spells ?? []), s.id];
}

function npcActor(npc: NpcDef): Actor {
  return {
    id: npc.id,
    name: npc.name,
    kind: 'npc',
    region: npc.home,
    home: npc.home,
    stats: { ...INITIAL_STATS },
    pt: [...npc.pt],
    pace: 'normal',
    abilities: [...npc.abilities],
    needs: [...npc.needs],
    ...(npc.protection?.length ? { protection: [...npc.protection] } : {}),
    ...(npc.revivesAfter ? { revives: npc.revivesAfter } : {}),
  };
}

export function needsOf(a: Actor): readonly Need[] {
  return a.needs ?? NEEDS;
}

// Why the land can't be used (explored, worked) now, or null.
export function landUnusable(state: State, regionId: string): string | null {
  const rs = state.regions[regionId];
  if (rs?.destroyed) return '땅이 부서졌다';
  return rs?.conditions.find((c) => c.tapped)?.label ?? null;
}

// The definition an NPC lives by: from world/entities, or one born in play (state.tokens).
export function npcDef(state: State, world: World, id: string): NpcDef | undefined {
  return world.npcs.find((n) => n.id === id) ?? state.tokens?.[id];
}

// Anyone the player can talk to or fight: an NPC, from a file or born in play.
export function speakerDef(state: State, world: World, id: string): Speaker | undefined {
  return npcDef(state, world, id);
}

export function isPerson(a: Actor) {
  return a.kind === 'npc';
}

export function player(state: State) {
  return state.playerId ? state.actors[state.playerId] : undefined;
}

export function alive(state: State) {
  return Object.values(state.actors).filter((a) => !a.dead);
}

// Out of time at `t`: skipping this day, or it is someone else's extra day (sim/eons.ts).
// They stand where they are, untouched and unchanged, until the day ends.
export function outOfTime(state: State, a: Actor, t = state.minutes) {
  // Taken nowhere (Journey to Nowhere, sim/nowhere.ts): as one out of time, until they come back.
  if (a.nowhere) return true;
  const day = gameDay(t);
  if (a.skipDay === day) return true;
  const extra = state.extraDays?.find((x) => x.day === day);
  return !!extra && extra.actor !== a.id;
}

// `n` more went into `a`'s graveyard at `t` (sim/state.ts `buried`).
export function buryCount(a: Actor, n: number, t: number) {
  if (n <= 0) return;
  const day = gameDay(t);
  a.buried = { day, count: (a.buried?.day === day ? a.buried.count : 0) + n };
}
export function buriedToday(a: Actor, t: number) {
  return a.buried?.day === gameDay(t) ? a.buried.count : 0;
}

// Living actors standing in a region (not on the road, not out of time).
// Raised when the places people live in their homes move (sim/tiles.ts homeTile): a save
// puts those at home on their own tile again. 3: the lands laid out again by the lore
// (2026-10-01: areas in areas, the continents moved).
const SPREAD = 3;

// Those standing on `tile` of `regionId` (null: anywhere in it), not on the way, not out of time.
export function present(state: State, regionId: string, tile: Tile | undefined | null) {
  return alive(state).filter((a) => a.region === regionId && (tile === null || sameTile(a.tile, tile)) && !a.travel && !outOfTime(state, a));
}

// Those standing with `a`: on their tile.
export function here(state: State, a: Actor) {
  return present(state, a.region, a.tile);
}

// Why `b` isn't there for `a` to reach, or null if they stand together: elsewhere on the same
// land (on another tile), or not here at all.
export function awayText(world: World, a: Actor, b: Actor) {
  if (together(a, b)) return null;
  const name = josa(shortName(b.name), '은', '는');
  if (!b.travel && b.region === a.region && b.tile) return `${name} 이 땅의 다른 곳(${tileLabel(world, b.region, b.tile)})에 있다.`;
  return `${name} 여기 없다.`;
}

// Whether `b` stands with `a` (the same tile of the same land, not on the way).
export function together(a: Actor, b: Actor) {
  return a.region === b.region && sameTile(a.tile, b.tile) && !a.travel && !b.travel;
}

// Power / toughness now, with their +1/+1 counters, this turn's boosts and their auras.
// Whether they have `ability` now (not lost for the while).
export function hasAbility(a: Actor, ability: Ability, t: number) {
  // A color of theirs sealed: no powers (living in the sea is what they are, not a power).
  if (a.sealedOut === gameDay(t) && ability !== 'aquatic') return false;
  return a.abilities.includes(ability) && !a.lost?.some((x) => x.ability === ability && x.until > t);
}

// Whether spells and abilities may pick them ("target"): not with shroud (Sphinx of Jwar
// Isle), not even their own side's. Fights are no targeting: they may still be attacked.
// `colors`: the colors of what picks them (a spell, a being, a land); protection from any of
// them keeps them out of reach too.
export function targetable(a: Actor, t: number, colors: readonly string[] = []) {
  return !hasAbility(a, 'shroud', t) && !protectedFrom(a, colors, t);
}

// Protection from one of `colors` (while their powers aren't sealed): the first one, if any.
export function protectedFrom(a: Actor, colors: readonly string[], t: number): Color | undefined {
  if (a.sealedOut === gameDay(t)) return undefined;
  return (a.protection ?? []).find((c) => colors.includes(c)) ?? a.warded?.find((w) => w.until > t && colors.includes(w.color))?.color;
}

// Why they can't be picked (shroud, protection), for the one trying.
export function untargetableText(a: Actor, t: number, colors: readonly string[] = []) {
  const c = protectedFrom(a, colors, t);
  const name = josa(shortName(a.name), '은', '는');
  return c ? `${name} ${COLOR_WORDS[c]}으로부터 보호받아 대상이 될 수 없다.` : `${name} 방어막에 싸여 대상이 될 수 없다.`;
}
const COLOR_WORDS: Record<Color, string> = { W: '백색', U: '청색', B: '흑색', R: '적색', G: '녹색' };

export function ptOf(a: Actor): Pt {
  let [p, t] = [...(a.auras ?? [])].reverse().find((x) => x.base)?.base ?? a.pt ?? PLAYER_PT;
  if (a.plusCounters) [p, t] = [p + a.plusCounters, t + a.plusCounters];
  for (const x of [...(a.boost ? [a.boost] : []), ...(a.pumps ?? []), ...(a.auras ?? [])]) [p, t] = [p + x.pt[0], t + x.pt[1]];
  if (a.anthem) [p, t] = [p + a.anthem.pt[0], t + a.anthem.pt[1]];
  if (a.emptyHand) [p, t] = [p + a.emptyHand[0], t + a.emptyHand[1]];
  if (a.dried) t -= a.dried;
  // Power below zero deals no damage: count it as 0 (Lethargy Trap).
  return [Math.max(0, p), t];
}

export function addLog(
  state: State,
  e: { kind: LogKind; text: string; regions?: string[]; scope?: 'region' | 'world'; actors?: string[]; t?: number },
): LogEntry {
  const regions = e.regions ?? [];
  const actors = e.actors ?? [];
  const scope = e.scope ?? 'region';
  const p = player(state);
  const seen =
    state.mode === 'observer' ||
    scope === 'world' ||
    (!!p && (actors.includes(p.id) || (!p.travel && regions.includes(p.region))));
  const entry: LogEntry = { id: state.nextLogId++, t: e.t ?? state.minutes, kind: e.kind, text: e.text, regions, scope, actors, seen };
  state.log.push(entry);
  if (state.log.length > LOG_LIMIT) state.log.splice(0, state.log.length - LOG_LIMIT);
  return entry;
}

// Deterministic randomness (mulberry32) kept in the state so a save replays the same way.
export function random(state: State) {
  let a = (state.rng = (state.rng + 0x6d2b79f5) | 0);
  a = Math.imul(a ^ (a >>> 15), 1 | a);
  a = (a + Math.imul(a ^ (a >>> 7), 61 | a)) ^ a;
  return ((a ^ (a >>> 14)) >>> 0) / 4294967296;
}
